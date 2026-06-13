"use client";

import { useEffect, useMemo, useState, useCallback } from "react";
import type { Dispatch, RefObject, SetStateAction, UIEvent } from "react";
import { Megaphone } from "lucide-react";
import { isChatMuted, setChatMuted } from "@/lib/chat-mute";
import { getChatBg, setChatBg, CHAT_BG_OPTIONS, type ChatBgType } from "@/lib/chat-bg";
import ChatAttachPanel from "./ChatAttachPanel";
import ImageViewerDrawer, { type ImageViewerData } from "./ImageViewerDrawer";
import ArchiveGrid from "./chat/ArchiveGrid";
import ChatComposer from "./chat/ChatComposer";
import ChatDrawerHeader from "./chat/ChatDrawerHeader";
import ChatEmojiPanel from "./chat/ChatEmojiPanel";
import ChatDrawerTabs, { type ChatDrawerTab } from "./chat/ChatDrawerTabs";
import ChatBgSheet from "./chat/ChatBgSheet";
import ChatMenuSheet from "./chat/ChatMenuSheet";
import ChatTimeline from "./chat/ChatTimeline";
import MemberBreakoutGame, { type MemberGameProfile } from "./chat/MemberBreakoutGame";
import MemberGrid, { type ChatMemberProfile } from "./chat/MemberGrid";
import ToastOverlay from "./chat/ToastOverlay";
import ClassNoticePanel from "./notices/ClassNoticePanel";
import NoticeDeleteDialog from "./notices/NoticeDeleteDialog";
import NoticeEditorDrawer from "./notices/NoticeEditorDrawer";
import CachedClassDetailPage from "@/components/class/CachedClassDetailPage";
import type { ChatNotice, Message, MessageReactionType, MyProfile, NoticeKind, NoticeReactionType, NoticeVoteType, OtherUser } from "../_types";
import { buildTimeline, getArchiveItems } from "../_lib/message-content";

interface ChatDrawerProps {
  attachOpen: boolean;
  chatLoading: boolean;
  chatOpen: boolean;
  chatTitle: string | null;
  classId: string | null;
  canAddMembers: boolean;
  canEditTitle: boolean;
  emojiOpen: boolean;
  messages: Message[];
  messagesEndRef: RefObject<HTMLDivElement | null>;
  otherTyping?: boolean;
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
  roomType: "direct" | "group" | "class" | "self" | undefined;
  photoInputRef: RefObject<HTMLInputElement | null>;
  videoInputRef: RefObject<HTMLInputElement | null>;
  selectedUserId: string | null;
  shakingMsgId: string | null;
  uploading: boolean;
  userId: string;
  onCancelLongPress: () => void;
  onChatScroll: (event: UIEvent<HTMLDivElement>) => void;
  onClose: () => void;
  onDeleteMessage: (msgId: string) => void;
  onOpenMemberDrawer: () => void;
  onNoticeReaction: (noticeId: string, reactionType: NoticeReactionType) => void;
  onNoticeVote: (noticeId: string, voteType: NoticeVoteType) => void;
  onPhotoUpload: (file: File) => void;
  onSendEmoji: (emojiSrc: string, text?: string) => void;
  onVideoUpload: (file: File) => void;
  onSaveNotice: (notice: string, kind: NoticeKind, closesAt: string | null) => Promise<void>;
  onUpdateNotice: (noticeId: string, content: string, kind: NoticeKind, closesAt: string | null) => Promise<void>;
  onDeleteNotice: (noticeId: string) => Promise<void>;
  onSendMessage: () => void;
  onMarkNoticeRead: (noticeId: string) => void;
  onMessageReaction: (messageId: string, reactionType: MessageReactionType) => void;
  onStartLongPress: (msgId: string, isMine: boolean) => void;
  onAvatarClick: (userId: string) => void;
  onTitleChanged: (title: string) => void;
  onLeaveRoom: () => void;
  roomCreatedAt: string | null;
  setAttachOpen: Dispatch<SetStateAction<boolean>>;
  setEmojiOpen: Dispatch<SetStateAction<boolean>>;
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

export default function ChatDrawer({
  attachOpen,
  chatLoading,
  chatOpen,
  chatTitle,
  classId,
  canAddMembers,
  canEditTitle,
  emojiOpen,
  messages,
  messagesEndRef,
  otherTyping,
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
  shakingMsgId,
  uploading,
  userId,
  onCancelLongPress,
  onChatScroll,
  onClose,
  onDeleteMessage,
  onOpenMemberDrawer,
  onNoticeReaction,
  onNoticeVote,
  onPhotoUpload,
  onSendEmoji,
  onVideoUpload,
  onSaveNotice,
  onUpdateNotice,
  onDeleteNotice,
  onSendMessage,
  onMarkNoticeRead,
  onMessageReaction,
  onStartLongPress,
  onAvatarClick,
  onTitleChanged,
  onLeaveRoom,
  roomCreatedAt,
  setAttachOpen,
  setEmojiOpen,
  setNewMessage,
  setShakingMsgId,
  formatTime,
}: ChatDrawerProps) {
  const [activeTab, setActiveTab] = useState<ChatDrawerTab>("all");
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
  const [viewerData, setViewerData] = useState<ImageViewerData | null>(null);
  const [pendingEmojiSrc, setPendingEmojiSrc] = useState<string | null>(null);
  const [menuOpen, setMenuOpen] = useState(false);
  const [showGame, setShowGame] = useState(false);
  const [muted, setMuted] = useState(() => roomId ? isChatMuted(roomId) : false);
  const [bgType, setBgType] = useState<ChatBgType>(() => roomId ? getChatBg(roomId) : "image");
  const [bgSheetOpen, setBgSheetOpen] = useState(false);
  const [classDetailId, setClassDetailId] = useState<string | null>(null);

  const handleToggleMute = useCallback(() => {
    if (!roomId) return;
    const next = !muted;
    setMuted(next);
    setChatMuted(roomId, next);
  }, [roomId, muted]);

  const handleSelectBg = useCallback((bg: ChatBgType) => {
    if (!roomId) return;
    setBgType(bg);
    setChatBg(roomId, bg);
    setBgSheetOpen(false);
  }, [roomId]);

  const chatBgStyle = useMemo<React.CSSProperties>(() => {
    const opt = CHAT_BG_OPTIONS.find((o) => o.type === bgType);
    if (!opt || opt.type === "image") {
      return {
        backgroundImage: "url(/chat_back.webp)",
        backgroundSize: "cover",
        backgroundPosition: "center",
        backgroundRepeat: "no-repeat",
      };
    }
    return { backgroundColor: opt.value };
  }, [bgType]);

  const isOwner = roomMembers?.some((m) => m.user_id === userId && m.role === "owner") ?? false;
  const isDirectRoom = roomType === "direct" || roomType === "self";
  const isClassRoom = roomType === "class";
  const contentBackgroundColor = "#F3F4F6";
  const displayedActiveTab: ChatDrawerTab = isDirectRoom && (activeTab === "class" || activeTab === "members") ? "all" : activeTab;
  const unreadNotice = notices.find((notice) => !notice.read_by_me) ?? null;

  const memberProfiles = useMemo<ChatMemberProfile[]>(() => {
    const unique = new Map<string, ChatMemberProfile>();
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

  const archiveItems = useMemo(() => getArchiveItems(messages), [messages]);
  const timeline = useMemo(() => buildTimeline(messages, notices, isClassRoom), [messages, notices, isClassRoom]);
  const hasActiveVote = useMemo(
    () => notices.some((n) => n.kind === "vote" && n.closes_at && new Date(n.closes_at).getTime() > now),
    [notices, now]
  );
  const classNoticeWriters = isClassRoom
    ? [
        memberProfiles.find((member) => member.role === "owner"),
        memberProfiles.filter((member) => member.role !== "owner")[0],
      ].filter(Boolean)
    : [];
  const canWriteClassNotice = classNoticeWriters.some((member) => member?.userId === userId);
  const todayDateStr = (() => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  })();

  useEffect(() => {
    if (activeTab !== "class" || !hasActiveVote) return;
    const id = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(id);
  }, [activeTab, hasActiveVote]);

  useEffect(() => {
    if (!chatOpen) return;

    const previousBodyOverflow = document.body.style.overflow;
    const previousHtmlOverflow = document.documentElement.style.overflow;
    document.body.style.overflow = "hidden";
    document.documentElement.style.overflow = "hidden";

    return () => {
      document.body.style.overflow = previousBodyOverflow;
      document.documentElement.style.overflow = previousHtmlOverflow;
    };
  }, [chatOpen]);

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

  function openUnreadNotice() {
    if (!unreadNotice) return;
    setActiveTab("class");
    onMarkNoticeRead(unreadNotice.id);
  }

  function handleEmojiSelect(emojiSrc: string) {
    setPendingEmojiSrc(emojiSrc);
    setAttachOpen(false);
    setTimeout(() => messagesEndRef.current?.scrollIntoView({ behavior: "smooth" }), 320);
  }

  function handleComposerSend() {
    if (pendingEmojiSrc) {
      const text = newMessage.trim();
      onSendEmoji(pendingEmojiSrc, text || undefined);
      setPendingEmojiSrc(null);
      if (text) setNewMessage("");
      return;
    }
    onSendMessage();
  }

  return (
    <>
    <ImageViewerDrawer data={viewerData} onClose={() => setViewerData(null)} onDelete={onDeleteMessage} />
    <div
      className={`fixed inset-0 z-[60] bg-white flex min-h-0 flex-col transition-transform duration-300 ease-in-out ${
        chatOpen ? "translate-x-0" : "translate-x-full"
      }`}
      style={{ paddingTop: 'env(safe-area-inset-top)' }}
    >
      <ChatDrawerHeader
        canEditTitle={canEditTitle}
        chatTitle={chatTitle}
        classId={classId}
        otherUser={otherUser}
        roomId={roomId}
        roomType={roomType}
        onClose={onClose}
        onMenuOpen={() => setMenuOpen(true)}
        onTitleChanged={onTitleChanged}
      />

      <ChatDrawerTabs
        displayedActiveTab={displayedActiveTab}
        isClassRoom={isClassRoom}
        isDirectRoom={isDirectRoom}
        onTabChange={setActiveTab}
      />

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
        @keyframes emojiBounce {
          0%, 100% { transform: translateY(0); }
          30% { transform: translateY(-16px); }
          60% { transform: translateY(0); }
        }
        .emoji-bounce { animation: emojiBounce 0.6s ease-in-out; }
        .chat-drawer-scroll {
          -webkit-overflow-scrolling: touch;
          overscroll-behavior: contain;
          touch-action: pan-y;
        }
      `}</style>

      {displayedActiveTab === "all" && isClassRoom && unreadNotice && (
        <div className="shrink-0 px-4 pt-3 pb-1" style={{ backgroundColor: contentBackgroundColor }}>
          <button
            type="button"
            onClick={openUnreadNotice}
            className="h-[40px] w-full rounded-[20px] bg-yellow-300 px-4 text-left text-sm font-semibold leading-[40px] text-gray-800 shadow-sm animate-[noticeBarDown_220ms_ease-out]"
          >
            <span className="flex h-full items-center gap-2">
              <Megaphone size={16} className="shrink-0" />
              <span className="min-w-0 flex-1 truncate">공지사항을 꼭 읽어주세요</span>
              <span className="shrink-0 text-xs font-bold text-gray-700">보기</span>
            </span>
          </button>
        </div>
      )}

      <div className="relative flex-1 min-h-0">
        <div
          className={`absolute inset-0 flex flex-col ${displayedActiveTab === "all" ? "" : "invisible pointer-events-none"}`}
          onTouchStart={() => { if (emojiOpen) { setEmojiOpen(false); setPendingEmojiSrc(null); } }}
          onClick={() => { if (emojiOpen) { setEmojiOpen(false); setPendingEmojiSrc(null); } }}
        >
          <ChatTimeline
            backgroundColor={contentBackgroundColor}
            bgStyle={chatBgStyle}
            chatLoading={chatLoading}
            messages={messages}
            messagesEndRef={messagesEndRef}
            otherTyping={otherTyping}
            myProfile={myProfile}
            noticeReactions={NOTICE_REACTIONS}
            notices={notices}
            otherUser={otherUser}
            roomMembers={roomMembers}
            shakingMsgId={shakingMsgId}
            timeline={timeline}
            userId={userId}
            onCancelLongPress={onCancelLongPress}
            onChatScroll={onChatScroll}
            onDeleteMessage={onDeleteMessage}
            onImageClick={(messageId: string, fullUrl: string, isMine: boolean) => setViewerData({ messageId, fullUrl, isMine })}
            onAvatarClick={onAvatarClick}
            onClassShareClick={(id: string) => setClassDetailId(id)}
            onMessageReaction={onMessageReaction}
            onNoticeReaction={onNoticeReaction}
            onStartLongPress={onStartLongPress}
            pendingEmojiSrc={pendingEmojiSrc}
            onClearPendingEmoji={() => setPendingEmojiSrc(null)}
            setAttachOpen={setAttachOpen}
            setShakingMsgId={setShakingMsgId}
            formatTime={formatTime}
          />
        </div>

        <div
          className={`absolute inset-0 chat-drawer-scroll overflow-y-auto px-0 py-0 ${displayedActiveTab === "members" ? "" : "invisible pointer-events-none"}`}
          style={{ backgroundColor: contentBackgroundColor }}
        >
          <MemberGrid
            canAddMembers={canAddMembers}
            members={memberProfiles}
            onAvatarClick={onAvatarClick}
            onOpenMemberDrawer={onOpenMemberDrawer}
          />
        </div>

        <div
          className={`absolute inset-0 chat-drawer-scroll overflow-y-auto px-4 py-5 ${displayedActiveTab === "class" ? "" : "invisible pointer-events-none"}`}
          style={{ backgroundColor: contentBackgroundColor }}
        >
          <ClassNoticePanel
            canWriteClassNotice={canWriteClassNotice}
            isClassRoom={isClassRoom}
            notices={notices}
            noticeReactions={NOTICE_REACTIONS}
            noticeVotes={NOTICE_VOTES}
            now={now}
            roomMembers={roomMembers}
            userId={userId}
            formatNoticeDate={formatNoticeDate}
            formatRemaining={formatRemaining}
            formatTime={formatTime}
            onNoticeReaction={onNoticeReaction}
            onNoticeVote={onNoticeVote}
            openNoticeDrawer={openNoticeDrawer}
            openEditNotice={openEditNotice}
            setDeleteTargetId={setDeleteTargetId}
          />
        </div>

        <div
          className={`absolute inset-0 chat-drawer-scroll overflow-y-auto px-4 py-4 ${displayedActiveTab === "archive" ? "" : "invisible pointer-events-none"}`}
          style={{ backgroundColor: contentBackgroundColor }}
        >
          <ArchiveGrid items={archiveItems} />
        </div>

        {showGame && (
          <div className="absolute inset-0 z-[10]">
            <MemberBreakoutGame
              members={memberProfiles as MemberGameProfile[]}
              userId={userId}
              roomId={roomId ?? ""}
              onExitGame={() => setShowGame(false)}
            />
          </div>
        )}
      </div>

      {displayedActiveTab === "all" && !showGame && (
        <>
          <ChatComposer
            emojiOpen={emojiOpen}
            muted={muted}
            newMessage={newMessage}
            pendingEmojiSrc={pendingEmojiSrc}
            selectedUserId={selectedUserId}
            setAttachOpen={setAttachOpen}
            setEmojiOpen={setEmojiOpen}
            setNewMessage={setNewMessage}
            onSendMessage={handleComposerSend}
          />

          <ChatAttachPanel
            attachOpen={attachOpen}
            photoInputRef={photoInputRef}
            videoInputRef={videoInputRef}
            uploading={uploading}
            onPhotoUpload={onPhotoUpload}
            onVideoUpload={onVideoUpload}
          />

          <ChatEmojiPanel
            emojiOpen={emojiOpen}
            pendingEmojiSrc={pendingEmojiSrc}
            uploading={uploading}
            onSelectEmoji={handleEmojiSelect}
          />
        </>
      )}

      {noticeDrawerOpen && (
        <NoticeEditorDrawer
          canWriteClassNotice={canWriteClassNotice}
          editingNoticeId={editingNoticeId}
          noticeDraft={noticeDraft}
          noticeError={noticeError}
          noticeKind={noticeKind}
          noticeSaving={noticeSaving}
          todayDateStr={todayDateStr}
          voteClosesAt={voteClosesAt}
          onClose={() => setNoticeDrawerOpen(false)}
          onSave={() => {
            void handleSaveNotice();
          }}
          setNoticeDraft={setNoticeDraft}
          setNoticeKind={setNoticeKind}
          setVoteClosesAt={setVoteClosesAt}
        />
      )}

      {deleteTargetId && (
        <NoticeDeleteDialog
          onCancel={() => setDeleteTargetId(null)}
          onConfirm={() => {
            void handleConfirmDelete();
          }}
        />
      )}

      <ChatMenuSheet
        open={menuOpen}
        isOwner={isOwner}
        muted={muted}
        roomCreatedAt={roomCreatedAt}
        onClose={() => setMenuOpen(false)}
        onInvite={onOpenMemberDrawer}
        onLeave={onLeaveRoom}
        onStartGame={() => setShowGame(true)}
        onToggleMute={handleToggleMute}
        onOpenBgSetting={() => setBgSheetOpen(true)}
      />

      <ChatBgSheet
        open={bgSheetOpen}
        selected={bgType}
        onSelect={handleSelectBg}
        onClose={() => setBgSheetOpen(false)}
      />

      <ToastOverlay message={toastMessage} />

      <div
        className={`fixed inset-0 z-[70] bg-white flex flex-col transition-transform duration-300 ease-in-out ${
          classDetailId ? "translate-x-0" : "translate-x-full"
        }`}
        style={{ paddingTop: 'env(safe-area-inset-top)' }}
      >
        {classDetailId && (
          <>
            <header className="sticky top-0 z-50 bg-white px-4 h-14 flex items-center">
              <button
                type="button"
                aria-label="뒤로 가기"
                onClick={() => setClassDetailId(null)}
                className="w-10 h-10 -ml-1 flex items-center justify-center text-gray-500"
              >
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  width="18"
                  height="18"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="3"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <path d="m15 18-6-6 6-6" />
                </svg>
              </button>
              <div className="absolute left-1/2 -translate-x-1/2 font-bold text-xl text-[#4d4d4d] leading-none">
                클래스 상세정보
              </div>
              <div className="ml-auto w-10" />
            </header>
            <div className="flex-1 overflow-y-auto">
              <CachedClassDetailPage
                classIdOverride={classDetailId}
                hideChat
                onClose={() => setClassDetailId(null)}
              />
            </div>
          </>
        )}
      </div>
    </div>
    </>
  );
}
