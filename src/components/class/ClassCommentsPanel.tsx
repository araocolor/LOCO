"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Avatar from "@/components/ui/Avatar";

export interface ClassCommentProfile {
  id: string;
  nickname: string;
  profile_image_url: string | null;
}

export interface ClassComment {
  id: string;
  class_id: string;
  profile_id: string;
  parent_id: string | null;
  content: string;
  like_count: number;
  is_deleted: boolean;
  deleted_at: string | null;
  created_at: string;
  profile: ClassCommentProfile | null;
}

interface ClassCommentsPanelProps {
  classId: string;
  mode: "sheet" | "full";
  open?: boolean;
  onClose?: () => void;
}

const QUICK_REACTIONS = ["❤️", "😍", "🥰", "😊", "😂", "🔥", "✨", "👍", "🎉", "💯"];

function formatCommentTime(value: string) {
  const created = new Date(value).getTime();
  const diffMinutes = Math.max(0, Math.floor((Date.now() - created) / 60000));

  if (diffMinutes < 1) return "방금";
  if (diffMinutes < 60) return `${diffMinutes}분전`;
  if (diffMinutes < 60 * 24) return `${Math.floor(diffMinutes / 60)}시간전`;
  if (diffMinutes < 60 * 24 * 30) return `${Math.floor(diffMinutes / (60 * 24))}일전`;

  const d = new Date(value);
  return `${String(d.getMonth() + 1).padStart(2, "0")}.${String(d.getDate()).padStart(2, "0")}`;
}

function displayName(comment: ClassComment) {
  return comment.profile?.nickname ?? "사용자";
}

function CommentItem({
  comment,
  replyCount,
  compact = false,
  onReply,
  onOpenReplies,
}: {
  comment: ClassComment;
  replyCount?: number;
  compact?: boolean;
  onReply: (comment: ClassComment) => void;
  onOpenReplies?: (comment: ClassComment) => void;
}) {
  const name = displayName(comment);

  return (
    <div className={`flex gap-3 ${compact ? "py-3" : "py-4"}`}>
      <Avatar src={comment.profile?.profile_image_url ?? null} nickname={name} size={compact ? 34 : 42} />
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <span className="font-semibold text-gray-500 text-sm">{name}</span>
          <span className="text-xs text-gray-400">{formatCommentTime(comment.created_at)}</span>
        </div>
        <p className={`${compact ? "text-sm" : "text-[15px]"} text-gray-950 whitespace-pre-wrap leading-relaxed mt-1`}>
          {comment.is_deleted ? "삭제된 댓글입니다." : comment.content}
        </p>
        <div className="flex items-center gap-3 text-xs text-gray-500 mt-1.5">
          {!comment.is_deleted && (
            <button type="button" onClick={() => onReply(comment)} className="font-medium">
              답글 달기
            </button>
          )}
          {comment.like_count > 0 && (
            <span className="text-red-500 font-semibold">♥ {comment.like_count}</span>
          )}
        </div>
        {!!replyCount && replyCount > 0 && onOpenReplies && (
          <button
            type="button"
            onClick={() => onOpenReplies(comment)}
            className="mt-3 text-xs font-semibold text-gray-500"
          >
            답글 {replyCount}개 보기
          </button>
        )}
      </div>
    </div>
  );
}

export default function ClassCommentsPanel({ classId, mode, open = true, onClose }: ClassCommentsPanelProps) {
  const router = useRouter();
  const [comments, setComments] = useState<ClassComment[]>([]);
  const [loading, setLoading] = useState(false);
  const [input, setInput] = useState("");
  const [replyTarget, setReplyTarget] = useState<ClassComment | null>(null);
  const [threadTarget, setThreadTarget] = useState<ClassComment | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [sheetFull, setSheetFull] = useState(false);
  const touchStartY = useRef(0);
  const shouldShow = mode === "full" || open;

  const rootComments = useMemo(() => comments.filter((comment) => !comment.parent_id), [comments]);
  const repliesByParent = useMemo(() => {
    const map = new Map<string, ClassComment[]>();
    comments.forEach((comment) => {
      if (!comment.parent_id) return;
      map.set(comment.parent_id, [...(map.get(comment.parent_id) ?? []), comment]);
    });
    return map;
  }, [comments]);

  useEffect(() => {
    if (!shouldShow) return;

    let cancelled = false;
    async function loadComments() {
      setLoading(true);
      try {
        const res = await fetch(`/api/classes/${classId}/comments`, { method: "GET" });
        const data = await res.json().catch(() => ({}));
        if (!cancelled && res.ok) setComments(data.comments ?? []);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    void loadComments();
    return () => {
      cancelled = true;
    };
  }, [classId, shouldShow]);

  useEffect(() => {
    if (mode !== "sheet") return;
    if (!open) {
      queueMicrotask(() => {
        setSheetFull(false);
        setReplyTarget(null);
        setThreadTarget(null);
      });
    }
  }, [mode, open]);

  async function submitComment(parentId: string | null = replyTarget?.id ?? null, value = input) {
    const content = value.trim();
    if (!content || submitting) return;

    setSubmitting(true);
    try {
      const res = await fetch(`/api/classes/${classId}/comments`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content, parent_id: parentId }),
      });

      if (res.status === 401) {
        router.push(`/login?next=/classes/${classId}`);
        return;
      }

      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        alert(data.error ?? "댓글 등록에 실패했습니다.");
        return;
      }

      setComments((prev) => [...prev, data.comment]);
      setInput("");
      setReplyTarget(null);
    } finally {
      setSubmitting(false);
    }
  }

  function handleTouchEnd(e: React.TouchEvent<HTMLDivElement>) {
    const diff = touchStartY.current - e.changedTouches[0].clientY;
    if (diff > 45) setSheetFull(true);
    if (diff < -45 && sheetFull) setSheetFull(false);
    if (diff < -80 && !sheetFull) onClose?.();
  }

  function renderEmpty() {
    if (loading) {
      return <p className="text-sm text-gray-400 text-center mt-16">댓글을 불러오는 중...</p>;
    }
    return <p className="text-sm text-gray-400 text-center mt-16">아직 댓글이 없습니다.</p>;
  }

  function renderCommentList(compact = false) {
    if (rootComments.length === 0) return renderEmpty();

    return (
      <div className="divide-y divide-gray-100">
        {rootComments.map((comment) => {
          const replyCount = repliesByParent.get(comment.id)?.length ?? 0;
          return (
            <CommentItem
              key={comment.id}
              comment={comment}
              replyCount={replyCount}
              compact={compact}
              onReply={setReplyTarget}
              onOpenReplies={setThreadTarget}
            />
          );
        })}
      </div>
    );
  }

  function renderComposer(placeholder = "댓글을 남겨보세요") {
    return (
      <div className="border-t border-gray-100 bg-white px-4 pt-2 pb-[max(16px,env(safe-area-inset-bottom))]">
        <div className="flex gap-4 overflow-x-auto pb-2 text-2xl">
          {QUICK_REACTIONS.map((reaction) => (
            <button
              type="button"
              key={reaction}
              onClick={() => setInput((value) => `${value}${reaction}`)}
              className="flex-shrink-0"
              aria-label={`${reaction} 입력`}
            >
              {reaction}
            </button>
          ))}
        </div>
        {replyTarget && (
          <div className="mb-2 flex items-center justify-between rounded-full bg-gray-100 px-3 py-1.5 text-xs text-gray-600">
            <span>{displayName(replyTarget)}님에게 답글</span>
            <button type="button" onClick={() => setReplyTarget(null)} className="font-semibold">
              취소
            </button>
          </div>
        )}
        <div className="flex gap-2">
          <input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder={placeholder}
            className="min-w-0 flex-1 rounded-2xl border border-gray-200 px-4 py-3 text-sm outline-none focus:border-gray-400"
          />
          <button
            type="button"
            onClick={() => void submitComment()}
            disabled={submitting || input.trim().length === 0}
            className="rounded-2xl bg-gray-950 px-5 py-3 text-sm font-semibold text-white disabled:opacity-40"
          >
            등록
          </button>
        </div>
      </div>
    );
  }

  function renderReplyThread() {
    if (!threadTarget) return null;
    const replies = repliesByParent.get(threadTarget.id) ?? [];

    return (
      <div className="fixed inset-0 z-[90] mx-auto flex max-w-xl flex-col bg-white">
        <div className="flex h-14 items-center border-b border-gray-100 px-4">
          <button type="button" onClick={() => setThreadTarget(null)} className="text-2xl text-gray-700" aria-label="닫기">
            ×
          </button>
          <h2 className="flex-1 text-center text-lg font-bold text-gray-900">답글</h2>
          <div className="w-6" />
        </div>
        <div className="bg-gray-100 px-4">
          <CommentItem comment={threadTarget} compact onReply={setReplyTarget} />
        </div>
        <div className="flex-1 overflow-y-auto px-4">
          {replies.length === 0 ? renderEmpty() : replies.map((reply) => (
            <CommentItem key={reply.id} comment={reply} compact onReply={setReplyTarget} />
          ))}
        </div>
        {renderComposer("답글을 남겨보세요")}
      </div>
    );
  }

  if (!shouldShow) return null;

  if (mode === "sheet") {
    return (
      <div className="fixed inset-0 z-[70] flex items-end justify-center">
        <button type="button" className="absolute inset-0 bg-black/40" onClick={onClose} aria-label="댓글 닫기" />
        <section
          className={`relative flex w-full max-w-xl flex-col rounded-t-[24px] bg-white shadow-2xl transition-all duration-300 ${
            sheetFull ? "h-[94dvh]" : "h-[54dvh]"
          }`}
        >
          <div
            className="flex-shrink-0"
            onTouchStart={(e) => {
              touchStartY.current = e.touches[0].clientY;
            }}
            onTouchEnd={handleTouchEnd}
          >
            <button
              type="button"
              onClick={() => setSheetFull((value) => !value)}
              className="flex w-full justify-center pt-3 pb-2"
              aria-label="댓글창 크기 변경"
            >
              <span className="h-1 w-14 rounded-full bg-gray-300" />
            </button>
            <div className="flex items-center border-b border-gray-100 px-4 pb-4">
              <button type="button" onClick={onClose} className="mr-3 text-2xl text-gray-800" aria-label="닫기">
                ‹
              </button>
              <h2 className="text-lg font-bold text-gray-900">댓글</h2>
            </div>
          </div>
          <div className="flex-1 overflow-y-auto px-4">{renderCommentList()}</div>
          {renderComposer()}
          {renderReplyThread()}
        </section>
      </div>
    );
  }

  return (
    <section className="flex min-h-[calc(100dvh-110px)] flex-col bg-white">
      <div className="flex items-center border-b border-gray-100 px-4 py-4">
        <h2 className="text-lg font-bold text-gray-900">댓글</h2>
      </div>
      <div className="flex-1 overflow-y-auto px-4">{renderCommentList()}</div>
      <div className="sticky bottom-0">{renderComposer()}</div>
      {renderReplyThread()}
    </section>
  );
}
