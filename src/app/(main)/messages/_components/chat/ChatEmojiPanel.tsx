"use client";

import Image from "next/image";

const EMOJI_PACKS = [
  {
    name: "yellowboy",
    emojis: [
      { id: "yellowboy-1", label: "옐로보이 1", src: "/character/character.png" },
    ],
  },
];

interface ChatEmojiPanelProps {
  emojiOpen: boolean;
  pendingEmojiSrc: string | null;
  uploading: boolean;
  onSelectEmoji: (emojiSrc: string) => void;
}

export default function ChatEmojiPanel({
  emojiOpen,
  pendingEmojiSrc,
  uploading,
  onSelectEmoji,
}: ChatEmojiPanelProps) {
  return (
    <div
      className="overflow-hidden bg-white transition-all duration-300 ease-in-out"
      style={{ height: emojiOpen ? "140px" : "0px" }}
    >
      <div className="grid grid-cols-5 gap-3 px-4 pt-5 pb-5">
        {EMOJI_PACKS[0].emojis.map((emoji) => (
          <button
            key={emoji.id}
            type="button"
            disabled={uploading}
            onClick={() => onSelectEmoji(emoji.src)}
            className={`flex items-center justify-center ${
              pendingEmojiSrc === emoji.src ? "opacity-100" : pendingEmojiSrc ? "opacity-40" : ""
            }`}
          >
            <Image
              src={emoji.src}
              alt={emoji.label}
              width={55}
              height={55}
              draggable={false}
              onContextMenu={(e) => e.preventDefault()}
              className="pointer-events-auto select-none object-contain"
              style={{ width: "55px", height: "55px", WebkitTouchCallout: "none" }}
            />
          </button>
        ))}
      </div>
    </div>
  );
}
