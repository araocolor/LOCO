"use client";

import Image from "next/image";

const TINO_NAMES = [
  "tino_angry",
  "tino_best",
  "tino_congulatu",
  "tino_cry",
  "tino_fight",
  "tino_good",
  "tino_goodmorning",
  "tino_goodnight",
  "tino_hehe",
  "tino_hugry",
  "tino_hul",
  "tino_love",
  "tino_ok",
  "tino_sleey",
  "tino_sorry",
  "tino_sorry2",
  "tino_thank",
  "tino_zaza",
];

const EMOJI_PACKS = [
  {
    name: "tino",
    emojis: TINO_NAMES.map((name) => ({
      id: name,
      label: name,
      src: `/tari/${name}.png`,
    })),
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
      style={{ height: emojiOpen ? "230px" : "0px" }}
    >
      <div className="h-full overflow-y-auto grid grid-cols-6 gap-3 px-4 pt-5 pb-5">
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
