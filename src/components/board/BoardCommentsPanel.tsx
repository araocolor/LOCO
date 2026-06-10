"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { CircleChevronLeft } from "lucide-react";
import Avatar from "@/components/ui/Avatar";
import { createClient } from "@/lib/supabase/client";
import type { BoardComment } from "@/types/board";

interface CurrentProfile {
  id: string;
  nickname: string;
  profile_image_url: string | null;
}

interface Props {
  postId: string;
  open: boolean;
  onClose: () => void;
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
  return `${String(d.getMonth() + 1).padStart(2, "0")}.${String(d.getDate()).padStart(2, "0")} ${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
}

function displayName(comment: BoardComment) {
  return comment.profile?.nickname ?? "사용자";
}

function CommentItem({
  comment,
  compact = false,
  isMine = false,
  onReply,
  onLike,
  onEdit,
  onDelete,
  justDeleted = false,
}: {
  comment: BoardComment;
  compact?: boolean;
  isMine?: boolean;
  onReply: (c: BoardComment) => void;
  onLike: (c: BoardComment) => void;
  onEdit: (c: BoardComment) => void;
  onDelete: (c: BoardComment) => void;
  justDeleted?: boolean;
}) {
  const name = displayName(comment);

  return (
    <div className={`relative flex gap-2 ${compact ? "py-2" : "py-2.5"} ${justDeleted ? "opacity-40" : ""}`}>
      {justDeleted && (
        <div className="absolute inset-0 z-10 flex items-center justify-center">
          <svg xmlns="http://www.w3.org/2000/svg" width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#22c55e" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="20 6 9 17 4 12" />
          </svg>
        </div>
      )}
      <Avatar
        src={comment.profile?.profile_image_url ?? null}
        nickname={name}
        size={compact ? 34 : 42}
      />
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <span style={{ fontSize: "15px", color: "#808080" }}>{name}</span>
          <span className="text-xs" style={{ color: "#808080" }}>
            {formatCommentTime(comment.created_at)}
          </span>
        </div>
        <p
          className="whitespace-pre-wrap leading-relaxed"
          style={{ fontSize: "16px", color: "rgba(0,0,0,0.8)", marginTop: "0px" }}
        >
          {comment.is_deleted ? "삭제된 댓글입니다." : comment.content}
        </p>
        <div className="flex items-center gap-3 text-xs text-gray-500" style={{ marginTop: "0px" }}>
          {!comment.is_deleted && (
            <button
              type="button"
              onClick={() => onReply(comment)}
              className="font-bold flex items-center gap-1"
              style={{ fontSize: "13px" }}
            >
              댓글쓰기
            </button>
          )}
          {!comment.is_deleted && isMine && (
            <div className="ml-1 flex items-center rounded-full border border-gray-200" style={{ padding: "2px 0" }}>
              <button
                type="button"
                onClick={() => onEdit(comment)}
                className="font-semibold"
                style={{ fontSize: "11px", color: "rgba(0,0,0,0.5)", padding: "0 8px" }}
              >
                수정
              </button>
              <button
                type="button"
                onClick={() => onDelete(comment)}
                className="font-semibold"
                style={{ fontSize: "11px", color: "rgba(0,0,0,0.5)", padding: "0 8px" }}
              >
                삭제
              </button>
            </div>
          )}
          {!comment.is_deleted && (
            <button
              type="button"
              onClick={() => onLike(comment)}
              className={`ml-auto flex items-center gap-1 font-semibold ${comment.my_liked ? "" : "text-gray-500"}`}
              style={comment.my_liked ? { color: "#ff3b5c" } : undefined}
            >
              {comment.like_count > 0 && <span>{comment.like_count}</span>}
              <svg
                xmlns="http://www.w3.org/2000/svg"
                width="14"
                height="14"
                viewBox="0 0 24 24"
                fill={comment.my_liked ? "#ff3b5c" : "none"}
                stroke={comment.my_liked ? "#ff3b5c" : "currentColor"}
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z" />
              </svg>
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

export default function BoardCommentsPanel({ postId, open, onClose }: Props) {
  const router = useRouter();
  const [comments, setComments] = useState<BoardComment[]>([]);
  const [loading, setLoading] = useState(false);
  const [input, setInput] = useState("");
  const [replyTarget, setReplyTarget] = useState<BoardComment | null>(null);
  const [editTarget, setEditTarget] = useState<BoardComment | null>(null);
  const [deletedId, setDeletedId] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [currentProfile, setCurrentProfile] = useState<CurrentProfile | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const likeTimersRef = useRef<Map<string, number>>(new Map());
  const likePendingRef = useRef<
    Map<string, { desired: boolean; previousLiked: boolean; previousCount: number }>
  >(new Map());

  const rootComments = useMemo(() => comments.filter((c) => !c.parent_id), [comments]);
  const repliesByParent = useMemo(() => {
    const map = new Map<string, BoardComment[]>();
    comments.forEach((c) => {
      if (!c.parent_id) return;
      map.set(c.parent_id, [...(map.get(c.parent_id) ?? []), c]);
    });
    return map;
  }, [comments]);

  useEffect(() => {
    if (!open) return;
    let cancelled = false;

    async function load() {
      setLoading(true);
      try {
        const res = await fetch(`/api/board/posts/${postId}/comments`);
        const data = await res.json().catch(() => ({}));
        if (!cancelled && res.ok) {
          setComments(data.comments ?? []);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    void load();
    return () => { cancelled = true; };
  }, [postId, open]);

  useEffect(() => {
    if (!open) return;
    let cancelled = false;

    async function loadProfile() {
      try {
        const supabase = createClient();
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) { if (!cancelled) setCurrentProfile(null); return; }

        const { data } = await supabase
          .from("profiles")
          .select("nickname, profile_image_url")
          .eq("id", user.id)
          .maybeSingle<CurrentProfile>();

        if (!cancelled) {
          setCurrentProfile({
            id: user.id,
            nickname: data?.nickname ?? user.email ?? "나",
            profile_image_url: data?.profile_image_url ?? null,
          });
        }
      } catch {
        if (!cancelled) setCurrentProfile(null);
      }
    }

    void loadProfile();
    return () => { cancelled = true; };
  }, [open]);

  useEffect(() => {
    if (!open) {
      queueMicrotask(() => {
        setReplyTarget(null);
        setEditTarget(null);
        setInput("");
      });
    }
  }, [open]);

  useEffect(() => {
    const timers = likeTimersRef.current;
    return () => {
      timers.forEach((t) => window.clearTimeout(t));
      timers.clear();
    };
  }, []);

  function handleEdit(comment: BoardComment) {
    setEditTarget(comment);
    setReplyTarget(null);
    setInput(comment.content);
    requestAnimationFrame(() => {
      const el = textareaRef.current;
      if (el) {
        el.style.height = "auto";
        el.style.height = `${Math.min(el.scrollHeight, 120)}px`;
        el.focus();
      }
    });
  }

  function cancelEdit() {
    setEditTarget(null);
    setInput("");
  }

  async function submitEdit() {
    if (!editTarget || submitting) return;
    const content = input.trim();
    if (!content) return;

    setSubmitting(true);
    try {
      const res = await fetch(`/api/board/posts/${postId}/comments/${editTarget.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content }),
      });

      if (res.status === 401) { router.push("/login"); return; }
      const data = await res.json().catch(() => ({}));
      if (!res.ok) { alert(data.error ?? "댓글 수정에 실패했습니다."); return; }

      setComments((prev) => prev.map((item) =>
        item.id === editTarget.id ? { ...item, content } : item
      ));
      setEditTarget(null);
      setInput("");
    } finally {
      setSubmitting(false);
    }
  }

  async function deleteComment(commentId: string) {
    if (submitting) return;
    setSubmitting(true);
    try {
      const res = await fetch(`/api/board/posts/${postId}/comments/${commentId}`, { method: "DELETE" });
      if (res.status === 401) { router.push("/login"); return; }
      const data = await res.json().catch(() => ({}));
      if (!res.ok) { alert(data.error ?? "댓글 삭제에 실패했습니다."); return; }

      setDeletedId(commentId);
      setTimeout(() => {
        setDeletedId(null);
        setComments((prev) => prev.map((item) =>
          item.id === commentId ? { ...item, is_deleted: true, content: "", deleted_at: new Date().toISOString() } : item
        ));
      }, 1000);
      setEditTarget(null);
      setInput("");
    } finally {
      setSubmitting(false);
    }
  }

  async function submitComment() {
    const content = input.trim();
    if (!content || submitting) return;
    const parentId = replyTarget
      ? (comments.find((c) => c.id === replyTarget.id)?.parent_id ?? replyTarget.id)
      : null;

    setSubmitting(true);
    try {
      const res = await fetch(`/api/board/posts/${postId}/comments`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content, parent_id: parentId }),
      });

      if (res.status === 401) { router.push("/login"); return; }
      const data = await res.json().catch(() => ({}));
      if (!res.ok) { alert(data.error ?? "댓글 등록에 실패했습니다."); return; }

      setComments((prev) => [...prev, data.comment]);
      setInput("");
      setReplyTarget(null);
    } finally {
      setSubmitting(false);
    }
  }

  async function handleLike(comment: BoardComment) {
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { router.push("/login"); return; }

    const desired = !comment.my_liked;
    likePendingRef.current.set(comment.id, {
      desired,
      previousLiked: !!comment.my_liked,
      previousCount: comment.like_count,
    });

    setComments((prev) => prev.map((item) =>
      item.id === comment.id
        ? { ...item, my_liked: desired, like_count: Math.max(0, item.like_count + (desired ? 1 : -1)) }
        : item
    ));

    const prev = likeTimersRef.current.get(comment.id);
    if (prev) window.clearTimeout(prev);
    const timer = window.setTimeout(() => void syncLike(comment.id), 1000);
    likeTimersRef.current.set(comment.id, timer);
  }

  async function syncLike(commentId: string) {
    const pending = likePendingRef.current.get(commentId);
    if (!pending) return;

    try {
      const res = await fetch(`/api/board/posts/${postId}/comments/${commentId}/like`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ liked: pending.desired }),
      });
      const json = await res.json().catch(() => ({}));
      if (res.ok && typeof json.like_count === "number") {
        setComments((prev) => prev.map((item) =>
          item.id === commentId ? { ...item, like_count: json.like_count, my_liked: pending.desired } : item
        ));
      }
      likePendingRef.current.delete(commentId);
      likeTimersRef.current.delete(commentId);
    } catch {
      setComments((prev) => prev.map((item) =>
        item.id === commentId
          ? { ...item, my_liked: pending.previousLiked, like_count: pending.previousCount }
          : item
      ));
      likePendingRef.current.delete(commentId);
      likeTimersRef.current.delete(commentId);
    }
  }

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[260] flex items-end justify-center">
      <button
        type="button"
        className="absolute inset-0 bg-black/40"
        onClick={onClose}
        aria-label="댓글 닫기"
      />
      <section className="relative flex h-[100dvh] w-full max-w-[500px] flex-col bg-white shadow-2xl animate-sheet-slide-up">
        {/* 헤더 */}
        <div className="flex-shrink-0 border-b border-gray-100">
          <div className="flex items-center px-4 py-3">
            <button
              type="button"
              onClick={onClose}
              className="mr-3 text-gray-800"
              aria-label="닫기"
            >
              <CircleChevronLeft size={25} />
            </button>
            <h2 className="text-lg font-bold text-gray-900">댓글</h2>
          </div>
        </div>

        {/* 댓글 목록 */}
        <div className="flex-1 overflow-y-auto px-4">
          {loading ? (
            <p className="text-sm text-gray-400 text-center mt-16">댓글을 불러오는 중...</p>
          ) : rootComments.length === 0 ? (
            <p className="text-sm text-gray-400 text-center mt-16">아직 댓글이 없습니다.</p>
          ) : (
            <div className="divide-y divide-gray-100">
              {rootComments.map((comment) => {
                const replies = repliesByParent.get(comment.id) ?? [];
                return (
                  <div key={comment.id}>
                    <CommentItem
                      comment={comment}
                      isMine={!!currentProfile?.id && comment.profile_id === currentProfile.id}
                      onReply={setReplyTarget}
                      onLike={(c) => void handleLike(c)}
                      onEdit={handleEdit}
                      onDelete={(c) => {
                        if (confirm("댓글을 삭제하시겠습니까?")) void deleteComment(c.id);
                      }}
                      justDeleted={deletedId === comment.id}
                    />
                    {replies.length > 0 && (
                      <div className="ml-10 border-t border-gray-50 pt-0.5">
                        {replies.map((reply) => (
                          <CommentItem
                            key={reply.id}
                            comment={reply}
                            compact
                            isMine={!!currentProfile?.id && reply.profile_id === currentProfile.id}
                            onReply={setReplyTarget}
                            onLike={(c) => void handleLike(c)}
                            onEdit={handleEdit}
                            onDelete={(c) => {
                              if (confirm("댓글을 삭제하시겠습니까?")) void deleteComment(c.id);
                            }}
                            justDeleted={deletedId === reply.id}
                          />
                        ))}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* 입력 */}
        <div className="border-t border-gray-100 bg-white px-4 pt-2 pb-[max(16px,env(safe-area-inset-bottom))]">
          <div className="flex gap-4 overflow-x-auto pb-2 text-2xl">
            {QUICK_REACTIONS.map((r) => (
              <button
                type="button"
                key={r}
                onClick={() => setInput((v) => `${v}${r}`)}
                className="flex-shrink-0"
              >
                {r}
              </button>
            ))}
          </div>
          {editTarget && (
            <div className="mb-2 flex items-center justify-between rounded-full bg-gray-100 px-3 py-1.5 text-xs text-gray-600">
              <span>댓글 수정중...</span>
              <button type="button" onClick={cancelEdit} className="font-semibold">취소</button>
            </div>
          )}
          {replyTarget && !editTarget && (
            <div className="mb-2 flex items-center justify-between rounded-full bg-gray-100 px-3 py-1.5 text-xs text-gray-600">
              <span>{displayName(replyTarget)}님에게 답글</span>
              <button type="button" onClick={() => setReplyTarget(null)} className="font-semibold">취소</button>
            </div>
          )}
          <div className="flex items-center gap-2">
            <div className="flex-shrink-0 pb-1">
              <Avatar
                src={currentProfile?.profile_image_url ?? null}
                nickname={currentProfile?.nickname ?? "나"}
                size={34}
              />
            </div>
            <textarea
              ref={textareaRef}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder={editTarget ? "수정할 내용을 입력하세요" : "댓글을 남겨보세요"}
              rows={1}
              onInput={(e) => {
                const el = e.currentTarget;
                el.style.height = "auto";
                el.style.height = `${Math.min(el.scrollHeight, 120)}px`;
              }}
              className={`min-h-[44px] min-w-0 flex-1 resize-none rounded-2xl border px-4 py-2.5 text-sm outline-none focus:border-gray-400 ${editTarget ? "border-gray-400" : "border-gray-200"}`}
            />
            <button
              type="button"
              onClick={() => {
                if (editTarget) void submitEdit();
                else void submitComment();
              }}
              disabled={submitting || input.trim().length === 0}
              className="h-10 flex-shrink-0 rounded-full bg-gray-950 px-5 text-sm font-semibold text-white disabled:opacity-40"
            >
              {editTarget ? "수정" : "등록"}
            </button>
          </div>
        </div>
      </section>
    </div>
  );
}
