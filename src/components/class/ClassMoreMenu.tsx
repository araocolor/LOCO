"use client";

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
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
        {menuOpen && createPortal(
          <>
            <div
              className="fixed inset-0 z-[80] bg-black/30"
              onClick={() => setMenuOpen(false)}
            />
            <div className="fixed bottom-0 left-0 right-0 z-[81] bg-white rounded-t-2xl animate-sheet-slide-up">
              <div className="w-10 h-1 bg-gray-300 rounded-full mx-auto mt-3 mb-2" />
              {isOwnClass ? (
                <>
                  <button
                    type="button"
                    className="flex w-full items-center justify-between px-5 py-4 text-[15px] text-gray-700"
                    onClick={handleDetailView}
                  >
                    <span>상세보기</span>
                    <svg xmlns="http://www.w3.org/2000/svg" width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-gray-400">
                      <path d="M9 18l6-6-6-6" />
                    </svg>
                  </button>
                  <div className="mx-4 border-t border-gray-100" />
                  <button
                    type="button"
                    className="flex w-full items-center justify-between px-5 py-4 text-[15px] text-gray-700 disabled:opacity-60"
                    onClick={() => { void handleEnterClassRoom(); }}
                    disabled={enteringClassRoom}
                  >
                    <span>{enteringClassRoom ? "입장 중..." : "대화방입장"}</span>
                    <svg xmlns="http://www.w3.org/2000/svg" width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-gray-400">
                      <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
                    </svg>
                  </button>
                  <div className="mx-4 border-t border-gray-100" />
                  <button
                    type="button"
                    className="flex w-full items-center justify-between px-5 py-4 text-[15px] text-gray-700"
                    onClick={() => {
                      setMenuOpen(false);
                      setApplicantSheetOpen(true);
                    }}
                  >
                    <span>신청자 목록</span>
                    <svg xmlns="http://www.w3.org/2000/svg" width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-gray-400">
                      <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
                      <circle cx="9" cy="7" r="4" />
                      <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
                      <path d="M16 3.13a4 4 0 0 1 0 7.75" />
                    </svg>
                  </button>
                  <div className="mx-4 border-t border-gray-100" />
                  <button
                    type="button"
                    className="flex w-full items-center justify-between px-5 py-4 text-[15px] text-gray-700"
                    onClick={() => {
                      setMenuOpen(false);
                      router.push(`/classes/${classId}/edit`);
                    }}
                  >
                    <span>클래스 수정</span>
                    <svg xmlns="http://www.w3.org/2000/svg" width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-gray-400">
                      <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
                      <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
                    </svg>
                  </button>
                </>
              ) : (
                <>
                  <button
                    type="button"
                    className="flex w-full items-center justify-between px-5 py-4 text-[15px] text-gray-700"
                    onClick={handleDetailView}
                  >
                    <span>상세보기</span>
                    <svg xmlns="http://www.w3.org/2000/svg" width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-gray-400">
                      <path d="M9 18l6-6-6-6" />
                    </svg>
                  </button>
                  <div className="mx-4 border-t border-gray-100" />
                  <button
                    type="button"
                    onClick={() => { void handleApplyClass(); }}
                    disabled={applyingClass || status !== "recruiting" || isPendingApplication}
                    className="flex w-full items-center justify-between px-5 py-4 text-[15px] text-gray-700 disabled:opacity-60"
                  >
                    <span>{applyingClass ? "신청 중..." : "수업신청"}</span>
                    <svg xmlns="http://www.w3.org/2000/svg" width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-gray-400">
                      <path d="M4 12h16" />
                      <path d="M12 4v16" />
                    </svg>
                  </button>
                  <div className="mx-4 border-t border-gray-100" />
                  <button
                    type="button"
                    onClick={() => {
                      setMenuOpen(false);
                      setMessageModalOpen(true);
                    }}
                    className="flex w-full items-center justify-between px-5 py-4 text-[15px] text-gray-700"
                  >
                    <span>메세지전송</span>
                    <svg xmlns="http://www.w3.org/2000/svg" width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-gray-400">
                      <line x1="22" y1="2" x2="11" y2="13" />
                      <polygon points="22 2 15 22 11 13 2 9 22 2" />
                    </svg>
                  </button>
                  <div className="mx-4 border-t border-gray-100" />
                  <button
                    type="button"
                    onClick={() => {
                      setMenuOpen(false);
                      handleBookmark();
                    }}
                    className="flex w-full items-center justify-between px-5 py-4 text-[15px] text-gray-700"
                  >
                    <span>북마크저장</span>
                    <svg xmlns="http://www.w3.org/2000/svg" width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-gray-400">
                      <polygon points="19 21 12 16 5 21 5 3 19 3" />
                    </svg>
                  </button>
                  <div className="mx-4 border-t border-gray-100" />
                  <button
                    type="button"
                    className="flex w-full items-center justify-between px-5 py-4 text-[15px] text-gray-700"
                  >
                    <span>게시물신고</span>
                    <svg xmlns="http://www.w3.org/2000/svg" width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-gray-400">
                      <path d="M4 15s1-1 4-1 5 2 8 2 4-1 4-1V3s-1 1-4 1-5-2-8-2-4 1-4 1z" />
                      <line x1="4" y1="22" x2="4" y2="15" />
                    </svg>
                  </button>
                </>
              )}
              <div className="h-6" />
            </div>
          </>,
          document.body
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
