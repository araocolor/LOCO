"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { parseBookmarkEntries } from "@/lib/bookmarks/local";
import { DanceClass, DANCE_GENRE_LABELS, CLASS_LEVEL_LABELS } from "@/types/class";
import CommentSheet from "@/components/class/CommentSheet";
import SendMessageModal from "@/components/modal/SendMessageModal";

const LIKES_CACHE_KEY = "loco_liked_posts";
const BOOKMARKS_CACHE_KEY = "loco_bookmark_ids_v1";
const SEARCH_CACHE_KEY = "search_prefetch_cache";

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
}

const GENRE_BG: Record<string, string> = {
  salsa: "#FFE4E4",
  bachata: "#EDE4FF",
  festival: "#FFF9D9",
  event: "#E4EEFF",
  other: "#F0F0F0",
};

const GENRE_CHIP: Record<string, string> = {
  salsa: "bg-red-50 text-red-600",
  bachata: "bg-purple-50 text-purple-600",
  festival: "bg-yellow-50 text-yellow-700",
  event: "bg-blue-50 text-blue-600",
  other: "bg-gray-100 text-gray-600",
};

const STATUS_MAP = {
  recruiting: { label: "모집중", cls: "bg-green-50 text-green-600" },
  closed: { label: "마감", cls: "bg-gray-100 text-gray-500" },
  cancelled: { label: "취소", cls: "bg-red-50 text-red-500" },
} as const;

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

function isClassStarted(datetime: string) {
  return new Date(datetime).getTime() <= Date.now();
}

function calcDaysLeft(deadline: string) {
  const now = new Date();
  now.setHours(0, 0, 0, 0);
  const d = new Date(deadline);
  d.setHours(0, 0, 0, 0);
  return Math.ceil((d.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
}

function readCachedFollowingIds() {
  try {
    const raw = localStorage.getItem(SEARCH_CACHE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed.following)) return null;
    return new Set<string>(parsed.following.map((item: { id: string }) => item.id));
  } catch {
    return null;
  }
}

function writeFriendToSearchCache(host: ClassHost) {
  try {
    const raw = localStorage.getItem(SEARCH_CACHE_KEY);
    const parsed = raw ? JSON.parse(raw) : {};
    const following = Array.isArray(parsed.following) ? parsed.following : [];
    if (following.some((item: { id: string }) => item.id === host.id)) return;
    localStorage.setItem(
      SEARCH_CACHE_KEY,
      JSON.stringify({
        ...parsed,
        following: [{ ...host, status: "approved" }, ...following],
        ts: Date.now(),
      })
    );
  } catch {}
}

export default function ClassCard({ classData }: ClassCardProps) {
  const { id, host_id, title, genres, level, datetime, deadline, region, status, images, host, is_modified, description } =
    classData;
  const [expanded, setExpanded] = useState(false);
  const [imgIndex, setImgIndex] = useState(0);
  const [menuOpen, setMenuOpen] = useState(false);
  const [friendMsg, setFriendMsg] = useState("");
  const [statusExpanded, setStatusExpanded] = useState(false);
  const [commentOpen, setCommentOpen] = useState(false);
  const [userExpanded, setUserExpanded] = useState(false);
  const [liked, setLiked] = useState(false);
  const [bookmarked, setBookmarked] = useState(false);
  const [heartVisible, setHeartVisible] = useState(false);
  const [heartLiked, setHeartLiked] = useState(false);
  const [messageModalOpen, setMessageModalOpen] = useState(false);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const router = useRouter();

  useEffect(() => {
    const raw = localStorage.getItem(LIKES_CACHE_KEY);
    const likes: string[] = raw ? JSON.parse(raw) : [];
    setLiked(likes.includes(id));
    const rawB = localStorage.getItem(BOOKMARKS_CACHE_KEY);
    const bookmarks = parseBookmarkEntries(rawB);
    setBookmarked(bookmarks.some((b) => b.id === id));
  }, [id]);

  useEffect(() => {
    let cancelled = false;

    createClient().auth.getUser().then(({ data: { user } }) => {
      if (!cancelled) setCurrentUserId(user?.id ?? null);
    });

    return () => {
      cancelled = true;
    };
  }, []);

  async function handleImageClick() {
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      router.push("/login");
      return;
    }
    const raw = localStorage.getItem(LIKES_CACHE_KEY);
    const likes: string[] = raw ? JSON.parse(raw) : [];
    const isLiked = likes.includes(id);
    const next = isLiked ? likes.filter((v) => v !== id) : [...likes, id];
    localStorage.setItem(LIKES_CACHE_KEY, JSON.stringify(next));
    setLiked(!isLiked);
    setHeartLiked(!isLiked);
    setHeartVisible(true);
    setTimeout(() => setHeartVisible(false), 900);
  }
  function handleBookmark() {
    const rawB = localStorage.getItem(BOOKMARKS_CACHE_KEY);
    const bookmarks = parseBookmarkEntries(rawB);
    const isBookmarked = bookmarks.some((b) => b.id === id);
    if (isBookmarked) {
      localStorage.setItem(BOOKMARKS_CACHE_KEY, JSON.stringify(bookmarks.filter((b) => b.id !== id)));
      setBookmarked(false);
    } else {
      const now = new Date().toISOString();
      localStorage.setItem(BOOKMARKS_CACHE_KEY, JSON.stringify([...bookmarks, { id, created_at: now }]));
      setBookmarked(true);
    }
    window.dispatchEvent(new CustomEvent("bookmarkChanged"));
    fetch("/api/bookmarks/toggle", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ class_id: id, bookmarked: !isBookmarked }),
    }).catch(() => {});
  }

  const touchStartX = useRef(0);
  const touchStartY = useRef(0);
  const isHorizontal = useRef<boolean | null>(null);
  const sliderRef = useRef<HTMLDivElement>(null);

  const primaryGenre = genres?.[0] ?? "other";
  const imageList = images ?? [];
  const totalImages = imageList.length;

  useEffect(() => {
    const el = sliderRef.current;
    if (!el || totalImages <= 1) return;

    function onTouchStart(e: TouchEvent) {
      touchStartX.current = e.touches[0].clientX;
      touchStartY.current = e.touches[0].clientY;
      isHorizontal.current = null;
    }
    function onTouchMove(e: TouchEvent) {
      if (isHorizontal.current === null) {
        const dx = Math.abs(e.touches[0].clientX - touchStartX.current);
        const dy = Math.abs(e.touches[0].clientY - touchStartY.current);
        isHorizontal.current = dx > dy;
      }
      if (isHorizontal.current) e.preventDefault();
    }
    function onTouchEnd(e: TouchEvent) {
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
  const genreLabel = genres?.map((g) => DANCE_GENRE_LABELS[g as keyof typeof DANCE_GENRE_LABELS] ?? g).join(" · ") ?? "";
  const levelLabel = CLASS_LEVEL_LABELS[level] ?? level;
  const statusInfo = STATUS_MAP[status] ?? STATUS_MAP.recruiting;
  const chipCls = GENRE_CHIP[primaryGenre] ?? GENRE_CHIP.other;
  const isHostFriend = !!host?.id && readCachedFollowingIds()?.has(host.id) === true;
  const isOwnClass = currentUserId === host_id;

  return (
    <>
      <div className="bg-white">
        {/* 개설자 아이콘 - 상단 */}
        <div className="flex items-center gap-2 px-3 pt-3 pb-2">
          {host?.profile_image_url ? (
            <Image
              src={host.profile_image_url}
              alt={host?.nickname ?? ""}
              width={35}
              height={35}
              className="rounded-full object-cover flex-shrink-0 w-[35px] h-[35px]"
            />
          ) : (
            <div className="w-[35px] h-[35px] rounded-full bg-gray-200 flex items-center justify-center text-gray-500 text-xs font-medium flex-shrink-0">
              {host?.nickname?.[0] ?? "?"}
            </div>
          )}
          <div className="flex flex-col flex-1 gap-0">
            <span className="font-bold text-gray-900" style={{ fontSize: "15px", lineHeight: "1.1" }}>{host?.nickname ?? ""}</span>
            <span className="text-gray-400" style={{ fontSize: "13px", lineHeight: "1.1" }}>{region} | {levelLabel} | {genreLabel}</span>
          </div>
          <div className="relative">
            <button className="p-1 text-gray-400" onClick={() => { setMenuOpen((v) => !v); setUserExpanded(false); }}>
              <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
                <circle cx="5" cy="12" r="2"/><circle cx="12" cy="12" r="2"/><circle cx="19" cy="12" r="2"/>
              </svg>
            </button>
            {menuOpen && (
              <>
                <div className="fixed inset-0 z-40" onClick={() => { setMenuOpen(false); setUserExpanded(false); }} />
                <div
                  className="absolute right-0 top-full z-50 bg-white rounded-xl shadow-lg border border-gray-100 overflow-hidden"
                  style={{ width: 180 }}
                >
                  {isOwnClass ? (
                    <>
                      <button type="button" className="flex items-center w-full px-4 py-3 text-sm text-gray-700">
                        대화방입장
                      </button>
                      <div className="border-t border-gray-100 mx-3" />
                      <button type="button" className="flex items-center w-full px-4 py-3 text-sm text-gray-700">
                        클래스 수정
                      </button>
                      <div className="border-t border-gray-100 mx-3" />
                      <button type="button" className="flex items-center w-full px-4 py-3 text-sm text-gray-700">
                        클래스정보
                      </button>
                    </>
                  ) : (
                    <>
                      {/* 다운로드 */}
                      <button className="flex items-center justify-between w-full px-4 py-3 text-sm text-gray-700 ">
                        <span>다운로드</span>
                        <svg xmlns="http://www.w3.org/2000/svg" width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-gray-500">
                          <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/>
                        </svg>
                      </button>
                      <div className="border-t border-gray-100 mx-3" />
                      {/* 북마크저장 */}
                      <button className="flex items-center justify-between w-full px-4 py-3 text-sm text-gray-700 ">
                        <span>북마크저장</span>
                        <svg xmlns="http://www.w3.org/2000/svg" width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-gray-500">
                          <polygon points="19 21 12 16 5 21 5 3 19 3"/>
                        </svg>
                      </button>
                      {!isHostFriend && (
                        <>
                          <div className="border-t border-gray-100 mx-3" />
                          {/* 친구등록 */}
                          <button
                            onClick={async () => {
                              if (!host?.id) return;
                              setMenuOpen(false);
                              const res = await fetch("/api/friends", {
                                method: "POST",
                                headers: { "Content-Type": "application/json" },
                                body: JSON.stringify({ target_id: host.id }),
                              });
                              const data = await res.json();
                              if (res.ok) {
                                writeFriendToSearchCache(host);
                              }
                              setFriendMsg(res.ok ? "친구등록 완료!" : (data.error ?? "오류가 발생했습니다"));
                              setTimeout(() => setFriendMsg(""), 3000);
                            }}
                            className="flex items-center justify-between w-full px-4 py-3 text-sm text-gray-700">
                            <span>친구등록</span>
                            <svg xmlns="http://www.w3.org/2000/svg" width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-gray-500">
                              <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><line x1="19" y1="8" x2="19" y2="14"/><line x1="22" y1="11" x2="16" y2="11"/>
                            </svg>
                          </button>
                        </>
                      )}
                      <div className="border-t border-gray-100 mx-3" />
                      {/* 메세지전송 */}
                      <button
                        onClick={() => {
                          setMenuOpen(false);
                          setMessageModalOpen(true);
                        }}
                        className="flex items-center justify-between w-full px-4 py-3 text-sm text-gray-700"
                      >
                        <span>메세지전송</span>
                        <svg xmlns="http://www.w3.org/2000/svg" width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-gray-500">
                          <line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/>
                        </svg>
                      </button>
                      <div className="border-t border-gray-100 mx-3" />
                      {/* 사용자 펼침 */}
                      <div>
                        <button
                          className="flex items-center justify-between w-full px-4 py-3 text-sm text-gray-700"
                          onClick={() => setUserExpanded((v) => !v)}
                        >
                          <span className="font-bold">{host?.nickname ?? "사용자"}</span>
                          <svg xmlns="http://www.w3.org/2000/svg" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-gray-400" style={{ transform: userExpanded ? "rotate(90deg)" : "rotate(0deg)", transition: "transform 0.2s" }}>
                            <polyline points="9 18 15 12 9 6"/>
                          </svg>
                        </button>
                        {userExpanded && (
                          <div>
                            {[
                              { icon: "flag", label: "게시물 신고" },
                              { icon: "slash", label: "블랙등록" },
                            ].map(({ icon, label }, idx) => (
                              <div key={label}>
                                {idx > 0 && <div className="border-t border-gray-200 mx-3" />}
                                <button className="flex items-center justify-between w-full px-4 py-2.5 text-sm text-gray-700">
                                  <span>{label}</span>
                                  <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                    {icon === "flag" && <><path d="M4 15s1-1 4-1 5 2 8 2 4-1 4-1V3s-1 1-4 1-5-2-8-2-4 1-4 1z"/><line x1="4" y1="22" x2="4" y2="15"/></>}
                                    {icon === "slash" && <><circle cx="12" cy="12" r="10"/><line x1="4.93" y1="4.93" x2="19.07" y2="19.07"/></>}
                                  </svg>
                                </button>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    </>
                  )}
                </div>
              </>
            )}
          </div>
        </div>

        <div ref={sliderRef} className="relative w-full overflow-hidden">
          {totalImages > 0 ? (
            <div className="block w-full cursor-default" onClick={handleImageClick}>
              <div
                style={{
                  display: "flex",
                  transform: `translateX(-${imgIndex * 100}%)`,
                  transition: "transform 0.35s cubic-bezier(0.25, 0.46, 0.45, 0.94)",
                }}
              >
                {imageList.map((img, i) => (
                  <div
                    key={i}
                    style={{ minWidth: "100%", maxHeight: "calc(100vw * 4 / 3)", overflow: "hidden", display: "flex", alignItems: "flex-end" }}
                  >
                    <Image
                      src={img.card_url}
                      alt={title}
                      width={0}
                      height={0}
                      sizes="100vw"
                      style={{ width: "100%", height: "auto" }}
                    />
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <div className="block w-full cursor-default">
              <div
                className="w-full aspect-[3/4] flex items-center justify-center"
                style={{ backgroundColor: GENRE_BG[primaryGenre] ?? GENRE_BG.other }}
              >
                <span className="text-6xl opacity-30">
                  {primaryGenre === "salsa" ? "💃" : primaryGenre === "bachata" ? "🕺" : "🎵"}
                </span>
              </div>
            </div>
          )}
          {/* 상태 배지 */}
          {(status === "recruiting" || status === "closed") && (() => {
            const daysLeft = deadline ? calcDaysLeft(deadline) : null;
            const deadlineLabel = deadline
              ? new Date(deadline).toLocaleDateString("ko-KR", { year: "numeric", month: "numeric", day: "numeric" })
              : "";
            const daysText = daysLeft !== null
              ? daysLeft > 0 ? `마감 ${daysLeft}일전` : daysLeft === 0 ? "오늘 마감" : "마감"
              : "";
            const inProgress = status === "recruiting" && isClassStarted(datetime);
            return (
              <div className="absolute top-2 left-2 flex items-center">
                {/* 확장 버튼 — 기존 버튼 뒤에서 오른쪽으로 슬라이드 */}
                <div
                  className="absolute left-0 flex items-center overflow-hidden transition-all duration-300 ease-out pointer-events-none"
                  style={{ maxWidth: statusExpanded ? 280 : 0 }}
                >
                  <div className="bg-black text-[#FEE500] text-xs font-semibold rounded-full whitespace-nowrap"
                    style={{ padding: "4px 12px 4px 70px" }}
                  >
                    {deadlineLabel} · {daysText}
                  </div>
                </div>
                {/* 기존 배지 버튼 — z-index로 위에 */}
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    setStatusExpanded((v) => {
                      if (!v) setTimeout(() => setStatusExpanded(false), 4000);
                      return !v;
                    });
                  }}
                  className={`relative z-10 flex items-center text-[#FEE500] text-xs font-semibold rounded-full whitespace-nowrap ${inProgress ? "bg-red-600 border border-[#FEE500]" : status === "recruiting" ? "bg-black border border-[#FEE500]" : "bg-black"}`}
                  style={{ padding: "6px 16px" }}
                >
                  {inProgress ? "수업중" : status === "recruiting" ? "모집중" : "마감"}
                </button>
              </div>
            );
          })()}
          {totalImages > 1 && (
            <div className="absolute top-2 right-2 bg-white/80 text-gray-900 text-xs font-medium px-2.5 py-0.5 rounded-full">
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
                <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/>
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
        <div className="flex items-center justify-between px-3 pt-3">
          <div className="flex items-center gap-4">
            {/* 좋아요 */}
            <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill={liked ? "#ff3b5c" : "none"} stroke={liked ? "#ff3b5c" : "currentColor"} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-gray-800">
              <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z" />
            </svg>
            {/* 댓글 */}
            <button onClick={() => setCommentOpen(true)}>
              <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-gray-800">
                <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
              </svg>
            </button>
            {/* 메세지 */}
            <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-gray-800">
              <line x1="22" y1="2" x2="11" y2="13" /><polygon points="22 2 15 22 11 13 2 9 22 2" />
            </svg>
          </div>
          {/* 북마크 */}
          <button onClick={handleBookmark}>
            <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill={bookmarked ? "#1a1a1a" : "none"} stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-gray-800">
              <polygon points="19 21 12 16 5 21 5 3 19 3" />
            </svg>
          </button>
        </div>

        {/* 제목/정보 */}
        <div className="flex items-start gap-2 px-3 pt-2 pb-3">
          <div className="flex flex-col min-w-0 flex-1">
            <button
              onClick={() => setExpanded((v) => !v)}
              className="text-left w-full"
            >
              <p className="text-base text-gray-900 font-semibold line-clamp-1">{title}</p>
              <p className="text-gray-500" style={{ fontSize: "14px" }}>
                {levelLabel} · {formatDate(datetime)}{!expanded && <span className="text-gray-500 font-bold inline-flex items-center gap-0.5" style={{ fontSize: "14px" }}> ...더 보기 <svg xmlns="http://www.w3.org/2000/svg" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="6 9 12 15 18 9"/></svg></span>}
              </p>
            </button>
            {expanded && description && (
              <p className="text-sm text-gray-600 mt-2 whitespace-pre-wrap leading-relaxed">{description}</p>
            )}
          </div>
        </div>
      </div>
      <CommentSheet open={commentOpen} onClose={() => setCommentOpen(false)} classId={id} />
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
    </>
  );
}
