"use client";

import Image from "next/image";
import { RefreshCw } from "lucide-react";
import NearbyMap from "@/components/features/NearbyMap";
import type { Conversation, MessageMenuTab } from "../_types";

interface ConversationListProps {
  activeMenuTab: MessageMenuTab;
  conversations: Conversation[];
  isSpinning: boolean;
  loading: boolean;
  onlineIds: Set<string>;
  refreshDisabled: boolean;
  onOpenChat: (roomId: string) => void;
  onOpenProfile: (userId: string) => void;
  onRefresh: () => void;
  setActiveMenuTab: (tab: MessageMenuTab) => void;
  formatDate: (dateStr: string) => string;
  truncateMessage: (content: string, length?: number) => string;
}

export default function ConversationList({
  activeMenuTab,
  conversations,
  isSpinning,
  loading,
  onlineIds,
  refreshDisabled,
  onOpenChat,
  onOpenProfile,
  onRefresh,
  setActiveMenuTab,
  formatDate,
  truncateMessage,
}: ConversationListProps) {
  const messageConversations = conversations.filter((conv) => conv.type !== "class");
  const classConversations = conversations.filter((conv) => conv.type === "class");
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
            메시지
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
            클래스
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
            내근처
          </button>
        </div>
        {(activeMenuTab === "messages" || activeMenuTab === "my-chat") && (
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
            <NearbyMap />
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
                let lastImage: { thumb: string } | null = null;
                try {
                  const parsed = JSON.parse(lastContent);
                  if (parsed.type === "image") lastImage = parsed;
                } catch {}

                const showOnlineDot =
                  conv.other_user?.id ? onlineIds.has(conv.other_user.id) : false;
                const displayNickname = conv.title ?? conv.other_user?.nickname ?? "알 수 없음";
                const avatarText = displayNickname[0] ?? "?";
                return (
                  <div className="flex items-stretch gap-2">
                    {lastImage && (
                      <div className="flex-shrink-0 w-[80px] flex items-center justify-center">
                        <Image
                          src={lastImage.thumb}
                          alt="사진"
                          width={50}
                          height={50}
                          className="w-[50px] h-[50px] object-cover rounded-[5px]"
                        />
                      </div>
                    )}
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
                          {conv.other_user?.profile_image_url ? (
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
                              {truncateMessage(conv.last_text_message.content)}
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
