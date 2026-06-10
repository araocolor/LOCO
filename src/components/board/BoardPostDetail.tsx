"use client";

import { useEffect, useState, useRef, useMemo } from "react";
import { ChevronLeft, MessageCircle, Pencil } from "lucide-react";
import type { BoardPost, BoardComment } from "@/types/board";
import Avatar from "@/components/ui/Avatar";
import { createClient } from "@/lib/supabase/client";
import {
  readBoardCommentsCache,
  readBoardPostCache,
  writeBoardCommentsCache,
  writeBoardPostCache,
} from "@/lib/board-session-cache";

interface Props {
  postId: string;
  onBack: () => void;
  onOpenComments: () => void;
  onEdit?: (post: BoardPost) => void;
}

function formatDateTime(value: string) {
  const d = new Date(value);
  return `${d.getFullYear()}.${String(d.getMonth() + 1).padStart(2, "0")}.${String(d.getDate()).padStart(2, "0")} ${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
}

function formatCommentTime(value: string) {
  const d = new Date(value);
  return `${String(d.getMonth() + 1).padStart(2, "0")}.${String(d.getDate()).padStart(2, "0")} ${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
}

export default function BoardPostDetail({ postId, onBack, onOpenComments, onEdit }: Props) {
  const initialPost = useMemo(() => readBoardPostCache(postId), [postId]);
  const [post, setPost] = useState<BoardPost | null>(initialPost);
  const [loading, setLoading] = useState(!initialPost);
  const [myLiked, setMyLiked] = useState(false);
  const [likeCount, setLikeCount] = useState(initialPost?.like_count ?? 0);
  const [isMineOrAdmin, setIsMineOrAdmin] = useState(false);
  const likeTimerRef = useRef<number | null>(null);

  const [comments, setComments] = useState<BoardComment[]>([]);
  const [expandedReplies, setExpandedReplies] = useState<Set<string>>(new Set());

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
    let cancelled = false;
    async function load(hasCachedPost: boolean) {
      if (!hasCachedPost) setLoading(true);
      try {
        const res = await fetch(`/api/board/posts/${postId}`);
        const data = await res.json().catch(() => ({}));
        if (!cancelled && res.ok && data.post) {
          const nextPost = data.post as BoardPost;
          setPost(nextPost);
          writeBoardPostCache(nextPost);
          setMyLiked(nextPost.my_liked ?? false);
          setLikeCount(nextPost.like_count ?? 0);

          const supabase = createClient();
          const { data: { user } } = await supabase.auth.getUser();
          if (user) {
            const isAuthor = user.id === nextPost.author_id;
            const { data: profile } = await supabase
              .from("profiles")
              .select("role")
              .eq("id", user.id)
              .single<{ role: string }>();
            if (!cancelled) setIsMineOrAdmin(isAuthor || profile?.role === "admin");
          }
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    queueMicrotask(() => {
      if (cancelled) return;
      const cachedPost = readBoardPostCache(postId);
      if (cachedPost) {
        setPost(cachedPost);
        setLikeCount(cachedPost.like_count ?? 0);
        setLoading(false);
      } else {
        setPost(null);
        setLikeCount(0);
      }
      setMyLiked(false);
      setIsMineOrAdmin(false);
      void load(!!cachedPost);
    });
    return () => { cancelled = true; };
  }, [postId]);

  useEffect(() => {
    let cancelled = false;
    async function loadComments() {
      try {
        const res = await fetch(`/api/board/posts/${postId}/comments`);
        const data = await res.json().catch(() => ({}));
        if (!cancelled && res.ok) {
          const nextComments = (data.comments ?? []) as BoardComment[];
          setComments(nextComments);
          writeBoardCommentsCache(postId, nextComments);
        }
      } catch { /* */ }
    }
    queueMicrotask(() => {
      if (cancelled) return;
      const cachedComments = readBoardCommentsCache(postId);
      if (cachedComments.length > 0) setComments(cachedComments);
      void loadComments();
    });
    return () => { cancelled = true; };
  }, [postId]);

  useEffect(() => {
    return () => {
      if (likeTimerRef.current) window.clearTimeout(likeTimerRef.current);
    };
  }, []);

  async function toggleLike() {
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const desired = !myLiked;
    setMyLiked(desired);
    setLikeCount((prev) => Math.max(0, prev + (desired ? 1 : -1)));

    if (likeTimerRef.current) window.clearTimeout(likeTimerRef.current);
    likeTimerRef.current = window.setTimeout(async () => {
      const res = await fetch(`/api/board/posts/${postId}/like`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ liked: desired }),
      });
      const data = await res.json().catch(() => ({}));
      if (res.ok && typeof data.like_count === "number") {
        setLikeCount(data.like_count);
      }
    }, 800);
  }

  function toggleReplies(parentId: string) {
    setExpandedReplies((prev) => {
      const next = new Set(prev);
      if (next.has(parentId)) next.delete(parentId);
      else next.add(parentId);
      return next;
    });
  }

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-gray-400">
        <span className="text-[15px]">불러오는 중...</span>
      </div>
    );
  }

  if (!post) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-gray-400">
        <span className="text-[15px]">게시글을 찾을 수 없습니다</span>
      </div>
    );
  }

  const showInlineComments = post.category === "support" || post.category === "free";

  return (
    <div className="flex flex-col h-full">
      {/* 헤더 */}
      <div className="sticky top-0 z-10 bg-white border-b border-gray-100">
        <div className="h-12 px-2 flex items-center justify-between">
          <button
            type="button"
            onClick={onBack}
            className="flex h-9 w-9 items-center justify-center rounded-full hover:bg-gray-100"
            aria-label="뒤로"
          >
            <ChevronLeft size={22} />
          </button>
          <div className="text-[17px] font-semibold text-gray-900">
            고객센터
          </div>
          {isMineOrAdmin && onEdit && post && (
            <button
              type="button"
              onClick={() => onEdit(post)}
              className="flex h-9 w-9 items-center justify-center rounded-full hover:bg-gray-100"
              aria-label="수정"
            >
              <Pencil size={18} className="text-gray-500" />
            </button>
          )}
        </div>
      </div>

      {/* 본문 */}
      <div className="flex-1 overflow-y-auto scrollbar-hide overscroll-contain">
        <div className="px-4 pt-4 pb-2">
          <h1 className="text-[20px] font-bold text-gray-900 leading-snug mb-3">
            {post.title}
          </h1>
          <div className="flex items-center gap-2.5 mb-4">
            <Avatar
              src={post.author?.profile_image_url ?? null}
              nickname={post.author?.nickname ?? "관리자"}
              size={38}
            />
            <div>
              <div className="text-[14px] font-semibold text-gray-800">
                {post.author?.nickname ?? "관리자"}
              </div>
              <div className="text-[12px] text-gray-400">
                {formatDateTime(post.created_at)}
                <span className="ml-2">조회 {post.view_count}</span>
              </div>
            </div>
          </div>
        </div>

        <div className="border-t border-gray-100" />

        {/* 본문 (blocks 우선, 없으면 기존 방식) */}
        {post.blocks && post.blocks.length > 0 ? (
          <div className="py-2">
            {post.blocks.map((block, i) =>
              block.type === "text" ? (
                block.value.trim() ? (
                  <div key={i} className="px-4 py-2">
                    <p className="text-[15px] text-gray-800 whitespace-pre-wrap leading-relaxed">
                      {block.value}
                    </p>
                  </div>
                ) : null
              ) : (
                <div key={i} className="py-2">
                  <img
                    src={block.full}
                    alt=""
                    className="w-full"
                    loading="lazy"
                  />
                </div>
              ),
            )}
          </div>
        ) : (
          <>
            {post.images.length > 0 && (
              <div className="space-y-1">
                {post.images.map((img, i) => (
                  <img key={i} src={img.full} alt="" className="w-full" loading="lazy" />
                ))}
              </div>
            )}
            {post.content && (
              <div className="px-4 py-4">
                <p className="text-[15px] text-gray-800 whitespace-pre-wrap leading-relaxed">
                  {post.content}
                </p>
              </div>
            )}
          </>
        )}

        {/* 좋아요 */}
        <div className="flex justify-center py-4">
          <button
            type="button"
            onClick={() => void toggleLike()}
            className={`flex items-center gap-1.5 rounded-full border px-5 py-2 text-[14px] font-semibold transition-colors ${
              myLiked
                ? "border-red-200 bg-red-50 text-red-500"
                : "border-gray-200 bg-white text-gray-500"
            }`}
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              width="18"
              height="18"
              viewBox="0 0 24 24"
              fill={myLiked ? "#ef4444" : "none"}
              stroke={myLiked ? "#ef4444" : "currentColor"}
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z" />
            </svg>
            {likeCount > 0 && <span>{likeCount}</span>}
          </button>
        </div>

        {/* 댓글 인라인 표시 (고객센터/자유게시판) */}
        {showInlineComments && post.comment_enabled && rootComments.length > 0 && (
          <>
            <div className="border-t-[6px] border-gray-100" />
            <div className="px-4 py-3">
              {rootComments.map((comment) => {
                const replies = repliesByParent.get(comment.id) ?? [];
                const isExpanded = expandedReplies.has(comment.id);
                return (
                  <div key={comment.id} className="border-b border-gray-100 last:border-b-0">
                    <InlineComment comment={comment} isAuthor={comment.profile_id === post.author_id} />
                    {replies.length > 0 && !isExpanded && (
                      <button
                        type="button"
                        onClick={() => toggleReplies(comment.id)}
                        className="ml-12 mb-3 px-4 py-1.5 rounded-full bg-gray-100 text-[13px] font-semibold text-gray-600"
                      >
                        댓글 {replies.length}개 보기
                      </button>
                    )}
                    {replies.length > 0 && isExpanded && (
                      <div className="ml-12 mb-2">
                        {replies.map((reply) => (
                          <InlineComment key={reply.id} comment={reply} isAuthor={reply.profile_id === post.author_id} compact />
                        ))}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </>
        )}
      </div>

      {/* 하단 좋아요 + 댓글 버튼 */}
      <div className="sticky bottom-0 border-t border-gray-100 bg-white px-4 py-3 flex items-center justify-between">
        <button
          type="button"
          onClick={() => void toggleLike()}
          className="flex items-center gap-1"
        >
          <svg
            xmlns="http://www.w3.org/2000/svg"
            width="22"
            height="22"
            viewBox="0 0 24 24"
            fill={myLiked ? "#ef4444" : "none"}
            stroke={myLiked ? "#ef4444" : "#9ca3af"}
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z" />
          </svg>
          {likeCount > 0 && (
            <span className={`text-[14px] font-semibold ${myLiked ? "text-red-500" : "text-gray-500"}`}>
              {likeCount}
            </span>
          )}
        </button>
        {post.comment_enabled && (
          <button
            type="button"
            onClick={onOpenComments}
            className="flex items-center gap-1 text-gray-400"
          >
            <MessageCircle size={22} />
            {post.comment_count > 0 && (
              <span className="text-[14px] font-semibold">{post.comment_count}</span>
            )}
          </button>
        )}
      </div>
    </div>
  );
}

function InlineComment({
  comment,
  isAuthor,
  compact = false,
}: {
  comment: BoardComment;
  isAuthor: boolean;
  compact?: boolean;
}) {
  const name = comment.profile?.nickname ?? "사용자";

  return (
    <div className={`flex gap-2.5 ${compact ? "py-2" : "py-3"}`}>
      <Avatar
        src={comment.profile?.profile_image_url ?? null}
        nickname={name}
        size={compact ? 32 : 40}
      />
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <span className="text-[14px] font-semibold text-gray-700">{name}</span>
          {isAuthor && (
            <span className="px-1.5 py-0.5 rounded text-[11px] font-bold bg-blue-100 text-blue-600">작성자</span>
          )}
          <span className="text-[12px] text-gray-400">{formatCommentTime(comment.created_at)}</span>
        </div>
        <p className="text-[15px] text-gray-800 whitespace-pre-wrap leading-relaxed mt-0.5">
          {comment.is_deleted ? "삭제된 댓글입니다." : comment.content}
        </p>
        {!comment.is_deleted && (
          <div className="flex items-center gap-3 mt-1 text-[13px] text-gray-400">
            <span>댓글쓰기</span>
            {comment.like_count > 0 && (
              <span className="flex items-center gap-0.5">
                <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="#ef4444" stroke="#ef4444" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z" />
                </svg>
                {comment.like_count}
              </span>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
