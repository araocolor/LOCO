import type { ChatNotice, Message } from "../_types";

export const CHAT_ROOM_CACHE_PREFIX = "loco_chat_room_cache_";

const LEGACY_MESSAGES_CACHE_PREFIX = "loco_messages_cache_";
const LEGACY_NOTICES_CACHE_PREFIX = "loco_notices_cache_";

interface ChatRoomCache {
  messages: Message[];
  notices: ChatNotice[];
}

function getChatRoomCacheKey(roomId: string) {
  return `${CHAT_ROOM_CACHE_PREFIX}${roomId}`;
}

function emptyRoomCache(): ChatRoomCache {
  return { messages: [], notices: [] };
}

function removeLegacyRoomCache(roomId: string) {
  sessionStorage.removeItem(`${LEGACY_MESSAGES_CACHE_PREFIX}${roomId}`);
  sessionStorage.removeItem(`${LEGACY_NOTICES_CACHE_PREFIX}${roomId}`);
}

function readLegacyRoomCache(roomId: string): ChatRoomCache {
  const next = emptyRoomCache();

  try {
    next.messages = JSON.parse(sessionStorage.getItem(`${LEGACY_MESSAGES_CACHE_PREFIX}${roomId}`) ?? "[]") as Message[];
  } catch {}

  try {
    next.notices = JSON.parse(sessionStorage.getItem(`${LEGACY_NOTICES_CACHE_PREFIX}${roomId}`) ?? "[]") as ChatNotice[];
  } catch {}

  return next;
}

export function hasChatRoomCache(roomId: string) {
  try {
    if (sessionStorage.getItem(getChatRoomCacheKey(roomId))) return true;
    if (sessionStorage.getItem(`${LEGACY_MESSAGES_CACHE_PREFIX}${roomId}`)) return true;
    if (sessionStorage.getItem(`${LEGACY_NOTICES_CACHE_PREFIX}${roomId}`)) return true;
  } catch {}
  return false;
}

function readRoomCache(roomId: string): ChatRoomCache {
  try {
    const cached = JSON.parse(sessionStorage.getItem(getChatRoomCacheKey(roomId)) ?? "null") as Partial<ChatRoomCache> | null;
    if (cached) {
      return {
        messages: Array.isArray(cached.messages) ? cached.messages : [],
        notices: Array.isArray(cached.notices) ? cached.notices : [],
      };
    }
  } catch {}

  const legacy = readLegacyRoomCache(roomId);
  if (legacy.messages.length > 0 || legacy.notices.length > 0) {
    writeRoomCache(roomId, legacy);
  }
  return legacy;
}

function writeRoomCache(roomId: string, cache: ChatRoomCache) {
  const nextMessages = limitImageMessages(cache.messages);
  sessionStorage.setItem(
    getChatRoomCacheKey(roomId),
    JSON.stringify({
      messages: nextMessages,
      notices: cache.notices.slice(0, 5),
    })
  );
  removeLegacyRoomCache(roomId);
  warmImageMessages(nextMessages);
}

export function readNoticeCache(roomId: string): ChatNotice[] {
  return readRoomCache(roomId).notices;
}

export function writeNoticeCache(roomId: string, notices: ChatNotice[]) {
  const cache = readRoomCache(roomId);
  writeRoomCache(roomId, { ...cache, notices });
}

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

export function getMessageCacheKey(roomId: string) {
  return getChatRoomCacheKey(roomId);
}

export function readMessageCache(roomId: string) {
  return readRoomCache(roomId).messages;
}

export function writeMessageCache(roomId: string, msgs: Message[]) {
  const cache = readRoomCache(roomId);
  writeRoomCache(roomId, { ...cache, messages: msgs });
}

export function appendMessageCache(roomId: string, message: Message) {
  const msgs = readMessageCache(roomId);
  writeMessageCache(roomId, [...msgs, message]);
}

export function patchMessageCache(roomId: string, message: Message) {
  try {
    const msgs = readMessageCache(roomId);
    if (msgs.length === 0) return;
    writeMessageCache(roomId, msgs.map((msg) => (msg.id === message.id ? { ...msg, ...message } : msg)));
  } catch {}
}
