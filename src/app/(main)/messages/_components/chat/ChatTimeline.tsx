"use client";

import React from "react";
import type { Dispatch, RefObject, SetStateAction } from "react";
import type { UIEvent } from "react";
import Image from "next/image";
import { BarChart3, Megaphone, X } from "lucide-react";
import Avatar from "@/components/ui/Avatar";
import MessageBubble from "../MessageBubble";
import type { ChatNotice, Message, MessageReactionType, MyProfile, NoticeReactionType, OtherUser } from "../../_types";
import type { TimelineItem } from "../../_lib/message-content";

interface NoticeReactionOption {
  type: NoticeReactionType;
  label: string;
}

interface ChatTimelineProps {
  backgroundColor: string;
  bgStyle: React.CSSProperties;
  chatLoading: boolean;
  messages: Message[];
  messagesEndRef: RefObject<HTMLDivElement | null>;
  otherTyping?: boolean;
  myProfile: MyProfile | null;
  noticeReactions: NoticeReactionOption[];
  notices: ChatNotice[];
  otherUser: OtherUser | null;
  roomMembers: Array<{
    user_id: string;
    role: "owner" | "admin" | "member";
    created_at?: string | null;
    profile: OtherUser | null;
  }> | undefined;
  shakingMsgId: string | null;
  timeline: TimelineItem[];
  userId: string;
  formatTime: (dateStr: string) => string;
  onCancelLongPress: () => void;
  onChatScroll: (event: UIEvent<HTMLDivElement>) => void;
  onDeleteMessage: (msgId: string) => void;
  onMessageReaction: (messageId: string, reactionType: MessageReactionType) => void;
  onImageClick: (messageId: string, fullUrl: string, isMine: boolean) => void;
  onAvatarClick: (userId: string) => void;
  onClassShareClick: (classId: string) => void;
  onNoticeReaction: (noticeId: string, reactionType: NoticeReactionType) => void;
  onStartLongPress: (msgId: string, isMine: boolean) => void;
  pendingEmojiSrc: string | null;
  onClearPendingEmoji: () => void;
  setAttachOpen: Dispatch<SetStateAction<boolean>>;
  setShakingMsgId: Dispatch<SetStateAction<string | null>>;
}

export default function ChatTimeline({
  backgroundColor,
  bgStyle,
  chatLoading,
  messages,
  messagesEndRef,
  otherTyping,
  myProfile,
  noticeReactions,
  notices,
  otherUser,
  roomMembers,
  shakingMsgId,
  timeline,
  userId,
  formatTime,
  onCancelLongPress,
  onChatScroll,
  onDeleteMessage,
  onImageClick,
  onAvatarClick,
  onClassShareClick,
  onMessageReaction,
  onNoticeReaction,
  onStartLongPress,
  pendingEmojiSrc,
  onClearPendingEmoji,
  setAttachOpen,
  setShakingMsgId,
}: ChatTimelineProps) {
  return (
    <div
      className="chat-drawer-scroll flex-1 min-h-0 overflow-y-auto px-4 py-4 flex flex-col gap-3"
      style={bgStyle}
      onScroll={onChatScroll}
      onClick={() => {
        setAttachOpen(false);
        setShakingMsgId(null);
      }}
    >
      {chatLoading ? (
        <div className="flex items-center justify-center h-full text-gray-600">로딩 중...</div>
      ) : messages.length === 0 && notices.length === 0 ? (
        <div className="flex items-center justify-center h-full text-gray-600 text-sm">
          대화 시작하기
        </div>
      ) : (() => {
        let prevMsgItem: Message | null = null;
        let prevDateStr = "";
        return timeline.map((item) => {
          const itemDate = new Date(item.at);
          const dateStr = `${itemDate.getFullYear()}-${itemDate.getMonth()}-${itemDate.getDate()}`;
          const showDateSeparator = dateStr !== prevDateStr;
          prevDateStr = dateStr;

          const dateSeparator = showDateSeparator ? (
            <div key={`date-${item.at}`} className="flex items-center justify-center my-2">
              <span className="px-4 py-1 rounded-full bg-black/20 text-white text-xs font-medium backdrop-blur-sm">
                {itemDate.toLocaleDateString("ko-KR", { year: "numeric", month: "long", day: "numeric", weekday: "long" })}
              </span>
            </div>
          ) : null;

          if (item.kind === "msg") {
            const prev = prevMsgItem;
            if (showDateSeparator) prevMsgItem = null;
            else prevMsgItem = item.msg;
            const prevForBubble = showDateSeparator ? null : prev;
            return (
              <React.Fragment key={`m-${item.msg.id}`}>
                {dateSeparator}
                <MessageBubble
                  msg={item.msg}
                  prevMsg={prevForBubble}
                  userId={userId}
                  myProfile={myProfile}
                  otherUser={otherUser}
                  shakingMsgId={shakingMsgId}
                  isSelfChat={otherUser?.id === userId}
                  messageIndex={messages.indexOf(item.msg)}
                  onStartLongPress={onStartLongPress}
                  onCancelLongPress={onCancelLongPress}
                  onDeleteMessage={onDeleteMessage}
                  onMessageReaction={onMessageReaction}
                  onImageClick={onImageClick}
                  onAvatarClick={onAvatarClick}
                  onClassShareClick={onClassShareClick}
                  formatTime={formatTime}
                />
              </React.Fragment>
            );
          }

          prevMsgItem = null;
          const notice = item.notice;
          const author = (roomMembers ?? []).find((m) => m.user_id === notice.author_id)?.profile ?? null;
          return (
            <React.Fragment key={`n-${notice.id}`}>
              {dateSeparator}
            <div className="flex items-start gap-2">
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
                      {noticeReactions.map((reaction) => (
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
                  const activeReactions = noticeReactions.filter((r) => (notice.reaction_counts?.[r.type] ?? 0) > 0 || notice.my_reaction === r.type);
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
            </React.Fragment>
          );
        });
      })()}
      {pendingEmojiSrc && (
        <div className="flex justify-end">
          <div className="relative inline-flex items-center rounded-2xl bg-white/90 p-3 shadow-sm">
            <Image
              src={pendingEmojiSrc}
              alt="전송 대기중"
              width={150}
              height={150}
              className="h-[150px] w-[150px] object-contain"
            />
            <button
              type="button"
              onClick={onClearPendingEmoji}
              className="absolute -top-2 -right-2 flex h-6 w-6 items-center justify-center rounded-full bg-gray-700 text-white shadow"
              aria-label="선택 취소"
            >
              <X size={12} />
            </button>
          </div>
        </div>
      )}
      {otherTyping && (
        <div className="flex items-center gap-1 px-3 py-2 w-fit rounded-2xl bg-white/90 shadow-sm">
          <span className="h-2 w-2 rounded-full bg-gray-400 animate-bounce [animation-delay:-0.3s]" />
          <span className="h-2 w-2 rounded-full bg-gray-400 animate-bounce [animation-delay:-0.15s]" />
          <span className="h-2 w-2 rounded-full bg-gray-400 animate-bounce" />
        </div>
      )}
      <div ref={messagesEndRef} />
    </div>
  );
}
