import type { BoardCategory, BoardComment, BoardPost, BoardBlock } from "@/types/board";

const BOARD_POSTS_CACHE_PREFIX = "loco_board_posts_local_v1";
const BOARD_COMMENTS_CACHE_PREFIX = "loco_board_comments_session_v1";
const POST_CACHE_LIMIT = 10;
const COMMENT_CACHE_LIMIT = 10;

type CachedBoardPost = BoardPost & { thumbnail_url?: string | null };

function getSessionStorage() {
  if (typeof window === "undefined") return null;
  return window.sessionStorage;
}

function getLocalStorage() {
  if (typeof window === "undefined") return null;
  return window.localStorage;
}

function getPostThumbnail(post: BoardPost) {
  const imageBlock = post.blocks?.find((block: BoardBlock) => block.type === "image" && block.thumbnail);
  if (imageBlock?.type === "image") return imageBlock.thumbnail;

  const firstImage = post.images?.[0];
  if (!firstImage) return null;
  if (typeof firstImage === "string") return firstImage;
  return firstImage.thumbnail ?? null;
}

export function readBoardPostsCache(category: BoardCategory): BoardPost[] {
  const storage = getLocalStorage();
  if (!storage) return [];

  try {
    const raw = storage.getItem(`${BOARD_POSTS_CACHE_PREFIX}:${category}`);
    if (!raw) return [];
    const cached = JSON.parse(raw) as { posts?: CachedBoardPost[] };
    return Array.isArray(cached.posts) ? cached.posts.slice(0, POST_CACHE_LIMIT) : [];
  } catch {
    return [];
  }
}

export function writeBoardPostsCache(category: BoardCategory, posts: BoardPost[]) {
  const storage = getLocalStorage();
  if (!storage) return;

  try {
    const cachedPosts: CachedBoardPost[] = posts.slice(0, POST_CACHE_LIMIT).map((post) => ({
      ...post,
      thumbnail_url: getPostThumbnail(post),
    }));
    storage.setItem(
      `${BOARD_POSTS_CACHE_PREFIX}:${category}`,
      JSON.stringify({ category, cached_at: Date.now(), posts: cachedPosts }),
    );
  } catch {
    // sessionStorage may be unavailable or full.
  }
}

export function readBoardPostCache(postId: string): BoardPost | null {
  const categories: BoardCategory[] = ["notice", "support", "free"];

  for (const category of categories) {
    const post = readBoardPostsCache(category).find((item) => item.id === postId);
    if (post) return post;
  }

  return null;
}

export function writeBoardPostCache(post: BoardPost) {
  const currentPosts = readBoardPostsCache(post.category);
  const nextPosts = [
    post,
    ...currentPosts.filter((item) => item.id !== post.id),
  ].slice(0, POST_CACHE_LIMIT);

  writeBoardPostsCache(post.category, nextPosts);
}

export async function prefetchBoardPostsCache(
  categories: BoardCategory[] = ["notice", "support", "free"],
  signal?: AbortSignal,
) {
  await Promise.allSettled(
    categories.map(async (category) => {
      try {
        const res = await fetch(`/api/board/posts?category=${category}&page=1`, { cache: "no-store", signal });
        const data = await res.json().catch(() => ({}));
        if (res.ok && Array.isArray(data.posts)) writeBoardPostsCache(category, data.posts as BoardPost[]);
      } catch {
        // Prefetch should never block the current screen.
      }
    }),
  );
}

export async function ensureBoardPostsCache(category: BoardCategory) {
  if (readBoardPostsCache(category).length > 0) return;
  await prefetchBoardPostsCache([category]);
}

export function readBoardCommentsCache(postId: string): BoardComment[] {
  const storage = getSessionStorage();
  if (!storage) return [];

  try {
    const raw = storage.getItem(`${BOARD_COMMENTS_CACHE_PREFIX}:${postId}`);
    if (!raw) return [];
    const cached = JSON.parse(raw) as { comments?: BoardComment[] };
    return Array.isArray(cached.comments) ? cached.comments.slice(0, COMMENT_CACHE_LIMIT) : [];
  } catch {
    return [];
  }
}

export function writeBoardCommentsCache(postId: string, comments: BoardComment[]) {
  const storage = getSessionStorage();
  if (!storage) return;

  try {
    storage.setItem(
      `${BOARD_COMMENTS_CACHE_PREFIX}:${postId}`,
      JSON.stringify({
        post_id: postId,
        cached_at: Date.now(),
        comments: comments.slice(0, COMMENT_CACHE_LIMIT),
      }),
    );
  } catch {
    // sessionStorage may be unavailable or full.
  }
}
