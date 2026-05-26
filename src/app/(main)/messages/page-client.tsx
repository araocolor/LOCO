"use client";

import { useEffect, useState, useRef } from "react";
import type { UIEvent } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { PRESENCE_EVENT } from "@/components/features/PresenceTracker";
import ConversationList from "./_components/ConversationList";
import ChatDrawer from "./_components/ChatDrawer";
import ChatMemberDrawer from "./_components/ChatMemberDrawer";
import type { ChatNotice, Conversation, Message, MessageMenuTab, MessageReactionType, MyProfile, OtherUser, SessionClassItem } from "./_types";
import { useChatNotices } from "./_hooks/useChatNotices";
import {
  appendMessageCache,
  hasChatRoomCache,
  readMessageCache,
  writeMessageCache,
  readNoticeCache,
  writeNoticeCache,
  patchMessageCache,
} from "./_lib/message-cache";
import { isPreviewableTextMessage, isProcessingVideoMessage } from "./_lib/message-content";

interface ChatRoomApiItem {
  id: string;
  type: "direct" | "group" | "class" | "self";
  class_id: string | null;
  class_image_url: string | null;
  owner_id: string | null;
  title: string | null;
  notice: string | null;
  member_count: number;
  members: Array<{
    user_id: string;
    role: "owner" | "admin" | "member";
    created_at?: string | null;
    profile: OtherUser | null;
  }>;
  last_message: {
    id: string;
    kind: "text" | "image" | "file" | "system";
    content: string;
    sender_id: string;
    is_mine: boolean;
    created_at: string;
  } | null;
  unread_count: number;
  updated_at: string;
  created_at: string;
}

interface ChatMessageApiItem {
  id: string;
  room_id: string;
  sender_id: string;
  kind: "text" | "image" | "file" | "system";
  content: string;
  deleted_at: string | null;
  created_at: string;
  sender?: OtherUser | null;
  is_mine?: boolean;
  my_reaction?: MessageReactionType | null;
  reaction_counts?: Record<MessageReactionType, number>;
}

interface ChatRoomPayload {
  messages: Message[];
  notices: ChatNotice[];
}

const EMPTY_MESSAGE_REACTION_COUNTS: Record<MessageReactionType, number> = {
  heart: 0,
  like: 0,
  laugh: 0,
  wow: 0,
  sad: 0,
};

const MAX_VIDEO_UPLOAD_BYTES = 50 * 1024 * 1024;
const VIDEO_UPLOAD_TIMEOUT_MS = 180000;
const ALLOWED_VIDEO_TYPES = new Set(["video/mp4", "video/quicktime", "video/webm"]);
const CHAT_ROOMS_CACHE_PREFIX = "loco_chat_rooms_cache_v2:";
const LEGACY_CHAT_ROOMS_CACHE_KEY = "loco_chat_rooms_cache_v1";
const CONVERSATIONS_LIMIT = 50;
const ROOM_PREFETCH_LIMIT = 5;
const MESSAGE_USER_SESSION_PREFIX = "message_userid_session:";
const APP_LAST_HIDDEN_AT_KEY = "app_last_hidden_at";
const APP_LAST_VISIBLE_AT_KEY = "app_last_visible_at";
const APP_LAST_RESUME_AT_KEY = "app_last_resume_at";
const APP_RESUME_SOURCE_KEY = "app_resume_source";
const APP_WAS_BACKGROUNDED_KEY = "app_was_backgrounded";
const APP_RESUME_MIN_HIDDEN_MS = 5000;
const MESSAGES_LAST_ROOMS_LOADED_PREFIX = "messages_last_rooms_loaded_at:";
const MESSAGES_RESUME_REFRESH_DELAY_MS = 2000;
const MESSAGES_RECENT_REFRESH_TTL_MS = 60 * 1000;

function getChatRoomsCacheKey(userId: string) {
  return `${CHAT_ROOMS_CACHE_PREFIX}${userId}`;
}

function getMessageUserSessionKey(userId: string) {
  return `${MESSAGE_USER_SESSION_PREFIX}${userId}`;
}

function getMessagesLastRoomsLoadedKey(userId: string) {
  return `${MESSAGES_LAST_ROOMS_LOADED_PREFIX}${userId}`;
}

function readLocalStorageTime(key: string) {
  try {
    const value = Number(localStorage.getItem(key) ?? "0");
    return Number.isFinite(value) ? value : 0;
  } catch {
    return 0;
  }
}

function writeLocalStorageTime(key: string, value: number) {
  try {
    localStorage.setItem(key, String(value));
  } catch {}
}

function markAppHidden() {
  const now = Date.now();
  writeLocalStorageTime(APP_LAST_HIDDEN_AT_KEY, now);
  try {
    localStorage.setItem(APP_WAS_BACKGROUNDED_KEY, "1");
  } catch {}
}

function markAppVisible(source: string) {
  const now = Date.now();
  const lastHiddenAt = readLocalStorageTime(APP_LAST_HIDDEN_AT_KEY);
  const wasBackgrounded = (() => {
    try {
      return localStorage.getItem(APP_WAS_BACKGROUNDED_KEY) === "1";
    } catch {
      return false;
    }
  })();
  const hiddenFor = lastHiddenAt > 0 ? now - lastHiddenAt : 0;
  const isResume = wasBackgrounded || hiddenFor >= APP_RESUME_MIN_HIDDEN_MS;

  writeLocalStorageTime(APP_LAST_VISIBLE_AT_KEY, now);
  try {
    localStorage.setItem(APP_WAS_BACKGROUNDED_KEY, "0");
    if (isResume) {
      localStorage.setItem(APP_RESUME_SOURCE_KEY, source);
      writeLocalStorageTime(APP_LAST_RESUME_AT_KEY, now);
    }
  } catch {}

  return { isResume, hiddenFor };
}

function prioritizeOneToOneConversations(convs: Conversation[]) {
  const oneToOneConversations = convs.filter((conv) => conv.type === "self" || conv.type === "direct");
  const otherConversations = convs.filter((conv) => conv.type !== "self" && conv.type !== "direct");
  return [...oneToOneConversations, ...otherConversations];
}

function getConversationsForCache(convs: Conversation[]) {
  return prioritizeOneToOneConversations(convs).slice(0, CONVERSATIONS_LIMIT);
}


async function uploadVideoToSignedUrl(signedUrl: string, file: File) {
  const controller = new AbortController();
  const timer = window.setTimeout(() => controller.abort(), VIDEO_UPLOAD_TIMEOUT_MS);

  try {
    const formData = new FormData();
    formData.append("cacheControl", "3600");
    formData.append("", file);

    const res = await fetch(signedUrl, {
      method: "PUT",
      body: formData,
      headers: { "x-upsert": "false" },
      signal: controller.signal,
    });

    if (!res.ok) {
      const text = await res.text().catch(() => "");
      throw new Error(text || "영상 원본 업로드에 실패했습니다.");
    }
  } catch (error) {
    if (error instanceof DOMException && error.name === "AbortError") {
      throw new Error("영상 업로드 시간이 초과되었습니다. 더 짧거나 작은 영상을 선택해주세요.");
    }
    throw error;
  } finally {
    window.clearTimeout(timer);
  }
}

export default function MessagesPageClient({ userId }: { userId: string }) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [loading, setLoading] = useState(true);
  const [onlineIds, setOnlineIds] = useState<Set<string>>(new Set());
  const [activeMenuTab, setActiveMenuTab] = useState<MessageMenuTab>("messages");

  // 대화창 상태
  const [selectedRoomId, setSelectedRoomId] = useState<string | null>(null);
  const [chatOpen, setChatOpen] = useState(false);
  const [messages, setMessages] = useState<Message[]>([]);
  const [notices, setNotices] = useState<ChatNotice[]>([]);
  const [otherUser, setOtherUser] = useState<OtherUser | null>(null);
  const [myProfile, setMyProfile] = useState<MyProfile | null>(null);
  const [chatLoading, setChatLoading] = useState(false);
  const [newMessage, setNewMessage] = useState("");
  const [memberDrawerOpen, setMemberDrawerOpen] = useState(false);
  const [attachOpen, setAttachOpen] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [shakingMsgId, setShakingMsgId] = useState<string | null>(null);
  const photoInputRef = useRef<HTMLInputElement>(null);
  const videoInputRef = useRef<HTMLInputElement>(null);
  const longPressTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const shouldStickToBottomRef = useRef(true);
  const previousScrollRoomRef = useRef<string | null>(null);
  const previousTimelineCountRef = useRef(0);
  const activeChatRoomRef = useRef<string | null>(null);
  const autoOpenedRoomRef = useRef<string | null>(null);
  const roomIdFromQuery = searchParams.get("roomId");
  const selectedConversation = selectedRoomId
    ? conversations.find((conv) => conv.id === selectedRoomId) ?? null
    : null;
  const canAddMembers = Boolean(
    !!selectedConversation &&
    (
      selectedConversation.type !== "class" ||
      selectedConversation.members?.some((member) =>
        member.user_id === userId && ["owner", "admin"].includes(member.role)
      )
    )
  );
  const canEditTitle = (() => {
    if (!selectedConversation || selectedConversation.type !== "group") return false;
    const members = selectedConversation.members;
    if (!members) return false;
    const owner = members.find((m) => m.role === "owner");
    const nonOwners = members.filter((m) => m.role !== "owner");
    const second = nonOwners[0] ?? null;
    return userId === owner?.user_id || userId === second?.user_id;
  })();
  const {
    saveClassNotice,
    updateClassNotice,
    deleteClassNotice,
    markNoticeRead,
    reactToNotice,
    voteNotice,
  } = useChatNotices({ selectedRoomId, notices, setNotices });



  async function resizeToBlob(bitmap: ImageBitmap, maxW: number): Promise<Blob> {
    const scale = bitmap.width > maxW ? maxW / bitmap.width : 1;
    const w = Math.round(bitmap.width * scale);
    const h = Math.round(bitmap.height * scale);
    const canvas = document.createElement("canvas");
    canvas.width = w;
    canvas.height = h;
    canvas.getContext("2d")!.drawImage(bitmap, 0, 0, w, h);
    return new Promise<Blob>((resolve) =>
      canvas.toBlob((b) => resolve(b!), "image/webp", 0.9)
    );
  }

  async function handlePhotoUpload(file: File) {
    if (!selectedRoomId) return;

    setUploading(true);
    try {
      const bitmap = await createImageBitmap(file);
      const supabase = createClient();
      const ts = Date.now();

      const [blob300, blob1024] = await Promise.all([
        resizeToBlob(bitmap, 300),
        resizeToBlob(bitmap, 1024),
      ]);

      const path300 = `${userId}/${ts}_300.webp`;
      const path1024 = `${userId}/${ts}_1024.webp`;

      const [{ error: err300 }, { error: err1024 }] = await Promise.all([
        supabase.storage.from("message").upload(path300, blob300, { contentType: "image/webp" }),
        supabase.storage.from("message").upload(path1024, blob1024, { contentType: "image/webp" }),
      ]);

      if (err300 || err1024) throw err300 ?? err1024;

      const { data: { publicUrl: url300 } } = supabase.storage.from("message").getPublicUrl(path300);
      const { data: { publicUrl: url1024 } } = supabase.storage.from("message").getPublicUrl(path1024);

      const res = await fetch(`/api/chat/rooms/${selectedRoomId}/messages`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          kind: "image",
          content: { type: "image", thumb: url300, full: url1024 },
        }),
      });
      const json = await res.json();
      const message = json.data ? mapChatMessage(json.data as ChatMessageApiItem) : null;

      if (res.ok && message) {
        setMessages((prev) => [...prev, message]);
        appendMessageCache(selectedRoomId, message);
        setAttachOpen(false);
        patchConversationWithMessage(selectedRoomId, message);
      }
    } catch (e) {
      console.error("업로드 실패", e);
    } finally {
      setUploading(false);
    }
  }

  async function handleVideoUpload(file: File) {
    if (!selectedRoomId) return;

    if (!ALLOWED_VIDEO_TYPES.has(file.type)) {
      alert("mp4, mov, webm 영상만 업로드할 수 있습니다.");
      return;
    }

    if (file.size > MAX_VIDEO_UPLOAD_BYTES) {
      alert("영상은 최대 50MB까지 업로드할 수 있습니다.");
      return;
    }

    const pendingMessage: Message = {
      id: `local-video-${Date.now()}`,
      room_id: selectedRoomId,
      sender_id: userId,
      kind: "file",
      content: JSON.stringify({ type: "video", status: "uploading" }),
      sent_at: new Date().toISOString(),
      sender: null,
      my_reaction: null,
      reaction_counts: EMPTY_MESSAGE_REACTION_COUNTS,
    };

    setUploading(true);
    setMessages((prev) => [...prev, pendingMessage]);
    setAttachOpen(false);

    try {
      const uploadUrlRes = await fetch(`/api/chat/rooms/${selectedRoomId}/videos/upload-url`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          fileName: file.name,
          contentType: file.type,
          size: file.size,
        }),
      });
      const uploadUrlJson = await uploadUrlRes.json();
      if (!uploadUrlRes.ok) throw new Error(uploadUrlJson.error ?? "영상 업로드 준비에 실패했습니다.");

      if (typeof uploadUrlJson.signedUrl !== "string") {
        throw new Error("영상 업로드 주소를 받지 못했습니다.");
      }

      await uploadVideoToSignedUrl(uploadUrlJson.signedUrl, file);

      const processRes = await fetch(`/api/chat/rooms/${selectedRoomId}/videos/process`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ path: uploadUrlJson.path }),
      });
      const processJson = await processRes.json();
      const message = processJson.data ? mapChatMessage(processJson.data as ChatMessageApiItem) : null;
      if (!processRes.ok || !message) throw new Error(processJson.error ?? "영상 처리 요청에 실패했습니다.");

      setMessages((prev) => [...prev.filter((item) => item.id !== pendingMessage.id), message]);
      appendMessageCache(selectedRoomId, message);
      patchConversationWithMessage(selectedRoomId, message);
    } catch (error) {
      setMessages((prev) => prev.filter((item) => item.id !== pendingMessage.id));
      console.error("영상 업로드 실패", error);
      alert(error instanceof Error ? error.message : "영상 업로드에 실패했습니다.");
    } finally {
      setUploading(false);
    }
  }

  const cacheKey = getChatRoomsCacheKey(userId);
  const messageUserSessionKey = getMessageUserSessionKey(userId);
  const messagesLastRoomsLoadedKey = getMessagesLastRoomsLoadedKey(userId);
  const roomPrefetchInFlightRef = useRef<Map<string, Promise<ChatRoomPayload>>>(new Map());
  const recentRoomPrefetchedRef = useRef<Set<string>>(new Set());
  const appResumeVisitRef = useRef(false);
  const resumeRefreshTimerRef = useRef<number | null>(null);

  function mapChatMessage(item: ChatMessageApiItem): Message {
    return {
      id: item.id,
      room_id: item.room_id,
      sender_id: item.sender_id,
      kind: item.kind,
      content: item.content,
      sent_at: item.created_at,
      sender: item.sender ?? null,
      my_reaction: item.my_reaction ?? null,
      reaction_counts: item.reaction_counts ?? EMPTY_MESSAGE_REACTION_COUNTS,
    };
  }

  function mapChatRoom(item: ChatRoomApiItem): Conversation {
    const otherMember = item.type === "direct"
      ? item.members.find((member) => member.user_id !== userId)
      : item.type === "self"
        ? item.members.find((member) => member.user_id === userId)
        : undefined;
    const lastMessage = item.last_message;

    return {
      id: item.id,
      type: item.type,
      class_id: item.class_id,
      class_image_url: item.class_image_url,
      title: item.title,
      notice: item.notice,
      member_count: item.member_count,
      members: item.members,
      other_user: otherMember?.profile ?? null,
      last_message: lastMessage
        ? {
            id: lastMessage.id,
            kind: lastMessage.kind,
            content: lastMessage.content,
            sent_at: lastMessage.created_at,
            is_mine: lastMessage.is_mine,
          }
        : null,
      last_text_message: lastMessage && isPreviewableTextMessage(lastMessage)
        ? {
            content: lastMessage.content,
            is_mine: lastMessage.is_mine,
          }
        : null,
      unread_count: item.unread_count,
      updated_at: item.updated_at,
    };
  }

  function normalizeCachedConversation(item: unknown): Conversation | null {
    if (!item || typeof item !== "object") return null;
    const record = item as Partial<Conversation> & Partial<ChatRoomApiItem>;
    if (typeof record.id !== "string") return null;

    const hasApiLastMessage =
      !!record.last_message &&
      typeof record.last_message === "object" &&
      "created_at" in record.last_message;
    const looksLikeApiRoom =
      hasApiLastMessage ||
      (!Object.prototype.hasOwnProperty.call(record, "other_user") && Array.isArray(record.members));

    if (looksLikeApiRoom) return mapChatRoom(record as ChatRoomApiItem);
    return record as Conversation;
  }

  function readCachedConversations() {
    try {
      const raw = localStorage.getItem(cacheKey) ?? localStorage.getItem(LEGACY_CHAT_ROOMS_CACHE_KEY);
      if (!raw) return null;
      const parsed = JSON.parse(raw) as { data?: unknown } | unknown[];
      const rows = Array.isArray(parsed)
        ? parsed
        : Array.isArray(parsed.data)
          ? parsed.data
          : [];
      const next = rows
        .map(normalizeCachedConversation)
        .filter((item): item is Conversation => Boolean(item));
      return next.length > 0 ? next : null;
    } catch {
      return null;
    }
  }

  function writeConversationsCache(convs: Conversation[]) {
    try {
      localStorage.setItem(
        cacheKey,
        JSON.stringify({
          data: getConversationsForCache(convs),
          ts: Date.now(),
        })
      );
    } catch {}
  }

  function patchConversationWithMessage(roomId: string, message: Message) {
    setConversations((prev) => {
      const next = prev.map((conv) =>
        conv.id === roomId
          ? {
              ...conv,
              last_message: {
                id: message.id,
                kind: message.kind,
                content: message.content,
                sent_at: message.sent_at,
                is_mine: message.sender_id === userId,
              },
              last_text_message: isPreviewableTextMessage(message)
                ? { content: message.content, is_mine: message.sender_id === userId }
                : conv.last_text_message,
              updated_at: message.sent_at,
            }
          : conv
      );
      const sorted = [...next].sort((a, b) => new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime());
      writeConversationsCache(sorted);
      return sorted;
    });
  }

  async function fetchChatRoomPayload(roomId: string): Promise<ChatRoomPayload> {
    const inFlight = roomPrefetchInFlightRef.current.get(roomId);
    if (inFlight) return inFlight;

    const task = (async () => {
      const [messageRes, noticeRes] = await Promise.all([
        fetch(`/api/chat/rooms/${roomId}/messages`),
        fetch(`/api/chat/rooms/${roomId}/notices`),
      ]);

      const messages: Message[] = [];
      let notices: ChatNotice[] = [];

      if (messageRes.ok) {
        const messageJson = await messageRes.json();
        if (messageJson.data) {
          messages.push(...(messageJson.data as ChatMessageApiItem[]).map(mapChatMessage));
        }
      }

      if (noticeRes.ok) {
        const noticeJson = await noticeRes.json();
        if (noticeJson.data) {
          notices = noticeJson.data as ChatNotice[];
        }
      }

      return { messages, notices };
    })();

    roomPrefetchInFlightRef.current.set(roomId, task);
    task.then(
      () => roomPrefetchInFlightRef.current.delete(roomId),
      () => roomPrefetchInFlightRef.current.delete(roomId)
    );

    return task;
  }

  function writeChatRoomPayloadCache(roomId: string, payload: ChatRoomPayload) {
    writeMessageCache(roomId, payload.messages);
    writeNoticeCache(roomId, payload.notices);
  }

  async function prefetchChatRoom(roomId: string, options?: { force?: boolean }) {
    if (!roomId) return;
    if (!options?.force && hasChatRoomCache(roomId)) return;

    try {
      const payload = await fetchChatRoomPayload(roomId);
      window.setTimeout(() => {
        writeChatRoomPayloadCache(roomId, payload);
      }, 0);
    } catch (error) {
      console.error("Failed to prefetch chat room:", error);
    }
  }

  function patchMessageInView(roomId: string, message: Message) {
    setMessages((prev) => {
      const existing = prev.find((item) => item.id === message.id);
      if (!existing) return prev;

      const merged = {
        ...existing,
        ...message,
        sender: existing.sender ?? message.sender ?? null,
        my_reaction: existing.my_reaction ?? message.my_reaction ?? null,
        reaction_counts: existing.reaction_counts ?? message.reaction_counts,
      };

      patchMessageCache(roomId, merged);
      patchConversationWithMessage(roomId, merged);
      return prev.map((item) => (item.id === message.id ? merged : item));
    });
  }

  function patchConversationWithRoom(room: unknown) {
    if (!room || typeof room !== "object") return;
    const nextRoom = room as {
      id?: string;
      type?: Conversation["type"];
      title?: string | null;
      notice?: string | null;
      updated_at?: string;
      members?: Conversation["members"];
    };
    if (!nextRoom.id) return;

    setConversations((prev) => {
      const next = prev.map((conv) =>
        conv.id === nextRoom.id
          ? {
              ...conv,
              type: nextRoom.type ?? conv.type,
              title: nextRoom.title ?? conv.title,
              notice: Object.prototype.hasOwnProperty.call(nextRoom, "notice") ? nextRoom.notice ?? null : conv.notice,
              updated_at: nextRoom.updated_at ?? conv.updated_at,
              members: nextRoom.members ?? conv.members,
              member_count: nextRoom.members?.length ?? conv.member_count,
              other_user: nextRoom.type === "direct" ? conv.other_user : null,
            }
          : conv
      );
      writeConversationsCache(next);
      return next;
    });
  }

  async function saveMessageUserSession(convs: Conversation[]) {
    try {
      const sessionMap: Record<
        string,
        {
          id: string;
          nickname: string;
          profile_image_url: string | null;
          email: string | null;
          bio: string | null;
          member_type: string[];
          opened_classes: SessionClassItem[];
          bookmarked_classes: SessionClassItem[];
        }
      > = {};

      const userIds = Array.from(
        new Set(
          convs
            .map((conv) => conv.other_user?.id)
            .filter((id): id is string => Boolean(id))
        )
      );

      convs.forEach((conv) => {
        const user = conv.other_user;
        if (!user?.id) return;
        sessionMap[user.id] = {
          id: user.id,
          nickname: user.nickname,
          profile_image_url: user.profile_image_url ?? null,
          email: null,
          bio: null,
          member_type: [],
          opened_classes: [],
          bookmarked_classes: [],
        };
      });

      if (userIds.length > 0) {
        const supabase = createClient();
        const { data: profiles } = await supabase
          .from("profiles")
          .select("id, email, bio, member_type")
          .in("id", userIds);

        (profiles ?? []).forEach((p) => {
          if (!sessionMap[p.id]) return;
          sessionMap[p.id].email = p.email ?? null;
          sessionMap[p.id].bio = p.bio ?? null;
          sessionMap[p.id].member_type = p.member_type ?? [];
        });

        const { data: openedClasses } = await supabase
          .from("classes")
          .select("id, host_id, title, images, status, created_at")
          .in("host_id", userIds)
          .order("created_at", { ascending: false })
          .limit(10);

        (openedClasses ?? []).forEach((cls) => {
          const hostId = (cls as { host_id?: string }).host_id;
          if (!hostId || !sessionMap[hostId]) return;
          sessionMap[hostId].opened_classes.push({
            id: cls.id,
            title: cls.title,
            images: cls.images,
            status: cls.status,
            created_at: cls.created_at,
          });
        });

        const { data: bookmarkRows } = await supabase
          .from("class_bookmarks")
          .select("user_id, created_at, classes(id, title, images, status)")
          .in("user_id", userIds)
          .order("created_at", { ascending: false })
          .limit(10);

        (bookmarkRows ?? []).forEach((row) => {
          const userIdRow = (row as { user_id?: string }).user_id;
          if (!userIdRow || !sessionMap[userIdRow]) return;
          const clsRaw = (row as { classes?: unknown }).classes;
          const cls = Array.isArray(clsRaw) ? clsRaw[0] : clsRaw;
          if (!cls || typeof cls !== "object") return;
          const c = cls as {
            id?: string;
            title?: string;
            images?: { card_url?: string }[] | null;
            status?: string;
          };
          if (!c.id || !c.title) return;
          sessionMap[userIdRow].bookmarked_classes.push({
            id: c.id,
            title: c.title,
            images: c.images ?? null,
            status: c.status,
            created_at: (row as { created_at?: string }).created_at,
          });
        });
      }

      sessionStorage.setItem(messageUserSessionKey, JSON.stringify(sessionMap));
    } catch {}
  }

  async function fetchConversations(options?: { force?: boolean }) {
    const force = options?.force ?? false;
    const hasUserSession = Boolean(sessionStorage.getItem(messageUserSessionKey));
    if (!force && hasUserSession) {
      const cached = readCachedConversations();
      if (cached) {
        setConversations(cached);
      }
      setLoading(false);
    }

    try {
      const res = await fetch("/api/chat/rooms");
      const json = await res.json();
      if (json.data) {
        const incomingConversations = (json.data as ChatRoomApiItem[]).map(mapChatRoom);
        setConversations(incomingConversations);
        writeConversationsCache(incomingConversations);
        writeLocalStorageTime(messagesLastRoomsLoadedKey, Date.now());
        await saveMessageUserSession(incomingConversations);
      }
    } catch (error) {
      console.error("Failed to load conversations:", error);
    } finally {
      setLoading(false);
    }
  }

  function clearResumeRefreshTimer() {
    if (resumeRefreshTimerRef.current === null) return;
    window.clearTimeout(resumeRefreshTimerRef.current);
    resumeRefreshTimerRef.current = null;
  }

  function scheduleConversationsRefresh(delay: number, options?: { force?: boolean }) {
    clearResumeRefreshTimer();
    resumeRefreshTimerRef.current = window.setTimeout(() => {
      resumeRefreshTimerRef.current = null;
      void fetchConversations(options);
    }, delay);
  }

  function scheduleResumeRefreshIfNeeded() {
    const lastRoomsLoadedAt = readLocalStorageTime(messagesLastRoomsLoadedKey);
    const hasRecentRooms = lastRoomsLoadedAt > 0 && Date.now() - lastRoomsLoadedAt < MESSAGES_RECENT_REFRESH_TTL_MS;
    if (hasRecentRooms) return;
    scheduleConversationsRefresh(MESSAGES_RESUME_REFRESH_DELAY_MS, { force: false });
  }

  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.visibilityState === "hidden") {
        markAppHidden();
      } else {
        const resume = markAppVisible("visibilitychange");
        if (resume.isResume) {
          appResumeVisitRef.current = true;
          scheduleResumeRefreshIfNeeded();
        }
      }
    };
    const handlePageHide = () => {
      markAppHidden();
    };
    const handlePageShow = (event: PageTransitionEvent) => {
      const resume = markAppVisible(event.persisted ? "pageshow-persisted" : "pageshow");
      if (resume.isResume) {
        appResumeVisitRef.current = true;
        scheduleResumeRefreshIfNeeded();
      }
    };

    document.addEventListener("visibilitychange", handleVisibilityChange);
    window.addEventListener("pagehide", handlePageHide);
    window.addEventListener("pageshow", handlePageShow);

    return () => {
      document.removeEventListener("visibilitychange", handleVisibilityChange);
      window.removeEventListener("pagehide", handlePageHide);
      window.removeEventListener("pageshow", handlePageShow);
      clearResumeRefreshTimer();
    };
    // 복귀 이벤트에서도 화면은 그대로 두고, 목록 최신화만 뒤로 미룹니다.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const resume = markAppVisible("messages-mount");
    // v1: 로컬 목록 캐시 즉시 표시
    const cached = readCachedConversations();
    const isResumeWithCache = resume.isResume && Boolean(cached);
    const lastRoomsLoadedAt = readLocalStorageTime(messagesLastRoomsLoadedKey);
    const hasRecentRooms = lastRoomsLoadedAt > 0 && Date.now() - lastRoomsLoadedAt < MESSAGES_RECENT_REFRESH_TTL_MS;
    appResumeVisitRef.current = isResumeWithCache;

    if (cached) {
      queueMicrotask(() => {
        setConversations(cached);
        setLoading(false);
      });
    }

    if (isResumeWithCache && hasRecentRooms) return;

    // v2: 백그라운드에서 최신 데이터 갱신
    scheduleConversationsRefresh(isResumeWithCache ? MESSAGES_RESUME_REFRESH_DELAY_MS : 0, { force: !cached });

    return () => {
      clearResumeRefreshTimer();
    };
    // 첫 진입 때는 최신 목록을 갱신하고, 복귀 때는 캐시 표시 후 갱신을 늦춥니다.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (conversations.length === 0) return;
    if (appResumeVisitRef.current) return;

    prioritizeOneToOneConversations(conversations).slice(0, ROOM_PREFETCH_LIMIT).forEach((conv) => {
      if (recentRoomPrefetchedRef.current.has(conv.id)) return;
      recentRoomPrefetchedRef.current.add(conv.id);
      void prefetchChatRoom(conv.id);
    });
    // 최근 대화방 본문을 백그라운드에서 미리 받아 첫 클릭 대기 시간을 줄입니다.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [conversations]);

  useEffect(() => {
    queueMicrotask(() => {
      if (window.__onlineIds) setOnlineIds(window.__onlineIds);
    });
    const handler = (e: Event) => {
      setOnlineIds((e as CustomEvent<Set<string>>).detail);
    };
    window.addEventListener(PRESENCE_EVENT, handler);
    return () => window.removeEventListener(PRESENCE_EVENT, handler);
  }, []);

  useEffect(() => {
    if (!selectedRoomId) return;

    const supabase = createClient();
    const channel = supabase
      .channel(`chat-room-${selectedRoomId}`)
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "chat_messages", filter: `room_id=eq.${selectedRoomId}` },
        (payload) => {
          const newMsg = mapChatMessage(payload.new as ChatMessageApiItem);
          if (newMsg.sender_id === userId) return;

          setMessages((prev) => {
            if (prev.some((m) => m.id === newMsg.id)) return prev;
            return [...prev, newMsg];
          });
          appendMessageCache(selectedRoomId, newMsg);
          patchConversationWithMessage(selectedRoomId, newMsg);
        }
      )
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "chat_messages", filter: `room_id=eq.${selectedRoomId}` },
        (payload) => {
          const updatedMsg = mapChatMessage(payload.new as ChatMessageApiItem);
          patchMessageInView(selectedRoomId, updatedMsg);
        }
      )
      .subscribe();

    return () => { supabase.removeChannel(channel); };
    // 실시간 구독은 현재 열린 방과 현재 사용자 기준으로만 다시 연결합니다.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedRoomId, userId]);

  useEffect(() => {
    if (!selectedRoomId) return;
    const pendingMessages = messages.filter((message) => !message.id.startsWith("local-video-") && isProcessingVideoMessage(message));
    if (pendingMessages.length === 0) return;

    let cancelled = false;
    const interval = window.setInterval(() => {
      void Promise.all(
        pendingMessages.map(async (message) => {
          if (cancelled) return;
          try {
            const res = await fetch(`/api/chat/messages/${message.id}`);
            const json = await res.json();
            if (!res.ok || !json.data || cancelled) return;
            patchMessageInView(selectedRoomId, mapChatMessage(json.data as ChatMessageApiItem));
          } catch (error) {
            console.error("영상 상태 확인 실패", error);
          }
        })
      );
    }, 3000);

    return () => {
      cancelled = true;
      window.clearInterval(interval);
    };
    // 처리중 영상 메시지가 ready/failed 될 때까지 3초마다 다시 확인합니다.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedRoomId, messages]);

  useEffect(() => {
    const roomChanged = previousScrollRoomRef.current !== selectedRoomId;
    const timelineCount = messages.length + notices.length;
    const itemAdded = timelineCount > previousTimelineCountRef.current;

    if (roomChanged) {
      shouldStickToBottomRef.current = true;
    }

    if (selectedRoomId && timelineCount > 0 && (roomChanged || (itemAdded && shouldStickToBottomRef.current))) {
      window.requestAnimationFrame(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: roomChanged ? "auto" : "smooth" });
      });
    }

    previousScrollRoomRef.current = selectedRoomId;
    previousTimelineCountRef.current = timelineCount;
  }, [selectedRoomId, messages.length, notices.length]);


  useEffect(() => {
    let mounted = true;

    async function fetchMyProfile() {
      const supabase = createClient();
      const { data } = await supabase
        .from("profiles")
        .select("nickname, profile_image_url")
        .eq("id", userId)
        .single();

      if (mounted && data) {
        setMyProfile(data);
      }
    }

    fetchMyProfile();

    return () => {
      mounted = false;
    };
  }, [userId]);

  async function openSelfChat() {
    try {
      const res = await fetch("/api/chat/rooms/direct", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ target_id: userId }),
      });
      const json = await res.json();
      if (res.ok && json.data?.id) {
        const room = mapChatRoom(json.data as ChatRoomApiItem);
        setConversations((prev) => {
          if (prev.some((c) => c.id === room.id)) return prev;
          return [room, ...prev];
        });
        void openChat(room.id);
      }
    } catch (error) {
      console.error("Failed to create self chat:", error);
    }
  }

  async function openChat(roomId: string) {
    activeChatRoomRef.current = roomId;
    setSelectedRoomId(roomId);
    setChatOpen(true);
    setChatLoading(true);

    const localConversation = conversations.find((conv) => conv.id === roomId) ?? null;
    const localOtherUser = localConversation?.other_user ?? null;
    const hasCachedRoom = hasChatRoomCache(roomId);

    setOtherUser(localOtherUser);

    const cachedNotices = readNoticeCache(roomId);
    if (cachedNotices.length > 0) {
      setNotices(cachedNotices);
    } else {
      setNotices([]);
    }

    try {
      const cachedMessages = readMessageCache(roomId);
      setMessages(cachedMessages);
      if (hasCachedRoom) {
        setChatLoading(false);
      }
    } catch {
      setMessages([]);
    }

    setConversations((prev) => {
      const next = prev.map((conv) =>
        conv.id === roomId ? { ...conv, unread_count: 0 } : conv
      );
      writeConversationsCache(next);
      return next;
    });

    void (async () => {
      try {
        const payload = await fetchChatRoomPayload(roomId);
        if (activeChatRoomRef.current === roomId) {
          setMessages(payload.messages);
          setNotices(payload.notices);
          setChatLoading(false);
          writeChatRoomPayloadCache(roomId, payload);
        }
      } catch (error) {
        console.error("Failed to load chat room:", error);
        if (activeChatRoomRef.current === roomId) {
          setChatLoading(false);
        }
      }
    })();

    if (!hasCachedRoom) setChatLoading(true);
  }

  useEffect(() => {
    if (!roomIdFromQuery) return;
    if (autoOpenedRoomRef.current === roomIdFromQuery) return;

    const target = conversations.find((conv) => conv.id === roomIdFromQuery);
    if (!target) return;

    autoOpenedRoomRef.current = roomIdFromQuery;
    queueMicrotask(() => {
      void openChat(roomIdFromQuery);
    });
    // 쿼리로 전달된 roomId는 한 번만 자동 진입합니다.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [roomIdFromQuery, conversations]);

  function closeChat() {
    activeChatRoomRef.current = null;
    setChatOpen(false);
    setMemberDrawerOpen(false);
    setTimeout(() => {
      setSelectedRoomId(null);
      setMessages([]);
      setNotices([]);
      setOtherUser(null);
    }, 300);
  }

  function handleSendMessage() {
    const text = newMessage.trim();
    if (!text || !selectedRoomId) return;

    const tempId = `local-${Date.now()}`;
    const tempMessage: Message = {
      id: tempId,
      room_id: selectedRoomId,
      sender_id: userId,
      kind: "text",
      content: text,
      sent_at: new Date().toISOString(),
      sender: null,
      my_reaction: null,
      reaction_counts: EMPTY_MESSAGE_REACTION_COUNTS,
      send_status: "sending",
    };

    setMessages((prev) => [...prev, tempMessage]);
    setNewMessage("");

    const roomId = selectedRoomId;
    fetch(`/api/chat/rooms/${roomId}/messages`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ kind: "text", content: text }),
    })
      .then(async (res) => {
        const json = await res.json();
        const message = json.data ? mapChatMessage(json.data as ChatMessageApiItem) : null;
        if (res.ok && message) {
          setMessages((prev) => prev.map((m) => m.id === tempId ? message : m));
          appendMessageCache(roomId, message);
          patchConversationWithMessage(roomId, message);
        } else {
          setMessages((prev) => prev.map((m) => m.id === tempId ? { ...m, send_status: "failed" as const } : m));
        }
      })
      .catch(() => {
        setMessages((prev) => prev.map((m) => m.id === tempId ? { ...m, send_status: "failed" as const } : m));
      });
  }

  function startLongPress(msgId: string) {
    longPressTimer.current = setTimeout(() => {
      setShakingMsgId(msgId);
    }, 500);
  }

  function cancelLongPress() {
    if (longPressTimer.current) clearTimeout(longPressTimer.current);
  }

  function handleChatScroll(event: UIEvent<HTMLDivElement>) {
    const node = event.currentTarget;
    shouldStickToBottomRef.current = node.scrollHeight - node.scrollTop - node.clientHeight < 120;
  }

  async function deleteMessage(msgId: string) {
    setMessages((prev) => prev.filter((m) => m.id !== msgId));
    setShakingMsgId(null);
    if (selectedRoomId) {
      writeMessageCache(selectedRoomId, readMessageCache(selectedRoomId).filter((m) => m.id !== msgId));
    }
    await fetch(`/api/chat/messages/${msgId}`, { method: "DELETE" });
  }

  function formatDate(dateStr: string) {
    const d = new Date(dateStr);
    const today = new Date();
    const isToday = d.toDateString() === today.toDateString();
    if (isToday) {
      return `${d.getHours().toString().padStart(2, "0")}:${d.getMinutes().toString().padStart(2, "0")}`;
    }
    return `${d.getMonth() + 1}/${d.getDate()}`;
  }

  function formatTime(dateStr: string) {
    const d = new Date(dateStr);
    return `${d.getHours().toString().padStart(2, "0")}:${d.getMinutes().toString().padStart(2, "0")}`;
  }

  function truncateMessage(content: string, length: number = 20) {
    return content.length > length ? content.substring(0, length) + "..." : content;
  }

  async function reactToMessage(messageId: string, reactionType: MessageReactionType) {
    const prevMessage = messages.find((item) => item.id === messageId);
    if (!prevMessage) return;
    const nextReaction = prevMessage.my_reaction === reactionType ? null : reactionType;

    const patchMessage = (message: Message): Message => {
      const counts = { ...(message.reaction_counts ?? EMPTY_MESSAGE_REACTION_COUNTS) };
      if (message.my_reaction) counts[message.my_reaction] = Math.max(0, counts[message.my_reaction] - 1);
      if (nextReaction) counts[nextReaction] += 1;
      return { ...message, my_reaction: nextReaction, reaction_counts: counts };
    };

    setMessages((prev) => prev.map((item) => item.id === messageId ? patchMessage(item) : item));

    try {
      const res = await fetch(`/api/chat/messages/${messageId}/reactions`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reaction_type: reactionType }),
      });
      if (!res.ok) setMessages((prev) => prev.map((item) => item.id === messageId ? prevMessage : item));
    } catch {
      setMessages((prev) => prev.map((item) => item.id === messageId ? prevMessage : item));
    }
  }

  async function handleFriendMessageSent(roomId: string) {
    setActiveMenuTab("messages");
    await fetchConversations({ force: true });
    queueMicrotask(() => {
      void openChat(roomId);
    });
  }

  return (
    <div className="max-w-xl mx-auto bg-white flex min-h-0 flex-col" style={{ height: "calc(100dvh - 126px)" }}>
      <ConversationList
        activeMenuTab={activeMenuTab}
        conversations={conversations}
        loading={loading}
        myProfile={myProfile}
        onlineIds={onlineIds}
        onOpenChat={openChat}
        onOpenProfile={(profileId) => router.push(`/users/${profileId}/view`)}
        onOpenSelfChat={() => { void openSelfChat(); }}
        onPrefetchChat={(roomId) => {
          void prefetchChatRoom(roomId);
        }}
        onFriendMessageSent={(roomId) => {
          void handleFriendMessageSent(roomId);
        }}
        setActiveMenuTab={setActiveMenuTab}
        formatDate={formatDate}
        truncateMessage={truncateMessage}
      />

      <ChatDrawer
        key={selectedRoomId ?? "chat-drawer-empty"}
        attachOpen={attachOpen}
        canAddMembers={canAddMembers}
        canEditTitle={canEditTitle}
        chatLoading={chatLoading}
        chatOpen={chatOpen}
        chatTitle={selectedConversation?.title ?? null}
        classId={selectedConversation?.class_id ?? null}
        messages={messages}
        messagesEndRef={messagesEndRef}
        myProfile={myProfile}
        newMessage={newMessage}
        notices={notices}
        otherUser={otherUser}
        roomMembers={selectedConversation?.members}
        roomId={selectedRoomId}
        roomType={selectedConversation?.type}
        photoInputRef={photoInputRef}
        videoInputRef={videoInputRef}
        selectedUserId={selectedRoomId}
        shakingMsgId={shakingMsgId}
        uploading={uploading}
        userId={userId}
        onCancelLongPress={cancelLongPress}
        onChatScroll={handleChatScroll}
        onClose={closeChat}
        onDeleteMessage={(msgId) => {
          void deleteMessage(msgId);
        }}
        onMarkNoticeRead={(noticeId) => {
          void markNoticeRead(noticeId);
        }}
        onMessageReaction={(messageId, reactionType) => {
          void reactToMessage(messageId, reactionType);
        }}
        onNoticeReaction={(noticeId, reactionType) => {
          void reactToNotice(noticeId, reactionType);
        }}
        onNoticeVote={(noticeId, voteType) => {
          void voteNotice(noticeId, voteType);
        }}
        onOpenMemberDrawer={() => setMemberDrawerOpen(true)}
        onPhotoUpload={handlePhotoUpload}
        onVideoUpload={handleVideoUpload}
        onSaveNotice={saveClassNotice}
        onUpdateNotice={updateClassNotice}
        onDeleteNotice={deleteClassNotice}
        onSendMessage={() => {
          void handleSendMessage();
        }}
        onStartLongPress={startLongPress}
        onTitleChanged={(title) => {
          patchConversationWithRoom({ id: selectedRoomId, title });
        }}
        setAttachOpen={setAttachOpen}
        setNewMessage={setNewMessage}
        setShakingMsgId={setShakingMsgId}
        formatTime={formatTime}
      />
      <ChatMemberDrawer
        open={memberDrawerOpen}
        roomId={selectedRoomId}
        currentMembers={selectedConversation?.members}
        onClose={() => setMemberDrawerOpen(false)}
        onMemberAdded={(room) => {
          patchConversationWithRoom(room);
        }}
      />
    </div>
  );
}
