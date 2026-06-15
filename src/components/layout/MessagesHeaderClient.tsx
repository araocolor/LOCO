"use client";

import { useState, useSyncExternalStore } from "react";
import { MessageCirclePlus, Settings } from "lucide-react";
import { useAuth } from "@/lib/auth-context";
import { getChatUnreadByType, subscribeChatUnread } from "@/lib/unread-store";
import MyPageSettingsDrawer from "./MyPageSettingsDrawer";
import type { MessageMenuTab } from "@/app/(main)/messages/_types";

const MSG_TAB_EVENT = "loco-message-tab-change";

let currentMsgTab: MessageMenuTab = "friends";
const listeners = new Set<() => void>();

export function getMsgTab() { return currentMsgTab; }
export function subscribeMsgTab(cb: () => void) { listeners.add(cb); return () => { listeners.delete(cb); }; }
export function replaceMsgTab(tab: MessageMenuTab) {
  currentMsgTab = tab;
  listeners.forEach((cb) => cb());
  window.dispatchEvent(new CustomEvent<MessageMenuTab>(MSG_TAB_EVENT, { detail: tab }));
}

const TAB_LABELS: Record<MessageMenuTab, string> = {
  friends: "친구들",
  direct: "1:1대화",
  groups: "그룹",
  class: "클래스",
};

export default function MessagesHeaderClient() {
  const { user } = useAuth();
  const [settingsOpen, setSettingsOpen] = useState(false);
  const activeMenuTab = useSyncExternalStore(subscribeMsgTab, getMsgTab, () => "friends" as const);
  const chatUnreadByType = useSyncExternalStore(subscribeChatUnread, getChatUnreadByType, () => ({ direct: 0, group: 0, class: 0 }));

  return (
    <>
    <header className="sticky top-0 z-50 bg-white border-b border-[#e5e7eb]">
      <div className="relative h-14 px-4 flex items-center">
        <div className="font-black text-[22px] text-[#4d4d4d] leading-none">
          채팅
        </div>
        {user && (
          <button
            type="button"
            className="absolute right-4 h-12 w-12 -mr-2 flex items-center justify-center text-gray-700"
            onClick={() => setSettingsOpen(true)}
          >
            <Settings size={22} strokeWidth={2.2} />
          </button>
        )}
      </div>
      <div className="flex pl-4 pr-4 gap-2 pb-2 items-center">
        <div className="flex gap-2 overflow-x-auto scrollbar-hide whitespace-nowrap flex-1">
          {(["friends", "direct", "groups", "class"] as const).map((tab) => {
            const typeKey = tab === "direct" ? "direct" : tab === "groups" ? "group" : tab === "class" ? "class" : null;
            const count = typeKey ? chatUnreadByType[typeKey] : 0;
            return (
              <button
                key={tab}
                onClick={() => replaceMsgTab(tab)}
                className={`relative px-3.5 py-1.5 rounded-full text-[15px] font-semibold transition-colors ${
                  activeMenuTab === tab ? "bg-black text-white" : "bg-gray-100 text-black/60"
                }`}
              >
                {TAB_LABELS[tab]}
                {count > 0 && (
                  <span className="absolute top-0.5 -right-1 min-w-[18px] h-[18px] rounded-full bg-red-500 flex items-center justify-center border-2 border-white">
                    <span className="text-[10px] font-bold text-white leading-none px-0.5">{count > 99 ? "99+" : count}</span>
                  </span>
                )}
              </button>
            );
          })}
        </div>
        <button type="button" onClick={() => window.dispatchEvent(new CustomEvent("open-create-chat"))} className="shrink-0 ml-1">
          <MessageCirclePlus size={24} className="text-[#4d4d4d]" />
        </button>
      </div>
    </header>

    <MyPageSettingsDrawer
      open={settingsOpen}
      onClose={() => setSettingsOpen(false)}
    />
    </>
  );
}
