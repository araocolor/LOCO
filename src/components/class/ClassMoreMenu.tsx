"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { parseBookmarkEntries } from "@/lib/bookmarks/local";
import ClassApplicantSheet from "@/components/class/ClassApplicantSheet";
import SendMessageModal from "@/components/modal/SendMessageModal";

const BOOKMARKS_CACHE_KEY = "loco_bookmark_ids_v1";

interface ClassMoreMenuProps {
  classId: string;
  hostId: string;
  hostNickname?: string;
  hostImageUrl?: string | null;
  status: string;
  buttonClassName?: string;
  onDetailView?: () => void;
}

export default function ClassMoreMenu({
  classId,
  hostId,
  hostNickname,
  hostImageUrl,
  status,
  buttonClassName = "flex items-center justify-center w-8 h-8 text-white drop-shadow",
  onDetailView,
}: ClassMoreMenuProps) {
  const [menuOpen, setMenuOpen] = useState(false);
  const [enteringClassRoom, setEnteringClassRoom] = useState(false);
  const [applyingClass, setApplyingClass] = useState(false);
  const [applicantSheetOpen, setApplicantSheetOpen] = useState(false);
  const [messageModalOpen, setMessageModalOpen] = useState(false);
  const [myApplicationStatus, setMyApplicationStatus] = useState<
    "pending" | "approved" | "cancelled" | null
  >(null);
  const { user: authUser } = useAuth();
  const currentUserId = authUser?.id ?? null;
  const isOwnClass = currentUserId === hostId;
  const isPendingApplication = myApplicationStatus === "pending";
  const router = useRouter();
  const buttonRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const [menuStyle, setMenuStyle] = useState<React.CSSProperties>({});

  const computeMenuPosition = useCallback(() => {
    const btn = buttonRef.current;
    const menu = menuRef.current;
    if (!btn || !menu) return;

    const btnRect = btn.getBoundingClientRect();
    const menuRect = menu.getBoundingClientRect();
    const vw = window.innerWidth;
    const vh = window.innerHeight;

    let top = btnRect.bottom;
    let left = btnRect.left;

    if (left + menuRect.width > vw) {
      left = btnRect.right - menuRect.width;
    }
    if (left < 0) left = 4;

    if (top + menuRect.height > vh) {
      top = btnRect.top - menuRect.height;
    }
    if (top < 0) top = 4;

    setMenuStyle({ position: "fixed", top, left, width: 180, zIndex: 50 });
  }, []);

  useEffect(() => {
    if (!menuOpen) return;
    requestAnimationFrame(computeMenuPosition);
  }, [menuOpen, computeMenuPosition]);

  useEffect(() => {
    if (!menuOpen || isOwnClass) return;
    let cancelled = false;
    const supabase = createClient();

    async function fetchMyApplicationStatus() {
      try {
        const {
          data: { user },
        } = await supabase.auth.getUser();
        if (!user || cancelled) return;
        const { data } = await supabase
          .from("applications")
          .select("status")
          .eq("class_id", classId)
          .eq("applicant_id", user.id)
          .neq("status", "cancelled")
          .maybeSingle<{ status: "pending" | "approved" | "cancelled" }>();
        if (!cancelled) setMyApplicationStatus(data?.status ?? null);
      } catch {}
    }

    void fetchMyApplicationStatus();
    return () => { cancelled = true; };
  }, [menuOpen, isOwnClass, classId]);

  async function handleEnterClassRoom() {
    if (enteringClassRoom) return;
    setEnteringClassRoom(true);
    setMenuOpen(false);
    try {
      const res = await fetch(`/api/chat/rooms/class/${classId}`, { method: "POST" });
      const json = await res.json();
      if (!res.ok) return;
      const roomId = json?.data?.id;
      if (roomId) router.push(`/messages?roomId=${roomId}`);
    } catch {
    } finally {
      setEnteringClassRoom(false);
    }
  }

  async function handleApplyClass() {
    if (applyingClass) return;
    setApplyingClass(true);
    setMenuOpen(false);
    try {
      const res = await fetch("/api/applications", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ class_id: classId }),
      });
      if (res.ok) setMyApplicationStatus("pending");
    } catch {
    } finally {
      setApplyingClass(false);
    }
  }

  function handleBookmark() {
    const rawB = localStorage.getItem(BOOKMARKS_CACHE_KEY);
    const bookmarks = parseBookmarkEntries(rawB);
    const isBookmarked = bookmarks.some((b) => b.id === classId);
    if (isBookmarked) {
      localStorage.setItem(
        BOOKMARKS_CACHE_KEY,
        JSON.stringify(bookmarks.filter((b) => b.id !== classId))
      );
    } else {
      const now = new Date().toISOString();
      localStorage.setItem(
        BOOKMARKS_CACHE_KEY,
        JSON.stringify([...bookmarks, { id: classId, created_at: now }])
      );
    }
    window.dispatchEvent(new CustomEvent("bookmarkChanged"));
    fetch("/api/bookmarks/toggle", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ class_id: classId, bookmarked: !isBookmarked }),
    }).catch(() => {});
  }

  function handleDetailView() {
    setMenuOpen(false);
    if (onDetailView) {
      onDetailView();
    } else {
      router.push(`/classes/${classId}`);
    }
  }

  return (
    <>
      <div className="relative">
        <button
          ref={buttonRef}
          type="button"
          aria-label="더보기"
          className={buttonClassName}
          onClick={(e) => {
            e.stopPropagation();
            setMenuOpen((v) => !v);
          }}
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
              ref={menuRef}
              className="max-h-[70vh] overflow-y-auto rounded-xl border border-gray-100 bg-white text-gray-900 shadow-lg"
              style={menuStyle}
            >
              {isOwnClass ? (
                <>
                  <button
                    type="button"
                    className="flex w-full items-center px-4 py-3 text-sm text-gray-700"
                    onClick={handleDetailView}
                  >
                    상세보기
                  </button>
                  <div className="mx-3 border-t border-gray-100" />
                  <button
                    type="button"
                    className="flex w-full items-center px-4 py-3 text-sm text-gray-700 disabled:opacity-60"
                    onClick={() => { void handleEnterClassRoom(); }}
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
                      router.push(`/classes/${classId}/edit`);
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
                    onClick={handleDetailView}
                  >
                    <span>상세보기</span>
                    <svg xmlns="http://www.w3.org/2000/svg" width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-gray-500">
                      <path d="M9 18l6-6-6-6" />
                    </svg>
                  </button>
                  <div className="mx-3 border-t border-gray-100" />
                  <button
                    type="button"
                    onClick={() => { void handleApplyClass(); }}
                    disabled={applyingClass || status !== "recruiting" || isPendingApplication}
                    className="flex w-full items-center justify-between px-4 py-3 text-sm text-gray-700 disabled:opacity-60"
                  >
                    <span>{applyingClass ? "신청 중..." : "수업신청"}</span>
                    <svg xmlns="http://www.w3.org/2000/svg" width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-gray-500">
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
                    <svg xmlns="http://www.w3.org/2000/svg" width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-gray-500">
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
                    <svg xmlns="http://www.w3.org/2000/svg" width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-gray-500">
                      <polygon points="19 21 12 16 5 21 5 3 19 3" />
                    </svg>
                  </button>
                  <div className="mx-3 border-t border-gray-100" />
                  <button
                    type="button"
                    className="flex w-full items-center justify-between px-4 py-3 text-sm text-gray-700"
                  >
                    <span>게시물신고</span>
                    <svg xmlns="http://www.w3.org/2000/svg" width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-gray-500">
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

      {applicantSheetOpen && (
        <ClassApplicantSheet
          classId={classId}
          open={applicantSheetOpen}
          onClose={() => setApplicantSheetOpen(false)}
        />
      )}

      {messageModalOpen && (
        <SendMessageModal
          isOpen={messageModalOpen}
          onClose={() => setMessageModalOpen(false)}
          receiver={{
            id: hostId,
            nickname: hostNickname ?? "",
            profile_image_url: hostImageUrl ?? null,
          }}
        />
      )}
    </>
  );
}
