"use client";

import { useEffect, useRef, useState, type TouchEvent as ReactTouchEvent } from "react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { parseBookmarkEntries } from "@/lib/bookmarks/local";
import { DanceClass, DANCE_GENRE_LABELS, CLASS_LEVEL_LABELS } from "@/types/class";
import ClassCommentsPanel from "@/components/class/ClassCommentsPanel";
import ClassApplicantSheet from "@/components/class/ClassApplicantSheet";
import SendMessageModal from "@/components/modal/SendMessageModal";
import ClassShareSheet from "@/components/class/ClassShareSheet";
import MentionText from "@/components/class/MentionText";

const LIKES_CACHE_KEY = "loco_liked_posts";
const LIKE_PENDING_CACHE_KEY = "loco_class_like_pending_v1";
const BOOKMARKS_CACHE_KEY = "loco_bookmark_ids_v1";

interface ClassHost {
  id: string;
  nickname: string;
  profile_image_url: string | null;
}

export interface ClassWithHost extends DanceClass {
  host?: ClassHost;
}

interface ClassCardProps {
  classData: ClassWithHost;
  priorityImage?: boolean;
}

const GENRE_BG: Record<string, string> = {
  salsa: "#FFE4E4",
  bachata: "#EDE4FF",
  festival: "#FFF9D9",
  event: "#E4EEFF",
  other: "#F0F0F0",
};

function formatDate(dateStr: string) {
  const d = new Date(dateStr);
  const days = ["일", "월", "화", "수", "목", "금", "토"];
  const m = d.getMonth() + 1;
  const dd = d.getDate();
  const day = days[d.getDay()];
  const hh = d.getHours().toString().padStart(2, "0");
  const mm = d.getMinutes().toString().padStart(2, "0");
  return `${m}/${dd}(${day}) ${hh}:${mm}`;
}

export default function ClassCard({ classData, priorityImage = false }: ClassCardProps) {
  const { id, host_id, title, genres, level, datetime, region, status, images, host, description } =
    classData;
  const [expanded, setExpanded] = useState(false);
  const [imgIndex, setImgIndex] = useState(0);
  const [menuOpen, setMenuOpen] = useState(false);
  const [friendMsg, setFriendMsg] = useState("");
  const [commentOpen, setCommentOpen] = useState(false);
  const [liked, setLiked] = useState(false);
  const [likeCount, setLikeCount] = useState(classData.like_count ?? 0);
  const [commentCount, setCommentCount] = useState(classData.comment_count ?? 0);
  const [shareCount, setShareCount] = useState(classData.share_count ?? 0);
  const [bookmarked, setBookmarked] = useState(false);
  const [heartVisible, setHeartVisible] = useState(false);
  const [heartLiked, setHeartLiked] = useState(false);
  const [shareOpen, setShareOpen] = useState(false);
  const [shareComplete, setShareComplete] = useState(false);
  const [lightboxOpen, setLightboxOpen] = useState(false);
  const [lightboxIndex, setLightboxIndex] = useState(0);
  const [messageModalOpen, setMessageModalOpen] = useState(false);
  const [enteringClassRoom, setEnteringClassRoom] = useState(false);
  const [applyingClass, setApplyingClass] = useState(false);
  const [applicantSheetOpen, setApplicantSheetOpen] = useState(false);
  const [failedImages, setFailedImages] = useState<{ classId: string; urls: Set<string> }>(() => ({
    classId: id,
    urls: new Set(),
  }));
  const [loadedImages, setLoadedImages] = useState<{ classId: string; urls: Set<string> }>(() => ({
    classId: id,
    urls: new Set(),
  }));
  const { user: authUser } = useAuth();
  const currentUserId = authUser?.id ?? null;
  const [myApplicationStatus, setMyApplicationStatus] = useState<
    "pending" | "approved" | "cancelled" | null
  >(null);
  const descriptionRef = useRef<HTMLDivElement>(null);
  const shouldScrollToDescription = useRef(false);
  const likeSyncTimerRef = useRef<number | null>(null);
  const pendingLikeRef = useRef<{
    desired: boolean;
    previousLiked: boolean;
    previousCount: number;
  } | null>(null);
  const router = useRouter();

  useEffect(() => {
    const raw = localStorage.getItem(LIKES_CACHE_KEY);
    const likes: string[] = raw ? JSON.parse(raw) : [];
    queueMicrotask(() => setLiked(likes.includes(id)));
    const rawB = localStorage.getItem(BOOKMARKS_CACHE_KEY);
    const bookmarks = parseBookmarkEntries(rawB);
    queueMicrotask(() => setBookmarked(bookmarks.some((b) => b.id === id)));
    queueMicrotask(() => {
      setLikeCount(classData.like_count ?? 0);
      setCommentCount(classData.comment_count ?? 0);
      setShareCount(classData.share_count ?? 0);
    });
  }, [id, classData.like_count, classData.comment_count, classData.share_count]);

  useEffect(() => {
    return () => {
      if (likeSyncTimerRef.current !== null) {
        window.clearTimeout(likeSyncTimerRef.current);
      }
    };
  }, []);

  function handleImageClick() {
    setLightboxIndex(imgIndex);
    setLightboxOpen(true);
  }

  async function handleLikeToggle() {
    const supabase = createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      router.push("/login");
      return;
    }
    const raw = localStorage.getItem(LIKES_CACHE_KEY);
    const likes: string[] = raw ? JSON.parse(raw) : [];
    const isLiked = likes.includes(id);
    const next = isLiked ? likes.filter((v) => v !== id) : [...likes, id];
    const desired = !isLiked;

    pendingLikeRef.current = {
      desired,
      previousLiked: isLiked,
      previousCount: likeCount,
    };

    localStorage.setItem(LIKES_CACHE_KEY, JSON.stringify(next));
    try {
      const rawPending = sessionStorage.getItem(LIKE_PENDING_CACHE_KEY);
      const pending = rawPending ? JSON.parse(rawPending) : {};
      sessionStorage.setItem(LIKE_PENDING_CACHE_KEY, JSON.stringify({ ...pending, [id]: desired }));
    } catch {}

    setLiked(desired);
    setLikeCount((count) => Math.max(0, count + (desired ? 1 : -1)));
    setHeartLiked(desired);
    setHeartVisible(true);
    setTimeout(() => setHeartVisible(false), 900);

    if (likeSyncTimerRef.current !== null) {
      window.clearTimeout(likeSyncTimerRef.current);
    }

    likeSyncTimerRef.current = window.setTimeout(() => {
      void syncLikeState();
    }, 1000);
  }

  async function syncLikeState() {
    const pending = pendingLikeRef.current;
    if (!pending) return;

    try {
      const res = await fetch(`/api/classes/${id}/like`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ liked: pending.desired }),
      });

      if (res.status === 401) {
        router.push("/login");
        return;
      }

      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json.error ?? "like failed");
      if (typeof json.like_count === "number") setLikeCount(json.like_count);

      try {
        const rawPending = sessionStorage.getItem(LIKE_PENDING_CACHE_KEY);
        const pendingMap = rawPending ? JSON.parse(rawPending) : {};
        delete pendingMap[id];
        sessionStorage.setItem(LIKE_PENDING_CACHE_KEY, JSON.stringify(pendingMap));
      } catch {}
      pendingLikeRef.current = null;
    } catch {
      setLiked(pending.previousLiked);
      setLikeCount(pending.previousCount);
      pendingLikeRef.current = null;
    }
  }

  function handleBookmark() {
    const rawB = localStorage.getItem(BOOKMARKS_CACHE_KEY);
    const bookmarks = parseBookmarkEntries(rawB);
    const isBookmarked = bookmarks.some((b) => b.id === id);
    if (isBookmarked) {
      localStorage.setItem(
        BOOKMARKS_CACHE_KEY,
        JSON.stringify(bookmarks.filter((b) => b.id !== id))
      );
      setBookmarked(false);
    } else {
      const now = new Date().toISOString();
      localStorage.setItem(
        BOOKMARKS_CACHE_KEY,
        JSON.stringify([...bookmarks, { id, created_at: now }])
      );
      setBookmarked(true);
    }
    window.dispatchEvent(new CustomEvent("bookmarkChanged"));
    fetch("/api/bookmarks/toggle", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ class_id: id, bookmarked: !isBookmarked }),
    }).catch(() => {});
  }

  async function handleEnterClassRoom() {
    if (enteringClassRoom) return;
    setEnteringClassRoom(true);
    setMenuOpen(false);
    setExpanded(false);

    try {
      const supabase = createClient();
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) {
        router.push("/login");
        return;
      }

      const res = await fetch(`/api/chat/rooms/class/${id}`, {
        method: "POST",
      });
      const json = await res.json();
      if (!res.ok) {
        alert(json.error ?? "대화방에 입장하지 못했습니다.");
        return;
      }

      const roomId = json?.data?.id;
      if (!roomId) {
        alert("대화방 정보를 찾지 못했습니다.");
        return;
      }

      router.push(`/messages?roomId=${roomId}`);
    } catch {
      alert("대화방에 입장하지 못했습니다.");
    } finally {
      setEnteringClassRoom(false);
    }
  }

  async function handleApplyClass() {
    if (applyingClass) return;
    setApplyingClass(true);
    setMenuOpen(false);
    setExpanded(false);

    try {
      const supabase = createClient();
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) {
        router.push("/login");
        return;
      }

      const res = await fetch("/api/applications", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ class_id: id }),
      });
      const json = await res.json().catch(() => ({}));
      setFriendMsg(res.ok ? "수업 신청 완료!" : (json.error ?? "수업 신청에 실패했습니다."));
      if (res.ok) setMyApplicationStatus("pending");
      setTimeout(() => setFriendMsg(""), 3000);
    } catch {
      setFriendMsg("수업 신청에 실패했습니다.");
      setTimeout(() => setFriendMsg(""), 3000);
    } finally {
      setApplyingClass(false);
    }
  }

  const touchStartX = useRef(0);
  const touchStartY = useRef(0);
  const isHorizontal = useRef<boolean | null>(null);
  const sliderRef = useRef<HTMLDivElement>(null);
  const lightboxTouchStartX = useRef(0);
  const lightboxTouchStartY = useRef(0);

  const primaryGenre = genres?.[0] ?? "other";
  const imageList = images ?? [];
  const totalImages = imageList.length;

  function handleClassImageError(url: string) {
    setFailedImages((prev) => {
      const prevUrls = prev.classId === id ? prev.urls : new Set<string>();
      if (prevUrls.has(url)) return prev;
      const next = new Set(prevUrls);
      next.add(url);
      return { classId: id, urls: next };
    });
  }

  function handleClassImageLoad(url: string) {
    setLoadedImages((prev) => {
      const prevUrls = prev.classId === id ? prev.urls : new Set<string>();
      if (prevUrls.has(url)) return prev;
      const next = new Set(prevUrls);
      next.add(url);
      return { classId: id, urls: next };
    });
  }

  function renderClassImageFallback() {
    return (
      <div
        className="flex h-full w-full items-center justify-center"
        style={{ backgroundColor: GENRE_BG[primaryGenre] ?? GENRE_BG.other }}
      >
        <span className="text-6xl opacity-30">
          {primaryGenre === "salsa" ? "💃" : primaryGenre === "bachata" ? "🕺" : "🎵"}
        </span>
      </div>
    );
  }

  useEffect(() => {
    const el = sliderRef.current;
    if (!el || totalImages <= 1) return;

    function onTouchStart(e: globalThis.TouchEvent) {
      touchStartX.current = e.touches[0].clientX;
      touchStartY.current = e.touches[0].clientY;
      isHorizontal.current = null;
    }
    function onTouchMove(e: globalThis.TouchEvent) {
      if (isHorizontal.current === null) {
        const dx = Math.abs(e.touches[0].clientX - touchStartX.current);
        const dy = Math.abs(e.touches[0].clientY - touchStartY.current);
        isHorizontal.current = dx > dy;
      }
      if (isHorizontal.current) e.preventDefault();
    }
    function onTouchEnd(e: globalThis.TouchEvent) {
      const diff = touchStartX.current - e.changedTouches[0].clientX;
      if (isHorizontal.current) {
        if (diff > 40) setImgIndex((i) => Math.min(i + 1, totalImages - 1));
        if (diff < -40) setImgIndex((i) => Math.max(i - 1, 0));
      }
    }

    el.addEventListener("touchstart", onTouchStart, { passive: true });
    el.addEventListener("touchmove", onTouchMove, { passive: false });
    el.addEventListener("touchend", onTouchEnd, { passive: true });
    return () => {
      el.removeEventListener("touchstart", onTouchStart);
      el.removeEventListener("touchmove", onTouchMove);
      el.removeEventListener("touchend", onTouchEnd);
    };
  }, [totalImages]);

  useEffect(() => {
    if (!lightboxOpen) return;
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") setLightboxOpen(false);
      if (e.key === "ArrowRight") setLightboxIndex((i) => Math.min(i + 1, totalImages - 1));
      if (e.key === "ArrowLeft") setLightboxIndex((i) => Math.max(i - 1, 0));
    }

    window.addEventListener("keydown", onKeyDown);
    return () => {
      document.body.style.overflow = prevOverflow;
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [lightboxOpen, totalImages]);
  const genreLabel =
    genres?.map((g) => DANCE_GENRE_LABELS[g as keyof typeof DANCE_GENRE_LABELS] ?? g).join(" · ") ??
    "";
  const levelLabel = CLASS_LEVEL_LABELS[level] ?? level;
  const isOwnClass = currentUserId === host_id;
  const isPendingApplication = myApplicationStatus === "pending";
  const currentLightboxImageUrl =
    imageList[lightboxIndex]?.full_url ?? imageList[lightboxIndex]?.card_url ?? null;
  const currentCardImageUrl = imageList[imgIndex]?.card_url ?? null;
  const currentCardImageFailed =
    !currentCardImageUrl ||
    (failedImages.classId === id && failedImages.urls.has(currentCardImageUrl));
  const currentCardImageLoaded =
    currentCardImageFailed ||
    (loadedImages.classId === id &&
      currentCardImageUrl !== null &&
      loadedImages.urls.has(currentCardImageUrl));

  function handleLightboxTouchStart(e: ReactTouchEvent<HTMLDivElement>) {
    lightboxTouchStartX.current = e.touches[0].clientX;
    lightboxTouchStartY.current = e.touches[0].clientY;
  }

  function handleLightboxTouchEnd(e: ReactTouchEvent<HTMLDivElement>) {
    if (totalImages <= 1) return;
    const endX = e.changedTouches[0].clientX;
    const endY = e.changedTouches[0].clientY;
    const dx = lightboxTouchStartX.current - endX;
    const dy = lightboxTouchStartY.current - endY;
    if (Math.abs(dx) <= Math.abs(dy) || Math.abs(dx) < 40) return;
    if (dx > 0) setLightboxIndex((i) => Math.min(i + 1, totalImages - 1));
    if (dx < 0) setLightboxIndex((i) => Math.max(i - 1, 0));
  }

  useEffect(() => {
    if (!menuOpen || isOwnClass) return;

    let cancelled = false;
    const supabase = createClient();

    async function fetchMyApplicationStatus() {
      try {
        const {
          data: { user },
        } = await supabase.auth.getUser();
        if (!user || cancelled) {
          if (!cancelled) setMyApplicationStatus(null);
          return;
        }

        const { data } = await supabase
          .from("applications")
          .select("status")
          .eq("class_id", id)
          .eq("applicant_id", user.id)
          .neq("status", "cancelled")
          .maybeSingle<{ status: "pending" | "approved" | "cancelled" }>();

        if (!cancelled) setMyApplicationStatus(data?.status ?? null);
      } catch {}
    }

    void fetchMyApplicationStatus();
    return () => {
      cancelled = true;
    };
  }, [menuOpen, isOwnClass, id]);

  useEffect(() => {
    if (!expanded || !shouldScrollToDescription.current) return;
    shouldScrollToDescription.current = false;
    requestAnimationFrame(() => {
      descriptionRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
    });
  }, [expanded]);

  function handleToggleExpanded() {
    setExpanded((prev) => {
      if (!prev) shouldScrollToDescription.current = true;
      return !prev;
    });
  }

  async function handleOpenShare() {
    const supabase = createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      router.push("/login");
      return;
    }

    setShareOpen(true);
  }

  function handleShareComplete(sentCount: number) {
    setShareCount((count) => count + sentCount);
    setShareComplete(true);
    window.setTimeout(() => setShareComplete(false), 1000);
  }

  function renderMoreMenu(buttonClassName: string) {
    return (
      <div className="relative">
        <button
          type="button"
          aria-label="더보기"
          className={buttonClassName}
          onClick={() => setMenuOpen((v) => !v)}
        >
          <svg
            xmlns="http://www.w3.org/2000/svg"
            width="20"
            height="20"
            viewBox="0 0 24 24"
            fill="currentColor"
          >
            <circle cx="5" cy="12" r="2" />
            <circle cx="12" cy="12" r="2" />
            <circle cx="19" cy="12" r="2" />
          </svg>
        </button>
        {menuOpen && (
          <>
            <div className="fixed inset-0 z-40" onClick={() => setMenuOpen(false)} />
            <div
              className="absolute right-0 top-full z-50 max-h-[70vh] overflow-y-auto rounded-xl border border-gray-100 bg-white text-gray-900 shadow-lg"
              style={{ width: 180 }}
            >
              {isOwnClass ? (
                <>
                  <button
                    type="button"
                    className="flex w-full items-center px-4 py-3 text-sm text-gray-700"
                    onClick={() => {
                      setMenuOpen(false);
                      router.push(`/classes/${id}`);
                    }}
                  >
                    상세보기
                  </button>
                  <div className="mx-3 border-t border-gray-100" />
                  <button
                    type="button"
                    className="flex w-full items-center px-4 py-3 text-sm text-gray-700 disabled:opacity-60"
                    onClick={() => {
                      void handleEnterClassRoom();
                    }}
                    disabled={enteringClassRoom}
                  >
                    {enteringClassRoom ? "입장 중..." : "대화방입장"}
                  </button>
                  <div className="mx-3 border-t border-gray-100" />
                  <button
                    type="button"
                    className="flex w-full items-center px-4 py-3 text-sm text-gray-700"
                    onClick={() => {
                      setMenuOpen(false);
                      setApplicantSheetOpen(true);
                    }}
                  >
                    신청자 목록
                  </button>
                  <div className="mx-3 border-t border-gray-100" />
                  <button
                    type="button"
                    className="flex w-full items-center px-4 py-3 text-sm text-gray-700"
                    onClick={() => {
                      setMenuOpen(false);
                      router.push(`/classes/${id}/edit`);
                    }}
                  >
                    클래스 수정
                  </button>
                </>
              ) : (
                <>
                  <button
                    type="button"
                    className="flex w-full items-center justify-between px-4 py-3 text-sm text-gray-700"
                    onClick={() => {
                      setMenuOpen(false);
                      router.push(`/classes/${id}`);
                    }}
                  >
                    <span>상세보기</span>
                    <svg
                      xmlns="http://www.w3.org/2000/svg"
                      width="17"
                      height="17"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      className="text-gray-500"
                    >
                      <path d="M9 18l6-6-6-6" />
                    </svg>
                  </button>
                  <div className="mx-3 border-t border-gray-100" />
                  <button
                    type="button"
                    onClick={() => {
                      void handleApplyClass();
                    }}
                    disabled={applyingClass || status !== "recruiting" || isPendingApplication}
                    className="flex w-full items-center justify-between px-4 py-3 text-sm text-gray-700 disabled:opacity-60"
                  >
                    <span>{applyingClass ? "신청 중..." : "수업신청"}</span>
                    <svg
                      xmlns="http://www.w3.org/2000/svg"
                      width="17"
                      height="17"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      className="text-gray-500"
                    >
                      <path d="M4 12h16" />
                      <path d="M12 4v16" />
                    </svg>
                  </button>
                  <div className="mx-3 border-t border-gray-100" />
                  <button
                    type="button"
                    onClick={() => {
                      setMenuOpen(false);
                      setMessageModalOpen(true);
                    }}
                    className="flex w-full items-center justify-between px-4 py-3 text-sm text-gray-700"
                  >
                    <span>메세지전송</span>
                    <svg
                      xmlns="http://www.w3.org/2000/svg"
                      width="17"
                      height="17"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      className="text-gray-500"
                    >
                      <line x1="22" y1="2" x2="11" y2="13" />
                      <polygon points="22 2 15 22 11 13 2 9 22 2" />
                    </svg>
                  </button>
                  <div className="mx-3 border-t border-gray-100" />
                  <button
                    type="button"
                    onClick={() => {
                      setMenuOpen(false);
                      handleBookmark();
                    }}
                    className="flex w-full items-center justify-between px-4 py-3 text-sm text-gray-700"
                  >
                    <span>북마크저장</span>
                    <svg
                      xmlns="http://www.w3.org/2000/svg"
                      width="17"
                      height="17"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      className="text-gray-500"
                    >
                      <polygon points="19 21 12 16 5 21 5 3 19 3" />
                    </svg>
                  </button>
                  <div className="mx-3 border-t border-gray-100" />
                  <button
                    type="button"
                    className="flex w-full items-center justify-between px-4 py-3 text-sm text-gray-700"
                  >
                    <span>게시물신고</span>
                    <svg
                      xmlns="http://www.w3.org/2000/svg"
                      width="17"
                      height="17"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      className="text-gray-500"
                    >
                      <path d="M4 15s1-1 4-1 5 2 8 2 4-1 4-1V3s-1 1-4 1-5-2-8-2-4 1-4 1z" />
                      <line x1="4" y1="22" x2="4" y2="15" />
                    </svg>
                  </button>
                </>
              )}
            </div>
          </>
        )}
      </div>
    );
  }

  return (
    <>
      <div className="bg-white">
        <div ref={sliderRef} className="relative w-full">
          {totalImages > 0 ? (
            <div className="block w-full cursor-default overflow-hidden" onClick={handleImageClick}>
              <div
                style={{
                  display: "flex",
                  transform: `translateX(-${imgIndex * 100}%)`,
                  transition: "transform 0.35s cubic-bezier(0.25, 0.46, 0.45, 0.94)",
                }}
              >
                {imageList.map((img, i) => {
                  const imageUrl = img.card_url;
                  const imageFailed =
                    !imageUrl || (failedImages.classId === id && failedImages.urls.has(imageUrl));

                  return (
                    <div key={i} className="relative min-w-full overflow-hidden">
                      {imageFailed ? (
                        renderClassImageFallback()
                      ) : (
                        <Image
                          src={imageUrl}
                          alt={title}
                          width={0}
                          height={0}
                          sizes="100vw"
                          priority={priorityImage && i === 0}
                          style={{ width: "100%", height: "auto" }}
                          onLoad={() => handleClassImageLoad(imageUrl)}
                          onError={() => handleClassImageError(imageUrl)}
                        />
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          ) : (
            <div className="block w-full cursor-default overflow-hidden">
              <div className="aspect-[3/4] w-full">{renderClassImageFallback()}</div>
            </div>
          )}
          <div
            className={`pointer-events-none absolute inset-x-0 top-0 z-20 h-[100px] transition-opacity duration-300 ${
              currentCardImageLoaded ? "opacity-100" : "opacity-0"
            }`}
          >
            <div className="relative h-full px-3 pt-3 text-white" style={{ textShadow: "0 1px 4px rgba(0,0,0,0.8), 0 0 2px rgba(0,0,0,0.6)" }}>
              <div className="pointer-events-auto absolute right-3 top-2 z-30">
                {renderMoreMenu(
                  "flex h-9 w-9 items-center justify-center rounded-full text-white drop-shadow-sm"
                )}
              </div>
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  handleToggleExpanded();
                }}
                className="pointer-events-auto block w-full text-left"
              >
                <p className="flex min-w-0 items-center gap-1.5 text-base font-semibold leading-tight text-white drop-shadow-sm">
                  <span className="min-w-0 truncate">{title}</span>
                  {status === "recruiting" && (
                    <span
                      className="h-2 w-2 flex-shrink-0 rounded-full bg-green-400"
                      aria-label="모집중"
                    />
                  )}
                </p>
                <p className="mt-0.5 truncate text-sm leading-tight text-white/85 drop-shadow-sm">
                  {region} | {levelLabel} | {genreLabel}
                </p>
              </button>
            </div>
          </div>
          {totalImages > 1 && (
            <div className="absolute bottom-3 right-3 z-20 rounded-full bg-black/45 px-2.5 py-0.5 text-xs font-medium text-white">
              {imgIndex + 1}/{totalImages}
            </div>
          )}
          {heartVisible && (
            <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
              <svg
                xmlns="http://www.w3.org/2000/svg"
                viewBox="0 0 24 24"
                fill={heartLiked ? "#ff3b5c" : "white"}
                className="drop-shadow-lg"
                style={{ width: 80, height: 80, animation: "heartPop 0.9s ease forwards" }}
              >
                <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z" />
              </svg>
            </div>
          )}
          {totalImages > 1 && (
            <div className="absolute bottom-3 left-1/2 -translate-x-1/2 flex gap-1.5">
              {imageList.map((_, i) => (
                <button
                  key={i}
                  onClick={() => setImgIndex(i)}
                  className="rounded-full transition-all"
                  style={{
                    width: i === imgIndex ? 12 : 9,
                    height: i === imgIndex ? 12 : 9,
                    backgroundColor: i === imgIndex ? "white" : "rgba(255,255,255,0.5)",
                  }}
                />
              ))}
            </div>
          )}
        </div>

        {/* 액션 아이콘 */}
        <div className="flex items-center justify-between px-3 pt-2">
          <div className="flex items-center gap-4">
            {/* 북마크 */}
            <button
              type="button"
              onClick={handleBookmark}
              aria-label="북마크"
              className="flex items-center gap-1"
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
                className="text-gray-800"
              >
                <polygon points="19 21 12 16 5 21 5 3 19 3" />
              </svg>
              <span className="text-sm font-semibold text-gray-800">5</span>
            </button>
            {/* 좋아요 */}
            <button
              type="button"
              onClick={() => void handleLikeToggle()}
              aria-label="좋아요"
              className="flex items-center gap-1"
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
                className="text-gray-800"
              >
                <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z" />
              </svg>
              <span className="text-sm font-semibold text-gray-800">{likeCount}</span>
            </button>
          </div>
          <div className="flex items-center gap-4">
            {/* 댓글 */}
            <button
              type="button"
              onClick={() => setCommentOpen(true)}
              aria-label="댓글보기"
              className="flex items-center gap-1"
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
                className="text-gray-800"
              >
                <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
              </svg>
              <span className="text-sm font-semibold text-gray-800">{commentCount}</span>
            </button>
            {/* 공유 */}
            <button
              type="button"
              onClick={() => void handleOpenShare()}
              aria-label="공유"
              className="flex items-center gap-1"
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
                className="text-gray-800"
              >
                <line x1="22" y1="2" x2="11" y2="13" />
                <polygon points="22 2 15 22 11 13 2 9 22 2" />
              </svg>
              <span className="text-sm font-semibold text-gray-800">{shareCount}</span>
            </button>
          </div>
        </div>

        {/* 개설자 정보 */}
        <div className={`flex items-center gap-2 px-3 pt-2 ${expanded ? "pb-1" : "pb-4"}`}>
          {host?.profile_image_url ? (
            <Image
              src={host.profile_image_url}
              alt={host?.nickname ?? ""}
              width={35}
              height={35}
              className="h-[35px] w-[35px] flex-shrink-0 rounded-full object-cover"
            />
          ) : (
            <div className="flex h-[35px] w-[35px] flex-shrink-0 items-center justify-center rounded-full bg-gray-200 text-xs font-medium text-gray-500">
              {host?.nickname?.[0] ?? "?"}
            </div>
          )}
          <div className="min-w-0 flex-1">
            <span className="block truncate text-[15px] font-bold leading-tight text-gray-900">
              {host?.nickname ?? ""}
            </span>
            <button
              type="button"
              onClick={handleToggleExpanded}
              className="block w-full truncate text-left text-[13px] leading-tight text-gray-400"
            >
              {levelLabel} · {formatDate(datetime)}
              {!expanded && (
                <span className="inline-flex items-center gap-0.5 font-bold text-gray-500">
                  {" ...더 보기"}
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    width="13"
                    height="13"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2.5"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
                    <polyline points="6 9 12 15 18 9" />
                  </svg>
                </span>
              )}
            </button>
          </div>
        </div>
        {description && (
          <div className={expanded ? "px-3 pb-3" : "hidden"}>
            <div ref={descriptionRef} className="scroll-mt-[250px]">
              <MentionText
                text={description}
                className="text-[15px] text-gray-600 mt-2 whitespace-pre-wrap leading-relaxed"
              />
            </div>
          </div>
        )}
      </div>
      {lightboxOpen && totalImages > 0 && (
        <div
          className="fixed inset-0 z-[260] bg-black/95 flex items-center justify-center"
          onClick={() => setLightboxOpen(false)}
        >
          {currentLightboxImageUrl && (
            <a
              href={currentLightboxImageUrl}
              download
              aria-label="사진 다운로드"
              className="absolute top-4 left-4 z-20 text-white"
              onClick={(e) => e.stopPropagation()}
            >
              <svg
                xmlns="http://www.w3.org/2000/svg"
                width="26"
                height="26"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2.2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                <polyline points="7 10 12 15 17 10" />
                <line x1="12" y1="15" x2="12" y2="3" />
              </svg>
            </a>
          )}
          <button
            type="button"
            aria-label="닫기"
            className="absolute top-4 right-4 z-20 text-white"
            onClick={() => setLightboxOpen(false)}
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              width="28"
              height="28"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
          {totalImages > 1 && lightboxIndex > 0 && (
            <button
              type="button"
              aria-label="이전 사진"
              className="absolute left-3 z-20 text-white/85 hover:text-white"
              onClick={(e) => {
                e.stopPropagation();
                setLightboxIndex((i) => Math.max(i - 1, 0));
              }}
            >
              <svg
                xmlns="http://www.w3.org/2000/svg"
                width="34"
                height="34"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2.2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <polyline points="15 18 9 12 15 6" />
              </svg>
            </button>
          )}
          <div
            className="relative w-[92vw] max-w-[900px] max-h-[88vh] overflow-hidden"
            onClick={(e) => e.stopPropagation()}
            onTouchStart={handleLightboxTouchStart}
            onTouchEnd={handleLightboxTouchEnd}
          >
            <div
              className="flex"
              style={{
                transform: `translateX(-${lightboxIndex * 100}%)`,
                transition: "transform 320ms cubic-bezier(0.22, 1, 0.36, 1)",
                willChange: "transform",
              }}
            >
              {imageList.map((img, index) => (
                <div
                  key={`${img.full_url ?? img.card_url}-${index}`}
                  className="min-w-full flex items-center justify-center"
                >
                  <Image
                    src={img.full_url ?? img.card_url}
                    alt={title}
                    width={1200}
                    height={1600}
                    className="w-full h-auto max-h-[88vh] object-contain select-none"
                    draggable={false}
                  />
                </div>
              ))}
            </div>
          </div>
          {totalImages > 1 && lightboxIndex < totalImages - 1 && (
            <button
              type="button"
              aria-label="다음 사진"
              className="absolute right-3 z-20 text-white/85 hover:text-white"
              onClick={(e) => {
                e.stopPropagation();
                setLightboxIndex((i) => Math.min(i + 1, totalImages - 1));
              }}
            >
              <svg
                xmlns="http://www.w3.org/2000/svg"
                width="34"
                height="34"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2.2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <polyline points="9 18 15 12 9 6" />
              </svg>
            </button>
          )}
          {totalImages > 1 && (
            <div className="absolute bottom-6 z-20 text-white/85 text-sm">
              {lightboxIndex + 1} / {totalImages}
            </div>
          )}
        </div>
      )}
      <ClassCommentsPanel
        classId={id}
        mode="sheet"
        open={commentOpen}
        onClose={() => setCommentOpen(false)}
        onCommentCreated={() => setCommentCount((count) => count + 1)}
      />
      <ClassShareSheet
        open={shareOpen}
        classData={classData}
        onClose={() => setShareOpen(false)}
        onShared={handleShareComplete}
      />
      {shareComplete && (
        <div className="pointer-events-none fixed inset-0 z-[310] flex items-center justify-center">
          <div className="flex h-16 w-16 items-center justify-center rounded-full bg-white text-3xl font-bold text-green-500 shadow-2xl">
            ✓
          </div>
        </div>
      )}
      {friendMsg && (
        <div className="fixed top-20 left-1/2 -translate-x-1/2 z-[300] bg-gray-800 text-white text-sm px-4 py-2 rounded-full shadow-lg">
          {friendMsg}
        </div>
      )}
      {host && (
        <SendMessageModal
          isOpen={messageModalOpen}
          onClose={() => setMessageModalOpen(false)}
          receiver={{
            id: host.id,
            nickname: host.nickname,
            profile_image_url: host.profile_image_url,
          }}
        />
      )}
      {isOwnClass && (
        <ClassApplicantSheet
          open={applicantSheetOpen}
          classId={id}
          onClose={() => setApplicantSheetOpen(false)}
        />
      )}
    </>
  );
}
