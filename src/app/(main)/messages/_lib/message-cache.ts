import type { Message } from "../_types";

export const MESSAGES_CACHE_PREFIX = "loco_messages_cache_";

export function isImageMessage(content: string) {
  try {
    return JSON.parse(content)?.type === "image";
  } catch {
    return false;
  }
}

export function limitImageMessages(msgs: Message[]) {
  let imageCount = 0;
  return msgs.reduceRight<Message[]>((acc, msg) => {
    if (isImageMessage(msg.content)) {
      if (imageCount < 1) {
        imageCount++;
        try {
          const parsed = JSON.parse(msg.content);
          const rest = { ...parsed };
          delete rest.full;
          acc.unshift({ ...msg, content: JSON.stringify(rest) });
        } catch {
          acc.unshift(msg);
        }
      }
    } else {
      acc.unshift(msg);
    }
    return acc;
  }, []);
}

export function warmImageMessages(msgs: Message[]) {
  msgs.forEach((msg) => {
    try {
      const parsed = JSON.parse(msg.content);
      if (parsed.type === "image" && parsed.thumb) {
        const img = new window.Image();
        img.decoding = "async";
        img.src = parsed.thumb;
      }
    } catch {}
  });
}

export function getMessageCacheKey(userId: string) {
  return `${MESSAGES_CACHE_PREFIX}${userId}`;
}

export function readMessageCache(userId: string) {
  try {
    return JSON.parse(sessionStorage.getItem(getMessageCacheKey(userId)) ?? "[]") as Message[];
  } catch {
    return [];
  }
}

export function writeMessageCache(userId: string, msgs: Message[]) {
  const nextMessages = limitImageMessages(msgs);
  sessionStorage.setItem(getMessageCacheKey(userId), JSON.stringify(nextMessages));
  warmImageMessages(nextMessages);
}

export function appendMessageCache(userId: string, message: Message) {
  const msgs = readMessageCache(userId);
  writeMessageCache(userId, [...msgs, message]);
}

export function patchMessageCache(userId: string, message: Message) {
  try {
    const msgs = readMessageCache(userId);
    if (msgs.length === 0) return;
    writeMessageCache(userId, msgs.map((msg) => (msg.id === message.id ? { ...msg, ...message } : msg)));
  } catch {}
}
