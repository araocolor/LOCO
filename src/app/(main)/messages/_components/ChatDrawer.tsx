"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import type { Dispatch, RefObject, SetStateAction, UIEvent } from "react";
import { ArrowLeft, BarChart3, Megaphone, Paperclip, Play, Send, UserPlus } from "lucide-react";
import Image from "next/image";
import Avatar from "@/components/ui/Avatar";
import ChatAttachPanel from "./ChatAttachPanel";
import MessageBubble from "./MessageBubble";
import type { ChatNotice, Message, MessageReactionType, MyProfile, NoticeKind, NoticeReactionType, NoticeVoteType, OtherUser } from "../_types";

interface ChatDrawerProps {
  attachOpen: boolean;
  chatLoading: boolean;
  chatMenuOpen: boolean;
  chatOpen: boolean;
  chatTitle: string | null;
  canAddMembers: boolean;
  canEditTitle: boolean;
  messages: Message[];
  messagesEndRef: RefObject<HTMLDivElement | null>;
  myProfile: MyProfile | null;
  newMessage: string;
  notices: ChatNotice[];
  otherUser: OtherUser | null;
  roomMembers: Array<{
    user_id: string;
    role: "owner" | "admin" | "member";
    created_at?: string | null;
    profile: OtherUser | null;
  }> | undefined;
  roomId: string | null;
  roomType: "direct" | "group" | "class" | undefined;
  photoInputRef: RefObject<HTMLInputElement | null>;
  videoInputRef: RefObject<HTMLInputElement | null>;
  selectedUserId: string | null;
  sending: boolean;
  shakingMsgId: string | null;
  uploading: boolean;
  userId: string;
  onCancelLongPress: () => void;
  onChatScroll: (event: UIEvent<HTMLDivElement>) => void;
  onClose: () => void;
  onDeleteMessage: (msgId: string) => void;
  onFriendRequest: () => void;
  onOpenMemberDrawer: () => void;
  onNoticeReaction: (noticeId: string, reactionType: NoticeReactionType) => void;
  onNoticeVote: (noticeId: string, voteType: NoticeVoteType) => void;
  onPhotoUpload: (file: File) => void;
  onVideoUpload: (file: File) => void;
  onSaveNotice: (notice: string, kind: NoticeKind, closesAt: string | null) => Promise<void>;
  onUpdateNotice: (noticeId: string, content: string, kind: NoticeKind, closesAt: string | null) => Promise<void>;
  onDeleteNotice: (noticeId: string) => Promise<void>;
  onSendMessage: () => void;
  onMarkNoticeRead: (noticeId: string) => void;
  onMessageReaction: (messageId: string, reactionType: MessageReactionType) => void;
  onStartLongPress: (msgId: string, isMine: boolean) => void;
  onTitleChanged: (title: string) => void;
  setAttachOpen: Dispatch<SetStateAction<boolean>>;
  setChatMenuOpen: Dispatch<SetStateAction<boolean>>;
  setNewMessage: Dispatch<SetStateAction<string>>;
  setShakingMsgId: Dispatch<SetStateAction<string | null>>;
  formatTime: (dateStr: string) => string;
}

const NOTICE_REACTIONS: Array<{ type: NoticeReactionType; label: string }> = [
  { type: "heart", label: "❤️" },
  { type: "like", label: "👍" },
  { type: "dislike", label: "👎" },
];

const NOTICE_VOTES: Array<{ type: NoticeVoteType; label: string }> = [
  { type: "agree", label: "찬성" },
  { type: "disagree", label: "반대" },
  { type: "abstain", label: "무효" },
];

type ArchiveItem =
  | { id: string; type: "image"; thumb: string; href: string }
  | { id: string; type: "video"; thumb: string | null; href: string };

export default function ChatDrawer({
  attachOpen,
  chatLoading,
  chatMenuOpen,
  chatOpen,
  chatTitle,
  canAddMembers,
  canEditTitle,
  messages,
  messagesEndRef,
  myProfile,
  newMessage,
  notices,
  otherUser,
  roomMembers,
  roomId,
  roomType,
  photoInputRef,
  videoInputRef,
  selectedUserId,
  sending,
  shakingMsgId,
  uploading,
  userId,
  onCancelLongPress,
  onChatScroll,
  onClose,
  onDeleteMessage,
  onFriendRequest,
  onOpenMemberDrawer,
  onNoticeReaction,
  onNoticeVote,
  onPhotoUpload,
  onVideoUpload,
  onSaveNotice,
  onUpdateNotice,
  onDeleteNotice,
  onSendMessage,
  onMarkNoticeRead,
  onMessageReaction,
  onStartLongPress,
  onTitleChanged,
  setAttachOpen,
  setChatMenuOpen,
  setNewMessage,
  setShakingMsgId,
  formatTime,
}: ChatDrawerProps) {
  const [activeTab, setActiveTab] = useState<"all" | "members" | "class" | "archive">("all");
  const [noticeDrawerOpen, setNoticeDrawerOpen] = useState(false);
  const [noticeDraft, setNoticeDraft] = useState("");
  const [noticeKind, setNoticeKind] = useState<NoticeKind>("notice");
  const [voteClosesAt, setVoteClosesAt] = useState("");
  const [noticeError, setNoticeError] = useState("");
  const [noticeSaving, setNoticeSaving] = useState(false);
  const [editingNoticeId, setEditingNoticeId] = useState<string | null>(null);
  const [deleteTargetId, setDeleteTargetId] = useState<string | null>(null);
  const [toastMessage, setToastMessage] = useState("");
  const [now, setNow] = useState(() => Date.now());

  const hasActiveVote = useMemo(
    () => notices.some((n) => n.kind === "vote" && n.closes_at && new Date(n.closes_at).getTime() > now),
    [notices, now]
  );

  useEffect(() => {
    if (activeTab !== "class" || !hasActiveVote) return;
    const id = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(id);
  }, [activeTab, hasActiveVote]);

  function formatRemaining(closesAt: string) {
    const diff = new Date(closesAt).getTime() - now;
    if (diff <= 0) return "마감";
    const days = Math.floor(diff / 86400000);
    const hours = Math.floor((diff % 86400000) / 3600000);
    const minutes = Math.floor((diff % 3600000) / 60000);
    const seconds = Math.floor((diff % 60000) / 1000);
    if (days > 0) return `${days}일 ${hours}시간 ${minutes}분 남음`;
    if (hours > 0) return `${hours}시간 ${minutes}분 ${seconds}초 남음`;
    if (minutes > 0) return `${minutes}분 ${seconds}초 남음`;
    return `${seconds}초 남음`;
  }
  const [editingTitle, setEditingTitle] = useState(false);
  const [titleDraft, setTitleDraft] = useState("");
  const titleInputRef = useRef<HTMLInputElement>(null);
  const chatMenuRef = useRef<HTMLDivElement>(null);
  const chatMenuButtonRef = useRef<HTMLButtonElement>(null);
  const rawChatTitle = chatTitle ?? otherUser?.nickname ?? "로딩중...";
  const displayChatTitle =
    rawChatTitle.length > 17 ? `${rawChatTitle.slice(0, 17)}...` : rawChatTitle;
  const roomTypeBadge =
    roomType === "group"
      ? { label: "그룹", className: "bg-lime-100 text-lime-700" }
      : roomType === "class"
        ? { label: "클래스", className: "bg-red-100 text-red-600" }
        : null;

  function startEditTitle() {
    if (!canEditTitle) return;
    setTitleDraft(rawChatTitle);
    setEditingTitle(true);
  }

  function commitTitle() {
    const trimmed = titleDraft.trim();
    setEditingTitle(false);
    if (!trimmed || trimmed === rawChatTitle || !roomId) return;
    onTitleChanged(trimmed);
    fetch(`/api/chat/rooms/${roomId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title: trimmed }),
    }).catch(() => {});
  }

  useEffect(() => {
    if (editingTitle) {
      requestAnimationFrame(() => {
        const input = titleInputRef.current;
        if (input) {
          input.focus();
          input.setSelectionRange(input.value.length, input.value.length);
        }
      });
    }
  }, [editingTitle]);

  const memberProfiles = useMemo(() => {
    const unique = new Map<
      string,
      {
        userId: string;
        nickname: string;
        profileImageUrl: string | null;
        role: "owner" | "admin" | "member";
        createdAt: string | null;
        order: number;
      }
    >();
    (roomMembers ?? []).forEach((member) => {
      if (unique.has(member.user_id)) return;
      unique.set(member.user_id, {
        userId: member.user_id,
        nickname: member.profile?.nickname ?? "알 수 없음",
        profileImageUrl: member.profile?.profile_image_url ?? null,
        role: member.role,
        createdAt: member.created_at ?? null,
        order: unique.size,
      });
    });
    return Array.from(unique.values()).sort((a, b) => {
      if (a.role === "owner" && b.role !== "owner") return -1;
      if (a.role !== "owner" && b.role === "owner") return 1;
      const aTime = a.createdAt ? new Date(a.createdAt).getTime() : Number.POSITIVE_INFINITY;
      const bTime = b.createdAt ? new Date(b.createdAt).getTime() : Number.POSITIVE_INFINITY;
      if (aTime !== bTime) return aTime - bTime;
      return a.order - b.order;
    });
  }, [roomMembers]);

  const archiveItems = useMemo<ArchiveItem[]>(() => {
    return messages.flatMap((message) => {
      try {
        const parsed = JSON.parse(message.content) as {
          type?: string;
          thumb?: string;
          full?: string;
          status?: string;
          video_url?: string;
          thumbnail_url?: string | null;
        };
        if (parsed.type === "image" && parsed.thumb && parsed.full) {
          return [{ id: message.id, type: "image", thumb: parsed.thumb, href: parsed.full }];
        }
        if (parsed.type === "video" && parsed.status === "ready" && parsed.video_url) {
          return [{ id: message.id, type: "video", thumb: parsed.thumbnail_url ?? null, href: parsed.video_url }];
        }
      } catch {}
      return [];
    });
  }, [messages]);

  const isDirectRoom = roomType === "direct";
  const isClassRoom = roomType === "class";
  const unreadNotice = notices.find((notice) => !notice.read_by_me) ?? null;
  const classNoticeWriters = isClassRoom
    ? [
        memberProfiles.find((member) => member.role === "owner"),
        memberProfiles.filter((member) => member.role !== "owner")[0],
      ].filter(Boolean)
    : [];
  const canWriteClassNotice = classNoticeWriters.some((member) => member?.userId === userId);
  const displayedActiveTab = isDirectRoom && (activeTab === "class" || activeTab === "members") ? "all" : activeTab;

  function formatNoticeDate(dateStr: string | null) {
    if (!dateStr) return "";
    const date = new Date(dateStr);
    if (Number.isNaN(date.getTime())) return "";
    return `${date.getMonth() + 1}/${date.getDate()}`;
  }

  function openNoticeDrawer(initialKind: NoticeKind = "notice") {
    setEditingNoticeId(null);
    setNoticeDraft("");
    setNoticeKind(initialKind);
    setVoteClosesAt("");
    setNoticeError("");
    setChatMenuOpen(false);
    setNoticeDrawerOpen(true);
  }

  function openEditNotice(notice: ChatNotice) {
    setEditingNoticeId(notice.id);
    setNoticeDraft(notice.content);
    setNoticeKind(notice.kind);
    setVoteClosesAt(notice.closes_at ? notice.closes_at.slice(0, 10) : "");
    setNoticeError("");
    setNoticeDrawerOpen(true);
  }

  async function handleSaveNotice() {
    setNoticeSaving(true);
    setNoticeError("");
    try {
      const closes = noticeKind === "vote" ? voteClosesAt : null;
      if (editingNoticeId) {
        await onUpdateNotice(editingNoticeId, noticeDraft, noticeKind, closes);
        showToast("수정되었습니다");
      } else {
        await onSaveNotice(noticeDraft, noticeKind, closes);
      }
      setNoticeDrawerOpen(false);
      setEditingNoticeId(null);
    } catch (error) {
      setNoticeError(error instanceof Error ? error.message : "공지 저장 중 오류가 발생했습니다");
    } finally {
      setNoticeSaving(false);
    }
  }

  function showToast(message: string) {
    setToastMessage(message);
    window.setTimeout(() => setToastMessage(""), 2000);
  }

  async function handleConfirmDelete() {
    if (!deleteTargetId) return;
    try {
      await onDeleteNotice(deleteTargetId);
      setDeleteTargetId(null);
      showToast("삭제되었습니다");
    } catch (error) {
      showToast(error instanceof Error ? error.message : "삭제 실패");
      setDeleteTargetId(null);
    }
  }

  const todayDateStr = (() => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  })();

  useEffect(() => {
    if (!chatMenuOpen) return;

    function closeMenuOnOutsideClick(event: PointerEvent) {
      const target = event.target;
      if (!(target instanceof Node)) return;
      if (chatMenuRef.current?.contains(target)) return;
      if (chatMenuButtonRef.current?.contains(target)) return;
      setChatMenuOpen(false);
    }

    document.addEventListener("pointerdown", closeMenuOnOutsideClick);
    return () => document.removeEventListener("pointerdown", closeMenuOnOutsideClick);
  }, [chatMenuOpen, setChatMenuOpen]);

  function openUnreadNotice() {
    if (!unreadNotice) return;
    setActiveTab("class");
    onMarkNoticeRead(unreadNotice.id);
  }

  return (
    <div
      className={`fixed inset-0 z-[60] bg-white flex flex-col transition-transform duration-300 ease-in-out ${
        chatOpen ? "translate-x-0" : "translate-x-full"
      }`}
    >
      <header className="sticky top-0 z-50 bg-white h-14 px-4 relative">
        <button
          onClick={onClose}
          className="absolute left-4 top-1/2 -translate-y-1/2 w-[37px] h-[37px] flex items-center justify-center text-gray-600 hover:text-gray-900"
        >
          <ArrowLeft size={20} />
        </button>
        <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-[60%] text-center">
          {editingTitle ? (
            <input
              ref={titleInputRef}
              value={titleDraft}
              maxLength={30}
              onChange={(e) => setTitleDraft(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  commitTitle();
                }
              }}
              onBlur={commitTitle}
              className="w-full text-center font-bold text-[#4d4d4d] leading-none bg-transparent border-b border-yellow-400 outline-none"
              style={{ fontSize: 18 }}
            />
          ) : (
            <span
              onClick={startEditTitle}
              className={`flex min-w-0 items-center justify-center gap-2 whitespace-nowrap font-bold text-[#4d4d4d] leading-none ${canEditTitle ? "cursor-pointer" : ""}`}
              style={{ fontSize: 18 }}
            >
              {roomTypeBadge && (
                <span
                  className={`shrink-0 rounded-full px-2 py-1 font-normal leading-none ${roomTypeBadge.className}`}
                  style={{ fontSize: 15 }}
                >
                  {roomTypeBadge.label}
                </span>
              )}
              <span className="min-w-0 overflow-hidden text-ellipsis">{displayChatTitle}</span>
            </span>
          )}
        </div>
        <div className="absolute right-4 top-1/2 -translate-y-1/2">
          <div className="relative">
            <button
              ref={chatMenuButtonRef}
              onClick={() => setChatMenuOpen((v) => !v)}
              className="w-[37px] h-[37px] flex items-center justify-center text-gray-600 hover:text-gray-900"
            >
              <svg xmlns="http://www.w3.org/2000/svg" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <line x1="3" y1="6" x2="21" y2="6" />
                <line x1="3" y1="12" x2="21" y2="12" />
                <line x1="3" y1="18" x2="21" y2="18" />
              </svg>
            </button>
            {chatMenuOpen && (
              <div ref={chatMenuRef} className="absolute right-0 top-full z-[80] bg-white rounded-xl shadow-lg border border-gray-100 overflow-hidden" style={{ width: 180 }}>
                {canAddMembers && (
                  <>
                    <button
                      className="flex items-center justify-between w-full px-4 py-3 text-gray-700" style={{ fontSize: "16px" }}
                      onClick={() => {
                        setChatMenuOpen(false);
                        onOpenMemberDrawer();
                      }}
                    >
                      <span>새 사용자 추가</span>
                      <UserPlus size={20} className="text-gray-500" />
                    </button>
                    <div className="border-t border-gray-100 mx-3" />
                  </>
                )}
                <button
                  className="flex items-center justify-between w-full px-4 py-3 text-gray-700" style={{ fontSize: "16px" }}
                  onClick={() => {
                    setChatMenuOpen(false);
                    onFriendRequest();
                  }}
                >
                  <span>친구 신청</span>
                  <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-gray-500">
                    <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><line x1="19" y1="8" x2="19" y2="14"/><line x1="22" y1="11" x2="16" y2="11"/>
                  </svg>
                </button>
                <div className="border-t border-gray-100 mx-3" />
                <button className="flex items-center justify-between w-full px-4 py-3 text-gray-700" style={{ fontSize: "16px" }}>
                  <span>대화 삭제</span>
                  <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-gray-500">
                    <polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/><path d="M10 11v6"/><path d="M14 11v6"/><path d="M9 6V4h6v2"/>
                  </svg>
                </button>
                <div className="border-t border-gray-100 mx-3" />
                <button className="flex items-center justify-between w-full px-4 py-3 text-red-500" style={{ fontSize: "16px" }}>
                  <span>차단하기</span>
                  <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-red-400">
                    <circle cx="12" cy="12" r="10"/><line x1="4.93" y1="4.93" x2="19.07" y2="19.07"/>
                  </svg>
                </button>
              </div>
            )}
          </div>
        </div>
      </header>

      <div className="shrink-0 flex items-end px-4 border-b border-[#e5e7eb]">
        <div className="flex gap-5">
          {!isDirectRoom && (
            <button
              type="button"
              onClick={() => setActiveTab("class")}
              style={{ fontSize: 17 }}
              className={`pb-2 font-bold border-b-2 transition-colors ${
                displayedActiveTab === "class" ? "border-black text-black" : "border-transparent text-gray-400"
              }`}
            >
              공지/투표
            </button>
          )}
          <button
            type="button"
            onClick={() => setActiveTab("all")}
            style={{ fontSize: 17 }}
            className={`pb-2 font-bold border-b-2 transition-colors ${
              displayedActiveTab === "all" ? "border-black text-black" : "border-transparent text-gray-400"
            }`}
          >
            {isDirectRoom ? "1:1 대화" : "전체대화"}
          </button>
          {!isDirectRoom && (
            <button
              type="button"
              onClick={() => setActiveTab("members")}
              style={{ fontSize: 17 }}
              className={`pb-2 font-bold border-b-2 transition-colors ${
                displayedActiveTab === "members" ? "border-black text-black" : "border-transparent text-gray-400"
              }`}
            >
              참여회원들
            </button>
          )}
          <button
            type="button"
            onClick={() => setActiveTab("archive")}
            style={{ fontSize: 17 }}
            className={`pb-2 font-bold border-b-2 transition-colors ${
              displayedActiveTab === "archive" ? "border-black text-black" : "border-transparent text-gray-400"
            }`}
          >
            보관함
          </button>
        </div>
      </div>

      <style>{`
        @keyframes shake {
          0%, 100% { transform: rotate(0deg); }
          25% { transform: rotate(-2deg); }
          75% { transform: rotate(2deg); }
        }
        @keyframes noticeDrawerDown {
          from { transform: translateY(-100%); }
          to { transform: translateY(0); }
        }
        @keyframes noticeBarDown {
          from { opacity: 0; transform: translateY(-14px); }
          to { opacity: 1; transform: translateY(0); }
        }
        .msg-shake { animation: shake 0.3s ease-in-out infinite; }
      `}</style>
      {displayedActiveTab === "all" && (
        <>
          <div
            className="flex-1 overflow-y-auto px-4 py-4 flex flex-col gap-3"
            style={{ backgroundColor: "#B2C7D9" }}
            onScroll={onChatScroll}
            onClick={() => {
              setAttachOpen(false);
              setShakingMsgId(null);
            }}
          >
            {isClassRoom && unreadNotice && (
              <button
                type="button"
                onClick={openUnreadNotice}
                className="sticky top-0 z-10 mb-1 h-[40px] w-full rounded-[20px] bg-yellow-300 px-4 text-left text-sm font-semibold leading-[40px] text-gray-800 shadow-sm animate-[noticeBarDown_220ms_ease-out]"
              >
                <span className="flex h-full items-center gap-2">
                  <Megaphone size={16} className="shrink-0" />
                  <span className="min-w-0 flex-1 truncate">공지사항을 꼭 읽어주세요</span>
                  <span className="shrink-0 text-xs font-bold text-gray-700">보기</span>
                </span>
              </button>
            )}
            {chatLoading ? (
              <div className="flex items-center justify-center h-full text-gray-600">로딩 중...</div>
            ) : messages.length === 0 && notices.length === 0 ? (
              <div className="flex items-center justify-center h-full text-gray-600 text-sm">
                대화 시작하기
              </div>
            ) : (() => {
              const timeline: Array<{ kind: "msg"; at: string; msg: Message } | { kind: "notice"; at: string; notice: ChatNotice }> = [
                ...messages.map((msg) => ({ kind: "msg" as const, at: msg.sent_at, msg })),
                ...(isClassRoom ? notices.map((notice) => ({ kind: "notice" as const, at: notice.created_at, notice })) : []),
              ].sort((a, b) => new Date(a.at).getTime() - new Date(b.at).getTime());

              let prevMsgItem: Message | null = null;
              return timeline.map((item) => {
                if (item.kind === "msg") {
                  const prev = prevMsgItem;
                  prevMsgItem = item.msg;
                  return (
                    <MessageBubble
                      key={`m-${item.msg.id}`}
                      msg={item.msg}
                      prevMsg={prev}
                      userId={userId}
                      myProfile={myProfile}
                      otherUser={otherUser}
                      shakingMsgId={shakingMsgId}
                      onStartLongPress={onStartLongPress}
                      onCancelLongPress={onCancelLongPress}
                      onDeleteMessage={onDeleteMessage}
                      onMessageReaction={onMessageReaction}
                      formatTime={formatTime}
                    />
                  );
                }
                prevMsgItem = null;
                const notice = item.notice;
                const author = (roomMembers ?? []).find((m) => m.user_id === notice.author_id)?.profile ?? null;
                return (
                  <div key={`n-${notice.id}`} className="flex items-start gap-2">
                    <Avatar src={author?.profile_image_url ?? null} nickname={author?.nickname ?? "?"} size={40} />
                    <div className="flex flex-col gap-1 min-w-0">
                      <span className="text-base text-gray-800">{author?.nickname ?? "알 수 없음"}</span>
                      <div className="relative">
                        <article
                          className="rounded-lg bg-white px-3 py-2 max-w-[270px] select-none"
                          onContextMenu={(e) => e.preventDefault()}
                          onTouchStart={() => onStartLongPress(notice.id, false)}
                          onTouchEnd={onCancelLongPress}
                          onMouseDown={() => onStartLongPress(notice.id, false)}
                          onMouseUp={onCancelLongPress}
                          onMouseLeave={onCancelLongPress}
                        >
                          <div className="flex items-center gap-2">
                            {notice.kind === "vote" ? <BarChart3 size={14} /> : <Megaphone size={14} />}
                            <span className="text-xs font-bold text-gray-700">{notice.kind === "vote" ? "투표" : "공지사항"}</span>
                          </div>
                          <p className="mt-1 whitespace-pre-wrap break-words text-base text-gray-900">{notice.content}</p>
                        </article>
                        {shakingMsgId === notice.id && (
                          <div className="absolute top-full left-0 mt-1 z-10 flex gap-1 bg-white rounded-full px-2 py-1 shadow-lg">
                            {NOTICE_REACTIONS.map((reaction) => (
                              <button
                                key={reaction.type}
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  onNoticeReaction(notice.id, reaction.type);
                                  onCancelLongPress();
                                  setShakingMsgId(null);
                                }}
                                className="text-lg hover:scale-125 transition-transform"
                              >
                                {reaction.label}
                              </button>
                            ))}
                          </div>
                        )}
                      </div>
                      {(() => {
                        const activeReactions = NOTICE_REACTIONS.filter((r) => (notice.reaction_counts?.[r.type] ?? 0) > 0 || notice.my_reaction === r.type);
                        if (activeReactions.length === 0) return null;
                        return (
                          <div className="flex flex-wrap gap-1">
                            {activeReactions.map((reaction) => {
                              const count = notice.reaction_counts?.[reaction.type] ?? 0;
                              const active = notice.my_reaction === reaction.type;
                              return (
                                <button
                                  key={reaction.type}
                                  type="button"
                                  onClick={() => onNoticeReaction(notice.id, reaction.type)}
                                  className={`px-1 text-xs font-bold ${active ? "opacity-100" : "opacity-70"}`}
                                >
                                  {reaction.label} <span className="text-gray-700 font-normal">{count}</span>
                                </button>
                              );
                            })}
                          </div>
                        );
                      })()}
                      <span className="text-xs text-gray-700">{formatTime(notice.created_at)}</span>
                    </div>
                  </div>
                );
              });
            })()}
            <div ref={messagesEndRef} />
          </div>

          <div className="border-t border-gray-100 px-3 pt-3 pb-3 flex gap-2 items-start min-h-[80px]">
            <button className="text-gray-500 flex-shrink-0 mt-2" onClick={() => setAttachOpen((v) => !v)}>
              <Paperclip size={22} strokeWidth={2.5} />
            </button>
            <input
              type="text"
              value={newMessage}
              onChange={(e) => setNewMessage(e.target.value)}
              onKeyPress={(e) => e.key === "Enter" && onSendMessage()}
              placeholder="메시지 입력..."
              className="flex-1 px-3 py-2 border border-gray-200 rounded-full focus:outline-none focus:ring-2 focus:ring-yellow-400"
              style={{ fontSize: "16px", color: "#000000cc" }}
              disabled={sending}
            />
            <button
              onClick={onSendMessage}
              disabled={!newMessage.trim() || sending || !selectedUserId}
              className="w-9 h-9 flex items-center justify-center bg-yellow-400 text-gray-900 rounded-full hover:bg-yellow-500 disabled:opacity-50 mt-1 flex-shrink-0"
            >
              <Send size={16} />
            </button>
          </div>

          <ChatAttachPanel
            attachOpen={attachOpen}
            photoInputRef={photoInputRef}
            videoInputRef={videoInputRef}
            uploading={uploading}
            onPhotoUpload={onPhotoUpload}
            onVideoUpload={onVideoUpload}
          />
        </>
      )}

      {displayedActiveTab === "members" && (
        <div className="flex-1 overflow-y-auto px-4 py-4" style={{ backgroundColor: "#B2C7D9" }}>
          {memberProfiles.length === 0 ? (
            <div className="flex h-full items-center justify-center text-sm text-gray-400">참여 회원이 없습니다</div>
          ) : (
            <div className="grid grid-cols-5 gap-4">
              {memberProfiles.map((member) => (
                <div key={member.userId} className="flex justify-center">
                  <Avatar
                    src={member.profileImageUrl}
                    nickname={member.nickname}
                    size={50}
                    className={isClassRoom && member.role === "owner" ? "border-2 border-white shadow-[0_0_0_2px_#ef4444]" : ""}
                  />
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {displayedActiveTab === "class" && (
        <div className="flex-1 overflow-y-auto px-4 py-5" style={{ backgroundColor: "#B2C7D9" }}>
          {!isClassRoom ? (
            <div className="flex h-full items-center justify-center text-sm text-gray-400">공지/투표가 없습니다</div>
          ) : (
            <div className="space-y-4">
              <div className="flex justify-center gap-2">
                <button
                  type="button"
                  onClick={() => openNoticeDrawer("vote")}
                  className="rounded-full bg-yellow-300 px-4 py-2 text-sm font-bold text-gray-900 shadow-sm hover:bg-yellow-400"
                >
                  투표작성
                </button>
                {canWriteClassNotice && (
                  <button
                    type="button"
                    onClick={() => openNoticeDrawer("notice")}
                    className="rounded-full bg-yellow-300 px-4 py-2 text-sm font-bold text-gray-900 shadow-sm hover:bg-yellow-400"
                  >
                    공지작성
                  </button>
                )}
              </div>
              {notices.length > 0 ? (
                <div className="space-y-4">
                  {notices.map((notice, index) => {
                    const dateLabel = formatNoticeDate(notice.created_at);
                    const prevDateLabel = index > 0 ? formatNoticeDate(notices[index - 1].created_at) : "";
                    const showDateHeader = index === 0 || dateLabel !== prevDateLabel;
                    const author = (roomMembers ?? []).find((m) => m.user_id === notice.author_id)?.profile ?? null;
                    return (
                      <div key={notice.id} className="space-y-2">
                        {showDateHeader && (
                          <p className="text-center text-xs font-bold text-gray-400">{dateLabel}</p>
                        )}
                        <div className="flex items-center gap-2">
                          <Avatar src={author?.profile_image_url ?? null} nickname={author?.nickname ?? "?"} size={36} />
                          <div className="flex flex-col">
                            <span className="text-sm font-bold text-gray-800">{author?.nickname ?? "알 수 없음"}</span>
                            <span className="text-xs text-gray-600">{formatTime(notice.created_at)}</span>
                          </div>
                        </div>
                        <article className="rounded-[10px] bg-white px-4 py-3 text-gray-900">
                          <div className="flex items-center gap-2 pb-2 border-b border-gray-200">
                            {notice.kind === "vote" ? (
                              <BarChart3 size={17} className="shrink-0" />
                            ) : (
                              <Megaphone size={17} className="shrink-0" />
                            )}
                            <span className="font-bold" style={{ fontSize: 17 }}>{notice.kind === "vote" ? "투표" : "공지사항"}</span>
                            {notice.kind === "vote" && (() => {
                              const closed = notice.closes_at ? new Date(notice.closes_at).getTime() <= now : false;
                              return closed ? (
                                <span className="rounded-full bg-gray-400 px-2 py-0.5 text-xs font-bold text-white">투표마감</span>
                              ) : (
                                <span className="rounded-full bg-yellow-400 px-2 py-0.5 text-xs font-bold text-white">진행중</span>
                              );
                            })()}
                            <span className="ml-auto text-xs font-bold text-gray-700">읽음 {notice.read_count}</span>
                            {notice.author_id === userId && (
                              <>
                                <button
                                  type="button"
                                  onClick={() => openEditNotice(notice)}
                                  className="text-xs font-bold text-gray-500 hover:text-gray-800"
                                >
                                  수정
                                </button>
                                <button
                                  type="button"
                                  onClick={() => setDeleteTargetId(notice.id)}
                                  className="text-xs font-bold text-red-500 hover:text-red-700"
                                >
                                  삭제
                                </button>
                              </>
                            )}
                          </div>
                          <p className="mt-2 whitespace-pre-wrap break-words text-[16px] font-semibold leading-6 text-[#595959]">{notice.content}</p>
                          {notice.kind !== "vote" && (
                            <div className="mt-3 flex flex-wrap gap-2">
                              {NOTICE_REACTIONS.map((reaction) => (
                                <button
                                  key={reaction.type}
                                  type="button"
                                  onClick={() => onNoticeReaction(notice.id, reaction.type)}
                                  className="px-1 text-sm font-bold"
                                >
                                  {reaction.label} <span className="text-gray-700 font-normal">{notice.reaction_counts[reaction.type]}</span>
                                </button>
                              ))}
                            </div>
                          )}
                          {notice.kind === "vote" && (() => {
                            const isClosed = notice.closes_at ? new Date(notice.closes_at).getTime() <= now : false;
                            const showResults = isClosed || notice.my_vote !== null;
                            return (
                              <>
                                <div className="mt-3 flex flex-wrap gap-2">
                                  {NOTICE_VOTES.map((vote) => (
                                    <button
                                      key={vote.type}
                                      type="button"
                                      onClick={() => !isClosed && onNoticeVote(notice.id, vote.type)}
                                      disabled={isClosed}
                                      className={`rounded-full px-4 py-1.5 text-sm font-bold border ${
                                        notice.my_vote === vote.type ? "border-black bg-gray-900 text-white" : "border-gray-300 bg-white text-gray-800"
                                      } ${isClosed ? "opacity-60" : ""}`}
                                    >
                                      {vote.label}{showResults ? ` ${notice.vote_counts[vote.type]}` : ""}
                                    </button>
                                  ))}
                                </div>
                                {notice.closes_at && (
                                  <p className="mt-2 text-gray-500" style={{ fontSize: 16 }}>
                                    {isClosed
                                      ? `마감됨 · ${formatNoticeDate(notice.closes_at)}`
                                      : `${formatNoticeDate(notice.closes_at)} 마감 · ${formatRemaining(notice.closes_at)}`}
                                  </p>
                                )}
                              </>
                            );
                          })()}
                        </article>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <p className="text-sm leading-6 text-gray-400">등록된 공지/투표가 없습니다.</p>
              )}
            </div>
          )}
        </div>
      )}

      {displayedActiveTab === "archive" && (
        <div className="flex-1 overflow-y-auto px-4 py-4" style={{ backgroundColor: "#B2C7D9" }}>
          {archiveItems.length === 0 ? (
            <div className="flex h-full items-center justify-center text-sm text-gray-400">보관된 항목이 없습니다</div>
          ) : (
            <div className="grid grid-cols-3 gap-2">
              {archiveItems.map((item) => (
                <a
                  key={item.id}
                  href={item.href}
                  target="_blank"
                  rel="noreferrer"
                  className="relative aspect-square overflow-hidden rounded-md bg-gray-200"
                  aria-label={item.type === "video" ? "동영상 열기" : "사진 열기"}
                >
                  {item.thumb ? (
                    <Image src={item.thumb} alt="" fill sizes="33vw" className="object-cover" />
                  ) : (
                    <div className="flex h-full w-full items-center justify-center bg-gray-900" />
                  )}
                  {item.type === "video" && (
                    <span className="absolute inset-0 flex items-center justify-center bg-black/20 text-white">
                      <span className="flex h-9 w-9 items-center justify-center rounded-full bg-black/50">
                        <Play size={18} fill="currentColor" />
                      </span>
                    </span>
                  )}
                </a>
              ))}
            </div>
          )}
        </div>
      )}

      {noticeDrawerOpen && (
        <div className="absolute inset-0 z-[90]">
          <button
            type="button"
            className="absolute inset-0 bg-black/20"
            aria-label="공지 작성 닫기"
            onClick={() => setNoticeDrawerOpen(false)}
          />
          <section className="absolute inset-x-0 top-0 h-[70vh] bg-white shadow-xl border-b border-gray-200 animate-[noticeDrawerDown_180ms_ease-out]">
            <div className="flex h-full flex-col">
              <div className="shrink-0 px-4 py-4 border-b border-gray-100">
                <h2 className="flex items-center gap-2 text-lg font-bold text-gray-900">
                  {noticeKind === "vote" ? <BarChart3 size={20} /> : <Megaphone size={20} />}
                  {editingNoticeId
                    ? noticeKind === "vote" ? "투표 수정" : "공지 수정"
                    : noticeKind === "vote" ? "투표 작성" : "클래스 공지사항"}
                </h2>
                <div className="mt-3 grid grid-cols-2 gap-2">
                  {([
                    ["notice", "공지"],
                    ["vote", "투표"],
                  ] as const).map(([value, label]) => {
                    const lockedByEdit = editingNoticeId !== null && noticeKind !== value;
                    const lockedByRole = value === "notice" && !isClassOwner;
                    const disabled = lockedByEdit || lockedByRole;
                    return (
                      <button
                        key={value}
                        type="button"
                        onClick={() => setNoticeKind(value)}
                        disabled={disabled}
                        className={`rounded-md py-2 text-sm font-bold ${
                          noticeKind === value ? "bg-yellow-300 text-gray-900" : "bg-gray-100 text-gray-500"
                        } ${disabled ? "opacity-40 cursor-not-allowed" : ""}`}
                      >
                        {label}
                      </button>
                    );
                  })}
                </div>
                {noticeKind === "vote" && (
                  <>
                    <p className="mt-2 font-semibold text-gray-500" style={{ fontSize: 14 }}>투표 선택지는 찬성 / 반대 / 무효로 표시됩니다.</p>
                    <div className="mt-3">
                      <label className="block font-bold text-gray-700 mb-1" style={{ fontSize: 14 }}>투표 마감일</label>
                      <input
                        type="date"
                        value={voteClosesAt}
                        min={todayDateStr}
                        onChange={(event) => setVoteClosesAt(event.target.value)}
                        className="w-full rounded-md border border-gray-200 px-3 py-2 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-yellow-300"
                      />
                    </div>
                  </>
                )}
              </div>
              <div className="flex-1 px-4 py-4 flex flex-col">
                <textarea
                  value={noticeDraft}
                  onChange={(event) => setNoticeDraft(event.target.value)}
                  maxLength={300}
                  placeholder="공지 내용을 입력하세요"
                  className="flex-1 w-full resize-none rounded-md border border-gray-200 px-3 py-[10px] text-base leading-6 text-gray-900 focus:outline-none focus:ring-2 focus:ring-yellow-300"
                />
                {noticeError && <p className="mt-2 text-sm text-red-500">{noticeError}</p>}
              </div>
              <div className="shrink-0 flex gap-2 px-4 py-3 border-t border-gray-100">
                <button
                  type="button"
                  onClick={() => setNoticeDrawerOpen(false)}
                  className="flex-1 rounded-md border border-gray-200 py-3 text-base font-semibold text-gray-700"
                >
                  취소
                </button>
                <button
                  type="button"
                  onClick={() => {
                    void handleSaveNotice();
                  }}
                  disabled={noticeSaving}
                  className="flex-1 rounded-md bg-yellow-300 py-3 text-base font-bold text-gray-900 disabled:opacity-50"
                >
                  확인
                </button>
              </div>
            </div>
          </section>
        </div>
      )}

      {deleteTargetId && (
        <div className="absolute inset-0 z-[95] flex items-center justify-center">
          <button
            type="button"
            className="absolute inset-0 bg-black/40"
            aria-label="삭제 취소"
            onClick={() => setDeleteTargetId(null)}
          />
          <div className="relative w-[80%] max-w-[320px] rounded-xl bg-white p-5 shadow-xl">
            <p className="text-base font-bold text-gray-900">정말 삭제하시겠습니까?</p>
            <p className="mt-2 text-sm text-gray-600">삭제된 공지는 복구할 수 없습니다.</p>
            <div className="mt-5 flex gap-2">
              <button
                type="button"
                onClick={() => setDeleteTargetId(null)}
                className="flex-1 rounded-md border border-gray-200 py-2.5 text-sm font-bold text-gray-700"
              >
                취소
              </button>
              <button
                type="button"
                onClick={() => { void handleConfirmDelete(); }}
                className="flex-1 rounded-md bg-red-500 py-2.5 text-sm font-bold text-white"
              >
                확인
              </button>
            </div>
          </div>
        </div>
      )}

      {toastMessage && (
        <div className="pointer-events-none absolute inset-0 z-[100] flex items-center justify-center">
          <div className="rounded-md bg-black/80 px-4 py-2 text-sm font-bold text-white shadow-lg">
            {toastMessage}
          </div>
        </div>
      )}
    </div>
  );
}
