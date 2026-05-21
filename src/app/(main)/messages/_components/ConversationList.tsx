"use client";

import { useCallback, useState } from "react";
import Image from "next/image";
import { Bell, BellOff, RefreshCw } from "lucide-react";
import NearbyMap, { type NearbyRefreshControl } from "@/components/features/NearbyMap";
import type { Conversation, MessageMenuTab } from "../_types";

interface ConversationListProps {
  activeMenuTab: MessageMenuTab;
  conversations: Conversation[];
  finderSoundEnabled: boolean;
  isSpinning: boolean;
  loading: boolean;
  onlineIds: Set<string>;
  refreshDisabled: boolean;
  userId: string;
  onOpenChat: (roomId: string) => void;
  onOpenProfile: (userId: string) => void;
  onRefresh: () => void;
  onToggleFinderSound: () => void;
  setActiveMenuTab: (tab: MessageMenuTab) => void;
  formatDate: (dateStr: string) => string;
  truncateMessage: (content: string, length?: number) => string;
}

export default function ConversationList({
  activeMenuTab,
  conversations,
  finderSoundEnabled,
  isSpinning,
  loading,
  onlineIds,
  refreshDisabled,
  userId,
  onOpenChat,
  onOpenProfile,
  onRefresh,
  onToggleFinderSound,
  setActiveMenuTab,
  formatDate,
  truncateMessage,
}: ConversationListProps) {
  const messageConversations = conversations.filter((conv) => conv.type !== "class");
  const classConversations = conversations.filter((conv) => conv.type === "class");
  const [nearbyRefreshControl, setNearbyRefreshControl] = useState<NearbyRefreshControl>({
    disabled: true,
    spinning: false,
    onRefresh: () => {},
  });
  const handleNearbyRefreshControlChange = useCallback((control: NearbyRefreshControl) => {
    setNearbyRefreshControl(control);
  }, []);
  const getPreviewText = useCallback((content: string, isMine?: boolean) => {
    try {
      const parsed = JSON.parse(content);
      if (parsed.type === "class_share") return "클래스 공유";
      if (parsed.type === "image") return isMine ? "사진을 업로드 하였습니다" : "사진이 업로드 되었습니다";
      if (parsed.type === "video") {
        if (parsed.status === "processing") return "처리중...";
        return isMine ? "영상을 업로드 하였습니다" : "영상이 업로드 되었습니다";
      }
    } catch {}
    return truncateMessage(content);
  }, [truncateMessage]);
  const visibleConversations =
    activeMenuTab === "messages"
      ? messageConversations
      : activeMenuTab === "my-chat"
        ? classConversations
        : [];

  return (
    <>
      <div className="flex items-end justify-between px-4 border-b border-[#e5e7eb]">
        <div className="flex gap-6">
          <button
            onClick={() => setActiveMenuTab("messages")}
            style={{ fontSize: 17 }}
            className={`pb-2 font-bold border-b-2 transition-colors ${
              activeMenuTab === "messages"
                ? "border-black text-black"
                : "border-transparent text-gray-400"
            }`}
          >
            1:1
          </button>
          <button
            onClick={() => setActiveMenuTab("my-chat")}
            style={{ fontSize: 17 }}
            className={`pb-2 font-bold border-b-2 transition-colors ${
              activeMenuTab === "my-chat"
                ? "border-black text-black"
                : "border-transparent text-gray-400"
            }`}
          >
            Class
          </button>
          <button
            onClick={() => setActiveMenuTab("nearby")}
            style={{ fontSize: 17 }}
            className={`pb-2 font-bold border-b-2 transition-colors ${
              activeMenuTab === "nearby"
                ? "border-black text-black"
                : "border-transparent text-gray-400"
            }`}
          >
            Finder
          </button>
        </div>
        {activeMenuTab === "nearby" ? (
          <div className="flex items-center gap-2 pb-2">
            <button
              type="button"
              onClick={onToggleFinderSound}
              className={`p-1 transition-colors ${
                finderSoundEnabled ? "text-gray-800 hover:text-gray-900" : "text-gray-400 hover:text-gray-500"
              }`}
              aria-label={finderSoundEnabled ? "Finder 알림음 끄기" : "Finder 알림음 켜기"}
              aria-pressed={finderSoundEnabled}
            >
              {finderSoundEnabled ? <Bell size={17} /> : <BellOff size={17} />}
            </button>
            <button
              onClick={nearbyRefreshControl.onRefresh}
              disabled={nearbyRefreshControl.disabled}
              className={`p-1 ${nearbyRefreshControl.disabled ? "text-gray-400 cursor-not-allowed" : "text-gray-800 hover:text-gray-900"}`}
              aria-label="내근처 새로고침"
            >
              <RefreshCw size={18} className={nearbyRefreshControl.spinning ? "animate-spin" : ""} style={{ animationDuration: "0.8s" }} />
            </button>
          </div>
        ) : (activeMenuTab === "messages" || activeMenuTab === "my-chat") && (
          <button
            onClick={onRefresh}
            disabled={refreshDisabled && !isSpinning}
            className={`pb-2 p-1 ${refreshDisabled && !isSpinning ? "text-gray-400 cursor-not-allowed" : "text-gray-800 hover:text-gray-900"}`}
          >
            <RefreshCw size={18} className={isSpinning ? "animate-spin" : ""} style={{ animationDuration: "0.8s" }} />
          </button>
        )}
      </div>

      <div className="flex-1 overflow-y-auto">
        {activeMenuTab === "nearby" ? (
          <div className="bg-white">
            <div className="px-4 pt-4 pb-2">
              <p className="text-base font-bold" style={{ color: "#333333" }}>검색범위</p>
            </div>
            <NearbyMap soundEnabled={finderSoundEnabled} onRefreshControlChange={handleNearbyRefreshControlChange} />
          </div>
        ) : loading ? (
          <div className="flex items-center justify-center h-32 text-gray-400">로딩 중...</div>
        ) : visibleConversations.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-32 text-gray-400">
            <p className="text-4xl mb-2">💬</p>
            <p className="text-sm">
              {activeMenuTab === "my-chat" ? "클래스 대화방이 없습니다" : "대화가 없습니다"}
            </p>
          </div>
        ) : (
          visibleConversations.map((conv) => (
            <div
              key={conv.id}
              onClick={() => onOpenChat(conv.id)}
              className="border-b border-gray-100 hover:bg-gray-50 cursor-pointer transition-colors"
            >
              {(() => {
                const isMine = conv.last_message?.is_mine;
                const lastContent = conv.last_message?.content ?? "";
                const classImageUrl = conv.type === "class" ? conv.class_image_url : null;
                let fallbackPreview = "";
                try {
                  const parsed = JSON.parse(lastContent);
                  if (parsed.type === "image" || parsed.type === "video") {
                    fallbackPreview = getPreviewText(lastContent, isMine);
                  }
                } catch {}

                const showOnlineDot =
                  conv.other_user?.id ? onlineIds.has(conv.other_user.id) : false;
                const displayNickname = conv.title ?? conv.other_user?.nickname ?? "알 수 없음";
                const avatarText = displayNickname[0] ?? "?";
                const otherMembers = (conv.members ?? []).filter((m) => m.user_id !== userId);
                const showGroupAvatars = conv.type === "group";
                const groupAvatars = showGroupAvatars ? otherMembers.slice(0, 3) : [];
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
                              className="h-[50px] w-[50px] rounded-[5px] object-cover object-center"
                            />
                          ) : showGroupAvatars ? (
                            <div className="relative w-10 h-10">
                              {groupAvatars[0]?.profile?.profile_image_url ? (
                                <Image
                                  src={groupAvatars[0].profile.profile_image_url}
                                  alt={groupAvatars[0].profile?.nickname ?? ""}
                                  width={28}
                                  height={28}
                                  className="absolute left-1/2 top-0 -translate-x-1/2 w-[28px] h-[28px] rounded-full object-cover border border-white"
                                />
                              ) : (
                                <div className="absolute left-1/2 top-0 -translate-x-1/2 w-[28px] h-[28px] rounded-full bg-gray-200 border border-white flex items-center justify-center text-gray-500 text-[11px] font-medium">
                                  {groupAvatars[0]?.profile?.nickname?.[0] ?? "?"}
                                </div>
                              )}
                              {groupAvatars[1]?.profile?.profile_image_url ? (
                                <Image
                                  src={groupAvatars[1].profile.profile_image_url}
                                  alt={groupAvatars[1].profile?.nickname ?? ""}
                                  width={28}
                                  height={28}
                                  className="absolute left-0 bottom-0 w-[28px] h-[28px] rounded-full object-cover border border-white"
                                />
                              ) : (
                                <div className="absolute left-0 bottom-0 w-[28px] h-[28px] rounded-full bg-gray-200 border border-white flex items-center justify-center text-gray-500 text-[11px] font-medium">
                                  {groupAvatars[1]?.profile?.nickname?.[0] ?? "?"}
                                </div>
                              )}
                              {groupAvatars[2] && (groupAvatars[2].profile?.profile_image_url ? (
                                <Image
                                  src={groupAvatars[2].profile.profile_image_url}
                                  alt={groupAvatars[2].profile?.nickname ?? ""}
                                  width={28}
                                  height={28}
                                  className="absolute right-0 bottom-0 w-[28px] h-[28px] rounded-full object-cover border border-white"
                                />
                              ) : (
                                <div className="absolute right-0 bottom-0 w-[28px] h-[28px] rounded-full bg-gray-200 border border-white flex items-center justify-center text-gray-500 text-[11px] font-medium">
                                  {groupAvatars[2].profile?.nickname?.[0] ?? "?"}
                                </div>
                              ))}
                            </div>
                          ) : conv.other_user?.profile_image_url ? (
                            <Image
                              src={conv.other_user.profile_image_url}
                              alt={conv.other_user.nickname}
                              width={40}
                              height={40}
                              className="rounded-full object-cover"
                            />
                          ) : (
                            <div className="w-10 h-10 rounded-full bg-gray-200 flex items-center justify-center text-gray-500 text-xs font-medium">
                              {avatarText}
                            </div>
                          )}
                          {showOnlineDot && (
                            <span className="absolute bottom-0 right-0 w-3 h-3 rounded-full bg-green-500 border-2 border-white" />
                          )}
                        </button>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-baseline gap-2">
                            <span className="font-bold text-gray-900" style={{ fontSize: "17px" }}>
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
          ))
        )}
      </div>
    </>
  );
}
