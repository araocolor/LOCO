"use client";

import type { Dispatch, SetStateAction } from "react";
import { Paperclip, Send } from "lucide-react";
import { playSound } from "@/lib/sound";

interface ChatComposerProps {
  newMessage: string;
  selectedUserId: string | null;
  setAttachOpen: Dispatch<SetStateAction<boolean>>;
  setNewMessage: Dispatch<SetStateAction<string>>;
  onSendMessage: () => void;
}

export default function ChatComposer({
  newMessage,
  selectedUserId,
  setAttachOpen,
  setNewMessage,
  onSendMessage,
}: ChatComposerProps) {
  return (
    <div className="border-t border-gray-100 px-3 pt-3 pb-3 flex gap-2 items-start min-h-[80px]">
      <button className="text-gray-500 flex-shrink-0 mt-2" onClick={() => setAttachOpen((v) => !v)}>
        <Paperclip size={22} strokeWidth={2.5} />
      </button>
      <textarea
        value={newMessage}
        onChange={(e) => setNewMessage(e.target.value)}
        placeholder="메시지 입력..."
        rows={1}
        className="flex-1 px-3 py-2 border border-gray-200 rounded-2xl focus:outline-none focus:ring-2 focus:ring-yellow-400 resize-none max-h-[120px] overflow-y-auto"
        style={{ fontSize: "16px", color: "#000000cc" }}
        onInput={(e) => {
          const target = e.currentTarget;
          target.style.height = "auto";
          target.style.height = `${target.scrollHeight}px`;
        }}
      />
      <button
        onClick={() => { playSound("talk-send", { volume: 0.1 }); onSendMessage(); }}
        disabled={!newMessage.trim() || !selectedUserId}
        className="w-9 h-9 flex items-center justify-center bg-yellow-400 text-gray-900 rounded-full hover:bg-yellow-500 disabled:opacity-50 mt-1 flex-shrink-0"
      >
        <Send size={16} />
      </button>
    </div>
  );
}
