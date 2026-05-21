"use client";

import Link from "next/link";
import Image from "next/image";
import { useEffect, useRef, useState } from "react";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import { DANCE_GENRE_LABELS, CLASS_LEVEL_LABELS } from "@/types/class";
import type { ClassWithHost } from "@/components/class/ClassCard";
import ClassCommentsPanel from "@/components/class/ClassCommentsPanel";
import ClassDetailImageGallery from "@/components/class/ClassDetailImageGallery";
import MentionText from "@/components/class/MentionText";

const HOME_RESULTS_LOCAL_KEY = "loco_home_results_local_v1";
const LIKES_CACHE_KEY = "loco_liked_posts";
const BOOKMARKS_CACHE_KEY = "loco_bookmark_ids_v1";

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

function InfoRow({ icon, label, value }: { icon: string; label: string; value: string }) {
  return (
    <div className="flex gap-3 text-sm">
      <span className="w-5 text-center flex-shrink-0">{icon}</span>
      <span className="text-gray-500 w-16 flex-shrink-0">{label}</span>
      <span className="text-gray-900 flex-1">{value}</span>
    </div>
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

export default function CachedClassDetailPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const searchParams = useSearchParams();
  const classId = params?.id;
  const animateFromHome = searchParams.get("from") === "home";
  const [loaded, setLoaded] = useState(false);
  const [displayClass, setDisplayClass] = useState<ClassWithHost | null>(null);
  const [activeTab, setActiveTab] = useState<"info" | "apply" | "comments">("info");
  const [liked, setLiked] = useState(false);
  const [bookmarked, setBookmarked] = useState(false);
  const [likeCount, setLikeCount] = useState(0);
  const [applying, setApplying] = useState(false);
  const [commentSheetOpen, setCommentSheetOpen] = useState(false);
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
        ? parsedBookmarks.map((item) => (typeof item === "string" ? item : (item as { id?: string }).id))
        : [];
      queueMicrotask(() => {
        setLiked(isLiked);
        setLikeCount(isLiked ? 1 : 0);
        setBookmarked(bookmarkIds.includes(classId));
      });
    } catch {}
  }, [classId]);

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
  const tabs = [
    { key: "info", label: "클래스 정보" },
    { key: "apply", label: "신청하기" },
    { key: "comments", label: "댓글보기" },
  ] as const;

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
        ? bookmarks.filter((item) => (typeof item === "string" ? item !== classId : (item as { id?: string }).id !== classId))
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

      if (res.status === 401) {
        router.push(`/login?next=/classes/${classId}`);
        return;
      }

      const data = await res.json().catch(() => ({}));
      alert(res.ok ? "신청이 완료되었습니다." : (data.error ?? "신청에 실패했습니다."));
    } catch {
      alert("신청에 실패했습니다.");
    } finally {
      setApplying(false);
    }
  }

  return (
    <div
      className={`relative max-w-xl mx-auto pb-32 ${animateFromHome ? "page-slide-in-from-left" : ""}`}
    >
      <div className="sticky top-0 z-30 bg-white border-b border-gray-100">
        <div className="grid grid-cols-3">
          {tabs.map((tab) => (
            <button
              key={tab.key}
              type="button"
              onClick={() => setActiveTab(tab.key)}
              className={`py-3 text-sm font-semibold ${
                activeTab === tab.key ? "text-gray-950 border-b-2 border-gray-950" : "text-gray-400"
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {activeTab === "info" && (
        <>
          {images.length > 0 ? (
            <ClassDetailImageGallery images={images} />
          ) : (
            <div className="w-full h-[160px] bg-gray-100 flex items-center justify-center text-5xl opacity-30">
              🎵
            </div>
          )}

          <div className="px-4 pt-4">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-5">
                <button
                  type="button"
                  onClick={handleLikeToggle}
                  className="flex items-center gap-1.5 text-gray-900"
                  aria-label="좋아요"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill={liked ? "#ff3b5c" : "none"} stroke={liked ? "#ff3b5c" : "currentColor"} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
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
                  <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
                  </svg>
                </button>
                <button
                  type="button"
                  onClick={handleShare}
                  className="text-gray-900"
                  aria-label="공유"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
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
                <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill={bookmarked ? "#1a1a1a" : "none"} stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
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
                <span className="text-gray-300" aria-hidden="true">|</span>
                <StatusBadge status={displayClass.status} />
              </Link>
            )}

            <div className="mb-5">
              <h2 className="font-semibold text-sm text-gray-700 mb-2">상세설명</h2>
              <MentionText
                text={displayClass.description}
                emptyText="등록된 상세설명이 없습니다."
                className="text-sm text-gray-700 whitespace-pre-wrap leading-relaxed"
              />
            </div>
          </div>
        </>
      )}

      {activeTab === "apply" && (
        <div className="px-4 pt-5">
          <div className="card p-4 space-y-3 mb-5">
            <InfoRow icon="•" label="제목" value={displayClass.title} />
            <InfoRow icon="⏰" label="마감일자" value={formatDate(displayClass.deadline)} />
            <InfoRow icon="📍" label="장소" value={displayClass.location_address} />
            <InfoRow icon="🎯" label="레벨" value={levelLabel} />
            <InfoRow icon="👥" label="정원" value={`${displayClass.capacity}명`} />
            <InfoRow icon="📞" label="연락처" value={displayClass.contact} />
          </div>
          <button
            type="button"
            onClick={handleApply}
            disabled={applying || displayClass.status !== "recruiting"}
            className="btn-primary disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {displayClass.status !== "recruiting" ? "신청 마감" : applying ? "신청 중..." : "신청하기"}
          </button>
        </div>
      )}

      {activeTab === "comments" && (
        <ClassCommentsPanel classId={displayClass.id} mode="full" />
      )}
      <ClassCommentsPanel
        classId={displayClass.id}
        mode="sheet"
        open={commentSheetOpen}
        onClose={() => setCommentSheetOpen(false)}
      />
    </div>
  );
}
