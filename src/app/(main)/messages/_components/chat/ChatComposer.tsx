"use client";

import type { Dispatch, SetStateAction } from "react";
import { Paperclip, Send, Smile } from "lucide-react";
import { playSound } from "@/lib/sound";

interface ChatComposerProps {
  emojiOpen: boolean;
  muted?: boolean;
  newMessage: string;
  pendingEmojiSrc: string | null;
  selectedUserId: string | null;
  setAttachOpen: Dispatch<SetStateAction<boolean>>;
  setEmojiOpen: Dispatch<SetStateAction<boolean>>;
  setNewMessage: Dispatch<SetStateAction<string>>;
  onSendMessage: () => void;
}

export default function ChatComposer({
  emojiOpen,
  muted,
  newMessage,
  pendingEmojiSrc,
  selectedUserId,
  setAttachOpen,
  setEmojiOpen,
  setNewMessage,
  onSendMessage,
}: ChatComposerProps) {
  return (
    <div className="border-t border-gray-100 px-3 pt-3 pb-3 flex gap-2 items-start min-h-[80px]">
      <button
        type="button"
        className="text-gray-500 flex-shrink-0 mt-2"
        onClick={() => {
          setAttachOpen((v) => !v);
          setEmojiOpen(false);
        }}
      >
        <Paperclip size={22} strokeWidth={2.5} />
      </button>
      <div className="relative flex-1">
        <textarea
          value={newMessage}
          onChange={(e) => setNewMessage(e.target.value)}
          placeholder="메시지 입력..."
          rows={1}
          className="flex-1 w-full px-3 py-2 pr-10 border border-gray-200 rounded-2xl focus:outline-none focus:ring-2 focus:ring-yellow-400 resize-none max-h-[120px] overflow-y-auto"
          style={{ fontSize: "16px", color: "#000000cc" }}
          onInput={(e) => {
            const target = e.currentTarget;
            target.style.height = "auto";
            target.style.height = `${target.scrollHeight}px`;
          }}
        />
        <button
          type="button"
          onClick={() => {
            setEmojiOpen((v) => !v);
            setAttachOpen(false);
          }}
          disabled={!selectedUserId}
          aria-label="이모지 열기"
          className={`absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 transition ${
            emojiOpen ? "text-yellow-500" : "hover:text-gray-600"
          } disabled:opacity-50`}
        >
          <Smile size={20} strokeWidth={2.2} />
        </button>
      </div>
      <button
        onClick={() => { if (!muted) playSound("talk-send", { volume: 0.1 }); onSendMessage(); }}
        disabled={(!newMessage.trim() && !pendingEmojiSrc) || !selectedUserId}
        className="w-9 h-9 flex items-center justify-center bg-yellow-400 text-gray-900 rounded-full hover:bg-yellow-500 disabled:opacity-50 mt-1 flex-shrink-0"
      >
        <Send size={16} />
      </button>
    </div>
  );
}
