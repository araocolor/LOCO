const PREFIX = "chat_bg_";

export type ChatBgType = "image" | "kakao" | "blue" | "beige" | "mint" | "lavender";

export const CHAT_BG_OPTIONS: { type: ChatBgType; label: string; value: string }[] = [
  { type: "image", label: "기본", value: "/chat_back.webp" },
  { type: "kakao", label: "하늘", value: "#B2C7D9" },
  { type: "blue", label: "베이직", value: "#FAF3E0" },
  { type: "beige", label: "베이지", value: "#F5E6CA" },
  { type: "mint", label: "민트", value: "#D4EDDA" },
  { type: "lavender", label: "라벤더", value: "#E8DEF8" },
];

export function getChatBg(roomId: string): ChatBgType {
  try {
    const v = localStorage.getItem(PREFIX + roomId);
    if (v && CHAT_BG_OPTIONS.some((o) => o.type === v)) return v as ChatBgType;
  } catch {}
  return "image";
}

export function setChatBg(roomId: string, bg: ChatBgType) {
  try {
    if (bg === "image") {
      localStorage.removeItem(PREFIX + roomId);
    } else {
      localStorage.setItem(PREFIX + roomId, bg);
    }
  } catch {}
}
