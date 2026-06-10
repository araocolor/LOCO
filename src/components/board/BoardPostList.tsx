"use client";

import { useEffect, useState, useCallback } from "react";
import type { BoardPost, BoardCategory, BoardBlock } from "@/types/board";
import Avatar from "@/components/ui/Avatar";

interface Props {
  category: BoardCategory;
  onSelectPost: (post: BoardPost) => void;
  onWrite: () => void;
}

function formatDate(value: string) {
  const d = new Date(value);
  return `${d.getFullYear()}.${String(d.getMonth() + 1).padStart(2, "0")}.${String(d.getDate()).padStart(2, "0")}`;
}

function getFirstThumbnail(post: BoardPost): string | null {
  if (Array.isArray(post.blocks) && post.blocks.length > 0) {
    const imgBlock = post.blocks.find((b: BoardBlock) => b.type === "image" && b.thumbnail);
    if (imgBlock && imgBlock.type === "image") return imgBlock.thumbnail;
  }
  if (Array.isArray(post.images) && post.images.length > 0) {
    const first = post.images[0];
    if (typeof first === "string") return first;
    return first?.thumbnail ?? null;
  }
  return null;
}

export default function BoardPostList({ category, onSelectPost, onWrite }: Props) {
  const [posts, setPosts] = useState<BoardPost[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(false);

  const fetchPosts = useCallback(async (p: number, append = false) => {
    setLoading(true);
    try {
      const res = await fetch(`/api/board/posts?category=${category}&page=${p}`);
      const data = await res.json().catch(() => ({}));
      if (res.ok) {
        setPosts((prev) => (append ? [...prev, ...(data.posts ?? [])] : data.posts ?? []));
        setHasMore(data.hasMore ?? false);
      }
    } finally {
      setLoading(false);
    }
  }, [category]);

  useEffect(() => {
    setPage(1);
    setPosts([]);
    void fetchPosts(1);
  }, [category, fetchPosts]);

  function loadMore() {
    const next = page + 1;
    setPage(next);
    void fetchPosts(next, true);
  }

  if (loading && posts.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-gray-400">
        <span className="text-[15px]">불러오는 중...</span>
      </div>
    );
  }

  if (posts.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-full">
        <span className="text-[15px] text-gray-400">게시글이 없습니다</span>
        <button
          type="button"
          onClick={onWrite}
          className="mt-4 px-5 py-2.5 rounded-full bg-gray-900 text-white text-[14px] font-semibold"
        >
          글쓰기
        </button>
      </div>
    );
  }

  return (
    <div>
      {posts.map((post) => {
        const thumb = getFirstThumbnail(post);
        return (
          <button
            key={post.id}
            type="button"
            onClick={() => onSelectPost(post)}
            className="w-full text-left border-b border-gray-100 px-4 py-3 flex gap-3 active:bg-gray-50 transition-colors"
          >
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-1.5 mb-0.5">
                {post.is_pinned && (
                  <span className="inline-block w-2 h-2 rounded-full bg-red-500 flex-shrink-0" />
                )}
                <h3
                  className="text-[15px] font-bold text-gray-900 truncate"
                  style={{ lineHeight: "1.4" }}
                >
                  {post.title}
                </h3>
              </div>
              <div className="flex items-center gap-1.5 text-[13px] text-gray-400">
                <span>{post.author?.nickname ?? "관리자"}</span>
                <span>{formatDate(post.created_at)}</span>
                <span>조회 {post.view_count}</span>
              </div>
              <div className="flex items-center gap-3 mt-1 text-[13px] text-gray-400">
                {post.like_count > 0 && (
                  <span className="flex items-center gap-0.5">
                    <HeartIcon size={12} />
                    {post.like_count}
                  </span>
                )}
                {post.comment_count > 0 && (
                  <span className="flex items-center gap-0.5">
                    <CommentIcon size={12} />
                    {post.comment_count}
                  </span>
                )}
              </div>
            </div>
            {thumb && (
              <div className="flex-shrink-0 w-16 h-16 rounded-lg overflow-hidden bg-gray-100">
                <img
                  src={thumb}
                  alt=""
                  className="w-full h-full object-cover"
                  loading="lazy"
                />
              </div>
            )}
          </button>
        );
      })}
      {hasMore && (
        <button
          type="button"
          onClick={loadMore}
          disabled={loading}
          className="w-full py-4 text-center text-[14px] text-gray-500 font-semibold"
        >
          {loading ? "불러오는 중..." : "더보기"}
        </button>
      )}
    </div>
  );
}

function HeartIcon({ size = 14 }: { size?: number }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z" />
    </svg>
  );
}

function CommentIcon({ size = 14 }: { size?: number }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
    </svg>
  );
}
