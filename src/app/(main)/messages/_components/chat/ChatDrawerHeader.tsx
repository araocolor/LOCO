"use client";

import { useEffect, useRef, useState } from "react";
import { ArrowLeft } from "lucide-react";
import type { OtherUser } from "../../_types";

interface ChatDrawerHeaderProps {
  canEditTitle: boolean;
  chatTitle: string | null;
  otherUser: OtherUser | null;
  roomId: string | null;
  roomType: "direct" | "group" | "class" | "self" | undefined;
  onClose: () => void;
  onTitleChanged: (title: string) => void;
}

export default function ChatDrawerHeader({
  canEditTitle,
  chatTitle,
  otherUser,
  roomId,
  roomType,
  onClose,
  onTitleChanged,
}: ChatDrawerHeaderProps) {
  const [editingTitle, setEditingTitle] = useState(false);
  const [titleDraft, setTitleDraft] = useState("");
  const titleInputRef = useRef<HTMLInputElement>(null);
  const rawChatTitle = chatTitle ?? otherUser?.nickname ?? "로딩중...";
  const displayChatTitle =
    rawChatTitle.length > 17 ? `${rawChatTitle.slice(0, 17)}...` : rawChatTitle;
  const roomTypeBadge =
    roomType === "group"
      ? { label: "그룹", className: "bg-lime-100 text-lime-700" }
      : roomType === "class"
        ? { label: "클래스", className: "bg-red-100 text-red-600" }
        : null;

  function startEditTitle() {
    if (!canEditTitle) return;
    setTitleDraft(rawChatTitle);
    setEditingTitle(true);
  }

  function commitTitle() {
    const trimmed = titleDraft.trim();
    setEditingTitle(false);
    if (!trimmed || trimmed === rawChatTitle || !roomId) return;
    onTitleChanged(trimmed);
    fetch(`/api/chat/rooms/${roomId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title: trimmed }),
    }).catch(() => {});
  }

  useEffect(() => {
    if (editingTitle) {
      requestAnimationFrame(() => {
        const input = titleInputRef.current;
        if (input) {
          input.focus();
          input.setSelectionRange(input.value.length, input.value.length);
        }
      });
    }
  }, [editingTitle]);

  return (
    <header className="sticky top-0 z-50 bg-white h-14 px-4 relative">
      <button
        onClick={onClose}
        className="absolute left-4 top-1/2 -translate-y-1/2 w-[37px] h-[37px] flex items-center justify-center text-gray-600 hover:text-gray-900"
      >
        <ArrowLeft size={20} />
      </button>
      <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-[60%] text-center">
        {editingTitle ? (
          <input
            ref={titleInputRef}
            value={titleDraft}
            maxLength={30}
            onChange={(e) => setTitleDraft(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                commitTitle();
              }
            }}
            onBlur={commitTitle}
            className="w-full text-center font-bold text-[#4d4d4d] leading-none bg-transparent border-b border-yellow-400 outline-none"
            style={{ fontSize: 18 }}
          />
        ) : (
          <span
            onClick={startEditTitle}
            className={`flex min-w-0 items-center justify-center gap-2 whitespace-nowrap font-bold text-[#4d4d4d] leading-none ${canEditTitle ? "cursor-pointer" : ""}`}
            style={{ fontSize: 18 }}
          >
            {roomTypeBadge && (
              <span
                className={`shrink-0 rounded-full px-2 py-1 font-normal leading-none ${roomTypeBadge.className}`}
                style={{ fontSize: 15 }}
              >
                {roomTypeBadge.label}
              </span>
            )}
            <span className="min-w-0 overflow-hidden text-ellipsis">{displayChatTitle}</span>
          </span>
        )}
      </div>
    </header>
  );
}
