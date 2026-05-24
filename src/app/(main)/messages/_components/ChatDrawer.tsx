"use client";

import { useEffect, useMemo, useState } from "react";
import type { Dispatch, RefObject, SetStateAction, UIEvent } from "react";
import { Megaphone } from "lucide-react";
import ChatAttachPanel from "./ChatAttachPanel";
import ArchiveGrid from "./chat/ArchiveGrid";
import ChatComposer from "./chat/ChatComposer";
import ChatDrawerHeader from "./chat/ChatDrawerHeader";
import ChatDrawerTabs, { type ChatDrawerTab } from "./chat/ChatDrawerTabs";
import ChatTimeline from "./chat/ChatTimeline";
import MemberGrid, { type ChatMemberProfile } from "./chat/MemberGrid";
import ToastOverlay from "./chat/ToastOverlay";
import ClassNoticePanel from "./notices/ClassNoticePanel";
import NoticeDeleteDialog from "./notices/NoticeDeleteDialog";
import NoticeEditorDrawer from "./notices/NoticeEditorDrawer";
import type { ChatNotice, Message, MessageReactionType, MyProfile, NoticeKind, NoticeReactionType, NoticeVoteType, OtherUser } from "../_types";
import { buildTimeline, getArchiveItems } from "../_lib/message-content";

interface ChatDrawerProps {
  attachOpen: boolean;
  chatLoading: boolean;
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

  const isDirectRoom = roomType === "direct" || roomType === "self";
  const isClassRoom = roomType === "class";
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

  return (
    <div
      className={`fixed inset-0 z-[60] bg-white flex min-h-0 flex-col transition-transform duration-300 ease-in-out ${
        chatOpen ? "translate-x-0" : "translate-x-full"
      }`}
    >
      <ChatDrawerHeader
        canEditTitle={canEditTitle}
        chatTitle={chatTitle}
        otherUser={otherUser}
        roomId={roomId}
        roomType={roomType}
        onClose={onClose}
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
        .chat-drawer-scroll {
          -webkit-overflow-scrolling: touch;
          overscroll-behavior: contain;
          touch-action: pan-y;
        }
      `}</style>

      {displayedActiveTab === "all" && isClassRoom && unreadNotice && (
        <div className="shrink-0 px-4 pt-3 pb-1" style={{ backgroundColor: "#B2C7D9" }}>
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

      {displayedActiveTab === "all" ? (
        <ChatTimeline
          chatLoading={chatLoading}
          messages={messages}
          messagesEndRef={messagesEndRef}
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
          onMessageReaction={onMessageReaction}
          onNoticeReaction={onNoticeReaction}
          onStartLongPress={onStartLongPress}
          setAttachOpen={setAttachOpen}
          setShakingMsgId={setShakingMsgId}
          formatTime={formatTime}
        />
      ) : (
        <div
          className={`chat-drawer-scroll flex-1 min-h-0 overflow-y-auto px-4 ${
            displayedActiveTab === "class" ? "py-5" : "py-4"
          }`}
          style={{ backgroundColor: "#B2C7D9" }}
        >
          {displayedActiveTab === "members" ? (
            <MemberGrid
              canAddMembers={canAddMembers}
              isClassRoom={isClassRoom}
              members={memberProfiles}
              onOpenMemberDrawer={onOpenMemberDrawer}
            />
          ) : displayedActiveTab === "class" ? (
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
          ) : (
            <ArchiveGrid items={archiveItems} />
          )}
        </div>
      )}

      {displayedActiveTab === "all" && (
        <>
          <ChatComposer
            newMessage={newMessage}
            selectedUserId={selectedUserId}
            setAttachOpen={setAttachOpen}
            setNewMessage={setNewMessage}
            onSendMessage={onSendMessage}
          />

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

      <ToastOverlay message={toastMessage} />
    </div>
  );
}
