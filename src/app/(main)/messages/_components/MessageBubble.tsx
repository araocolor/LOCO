"use client";

import Image from "next/image";
import type { Message, MessageReactionType, MyProfile, OtherUser } from "../_types";

interface MessageBubbleProps {
  msg: Message;
  prevMsg: Message | null;
  userId: string;
  myProfile: MyProfile | null;
  otherUser: OtherUser | null;
  shakingMsgId: string | null;
  onStartLongPress: (msgId: string, isMine: boolean) => void;
  onCancelLongPress: () => void;
  onDeleteMessage: (msgId: string) => void;
  onMessageReaction: (msgId: string, reactionType: MessageReactionType) => void;
  formatTime: (dateStr: string) => string;
}

const MESSAGE_REACTIONS: Array<{ type: MessageReactionType; label: string }> = [
  { type: "heart", label: "❤️" },
  { type: "like", label: "👍" },
  { type: "laugh", label: "😂" },
  { type: "wow", label: "😮" },
  { type: "sad", label: "😢" },
];

export default function MessageBubble({
  msg,
  prevMsg,
  userId,
  myProfile,
  otherUser,
  shakingMsgId,
  onStartLongPress,
  onCancelLongPress,
  onDeleteMessage,
  onMessageReaction,
  formatTime,
}: MessageBubbleProps) {
  const isMine = msg.sender_id === userId;
  const isNewGroup = !prevMsg || prevMsg.sender_id !== msg.sender_id;
  const showSenderName = !isMine && isNewGroup;
  const showMyAvatar = isMine && isNewGroup;
  const sender = msg.sender ?? otherUser;
  let imageData: { thumb: string; full: string } | null = null;

  try {
    const parsed = JSON.parse(msg.content);
    if (parsed.type === "image") imageData = parsed;
  } catch {}

  return (
    <div>
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
          {sender?.profile_image_url ? (
            <Image
              src={sender.profile_image_url}
              alt={sender.nickname}
              width={40}
              height={40}
              className="rounded-full object-cover flex-shrink-0"
            />
          ) : (
            <div className="w-[40px] h-[40px] rounded-full bg-gray-200 flex items-center justify-center text-gray-500 text-xs font-medium flex-shrink-0">
              {sender?.nickname?.[0] ?? "?"}
            </div>
          )}
          <span className="text-base text-gray-800">{sender?.nickname}</span>
        </div>
      )}
      <div className={`flex ${isMine ? "justify-end" : "justify-start"} gap-2 items-end`}>
        {!isMine && <span className="text-xs text-gray-700 flex-shrink-0 order-2">{formatTime(msg.sent_at)}</span>}
        <div className={`flex ${isMine ? "flex-col items-end" : ""} gap-1`}>
          <div
            className={`relative rounded-lg text-base overflow-visible ${
              imageData ? "" : "px-3 py-2"
            } ${isMine ? "text-gray-900" : "bg-white text-gray-900"} ${isMine && shakingMsgId === msg.id ? "msg-shake" : ""}`}
            style={{
              ...(isMine ? { maxWidth: "72vw" } : { maxWidth: "270px" }),
              ...(isMine && !imageData ? { backgroundColor: "#FEE500" } : {}),
            }}
            onTouchStart={() => onStartLongPress(msg.id, isMine)}
            onTouchEnd={onCancelLongPress}
            onMouseDown={() => onStartLongPress(msg.id, isMine)}
            onMouseUp={onCancelLongPress}
            onMouseLeave={onCancelLongPress}
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
            {imageData ? (
              <a href={imageData.full} target="_blank" rel="noreferrer">
                <Image src={imageData.thumb} alt="사진" width={200} height={200} className="rounded-lg object-cover" />
              </a>
            ) : (
              <p className="break-words">{msg.content}</p>
            )}
          </div>
          {isMine && (
            <span className="flex items-center gap-1 text-xs text-gray-700">
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
            </span>
          )}
          <div className={`flex flex-wrap gap-1 ${isMine ? "justify-end" : "justify-start"}`}>
            {MESSAGE_REACTIONS.map((reaction) => {
              const count = msg.reaction_counts?.[reaction.type] ?? 0;
              const active = msg.my_reaction === reaction.type;
              if (count === 0 && !active) return null;
              return (
                <button
                  key={reaction.type}
                  type="button"
                  onClick={() => onMessageReaction(msg.id, reaction.type)}
                  className={`rounded-full px-2 py-0.5 text-xs font-bold shadow-sm ${
                    active ? "bg-black text-white" : "bg-white text-gray-800"
                  }`}
                >
                  {reaction.label} {count}
                </button>
              );
            })}
            <div className="flex gap-1">
              {MESSAGE_REACTIONS.filter((reaction) => (msg.reaction_counts?.[reaction.type] ?? 0) === 0 && msg.my_reaction !== reaction.type).map((reaction) => (
                <button
                  key={reaction.type}
                  type="button"
                  onClick={() => onMessageReaction(msg.id, reaction.type)}
                  className="rounded-full bg-white/80 px-1.5 py-0.5 text-xs shadow-sm"
                >
                  {reaction.label}
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
