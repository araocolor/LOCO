"use client";

import { X } from "lucide-react";
import { CHAT_BG_OPTIONS, type ChatBgType } from "@/lib/chat-bg";

interface ChatBgSheetProps {
  open: boolean;
  selected: ChatBgType;
  onSelect: (bg: ChatBgType) => void;
  onClose: () => void;
}

export default function ChatBgSheet({ open, selected, onSelect, onClose }: ChatBgSheetProps) {
  if (!open) return null;

  return (
    <>
      <div className="fixed inset-0 z-[82] bg-black/40" onClick={onClose} />
      <div className="fixed inset-x-0 bottom-0 z-[83] animate-[slideUp_200ms_ease-out] rounded-t-2xl bg-white pb-[env(safe-area-inset-bottom)]">
        <style>{`
          @keyframes slideUp {
            from { transform: translateY(100%); }
            to { transform: translateY(0); }
          }
        `}</style>

        <div className="flex items-center justify-between px-5 pt-4 pb-2">
          <span className="text-base font-bold text-gray-800">배경화면 설정</span>
          <button onClick={onClose} className="p-1 text-gray-500">
            <X size={20} />
          </button>
        </div>

        <div className="flex items-center gap-2 px-5 py-4">
          {CHAT_BG_OPTIONS.map((opt) => (
            <button
              key={opt.type}
              type="button"
              onClick={() => onSelect(opt.type)}
              className="flex flex-col items-center gap-1.5"
            >
              <div
                className="relative h-12 w-12 rounded-xl overflow-hidden"
              >
                {opt.type === "image" ? (
                  <div
                    className="h-full w-full bg-cover bg-center"
                    style={{ backgroundImage: `url(${opt.value})` }}
                  />
                ) : (
                  <div className="h-full w-full" style={{ backgroundColor: opt.value }} />
                )}
              </div>
              <span className={`${selected === opt.type ? "text-[14px] font-bold text-blue-500" : "text-[13px] text-gray-500"}`}>
                {opt.label}
              </span>
            </button>
          ))}
        </div>
      </div>
    </>
  );
}
