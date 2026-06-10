"use client";

import Image from "next/image";

const EMOJI_PACKS = [
  {
    name: "yellowboy",
    emojis: [
      { id: "yellowboy-1", label: "옐로보이 1", src: "/character/character.png" },
      { id: "yellowboy-2", label: "옐로보이 2", src: "/character/character_2.png" },
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
      <div className="grid grid-cols-4 gap-3 px-4 pt-5 pb-5">
        {EMOJI_PACKS[0].emojis.map((emoji) => (
          <button
            key={emoji.id}
            type="button"
            disabled={uploading}
            onClick={() => onSelectEmoji(emoji.src)}
            className={`flex flex-col items-center gap-2 ${
              pendingEmojiSrc === emoji.src ? "opacity-100" : pendingEmojiSrc ? "opacity-40" : ""
            }`}
          >
            <div className={`flex h-16 w-16 items-center justify-center rounded-2xl ${
              pendingEmojiSrc === emoji.src ? "bg-yellow-100 ring-2 ring-yellow-400" : "bg-gray-100"
            }`}>
              <Image
                src={emoji.src}
                alt={emoji.label}
                width={48}
                height={48}
                className="h-12 w-12 object-contain"
              />
            </div>
            <span className="text-xs text-gray-500">{emoji.label}</span>
          </button>
        ))}
      </div>
    </div>
  );
}
