"use client";

import { useEffect, useState, useSyncExternalStore } from "react";
import { MessageCirclePlus } from "lucide-react";
import Avatar from "@/components/ui/Avatar";
import { useAuth } from "@/lib/auth-context";
import { createClient } from "@/lib/supabase/client";
import { replaceMainTab } from "@/lib/main-tab";
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

export default function MessagesHeaderClient() {
  const { user } = useAuth();
  const [nickname, setNickname] = useState("me");
  const [profileImageUrl, setProfileImageUrl] = useState<string | null>(null);
  const activeMenuTab = useSyncExternalStore(subscribeMsgTab, getMsgTab, () => "friends" as const);

  useEffect(() => {
    if (!user) {
      setNickname("me");
      setProfileImageUrl(null);
      return;
    }
    const supabase = createClient();
    supabase
      .from("profiles")
      .select("nickname, profile_image_url")
      .eq("id", user.id)
      .single()
      .then(({ data }) => {
        if (!data) return;
        setNickname(data.nickname ?? "me");
        setProfileImageUrl(data.profile_image_url ?? null);
      });
  }, [user]);

  return (
    <header className="sticky top-0 z-50 bg-white border-b border-[#e5e7eb]">
      <div className="relative h-14 px-4 flex items-center">
        <div className="font-black text-[22px] text-[#4d4d4d] leading-none">
          채팅
        </div>
        {user && profileImageUrl && (
          <button
            type="button"
            className="absolute right-4"
            onClick={() => replaceMainTab("mypage")}
          >
            <Avatar src={profileImageUrl} nickname={nickname} size={28} />
          </button>
        )}
      </div>
      <div className="flex pl-4 pr-4 gap-2 pb-2 items-center">
        <div className="flex gap-2 overflow-x-auto scrollbar-hide whitespace-nowrap flex-1">
          {(["friends", "direct", "groups", "class"] as const).map((tab) => (
            <button
              key={tab}
              onClick={() => replaceMsgTab(tab)}
              className={`px-3.5 py-1.5 rounded-full text-[15px] font-semibold transition-colors ${
                activeMenuTab === tab ? "bg-black text-white" : "bg-gray-100 text-black/60"
              }`}
            >
              {tab === "friends" ? "친구들" : tab === "direct" ? "1:1대화" : tab === "groups" ? "그룹" : "클래스"}
            </button>
          ))}
        </div>
        <button type="button" onClick={() => window.dispatchEvent(new CustomEvent("open-create-chat"))} className="shrink-0 ml-1">
          <MessageCirclePlus size={24} className="text-[#4d4d4d]" />
        </button>
      </div>
    </header>
  );
}
