"use client";

import React, { memo, useState, useEffect } from "react";
import Image from "next/image";
import { Loader2, Play, TriangleAlert } from "lucide-react";
import type { Message, MessageReactionType, MyProfile, OtherUser } from "../_types";
import {
  formatClassShareDate,
  getClassShareData,
  getEmojiMessageData,
  getImageMessageData,
  getVideoMessageData,
  hasRichMessageContent,
} from "../_lib/message-content";

interface MessageBubbleProps {
  msg: Message;
  prevMsg: Message | null;
  userId: string;
  myProfile: MyProfile | null;
  otherUser: OtherUser | null;
  shakingMsgId: string | null;
  isSelfChat?: boolean;
  messageIndex?: number;
  onStartLongPress: (msgId: string, isMine: boolean) => void;
  onCancelLongPress: () => void;
  onDeleteMessage: (msgId: string) => void;
  onMessageReaction: (msgId: string, reactionType: MessageReactionType) => void;
  onImageClick?: (messageId: string, fullUrl: string, isMine: boolean) => void;
  onAvatarClick?: (userId: string) => void;
  onClassShareClick?: (classId: string) => void;
  formatTime: (dateStr: string) => string;
}

const MESSAGE_REACTIONS: Array<{ type: MessageReactionType; label: string }> = [
  { type: "heart", label: "❤️" },
  { type: "like", label: "👍" },
  { type: "laugh", label: "😂" },
  { type: "wow", label: "😮" },
  { type: "sad", label: "😢" },
];

export default memo(function MessageBubble({
  msg,
  prevMsg,
  userId,
  myProfile,
  otherUser,
  shakingMsgId,
  isSelfChat = false,
  messageIndex = 0,
  onStartLongPress,
  onCancelLongPress,
  onDeleteMessage,
  onMessageReaction,
  onImageClick,
  onAvatarClick,
  onClassShareClick,
  formatTime,
}: MessageBubbleProps) {
  const isMine = isSelfChat ? messageIndex % 2 === 0 : msg.sender_id === userId;
  const isNewGroup = !prevMsg || prevMsg.sender_id !== msg.sender_id;
  const showSenderName = !isMine && isNewGroup;
  const showMyAvatar = isMine && isNewGroup;
  const sender = msg.sender ?? otherUser;
  const emojiData = msg.kind === "emoji" ? getEmojiMessageData(msg.content) : null;
  const imageData = msg.kind !== "emoji" ? getImageMessageData(msg.content) : null;
  const videoData = getVideoMessageData(msg.content);
  const classShareData = getClassShareData(msg.content);
  const hasRichContent = hasRichMessageContent(msg.content);

  const isNewEmoji = emojiData && msg.send_status === "sending";
  const [emojiAnim, setEmojiAnim] = useState<string | null>(null);
  const emojiAnimRef = React.useRef(false);
  useEffect(() => {
    if (isNewEmoji && !emojiAnimRef.current) {
      emojiAnimRef.current = true;
      setEmojiAnim("emoji-bounce");
      const timer = window.setTimeout(() => setEmojiAnim(null), 2000);
      return () => window.clearTimeout(timer);
    }
  }, [isNewEmoji]);

  return (
    <div data-msg-id={msg.id}>
      {showMyAvatar && (
        <div className="flex justify-end mb-2">
          {myProfile?.profile_image_url ? (
            <Image
              src={myProfile.profile_image_url}
              alt={myProfile.nickname ?? "나"}
              width={40}
              height={40}
              className="rounded-full object-cover flex-shrink-0"
            />
          ) : (
            <div className="w-[40px] h-[40px] rounded-full bg-gray-200 flex items-center justify-center text-gray-500 text-xs font-medium flex-shrink-0">
              {myProfile?.nickname?.[0] ?? "나"}
            </div>
          )}
        </div>
      )}
      {showSenderName && (
        <div className="flex items-center gap-2 mb-2">
          <button
            type="button"
            onClick={() => sender?.id && onAvatarClick?.(sender.id)}
            className="flex-shrink-0"
          >
            {sender?.profile_image_url ? (
              <Image
                src={sender.profile_image_url}
                alt={sender.nickname}
                width={40}
                height={40}
                className="rounded-full object-cover"
              />
            ) : (
              <div className="w-[40px] h-[40px] rounded-full bg-gray-200 flex items-center justify-center text-gray-500 text-xs font-medium">
                {sender?.nickname?.[0] ?? "?"}
              </div>
            )}
          </button>
          <span className="text-base text-gray-800">{sender?.nickname}</span>
        </div>
      )}
      <div className={`flex ${isMine ? "justify-end" : "justify-start"} gap-2 items-end`}>
        {!isMine && <span className="text-xs text-gray-700 flex-shrink-0 order-2">{formatTime(msg.sent_at)}</span>}
        <div className={`flex ${isMine ? "flex-col items-end" : ""} gap-1`}>
          <div className={`flex items-end gap-1 ${isMine ? "flex-row" : "flex-row-reverse"}`}>
            {(() => {
              const activeReactions = MESSAGE_REACTIONS.filter((reaction) => {
                const count = msg.reaction_counts?.[reaction.type] ?? 0;
                const active = msg.my_reaction === reaction.type;
                return count > 0 || active;
              });
              if (activeReactions.length === 0) return null;
              return (
                <div className="flex flex-col gap-1 flex-shrink-0">
                  {activeReactions.map((reaction) => {
                    const count = msg.reaction_counts?.[reaction.type] ?? 0;
                    return (
                      <button
                        key={reaction.type}
                        type="button"
                        onClick={() => onMessageReaction(msg.id, reaction.type)}
                        className="px-1 text-xs font-bold"
                      >
                        {reaction.label} <span className="text-gray-700 font-normal">{count}</span>
                      </button>
                    );
                  })}
                </div>
              );
            })()}
            <div
              className={`relative rounded-lg overflow-visible ${
                hasRichContent || emojiData ? "" : "px-3 py-2"
              } ${isMine ? "text-gray-900" : emojiData ? "text-gray-900" : "bg-white text-gray-900"} ${isMine && shakingMsgId === msg.id ? "msg-shake" : ""} select-none`}
              style={{
                ...(isMine ? { maxWidth: "72vw" } : { maxWidth: "270px" }),
                ...(isMine && !hasRichContent && !emojiData ? { backgroundColor: "#FEE500" } : {}),
                fontFamily: 'Roboto, -apple-system, BlinkMacSystemFont, "Apple SD Gothic Neo", "Malgun Gothic", sans-serif',
              }}
              onTouchStart={() => onStartLongPress(msg.id, isMine)}
              onTouchEnd={onCancelLongPress}
              onMouseDown={() => onStartLongPress(msg.id, isMine)}
              onMouseUp={onCancelLongPress}
              onMouseLeave={onCancelLongPress}
              onContextMenu={(e) => e.preventDefault()}
            >
              {isMine && shakingMsgId === msg.id && (
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    onDeleteMessage(msg.id);
                  }}
                  className="absolute -top-2 -left-2 z-10 w-5 h-5 bg-red-500 rounded-full flex items-center justify-center"
                >
                  <span className="text-white text-xs font-bold leading-none">✕</span>
                </button>
              )}
              {!isMine && shakingMsgId === msg.id && (
                <div className="absolute top-full left-0 mt-1 z-10 flex gap-1 bg-white rounded-full px-2 py-1 shadow-lg">
                  {MESSAGE_REACTIONS.map((reaction) => (
                    <button
                      key={reaction.type}
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        onMessageReaction(msg.id, reaction.type);
                        onCancelLongPress();
                      }}
                      className="text-lg hover:scale-125 transition-transform"
                    >
                      {reaction.label}
                    </button>
                  ))}
                </div>
              )}
              {emojiData ? (
                <Image src={emojiData.src} alt="이모지" width={120} height={120} draggable={false} onContextMenu={(e) => e.preventDefault()} className={`h-[120px] w-[120px] select-none object-contain ${emojiAnim ?? ""}`} style={{ WebkitTouchCallout: "none" }} />
              ) : imageData ? (
                <div className="relative">
                  <button
                    type="button"
                    onClick={() => !msg.send_status && onImageClick?.(msg.id, imageData.full, isMine)}
                    className="block"
                  >
                    <Image src={imageData.thumb} alt="사진" width={100} height={100} className={`rounded-lg object-cover ${msg.send_status === "sending" ? "opacity-60" : ""}`} />
                  </button>
                  {msg.send_status === "sending" && (
                    <div className="absolute inset-0 flex items-center justify-center rounded-lg bg-black/30">
                      <Loader2 size={32} className="animate-spin text-white" />
                    </div>
                  )}
                </div>
              ) : videoData ? (
                videoData.status === "ready" && videoData.video_url ? (
                  <video
                    src={videoData.video_url}
                    poster={videoData.thumbnail_url ?? undefined}
                    controls
                    preload="metadata"
                    className="block max-h-[360px] w-[220px] rounded-lg bg-black object-cover"
                  />
                ) : videoData.status === "failed" ? (
                  <div className="flex h-[124px] w-[220px] flex-col items-center justify-center gap-2 rounded-lg bg-white px-4 text-center text-red-500">
                    <TriangleAlert size={24} />
                    <span className="text-sm font-bold">영상 처리 실패</span>
                  </div>
                ) : (
                  <div className="flex h-[124px] w-[220px] flex-col items-center justify-center gap-2 rounded-lg bg-gray-900 px-4 text-center text-white">
                    <div className="relative flex h-10 w-10 items-center justify-center rounded-full bg-white/15">
                      <Play size={18} fill="currentColor" />
                      <Loader2 size={40} className="absolute animate-spin opacity-60" />
                    </div>
                    <span className="text-sm font-bold">
                      {videoData.status === "uploading" ? "영상 업로드중" : "영상 처리중"}
                    </span>
                  </div>
                )
              ) : classShareData?.class?.id ? (
                <div className="w-[270px] overflow-hidden rounded-lg bg-white">
                  {classShareData.message && (
                    <p className="px-3 pt-3 text-sm font-medium text-gray-900">{classShareData.message}</p>
                  )}
                  <button
                    type="button"
                    onClick={() => onClassShareClick?.(classShareData.class!.id!)}
                    className="block w-full p-2 text-left"
                  >
                    <div className="flex gap-3 rounded-md border border-gray-100 bg-gray-50 p-2">
                      {classShareData.class.image_url ? (
                        <Image
                          src={classShareData.class.image_url}
                          alt={classShareData.class.title ?? "클래스"}
                          width={58}
                          height={58}
                          className="h-[58px] w-[58px] rounded-md object-cover"
                        />
                      ) : (
                        <div className="flex h-[58px] w-[58px] shrink-0 items-center justify-center rounded-md bg-gray-200 text-lg">
                          CLASS
                        </div>
                      )}
                      <div className="min-w-0 flex-1">
                        <p className="line-clamp-2 text-sm font-bold text-gray-900">{classShareData.class.title}</p>
                        <p className="mt-1 text-xs text-gray-500">
                          {[classShareData.class.region, formatClassShareDate(classShareData.class.datetime)].filter(Boolean).join(" · ")}
                        </p>
                      </div>
                    </div>
                  </button>
                </div>
              ) : (
                <p className="break-words">{msg.content}</p>
              )}
            </div>
          </div>
          {isMine && (
            <span className={`flex items-center gap-1 text-xs text-gray-700 ${emojiData ? "justify-center w-full" : ""}`}>
              {msg.send_status === "sending" ? (
                <span className="text-xs font-normal leading-none text-gray-400">전송중</span>
              ) : msg.send_status === "failed" ? (
                <span className="text-xs font-bold leading-none text-red-500">전송실패</span>
              ) : (
                <>
                  {videoData?.file_size && (
                    <span className="text-[11px] text-gray-400">
                      {videoData.file_size < 1024 * 1024
                        ? `${(videoData.file_size / 1024).toFixed(0)}KB`
                        : `${(videoData.file_size / (1024 * 1024)).toFixed(1)}MB`}
                    </span>
                  )}
                  {formatTime(msg.sent_at)}
                  {"read_at" in msg && (
                    msg.read_at ? (
                      <span className="text-xs font-normal leading-none text-[#595959]">
                        읽음
                      </span>
                    ) : (
                      <span className="text-xs font-normal leading-none text-red-500">
                        안읽음
                      </span>
                    )
                  )}
                </>
              )}
            </span>
          )}
        </div>
      </div>
    </div>
  );
});
