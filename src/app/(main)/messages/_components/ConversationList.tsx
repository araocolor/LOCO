"use client";

import { useCallback } from "react";
import Image from "next/image";
import type { Conversation, MessageMenuTab, MyProfile } from "../_types";
import { getMessagePreviewText, parseMessageContent } from "../_lib/message-content";
import MessageFriendsPanel from "./MessageFriendsPanel";

const DEFAULT_AVATAR = "/no face/noface.png";

interface ConversationListProps {
  activeMenuTab: MessageMenuTab;
  conversations: Conversation[];
  loading: boolean;
  myProfile: MyProfile | null;
  onlineIds: Set<string>;
  onOpenChat: (roomId: string) => void;
  onOpenSelfChat: () => void;
  onOpenProfile: (userId: string) => void;
  onFriendMessageSent: (roomId: string) => void;
  formatDate: (dateStr: string) => string;
  truncateMessage: (content: string, length?: number) => string;
}

export default function ConversationList({
  activeMenuTab,
  conversations,
  loading,
  myProfile,
  onlineIds,
  onOpenChat,
  onOpenProfile,
  onOpenSelfChat,
  onFriendMessageSent,
  formatDate,
  truncateMessage,
}: ConversationListProps) {
  const selfChat = conversations.find((conv) => conv.type === "self");
  const directConversations = conversations.filter((conv) => conv.type === "direct");
  const groupConversations = conversations.filter((conv) => conv.type === "group");
  const classConversations = conversations.filter((conv) => conv.type === "class");
  const getPreviewText = useCallback((content: string, isMine?: boolean) => {
    return getMessagePreviewText(content, { isMine, truncate: truncateMessage });
  }, [truncateMessage]);
  const visibleConversations =
    activeMenuTab === "direct"
      ? directConversations
      : activeMenuTab === "friends"
        ? []
      : activeMenuTab === "groups"
        ? groupConversations
        : activeMenuTab === "class"
          ? classConversations
          : [];
  const centeredStatusClass = "flex min-h-[calc(100dvh-220px)] flex-col items-center justify-center text-gray-400";

  return (
    <>
      <div className="min-h-0 flex-1 overflow-y-auto">
        {activeMenuTab === "friends" ? (
          <MessageFriendsPanel onlineIds={onlineIds} onMessageSent={onFriendMessageSent} />
        ) : loading ? (
          <div className={centeredStatusClass}>로딩 중...</div>
        ) : visibleConversations.length === 0 && activeMenuTab !== "direct" ? (
          <div className={centeredStatusClass}>
            <Image
              src="/character/tino.png"
              alt="Tino"
              width={80}
              height={80}
              className="mb-2 h-[80px] w-[80px] object-contain"
              priority={false}
            />
            <p className="text-sm">
              {activeMenuTab === "class"
                ? "클래스 대화방이 없습니다"
                : activeMenuTab === "groups"
                  ? "그룹 대화방이 없습니다"
                  : "1:1 대화가 없습니다"}
            </p>
          </div>
        ) : (
          <div className="flex min-h-full flex-col">
          {activeMenuTab === "direct" && (
            <div
              onClick={() => selfChat ? onOpenChat(selfChat.id) : onOpenSelfChat()}
              className="border-b border-gray-100 hover:bg-gray-50 cursor-pointer transition-colors"
            >
              <div className="flex items-stretch gap-2">
                <div className="flex-1 px-3 py-3">
                  <div className="flex items-start gap-3">
                    <div className="flex-shrink-0 relative">
                      <Image
                        src={myProfile?.profile_image_url || DEFAULT_AVATAR}
                        alt="나"
                        width={43}
                        height={43}
                        className="h-[43px] w-[43px] rounded-[19px] object-cover"
                        unoptimized
                      />
                    </div>
                    <div className="flex-1 min-w-0 pt-0.5">
                      <div className="flex items-center justify-between">
                        <span className="font-bold text-gray-900" style={{ fontSize: 15 }}>
                          나와의 채팅
                        </span>
                        {selfChat?.last_message?.sent_at && (
                          <span className="text-xs text-gray-400 ml-2 whitespace-nowrap">
                            {formatDate(selfChat.last_message.sent_at)}
                          </span>
                        )}
                      </div>
                      <p className="text-sm text-gray-500 truncate mt-0.5">
                        {selfChat?.last_message?.content
                          ? getPreviewText(selfChat.last_message.content)
                          : "나만의 메모 공간"}
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}
          {visibleConversations.map((conv) => (
            <div
              key={conv.id}
              onClick={() => onOpenChat(conv.id)}
              className="border-b border-gray-100 hover:bg-gray-50 cursor-pointer transition-colors"
            >
              {(() => {
                const isMine = conv.last_message?.kind !== "system" && conv.last_message?.is_mine;
                const lastContent = conv.last_message?.content ?? "";
                const classImageUrl = conv.type === "class" ? conv.class_image_url : null;
                let fallbackPreview = "";
                const parsed = parseMessageContent(lastContent);
                if (parsed?.type === "image" || parsed?.type === "video") {
                  fallbackPreview = getPreviewText(lastContent, isMine);
                } else if (conv.last_message?.kind === "emoji" || typeof parsed?.src === "string") {
                  if (typeof parsed?.text === "string" && parsed.text.trim()) {
                    fallbackPreview = parsed.text.trim();
                  } else {
                    const senderNickname = conv.last_message?.sender_id
                      ? conv.members?.find((m) => m.user_id === conv.last_message?.sender_id)?.profile?.nickname
                      : undefined;
                    fallbackPreview = senderNickname
                      ? `${senderNickname}님이 이모지를 남겼습니다`
                      : isMine
                        ? "이모지를 보냈습니다"
                        : "이모지가 도착했습니다";
                  }
                } else if (parsed?.type === "class_share") {
                  const senderNickname = conv.last_message?.sender_id
                    ? conv.members?.find((m) => m.user_id === conv.last_message?.sender_id)?.profile?.nickname
                    : undefined;
                  fallbackPreview = senderNickname
                    ? `${senderNickname}님이 클래스를 공유하였습니다`
                    : isMine
                      ? "클래스를 공유하였습니다"
                      : "클래스가 공유되었습니다";
                }

                const showOnlineDot =
                  conv.other_user?.id ? onlineIds.has(conv.other_user.id) : false;
                const displayNickname = conv.title ?? conv.other_user?.nickname ?? "알 수 없음";
                const avatarText = displayNickname[0] ?? "?";
                const showGroupAvatars = conv.type === "group";
                const groupAvatarSlots = showGroupAvatars
                  ? (() => {
                      const members = conv.members ?? [];
                      const owner = members.find((member) => member.role === "owner");
                      const others = members.filter((member) => member.user_id !== owner?.user_id);
                      return {
                        top: others[0],
                        left: others[1],
                        right: owner ?? others[2],
                      };
                    })()
                  : { top: undefined, left: undefined, right: undefined };
                return (
                  <div className="flex items-stretch gap-2">
                    <div className="flex-1 px-3 py-3">
                      <div className="flex items-start gap-3">
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            if (!conv.other_user?.id) return;
                            onOpenProfile(conv.other_user.id);
                          }}
                          className="flex-shrink-0 relative"
                          aria-label={`${conv.other_user?.nickname ?? "사용자"} 프로필 보기`}
                          disabled={!conv.other_user?.id}
                        >
                          {classImageUrl ? (
                            <Image
                              src={classImageUrl}
                              alt={displayNickname}
                              width={50}
                              height={50}
                              className="h-[50px] w-[50px] rounded-none object-cover object-center"
                            />
                          ) : showGroupAvatars ? (
                            <div className="relative w-10 h-10">
                              {groupAvatarSlots.top?.profile?.profile_image_url ? (
                                <Image
                                  src={groupAvatarSlots.top.profile.profile_image_url}
                                  alt={groupAvatarSlots.top.profile?.nickname ?? ""}
                                  width={28}
                                  height={28}
                                  className="absolute left-1/2 top-0 -translate-x-1/2 w-[28px] h-[28px] rounded-full object-cover border border-white"
                                />
                              ) : (
                                <div className="absolute left-1/2 top-0 -translate-x-1/2 w-[28px] h-[28px] rounded-full bg-gray-200 border border-white flex items-center justify-center text-gray-500 text-[11px] font-medium">
                                  {groupAvatarSlots.top?.profile?.nickname?.[0] ?? "?"}
                                </div>
                              )}
                              {groupAvatarSlots.left?.profile?.profile_image_url ? (
                                <Image
                                  src={groupAvatarSlots.left.profile.profile_image_url}
                                  alt={groupAvatarSlots.left.profile?.nickname ?? ""}
                                  width={28}
                                  height={28}
                                  className="absolute left-0 bottom-0 w-[28px] h-[28px] rounded-full object-cover border border-white"
                                />
                              ) : (
                                <div className="absolute left-0 bottom-0 w-[28px] h-[28px] rounded-full bg-gray-200 border border-white flex items-center justify-center text-gray-500 text-[11px] font-medium">
                                  {groupAvatarSlots.left?.profile?.nickname?.[0] ?? "?"}
                                </div>
                              )}
                              {groupAvatarSlots.right && (groupAvatarSlots.right.profile?.profile_image_url ? (
                                <Image
                                  src={groupAvatarSlots.right.profile.profile_image_url}
                                  alt={groupAvatarSlots.right.profile?.nickname ?? ""}
                                  width={28}
                                  height={28}
                                  className="absolute right-0 bottom-0 w-[28px] h-[28px] rounded-full object-cover border border-white"
                                />
                              ) : (
                                <div className="absolute right-0 bottom-0 w-[28px] h-[28px] rounded-full bg-gray-200 border border-white flex items-center justify-center text-gray-500 text-[11px] font-medium">
                                  {groupAvatarSlots.right.profile?.nickname?.[0] ?? "?"}
                                </div>
                              ))}
                            </div>
                          ) : (
                            <Image
                              src={conv.other_user?.profile_image_url || DEFAULT_AVATAR}
                              alt={conv.other_user?.nickname ?? ""}
                              width={43}
                              height={43}
                              className="h-[43px] w-[43px] rounded-[19px] object-cover"
                              unoptimized
                            />
                          )}
                          {showOnlineDot && (
                            <span className="absolute bottom-0 right-0 w-3 h-3 rounded-full bg-green-500 border-2 border-white" />
                          )}
                        </button>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-baseline gap-2 min-w-0">
                            <span className="font-bold text-gray-900 truncate min-w-0" style={{ fontSize: "17px" }}>
                              {displayNickname}
                              {isMine && (
                                <span className="font-normal ml-1" style={{ fontSize: "15px" }}>
                                  에게
                                </span>
                              )}
                            </span>
                            <span className="text-gray-400 text-xs flex-shrink-0">
                              {conv.last_message?.sent_at ? formatDate(conv.last_message.sent_at) : ""}
                            </span>
                          </div>
                          {conv.last_text_message && (
                            <p className="line-clamp-1 mt-1 text-gray-900" style={{ fontSize: "16px" }}>
                              {getPreviewText(conv.last_text_message.content)}
                            </p>
                          )}
                          {!conv.last_text_message && fallbackPreview && (
                            <p className="line-clamp-1 mt-1 text-gray-900" style={{ fontSize: "16px" }}>
                              {fallbackPreview}
                            </p>
                          )}
                        </div>
                        {conv.unread_count > 0 && (
                          <div className="ml-auto flex h-6 min-w-6 shrink-0 items-center justify-center rounded-full bg-red-500 px-1.5 text-xs font-bold leading-none text-white">
                            {conv.unread_count}
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })()}
            </div>
          ))}
          </div>
        )}
      </div>
    </>
  );
}
