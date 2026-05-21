"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Avatar from "@/components/ui/Avatar";
import { createClient } from "@/lib/supabase/client";

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
  my_liked?: boolean;
  is_deleted: boolean;
  deleted_at: string | null;
  created_at: string;
  profile: ClassCommentProfile | null;
}

interface CurrentProfile {
  nickname: string;
  profile_image_url: string | null;
}

interface ClassCommentsPanelProps {
  classId: string;
  mode: "sheet" | "full";
  open?: boolean;
  onClose?: () => void;
  onCommentCreated?: () => void;
}

const QUICK_REACTIONS = ["❤️", "😍", "🥰", "😊", "😂", "🔥", "✨", "👍", "🎉", "💯"];
const COMMENTS_SESSION_CACHE_PREFIX = "loco_class_comments_session_v1:";
const COMMENT_LIKE_PENDING_CACHE_KEY = "loco_comment_like_pending_v1:";

function getCommentsCacheKey(classId: string) {
  return `${COMMENTS_SESSION_CACHE_PREFIX}${classId}`;
}

function readCachedComments(classId: string) {
  try {
    const raw = sessionStorage.getItem(getCommentsCacheKey(classId));
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? (parsed as ClassComment[]) : null;
  } catch {
    return null;
  }
}

function writeCachedComments(classId: string, comments: ClassComment[]) {
  try {
    sessionStorage.setItem(getCommentsCacheKey(classId), JSON.stringify(comments));
  } catch {}
}

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
  compact = false,
  onReply,
  onLike,
}: {
  comment: ClassComment;
  compact?: boolean;
  onReply: (comment: ClassComment) => void;
  onLike: (comment: ClassComment) => void;
}) {
  const name = displayName(comment);

  return (
    <div className={`flex gap-2 ${compact ? "py-2" : "py-2.5"}`}>
      <Avatar src={comment.profile?.profile_image_url ?? null} nickname={name} size={compact ? 34 : 42} />
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <span style={{ fontSize: "15px", color: "#808080" }}>{name}</span>
          <span className="text-xs" style={{ color: "#808080" }}>{formatCommentTime(comment.created_at)}</span>
        </div>
        <p className="whitespace-pre-wrap leading-relaxed" style={{ fontSize: "16px", color: "#333333", marginTop: "0px" }}>
          {comment.is_deleted ? "삭제된 댓글입니다." : comment.content}
        </p>
        <div className="flex items-center gap-3 text-xs text-gray-500" style={{ marginTop: "0px" }}>
          {!comment.is_deleted && (
            <button type="button" onClick={() => onReply(comment)} className="font-bold flex items-center gap-1" style={{ fontSize: "13px" }}>
              댓글쓰기
            </button>
          )}
          {!comment.is_deleted && (
            <button
              type="button"
              onClick={() => onLike(comment)}
              className="ml-auto flex items-center gap-1 font-semibold text-gray-500"
            >
              {comment.like_count > 0 && <span>{comment.like_count}</span>}
              <svg
                xmlns="http://www.w3.org/2000/svg"
                width="14"
                height="14"
                viewBox="0 0 24 24"
                fill={comment.my_liked ? "currentColor" : "none"}
                stroke="currentColor"
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

export default function ClassCommentsPanel({ classId, mode, open = true, onClose, onCommentCreated }: ClassCommentsPanelProps) {
  const router = useRouter();
  const [comments, setComments] = useState<ClassComment[]>([]);
  const [loading, setLoading] = useState(false);
  const [input, setInput] = useState("");
  const [replyTarget, setReplyTarget] = useState<ClassComment | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [sheetFull, setSheetFull] = useState(false);
  const [currentProfile, setCurrentProfile] = useState<CurrentProfile | null>(null);
  const touchStartY = useRef(0);
  const likeTimersRef = useRef<Map<string, number>>(new Map());
  const likePendingRef = useRef<Map<string, { desired: boolean; previousLiked: boolean; previousCount: number }>>(new Map());
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
      const cachedComments = readCachedComments(classId);
      if (cachedComments) {
        setComments(cachedComments);
        setLoading(false);
      } else {
        setComments([]);
        setLoading(true);
      }

      try {
        const res = await fetch(`/api/classes/${classId}/comments`, { method: "GET" });
        const data = await res.json().catch(() => ({}));
        if (!cancelled && res.ok) {
          const nextComments = data.comments ?? [];
          setComments(nextComments);
          writeCachedComments(classId, nextComments);
        }
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
    if (!shouldShow) return;

    let cancelled = false;
    async function loadCurrentProfile() {
      try {
        const supabase = createClient();
        const {
          data: { user },
        } = await supabase.auth.getUser();

        if (!user) {
          if (!cancelled) setCurrentProfile(null);
          return;
        }

        const { data } = await supabase
          .from("profiles")
          .select("nickname, profile_image_url")
          .eq("id", user.id)
          .maybeSingle<CurrentProfile>();

        if (!cancelled) {
          setCurrentProfile({
            nickname: data?.nickname ?? user.email ?? "나",
            profile_image_url: data?.profile_image_url ?? null,
          });
        }
      } catch {
        if (!cancelled) setCurrentProfile(null);
      }
    }

    void loadCurrentProfile();
    return () => {
      cancelled = true;
    };
  }, [shouldShow]);

  useEffect(() => {
    if (mode !== "sheet" || !open) return;

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, [mode, open]);

  useEffect(() => {
    if (mode !== "sheet") return;
    if (!open) {
      queueMicrotask(() => {
        setSheetFull(false);
        setReplyTarget(null);
      });
    }
  }, [mode, open]);

  useEffect(() => {
    const likeTimers = likeTimersRef.current;
    return () => {
      likeTimers.forEach((timer) => window.clearTimeout(timer));
      likeTimers.clear();
    };
  }, []);

  async function submitComment(parentId: string | null = replyTarget?.id ?? null, value = input) {
    const content = value.trim();
    if (!content || submitting) return;
    const normalizedParentId = parentId
      ? comments.find((comment) => comment.id === parentId)?.parent_id ?? parentId
      : null;

    setSubmitting(true);
    try {
      const res = await fetch(`/api/classes/${classId}/comments`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content, parent_id: normalizedParentId }),
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

      setComments((prev) => {
        const nextComments = [...prev, data.comment];
        writeCachedComments(classId, nextComments);
        return nextComments;
      });
      setInput("");
      setReplyTarget(null);
      onCommentCreated?.();
    } finally {
      setSubmitting(false);
    }
  }

  async function handleCommentLike(comment: ClassComment) {
    const supabase = createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      router.push(`/login?next=/classes/${classId}`);
      return;
    }

    const desired = !comment.my_liked;
    likePendingRef.current.set(comment.id, {
      desired,
      previousLiked: !!comment.my_liked,
      previousCount: comment.like_count,
    });

    setComments((prev) => {
      const nextComments = prev.map((item) => (
        item.id === comment.id
          ? { ...item, my_liked: desired, like_count: Math.max(0, item.like_count + (desired ? 1 : -1)) }
          : item
      ));
      writeCachedComments(classId, nextComments);
      return nextComments;
    });

    try {
      const raw = sessionStorage.getItem(`${COMMENT_LIKE_PENDING_CACHE_KEY}${classId}`);
      const pending = raw ? JSON.parse(raw) : {};
      sessionStorage.setItem(`${COMMENT_LIKE_PENDING_CACHE_KEY}${classId}`, JSON.stringify({ ...pending, [comment.id]: desired }));
    } catch {}

    const previousTimer = likeTimersRef.current.get(comment.id);
    if (previousTimer) window.clearTimeout(previousTimer);
    const nextTimer = window.setTimeout(() => {
      void syncCommentLike(comment.id);
    }, 1000);
    likeTimersRef.current.set(comment.id, nextTimer);
  }

  async function syncCommentLike(commentId: string) {
    const pending = likePendingRef.current.get(commentId);
    if (!pending) return;

    try {
      const res = await fetch(`/api/classes/${classId}/comments/${commentId}/like`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ liked: pending.desired }),
      });

      if (res.status === 401) {
        router.push(`/login?next=/classes/${classId}`);
        return;
      }

      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json.error ?? "comment like failed");

      if (typeof json.like_count === "number") {
        setComments((prev) => {
          const nextComments = prev.map((item) => (
            item.id === commentId ? { ...item, like_count: json.like_count, my_liked: pending.desired } : item
          ));
          writeCachedComments(classId, nextComments);
          return nextComments;
        });
      }

      try {
        const raw = sessionStorage.getItem(`${COMMENT_LIKE_PENDING_CACHE_KEY}${classId}`);
        const pendingMap = raw ? JSON.parse(raw) : {};
        delete pendingMap[commentId];
        sessionStorage.setItem(`${COMMENT_LIKE_PENDING_CACHE_KEY}${classId}`, JSON.stringify(pendingMap));
      } catch {}
      likePendingRef.current.delete(commentId);
      likeTimersRef.current.delete(commentId);
    } catch {
      setComments((prev) => {
        const nextComments = prev.map((item) => (
          item.id === commentId
            ? { ...item, my_liked: pending.previousLiked, like_count: pending.previousCount }
            : item
        ));
        writeCachedComments(classId, nextComments);
        return nextComments;
      });
      likePendingRef.current.delete(commentId);
      likeTimersRef.current.delete(commentId);
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
          const replies = repliesByParent.get(comment.id) ?? [];
          return (
            <div key={comment.id}>
              <CommentItem
                comment={comment}
                compact={compact}
                onReply={setReplyTarget}
                onLike={(targetComment) => {
                  void handleCommentLike(targetComment);
                }}
              />
              {replies.length > 0 && (
                <div className="ml-10 border-t border-gray-50 pt-0.5">
                  {replies.map((reply) => (
                  <CommentItem
                    key={reply.id}
                    comment={reply}
                    compact
                    onReply={setReplyTarget}
                    onLike={(targetComment) => {
                      void handleCommentLike(targetComment);
                    }}
                  />
                  ))}
                </div>
              )}
            </div>
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
        <div className="flex items-center gap-2">
          <Avatar
            src={currentProfile?.profile_image_url ?? null}
            nickname={currentProfile?.nickname ?? "나"}
            size={34}
          />
          <input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder={placeholder}
            className="h-11 min-w-0 flex-1 rounded-full border border-gray-200 px-4 text-sm outline-none focus:border-gray-400"
          />
          <button
            type="button"
            onClick={() => void submitComment()}
            disabled={submitting || input.trim().length === 0}
            className="h-11 rounded-full bg-gray-950 px-5 text-sm font-semibold text-white disabled:opacity-40"
          >
            등록
          </button>
        </div>
      </div>
    );
  }

  if (!shouldShow) return null;

  if (mode === "sheet") {
    return (
      <div className="loco-comment-font fixed inset-0 z-[70] flex items-end justify-center">
        <button type="button" className="absolute inset-0 bg-black/40" onClick={onClose} aria-label="댓글 닫기" />
        <section
          className={`relative flex w-full max-w-xl flex-col rounded-t-[24px] bg-white shadow-2xl transition-all duration-300 animate-sheet-slide-up ${
            sheetFull ? "h-[94dvh]" : "h-[65dvh]"
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
        </section>
      </div>
    );
  }

  return (
    <section className="loco-comment-font flex min-h-[calc(100dvh-110px)] flex-col bg-white">
      <div className="flex items-center border-b border-gray-100 px-4 py-4">
        <h2 className="text-lg font-bold text-gray-900">댓글</h2>
      </div>
      <div className="flex-1 overflow-y-auto px-4">{renderCommentList()}</div>
      <div className="sticky bottom-0">{renderComposer()}</div>
    </section>
  );
}
