"use client";

import Link from "next/link";
import Image from "next/image";
import { useCallback, useEffect, useRef, useState } from "react";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import { DANCE_GENRE_LABELS, CLASS_LEVEL_LABELS } from "@/types/class";
import type { ClassWithHost } from "@/components/class/ClassCard";
import type { ClassComment } from "@/components/class/ClassCommentsPanel";
import ClassCommentsPanel from "@/components/class/ClassCommentsPanel";
import ClassDetailImageGallery from "@/components/class/ClassDetailImageGallery";
import MentionText from "@/components/class/MentionText";
import Avatar from "@/components/ui/Avatar";
import { useAuth } from "@/lib/auth-context";
import { createClient } from "@/lib/supabase/client";

const HOME_RESULTS_LOCAL_KEY = "loco_home_results_local_v1";
const LIKES_CACHE_KEY = "loco_liked_posts";
const BOOKMARKS_CACHE_KEY = "loco_bookmark_ids_v1";
const COMMENT_PREVIEW_LIMIT = 8;

interface CachedHomeResult {
  data: ClassWithHost[];
  count: number;
}

const GENRE_CHIP: Record<string, string> = {
  salsa: "bg-red-50 text-red-600",
  bachata: "bg-purple-50 text-purple-600",
  festival: "bg-yellow-50 text-yellow-700",
  event: "bg-blue-50 text-blue-600",
  other: "bg-gray-100 text-gray-600",
};

function formatDate(dateStr: string) {
  const d = new Date(dateStr);
  return `${d.getFullYear()}.${String(d.getMonth() + 1).padStart(2, "0")}.${String(d.getDate()).padStart(2, "0")}`;
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

function InfoRow({ icon, label, value }: { icon: string; label: string; value: string }) {
  return (
    <p className="text-[15px] leading-snug text-gray-800">
      <span className="mr-1.5 text-[17px]">{icon}</span>
      <span>{label}: </span>
      <span>{value}</span>
    </p>
  );
}

function StatusBadge({ status }: { status: ClassWithHost["status"] }) {
  if (status === "recruiting") {
    return (
      <span className="text-xs font-medium px-2 py-0.5 rounded-full bg-green-50 text-green-600">
        모집중
      </span>
    );
  }

  if (status === "closed") {
    return (
      <span className="text-xs font-medium px-2 py-0.5 rounded-full bg-gray-100 text-gray-500">
        마감
      </span>
    );
  }

  return (
    <span className="text-xs font-medium px-2 py-0.5 rounded-full bg-red-50 text-red-500">
      취소됨
    </span>
  );
}

function CommentPreviewItem({ comment }: { comment: ClassComment }) {
  const name = comment.profile?.nickname ?? "사용자";

  return (
    <div className="flex gap-2 py-3">
      <Avatar src={comment.profile?.profile_image_url ?? null} nickname={name} size={34} />
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <span className="text-[14px] font-medium text-gray-600">{name}</span>
          <span className="text-xs text-gray-400">{formatCommentTime(comment.created_at)}</span>
        </div>
        <p className="mt-0.5 line-clamp-2 whitespace-pre-wrap text-[15px] leading-relaxed text-gray-800">
          {comment.is_deleted ? "삭제된 댓글입니다." : comment.content}
        </p>
      </div>
    </div>
  );
}

function CommentPreviewThread({
  comment,
  replies,
}: {
  comment: ClassComment;
  replies: ClassComment[];
}) {
  return (
    <div>
      <CommentPreviewItem comment={comment} />
      {replies.length > 0 && (
        <div className="ml-10 border-t border-gray-50 pt-0.5">
          {replies.map((reply) => (
            <CommentPreviewItem key={reply.id} comment={reply} />
          ))}
        </div>
      )}
    </div>
  );
}

interface CachedClassDetailPageProps {
  classIdOverride?: string;
  hideChat?: boolean;
  onClose?: () => void;
}

export default function CachedClassDetailPage({ classIdOverride, hideChat, onClose }: CachedClassDetailPageProps = {}) {
  const params = useParams<{ id: string }>();
  const searchParams = useSearchParams();
  const router = useRouter();
  const { user } = useAuth();
  const classId = classIdOverride ?? params?.id;
  const animateFromHome = searchParams.get("from") === "home";
  const [loaded, setLoaded] = useState(false);
  const [displayClass, setDisplayClass] = useState<ClassWithHost | null>(null);
  const [liked, setLiked] = useState(false);
  const [bookmarked, setBookmarked] = useState(false);
  const [likeCount, setLikeCount] = useState(0);
  const [applying, setApplying] = useState(false);
  const [applied, setApplied] = useState(false);
  const [approved, setApproved] = useState(false);
  const [enteringChat, setEnteringChat] = useState(false);
  const [commentSheetOpen, setCommentSheetOpen] = useState(false);
  const [comments, setComments] = useState<ClassComment[]>([]);
  const [commentsLoading, setCommentsLoading] = useState(false);
  const [deleteModalOpen, setDeleteModalOpen] = useState(false);
  const [deleteConfirmText, setDeleteConfirmText] = useState("");
  const [deleteLoading, setDeleteLoading] = useState(false);
  const [noticeText, setNoticeText] = useState("");
  const requestedRef = useRef(false);

  useEffect(() => {
    if (!classId) {
      queueMicrotask(() => setLoaded(true));
      return;
    }

    const raw = localStorage.getItem(HOME_RESULTS_LOCAL_KEY);
    if (!raw) {
      queueMicrotask(() => setLoaded(true));
      return;
    }

    try {
      const parsed = JSON.parse(raw) as CachedHomeResult;
      const found = (parsed.data ?? []).find((item) => item.id === classId) ?? null;
      queueMicrotask(() => setDisplayClass(found));
    } catch {
      queueMicrotask(() => setDisplayClass(null));
    } finally {
      queueMicrotask(() => setLoaded(true));
    }
  }, [classId]);

  useEffect(() => {
    if (!loaded || !classId) return;
    if (requestedRef.current) return;

    const run = async () => {
      requestedRef.current = true;
      try {
        const res = await fetch(`/api/classes/${classId}`, { method: "GET" });
        if (!res.ok) return;
        const latest = (await res.json()) as ClassWithHost;
        setDisplayClass((prev) => (prev ? { ...prev, ...latest } : latest));
      } catch {
        // 백그라운드 동기화 실패는 화면 유지
      }
    };

    if (document.readyState === "complete") {
      void run();
      return;
    }

    const onLoad = () => {
      void run();
    };
    window.addEventListener("load", onLoad, { once: true });
    return () => window.removeEventListener("load", onLoad);
  }, [loaded, classId, displayClass]);

  useEffect(() => {
    if (!classId) return;

    try {
      const likes: string[] = JSON.parse(localStorage.getItem(LIKES_CACHE_KEY) ?? "[]");
      const isLiked = likes.includes(classId);

      const rawBookmarks = localStorage.getItem(BOOKMARKS_CACHE_KEY);
      const parsedBookmarks: unknown = rawBookmarks ? JSON.parse(rawBookmarks) : [];
      const bookmarkIds = Array.isArray(parsedBookmarks)
        ? parsedBookmarks.map((item) =>
            typeof item === "string" ? item : (item as { id?: string }).id
          )
        : [];
      queueMicrotask(() => {
        setLiked(isLiked);
        setLikeCount(isLiked ? 1 : 0);
        setBookmarked(bookmarkIds.includes(classId));
      });
    } catch {}
  }, [classId]);

  const loadCommentPreview = useCallback(async () => {
    if (!classId) return;

    queueMicrotask(() => setCommentsLoading(true));
    try {
      const res = await fetch(`/api/classes/${classId}/comments`, { method: "GET" });
      const data = await res.json().catch(() => ({}));
      if (res.ok) {
        setComments(Array.isArray(data.comments) ? data.comments : []);
      }
    } finally {
      setCommentsLoading(false);
    }
  }, [classId]);

  useEffect(() => {
    void loadCommentPreview();
  }, [loadCommentPreview]);

  useEffect(() => {
    if (!classId || !user) return;
    const checkMyApplication = async () => {
      const supabase = createClient();
      const { data } = await supabase
        .from("applications")
        .select("status")
        .eq("class_id", classId)
        .eq("applicant_id", user.id)
        .neq("status", "cancelled")
        .maybeSingle();
      if (data?.status === "pending") {
        setApplied(true);
      } else if (data?.status === "approved") {
        setApproved(true);
      }
    };
    void checkMyApplication();
  }, [classId, user]);

  if (!loaded) {
    return <div className="max-w-xl mx-auto px-4 py-6 text-sm text-gray-400">불러오는 중...</div>;
  }

  if (!displayClass) {
    return <div className="max-w-xl mx-auto px-4 py-6 text-sm text-gray-500">null</div>;
  }

  const host = displayClass.host ?? null;
  const classTitle = displayClass.title;
  const images: { card_url?: string; full_url?: string }[] = displayClass.images ?? [];
  const primaryGenre = displayClass.genres?.[0] ?? "other";
  const genreLabel = (displayClass.genres ?? [])
    .map((g) => DANCE_GENRE_LABELS[g as keyof typeof DANCE_GENRE_LABELS] ?? g)
    .join(" · ");
  const levelLabel =
    CLASS_LEVEL_LABELS[displayClass.level as keyof typeof CLASS_LEVEL_LABELS] ?? displayClass.level;
  const chipCls = GENRE_CHIP[primaryGenre] ?? GENRE_CHIP.other;

  function handleLikeToggle() {
    if (!classId) return;

    try {
      const likes: string[] = JSON.parse(localStorage.getItem(LIKES_CACHE_KEY) ?? "[]");
      const isLiked = likes.includes(classId);
      const next = isLiked ? likes.filter((id) => id !== classId) : [...likes, classId];
      localStorage.setItem(LIKES_CACHE_KEY, JSON.stringify(next));
      setLiked(!isLiked);
      setLikeCount(!isLiked ? 1 : 0);
    } catch {}
  }

  function handleBookmarkToggle() {
    if (!classId) return;

    try {
      const raw = localStorage.getItem(BOOKMARKS_CACHE_KEY);
      const parsed: unknown = raw ? JSON.parse(raw) : [];
      const bookmarks = Array.isArray(parsed) ? parsed : [];
      const isSaved = bookmarks.some((item) =>
        typeof item === "string" ? item === classId : (item as { id?: string }).id === classId
      );
      const next = isSaved
        ? bookmarks.filter((item) =>
            typeof item === "string" ? item !== classId : (item as { id?: string }).id !== classId
          )
        : [...bookmarks, { id: classId, created_at: new Date().toISOString() }];
      localStorage.setItem(BOOKMARKS_CACHE_KEY, JSON.stringify(next));
      setBookmarked(!isSaved);
      window.dispatchEvent(new CustomEvent("bookmarkChanged"));
    } catch {}
  }

  async function handleShare() {
    const shareUrl = window.location.href;
    try {
      if (navigator.share) {
        await navigator.share({ title: classTitle, url: shareUrl });
        return;
      }
      await navigator.clipboard.writeText(shareUrl);
      alert("링크를 복사했습니다.");
    } catch {}
  }

  async function handleApply() {
    if (!classId || applying) return;
    setApplying(true);

    try {
      const res = await fetch("/api/applications", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ class_id: classId }),
      });

      const data = await res.json().catch(() => ({}));
      if (res.ok) {
        setApplied(true);
        showCenterNotice("신청완료되었습니다.");
      } else {
        showCenterNotice(data.error ?? "신청에 실패했습니다.");
      }
    } catch {
      showCenterNotice("신청에 실패했습니다.");
    } finally {
      setApplying(false);
    }
  }

  function showCenterNotice(message: string) {
    setNoticeText(message);
    window.setTimeout(() => {
      setNoticeText((current) => (current === message ? "" : current));
    }, 1500);
  }

  async function handleDeleteClick() {
    if (!classId || deleteLoading || !displayClass) return;
    const currentClass = displayClass;

    try {
      const res = await fetch(`/api/classes/${classId}/applications`, { method: "GET" });
      const data = await res.json().catch(() => ({}));
      if (res.ok) {
        const pendingCount = Array.isArray(data.data?.pending) ? data.data.pending.length : 0;
        const approvedCount = Array.isArray(data.data?.approved) ? data.data.approved.length : 0;
        const hasApplicants = pendingCount + approvedCount > 0;
        const isRecruitingPeriod =
          currentClass.status === "recruiting" &&
          new Date(currentClass.deadline).getTime() >= Date.now();

        if (hasApplicants && isRecruitingPeriod) {
          showCenterNotice("신청자가 있는 모집중 클래스는 삭제할 수 없습니다.");
          return;
        }
      }
    } catch {
      showCenterNotice("삭제 가능 여부를 확인하지 못했습니다.");
      return;
    }

    setDeleteConfirmText("");
    setDeleteModalOpen(true);
  }

  async function handleDeleteConfirm() {
    if (!classId || deleteConfirmText !== "삭제하기" || deleteLoading) return;

    setDeleteLoading(true);
    try {
      const res = await fetch(`/api/classes/${classId}`, { method: "DELETE" });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        showCenterNotice(data.error ?? "삭제할 수 없습니다.");
        return;
      }

      setDeleteModalOpen(false);
      showCenterNotice("삭제되었습니다.");
      window.setTimeout(() => {
        router.push("/");
        router.refresh();
      }, 900);
    } catch {
      showCenterNotice("삭제에 실패했습니다.");
    } finally {
      setDeleteLoading(false);
    }
  }

  const rootComments = comments.filter((comment) => !comment.parent_id);
  const repliesByParent = comments.reduce((map, comment) => {
    if (!comment.parent_id) return map;
    map.set(comment.parent_id, [...(map.get(comment.parent_id) ?? []), comment]);
    return map;
  }, new Map<string, ClassComment[]>());
  const sortedThreads = rootComments
    .map((comment) => ({
      comment,
      replies: (repliesByParent.get(comment.id) ?? []).sort(
        (a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
      ),
      latestAt: Math.max(
        new Date(comment.created_at).getTime(),
        ...(repliesByParent.get(comment.id) ?? []).map((reply) =>
          new Date(reply.created_at).getTime()
        )
      ),
    }))
    .sort((a, b) => b.latestAt - a.latestAt);
  const previewThreads: Array<{
    comment: ClassComment;
    replies: ClassComment[];
    latestAt: number;
  }> = [];
  let remainingPreviewCount = COMMENT_PREVIEW_LIMIT;

  for (const thread of sortedThreads) {
    if (remainingPreviewCount <= 0) break;

    const replySlots = Math.max(0, remainingPreviewCount - 1);
    const visibleReplies =
      thread.replies.length > replySlots
        ? thread.replies.slice(thread.replies.length - replySlots)
        : thread.replies;

    previewThreads.push({
      comment: thread.comment,
      replies: visibleReplies,
      latestAt: thread.latestAt,
    });
    remainingPreviewCount -= 1 + visibleReplies.length;
  }

  previewThreads.sort((a, b) => a.latestAt - b.latestAt);

  const previewCommentCount = COMMENT_PREVIEW_LIMIT - remainingPreviewCount;
  const hasMoreComments = comments.length > previewCommentCount;
  const isOwnClass = user?.id === displayClass.host_id;
  const applyLabel =
    displayClass.status !== "recruiting" ? "신청 마감" : applied ? "신청확인중" : applying ? "신청 중..." : "신청하기";

  return (
    <div
      className={`relative max-w-xl mx-auto pb-10 ${animateFromHome ? "page-slide-in-from-left" : ""}`}
    >
      {images.length > 0 ? (
        <ClassDetailImageGallery images={images} />
      ) : (
        <div className="w-full h-[160px] bg-gray-100 flex items-center justify-center text-5xl opacity-30">
          🎵
        </div>
      )}

      <section className="px-4 pt-4">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-5">
            <button
              type="button"
              onClick={handleLikeToggle}
              className="flex items-center gap-1.5 text-gray-900"
              aria-label="좋아요"
            >
              <svg
                xmlns="http://www.w3.org/2000/svg"
                width="24"
                height="24"
                viewBox="0 0 24 24"
                fill={liked ? "#ff3b5c" : "none"}
                stroke={liked ? "#ff3b5c" : "currentColor"}
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z" />
              </svg>
              <span className="text-sm font-semibold">{likeCount}</span>
            </button>
            <button
              type="button"
              onClick={() => setCommentSheetOpen(true)}
              className="text-gray-900"
              aria-label="댓글보기"
            >
              <svg
                xmlns="http://www.w3.org/2000/svg"
                width="24"
                height="24"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
              </svg>
            </button>
            <button type="button" onClick={handleShare} className="text-gray-900" aria-label="공유">
              <svg
                xmlns="http://www.w3.org/2000/svg"
                width="24"
                height="24"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <line x1="22" y1="2" x2="11" y2="13" />
                <polygon points="22 2 15 22 11 13 2 9 22 2" />
              </svg>
            </button>
          </div>
          <button
            type="button"
            onClick={handleBookmarkToggle}
            className="text-gray-900"
            aria-label="북마크"
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              width="24"
              height="24"
              viewBox="0 0 24 24"
              fill={bookmarked ? "#1a1a1a" : "none"}
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <polygon points="19 21 12 16 5 21 5 3 19 3" />
            </svg>
          </button>
        </div>

        <div className="flex items-center gap-2 flex-wrap mb-3">
          <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${chipCls}`}>
            {genreLabel}
          </span>
          {displayClass.is_modified && (
            <span className="text-xs font-medium text-orange-500">수정됨</span>
          )}
        </div>

        <h1 className="text-xl font-bold text-gray-900 mb-3">{displayClass.title}</h1>

        {host && (
          <Link href={`/users/${host.id}`} className="flex items-center gap-2 mb-5">
            {host.profile_image_url ? (
              <Image
                src={host.profile_image_url}
                alt={host.nickname}
                width={36}
                height={36}
                className="rounded-full object-cover"
              />
            ) : (
              <div className="w-9 h-9 rounded-full bg-gray-100 flex items-center justify-center text-sm font-medium text-gray-500">
                {host.nickname[0]}
              </div>
            )}
            <span className="text-sm font-medium text-gray-700">{host.nickname}</span>
            <span className="text-gray-300" aria-hidden="true">
              |
            </span>
            <StatusBadge status={displayClass.status} />
          </Link>
        )}

        <div>
          <h2 className="font-semibold text-[15px] text-gray-700 mb-2">상세설명</h2>
          <MentionText
            text={displayClass.description}
            emptyText="등록된 상세설명이 없습니다."
            className="text-[15px] text-gray-700 whitespace-pre-wrap leading-relaxed"
          />
        </div>
      </section>

      <section className="mt-6 border-t border-gray-100 px-4 pt-5">
        <div className="space-y-1.5">
          <InfoRow icon="🎁" label="제목" value={displayClass.title} />
          <InfoRow icon="📆" label="마감일자" value={formatDate(displayClass.deadline)} />
          <InfoRow icon="📍" label="장소" value={displayClass.location_address} />
          <InfoRow icon="💊" label="레벨" value={levelLabel} />
          <InfoRow icon="📞" label="연락처" value={displayClass.contact} />
        </div>
      </section>

      <section className="mt-6 border-t border-gray-100 px-4 pt-5">
        <div className="mb-1 flex items-center justify-between">
          <h2 className="text-base font-bold text-gray-900">댓글</h2>
          {hasMoreComments && (
            <button
              type="button"
              onClick={() => setCommentSheetOpen(true)}
              className="rounded-full bg-gray-950 px-3.5 py-1.5 text-sm font-semibold text-white"
            >
              댓글 전체보기
            </button>
          )}
        </div>
        {commentsLoading ? (
          <p className="py-8 text-center text-sm text-gray-400">댓글을 불러오는 중...</p>
        ) : previewThreads.length > 0 ? (
          <div className="divide-y divide-gray-100">
            {previewThreads.map(({ comment, replies }) => (
              <CommentPreviewThread key={comment.id} comment={comment} replies={replies} />
            ))}
          </div>
        ) : (
          <p className="py-8 text-center text-sm text-gray-400">아직 댓글이 없습니다.</p>
        )}
      </section>

      <div className="flex justify-center gap-2 px-4 pb-[max(16px,env(safe-area-inset-bottom))] pt-6">
        {isOwnClass ? (
          <button
            type="button"
            onClick={handleDeleteClick}
            disabled={deleteLoading}
            className="inline-flex h-12 items-center justify-center rounded-full bg-red-500 px-7 text-[15px] font-bold text-white shadow-sm transition-colors hover:bg-red-600 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {deleteLoading ? "삭제 중..." : "삭제하기"}
          </button>
        ) : approved && !hideChat ? (
          <button
            type="button"
            disabled={enteringChat}
            onClick={async () => {
              if (!classId || enteringChat) return;
              setEnteringChat(true);
              try {
                const res = await fetch(`/api/chat/rooms/class/${classId}`, { method: "POST" });
                if (res.ok) {
                  const roomId = (await res.json()).data?.id;
                  onClose?.();
                  router.push(`/messages?roomId=${roomId}`);
                } else {
                  showCenterNotice("대화방 입장에 실패했습니다.");
                }
              } catch {
                showCenterNotice("대화방 입장에 실패했습니다.");
              } finally {
                setEnteringChat(false);
              }
            }}
            className="inline-flex h-12 items-center justify-center rounded-full bg-[#fee500] px-7 text-[15px] font-bold text-[#191600] shadow-sm transition-colors hover:bg-[#f5dc00] disabled:cursor-not-allowed disabled:opacity-50"
          >
            {enteringChat ? "입장 중..." : "클래스 대화방"}
          </button>
        ) : (
          <button
            type="button"
            onClick={handleApply}
            disabled={applying || applied || displayClass.status !== "recruiting"}
            className="inline-flex h-12 items-center justify-center rounded-full bg-[#fee500] px-7 text-[15px] font-bold text-[#191600] shadow-sm transition-colors hover:bg-[#f5dc00] disabled:cursor-not-allowed disabled:opacity-50"
          >
            {applyLabel}
          </button>
        )}
        {isOwnClass && (
          <Link
            href={`/classes/${displayClass.id}/edit`}
            className="inline-flex h-12 items-center justify-center rounded-full border border-gray-200 bg-white px-7 text-[15px] font-bold text-gray-900 shadow-sm"
          >
            편집하기
          </Link>
        )}
      </div>

      {deleteModalOpen && (
        <div className="fixed inset-0 z-[120] flex items-center justify-center bg-black/35 px-4">
          <div className="w-full max-w-sm rounded-2xl bg-white p-5 shadow-xl">
            <h2 className="text-lg font-bold text-gray-900">클래스 삭제</h2>
            <p className="mt-2 text-sm leading-6 text-gray-600">
              해당 클래스를 삭제하려면 아래에 삭제하기를 입력하세요.
            </p>
            <input
              type="text"
              value={deleteConfirmText}
              onChange={(event) => setDeleteConfirmText(event.target.value)}
              className="mt-4 w-full rounded-xl border border-gray-200 px-3 py-3 text-sm font-semibold outline-none focus:border-red-300"
              placeholder="삭제하기"
              autoFocus
            />
            <div className="mt-4 flex gap-2">
              <button
                type="button"
                onClick={() => setDeleteModalOpen(false)}
                disabled={deleteLoading}
                className="flex-1 rounded-full border border-gray-200 py-3 text-sm font-bold text-gray-700 disabled:opacity-50"
              >
                취소
              </button>
              <button
                type="button"
                onClick={handleDeleteConfirm}
                disabled={deleteConfirmText !== "삭제하기" || deleteLoading}
                className="flex-1 rounded-full bg-red-500 py-3 text-sm font-bold text-white disabled:cursor-not-allowed disabled:opacity-40"
              >
                확인
              </button>
            </div>
          </div>
        </div>
      )}

      {noticeText && (
        <div className="pointer-events-none fixed inset-0 z-[130] flex items-center justify-center px-4">
          <div className="rounded-full bg-black/80 px-5 py-3 text-sm font-bold text-white shadow-lg">
            {noticeText}
          </div>
        </div>
      )}

      <ClassCommentsPanel
        classId={displayClass.id}
        mode="sheet"
        open={commentSheetOpen}
        onClose={() => setCommentSheetOpen(false)}
        onCommentCreated={() => {
          void loadCommentPreview();
        }}
      />
    </div>
  );
}
