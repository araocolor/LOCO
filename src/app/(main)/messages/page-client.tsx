"use client";

import { useEffect, useState, useRef } from "react";
import type { UIEvent } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { isChatMuted } from "@/lib/chat-mute";
import { PRESENCE_EVENT } from "@/components/features/PresenceTracker";
import ConversationList from "./_components/ConversationList";
import ChatDrawer from "./_components/ChatDrawer";
import ChatMemberDrawer from "./_components/ChatMemberDrawer";
import CreateChatDrawer from "./_components/CreateChatDrawer";
import UserProfileModal from "@/components/user/UserProfileModal";
import type { ChatNotice, Conversation, Message, MessageMenuTab, MessageReactionType, MyProfile, OtherUser } from "./_types";
import { useChatNotices } from "./_hooks/useChatNotices";
import {
  appendMessageCache,
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
    kind: "text" | "image" | "file" | "system" | "emoji";
    content: string;
    sender_id: string;
    is_mine: boolean;
    created_at: string;
  } | null;
  recent_messages?: Array<{
    id: string;
    room_id: string;
    sender_id: string;
    kind: "text" | "image" | "file" | "system" | "emoji";
    content: string;
    is_mine: boolean;
    created_at: string;
    sender?: OtherUser | null;
  }>;
  unread_count: number;
  updated_at: string;
  created_at: string;
}

interface CreatedChatRoomApiItem {
  id: string;
  type: "direct" | "group" | "class" | "self";
  class_id: string | null;
  owner_id: string | null;
  title: string | null;
  notice: string | null;
  updated_at: string;
  created_at: string;
  members: Array<{
    user_id: string;
    role: "owner" | "admin" | "member";
    created_at?: string | null;
    profile: OtherUser | null;
  }>;
}

interface ChatMessageApiItem {
  id: string;
  room_id: string;
  sender_id: string;
  kind: "text" | "image" | "file" | "system" | "emoji";
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
  room?: Partial<ChatRoomApiItem>;
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
const CHAT_ROOMS_PREVIEW_CACHE_PREFIX = "loco_chat_rooms_preview_cache_v1:";
const CHAT_ROOMS_PREVIEW_CACHE_TTL_MS = 5 * 60 * 1000;
const CONVERSATIONS_LIMIT = 50;

type PreviewRoomType = "direct" | "group" | "class";

function getPreviewCacheKey(userId: string, type: PreviewRoomType) {
  return `${CHAT_ROOMS_PREVIEW_CACHE_PREFIX}${userId}:${type}`;
}

function isConversationInPreviewType(conv: Conversation, type: PreviewRoomType) {
  if (type === "direct") return conv.type === "direct" || conv.type === "self";
  return conv.type === type;
}

function mapMenuTabToPreviewType(tab: MessageMenuTab): PreviewRoomType | null {
  if (tab === "direct") return "direct";
  if (tab === "groups") return "group";
  if (tab === "class") return "class";
  return null;
}

function getConversationsForCache(convs: Conversation[]) {
  return convs.slice(0, CONVERSATIONS_LIMIT);
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
  const [activeMenuTab, setActiveMenuTab] = useState<MessageMenuTab>("friends");

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
  const [createChatOpen, setCreateChatOpen] = useState(false);
  const [attachOpen, setAttachOpen] = useState(false);
  const [emojiOpen, setEmojiOpen] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [shakingMsgId, setShakingMsgId] = useState<string | null>(null);
  const [profileModalUserId, setProfileModalUserId] = useState<string | null>(null);
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



  async function resizeToBlob(bitmap: ImageBitmap, maxW: number, quality: number): Promise<Blob> {
    const scale = bitmap.width > maxW ? maxW / bitmap.width : 1;
    const w = Math.round(bitmap.width * scale);
    const h = Math.round(bitmap.height * scale);
    const canvas = document.createElement("canvas");
    canvas.width = w;
    canvas.height = h;
    canvas.getContext("2d")!.drawImage(bitmap, 0, 0, w, h);
    return new Promise<Blob>((resolve) =>
      canvas.toBlob((b) => resolve(b!), "image/webp", quality)
    );
  }

  async function handlePhotoUpload(file: File) {
    if (!selectedRoomId) return;

    const localPreviewUrl = URL.createObjectURL(file);
    const tempId = `local-photo-${Date.now()}`;
    const tempMessage: Message = {
      id: tempId,
      sender_id: userId,
      room_id: selectedRoomId,
      kind: "image",
      content: JSON.stringify({ type: "image", thumb: localPreviewUrl, full: localPreviewUrl }),
      sent_at: new Date().toISOString(),
      send_status: "sending",
    };

    setMessages((prev) => [...prev, tempMessage]);
    setAttachOpen(false);
    setUploading(true);

    try {
      const bitmap = await createImageBitmap(file);
      const supabase = createClient();
      const ts = Date.now();
      const quality = file.size >= 2 * 1024 * 1024 ? 0.7 : 0.9;

      const [blob300, blob1024] = await Promise.all([
        resizeToBlob(bitmap, 300, quality),
        resizeToBlob(bitmap, 1024, quality),
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
        setMessages((prev) => prev.map((m) => m.id === tempId ? message : m));
        appendMessageCache(selectedRoomId, message);
        patchConversationWithMessage(selectedRoomId, message);
      } else {
        setMessages((prev) => prev.map((m) => m.id === tempId ? { ...m, send_status: "failed" as const } : m));
      }
    } catch (e) {
      console.error("업로드 실패", e);
      setMessages((prev) => prev.map((m) => m.id === tempId ? { ...m, send_status: "failed" as const } : m));
    } finally {
      URL.revokeObjectURL(localPreviewUrl);
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

  async function handleSendEmoji(emojiSrc: string) {
    if (!selectedRoomId) return;

    const roomId = selectedRoomId;
    const tempId = `local-emoji-${Date.now()}`;
    const emojiContent = { src: emojiSrc };
    const tempMessage: Message = {
      id: tempId,
      room_id: roomId,
      sender_id: userId,
      kind: "emoji",
      content: JSON.stringify(emojiContent),
      sent_at: new Date().toISOString(),
      sender: null,
      my_reaction: null,
      reaction_counts: EMPTY_MESSAGE_REACTION_COUNTS,
      send_status: "sending",
    };

    setMessages((prev) => [...prev, tempMessage]);
    setAttachOpen(false);
    setEmojiOpen(false);

    try {
      const res = await fetch(`/api/chat/rooms/${roomId}/messages`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          kind: "emoji",
          content: emojiContent,
        }),
      });
      const json = await res.json();
      const message = json.data ? mapChatMessage(json.data as ChatMessageApiItem) : null;

      if (res.ok && message) {
        setMessages((prev) => prev.map((item) => (item.id === tempId ? message : item)));
        appendMessageCache(roomId, message);
        patchConversationWithMessage(roomId, message);
      } else {
        setMessages((prev) => prev.map((item) => (
          item.id === tempId ? { ...item, send_status: "failed" as const } : item
        )));
      }
    } catch {
      setMessages((prev) => prev.map((item) => (
        item.id === tempId ? { ...item, send_status: "failed" as const } : item
      )));
    }
  }

  const roomLoadInFlightRef = useRef<Map<string, Promise<ChatRoomPayload>>>(new Map());

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
            sender_id: lastMessage.sender_id,
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
      created_at: item.created_at,
    };
  }

  function mapCreatedChatRoom(item: CreatedChatRoomApiItem): Conversation {
    return mapChatRoom({
      ...item,
      class_image_url: null,
      member_count: item.members.length,
      last_message: null,
      unread_count: 0,
    });
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

  function readPreviewCache(type: PreviewRoomType) {
    try {
      const raw = localStorage.getItem(getPreviewCacheKey(userId, type));
      if (!raw) return null;
      const parsed = JSON.parse(raw) as { data?: unknown; ts?: number };
      const rows = Array.isArray(parsed)
        ? parsed
        : Array.isArray(parsed.data)
          ? parsed.data
          : [];
      const next = rows
        .map(normalizeCachedConversation)
        .filter((item): item is Conversation => Boolean(item));
      if (next.length === 0) return null;
      const ts = typeof parsed.ts === "number" ? parsed.ts : 0;
      const expired = ts <= 0 || Date.now() - ts > CHAT_ROOMS_PREVIEW_CACHE_TTL_MS;
      return { data: next, expired, ts };
    } catch {
      return null;
    }
  }

  function writePreviewCache(type: PreviewRoomType, convs: Conversation[]) {
    try {
      const rows = getConversationsForCache(convs.filter((conv) => isConversationInPreviewType(conv, type)));
      localStorage.setItem(
        getPreviewCacheKey(userId, type),
        JSON.stringify({
          data: rows,
          ts: Date.now(),
        })
      );
    } catch {}
  }

  function writeAllPreviewCaches(convs: Conversation[]) {
    writePreviewCache("direct", convs);
    writePreviewCache("group", convs);
    writePreviewCache("class", convs);
  }

  function mergeConversationsByType(type: PreviewRoomType, incoming: Conversation[]) {
    setConversations((prev) => {
      const next = prev.filter((conv) => !isConversationInPreviewType(conv, type));
      const merged = [...next, ...incoming].sort((a, b) => new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime());
      writeAllPreviewCaches(merged);
      return merged;
    });
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
      writeAllPreviewCaches(sorted);
      return sorted;
    });
  }

  async function fetchChatRoomPayload(roomId: string): Promise<ChatRoomPayload> {
    const inFlight = roomLoadInFlightRef.current.get(roomId);
    if (inFlight) return inFlight;

    const task = (async () => {
      const [messageRes, noticeRes, roomRes] = await Promise.all([
        fetch(`/api/chat/rooms/${roomId}/messages?limit=40`),
        fetch(`/api/chat/rooms/${roomId}/notices`),
        fetch(`/api/chat/rooms/${roomId}`),
      ]);

      const messages: Message[] = [];
      let notices: ChatNotice[] = [];
      let room: Partial<ChatRoomApiItem> | undefined;

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

      if (roomRes.ok) {
        const roomJson = await roomRes.json();
        if (roomJson.data) {
          room = roomJson.data as Partial<ChatRoomApiItem>;
        }
      }

      return { messages, notices, room };
    })();

    roomLoadInFlightRef.current.set(roomId, task);
    task.then(
      () => roomLoadInFlightRef.current.delete(roomId),
      () => roomLoadInFlightRef.current.delete(roomId)
    );

    return task;
  }

  function writeChatRoomPayloadCache(roomId: string, payload: ChatRoomPayload) {
    writeMessageCache(roomId, payload.messages);
    writeNoticeCache(roomId, payload.notices);
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
      class_id?: string | null;
      class_image_url?: string | null;
      member_count?: number;
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
              class_id: Object.prototype.hasOwnProperty.call(nextRoom, "class_id") ? nextRoom.class_id ?? null : conv.class_id,
              class_image_url: Object.prototype.hasOwnProperty.call(nextRoom, "class_image_url") ? nextRoom.class_image_url ?? null : conv.class_image_url,
              updated_at: nextRoom.updated_at ?? conv.updated_at,
              members: nextRoom.members ?? conv.members,
              member_count: nextRoom.member_count ?? nextRoom.members?.length ?? conv.member_count,
              other_user: nextRoom.type === "direct" ? conv.other_user : null,
            }
          : conv
      );
      writeAllPreviewCaches(next);
      return next;
    });
  }

  async function fetchConversationsByType(type: PreviewRoomType, options?: { force?: boolean; limit?: number }) {
    const cached = readPreviewCache(type);
    if (!options?.force && cached && !cached.expired) {
      mergeConversationsByType(type, cached.data);
      return;
    }

    try {
      const limitParam = options?.limit ? `&limit=${options.limit}` : "";
      const res = await fetch(`/api/chat/rooms/preview?type=${type}${limitParam}`);
      const json = await res.json();
      if (!res.ok || !json.data) return;
      const apiItems = json.data as ChatRoomApiItem[];
      const incomingConversations = apiItems.map(mapChatRoom);
      writePreviewCache(type, incomingConversations);
      mergeConversationsByType(type, incomingConversations);

      for (const item of apiItems) {
        if (item.recent_messages && item.recent_messages.length > 0) {
          const recentMsgs: Message[] = item.recent_messages.map((rm) => ({
            id: rm.id,
            room_id: rm.room_id,
            sender_id: rm.sender_id,
            kind: rm.kind,
            content: rm.content,
            sent_at: rm.created_at,
            sender: rm.sender ?? null,
          }));
          const cached = readMessageCache(item.id);
          if (cached.length === 0) {
            writeMessageCache(item.id, recentMsgs);
          } else {
            const cachedIds = new Set(cached.map((m) => m.id));
            const newMsgs = recentMsgs.filter((m) => !cachedIds.has(m.id));
            if (newMsgs.length > 0) {
              writeMessageCache(item.id, [...cached, ...newMsgs].sort(
                (a, b) => new Date(a.sent_at).getTime() - new Date(b.sent_at).getTime()
              ));
            }
          }
        } else if (item.last_message) {
          const msg: Message = {
            id: item.last_message.id,
            room_id: item.id,
            sender_id: item.last_message.sender_id,
            kind: item.last_message.kind,
            content: item.last_message.content,
            sent_at: item.last_message.created_at,
          };
          const cached = readMessageCache(item.id);
          if (cached.length === 0 || cached[cached.length - 1].id !== msg.id) {
            appendMessageCache(item.id, msg);
          }
        }
      }
    } catch (error) {
      console.error(`Failed to load ${type} conversations:`, error);
    }
  }

  useEffect(() => {
    const cachedDirect = readPreviewCache("direct");
    const cachedGroup = readPreviewCache("group");
    const cachedClass = readPreviewCache("class");
    const hydrated = [
      ...(cachedDirect?.data ?? []),
      ...(cachedGroup?.data ?? []),
      ...(cachedClass?.data ?? []),
    ];

    if (hydrated.length > 0) {
      const byId = new Map(hydrated.map((conv) => [conv.id, conv]));
      const merged = Array.from(byId.values()).sort((a, b) => new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime());
      queueMicrotask(() => {
        setConversations(merged);
      });
    }
    queueMicrotask(() => {
      setLoading(false);
    });
    // 캐시는 첫 렌더 이후 비동기로 반영해 effect 내부 동기 setState를 피합니다.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const previewType = mapMenuTabToPreviewType(activeMenuTab);
    if (!previewType) return;

    const cached = readPreviewCache(previewType);
    if (cached?.data?.length) {
      queueMicrotask(() => {
        mergeConversationsByType(previewType, cached.data);
        setLoading(false);
      });
    }

    if (!cached || cached.expired) {
      if (!cached?.data?.length) {
        queueMicrotask(() => {
          setLoading(true);
        });
      }
      const timer = window.setTimeout(() => {
        void fetchConversationsByType(previewType, { force: true, limit: 3 })
          .then(() => setLoading(false))
          .then(() => fetchConversationsByType(previewType, { force: true }));
      }, 0);
      return () => window.clearTimeout(timer);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeMenuTab]);

  useEffect(() => {
    if (activeMenuTab !== "friends") return;

    const types: PreviewRoomType[] = ["direct", "group", "class"];
    types.forEach((type) => {
      const cached = readPreviewCache(type);
      if (cached && !cached.expired) return;

      void fetchConversationsByType(type, { limit: 3 }).then(() => {
        void fetchConversationsByType(type, { force: true });
      });
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeMenuTab]);

  useEffect(() => {
    if (!roomIdFromQuery) return;
    const timer = window.setTimeout(() => {
      void Promise.allSettled([
        fetchConversationsByType("direct", { force: true }),
        fetchConversationsByType("group", { force: true }),
        fetchConversationsByType("class", { force: true }),
      ]);
    }, 0);
    return () => window.clearTimeout(timer);
    // roomId 딥링크는 목록 확보를 위해 마운트 후 비동기로 동기화합니다.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [roomIdFromQuery]);

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

  const refreshListRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const conversationsRef = useRef(conversations);
  conversationsRef.current = conversations;
  const arrivedAudioRef = useRef<HTMLAudioElement | null>(null);

  function playArrivedSound() {
    try {
      if (!arrivedAudioRef.current) {
        arrivedAudioRef.current = new Audio("/sound/arrived_message.mp3");
        arrivedAudioRef.current.volume = 0.7;
      }
      arrivedAudioRef.current.currentTime = 0;
      void arrivedAudioRef.current.play();
    } catch {}
  }

  function scheduleListRefresh() {
    if (refreshListRef.current) return;
    refreshListRef.current = setTimeout(() => {
      refreshListRef.current = null;
      void Promise.allSettled([
        fetchConversationsByType("direct", { force: true }),
        fetchConversationsByType("group", { force: true }),
        fetchConversationsByType("class", { force: true }),
      ]);
    }, 500);
  }

  useEffect(() => {
    const supabase = createClient();
    const channel = supabase
      .channel(`chat-room-list-${userId}`)
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "chat_room_members", filter: `user_id=eq.${userId}` },
        () => {
          scheduleListRefresh();
          if (!activeChatRoomRef.current) playArrivedSound();
        }
      )
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "chat_rooms" },
        (payload) => {
          const roomId = (payload.new as { id?: string }).id;
          if (!roomId) return;
          if (!conversationsRef.current.some((conv) => conv.id === roomId)) return;
          scheduleListRefresh();
          if (activeChatRoomRef.current === roomId) return;
          if (!isChatMuted(roomId)) playArrivedSound();
          void (async () => {
            try {
              const res = await fetch(`/api/chat/rooms/${roomId}/messages?limit=1`);
              const json = await res.json();
              if (!res.ok || !json.data) return;
              const msgs = (json.data as ChatMessageApiItem[]).map(mapChatMessage);
              if (msgs.length === 0) return;
              const latest = msgs[0];
              const cached = readMessageCache(roomId);
              if (cached.some((m) => m.id === latest.id)) return;
              appendMessageCache(roomId, latest);
            } catch {}
          })();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
      if (refreshListRef.current) {
        clearTimeout(refreshListRef.current);
        refreshListRef.current = null;
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId]);

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
    try {
      const keys = Object.keys(localStorage).filter((k) => k.startsWith("loco_home_my_classes_v1:"));
      for (const key of keys) {
        const raw = localStorage.getItem(key);
        if (!raw) continue;
        const cache = JSON.parse(raw);
        const p = cache?.profile;
        if (p?.nickname) {
          queueMicrotask(() => {
            setMyProfile({ nickname: p.nickname, profile_image_url: p.profile_image_url ?? null });
          });
          return;
        }
      }
    } catch {}
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
    setAttachOpen(false);
    setEmojiOpen(false);

    const localConversation = conversations.find((conv) => conv.id === roomId) ?? null;
    const localOtherUser = localConversation?.other_user ?? null;
    setOtherUser(localOtherUser);

    const cachedNotices = readNoticeCache(roomId);
    if (cachedNotices.length > 0) {
      setNotices(cachedNotices);
    } else {
      setNotices([]);
    }

    const cachedMessages = readMessageCache(roomId);
    setMessages(cachedMessages);

    setConversations((prev) => {
      const next = prev.map((conv) =>
        conv.id === roomId ? { ...conv, unread_count: 0 } : conv
      );
      writeAllPreviewCaches(next);
      return next;
    });

    const hadCache = cachedMessages.length > 0;
    if (hadCache) setChatLoading(false);
    void (async () => {
      try {
        const payload = await fetchChatRoomPayload(roomId);
        if (payload.room) {
          patchConversationWithRoom(payload.room);
        }
        if (activeChatRoomRef.current === roomId) {
          if (hadCache && payload.messages.length > 0) {
            shouldStickToBottomRef.current = false;
            const nextNoticeCount = payload.notices.length;
            const scrollContainer = document.querySelector(".chat-drawer-scroll");
            const anchorId = cachedMessages[0]?.id;
            const anchorEl = anchorId ? scrollContainer?.querySelector(`[data-msg-id="${anchorId}"]`) as HTMLElement | null : null;
            const anchorOffset = anchorEl && scrollContainer ? anchorEl.offsetTop - scrollContainer.scrollTop : null;
            setMessages((prev) => {
              const existingMap = new Map(prev.map((m) => [m.id, m]));
              const olderMsgs = payload.messages.filter((m) => !existingMap.has(m.id));
              if (olderMsgs.length === 0) {
                previousTimelineCountRef.current = prev.length + nextNoticeCount;
                return prev;
              }
              const preserved = prev.map((m) => {
                const server = payload.messages.find((s) => s.id === m.id);
                if (!server) return m;
                return { ...server, content: m.content };
              });
              const merged = [...olderMsgs, ...preserved].sort(
                (a, b) => new Date(a.sent_at).getTime() - new Date(b.sent_at).getTime()
              );
              previousTimelineCountRef.current = merged.length + nextNoticeCount;
              requestAnimationFrame(() => {
                if (scrollContainer && anchorId && anchorOffset !== null) {
                  const newAnchorEl = scrollContainer.querySelector(`[data-msg-id="${anchorId}"]`) as HTMLElement | null;
                  if (newAnchorEl) {
                    scrollContainer.scrollTop = newAnchorEl.offsetTop - anchorOffset;
                  }
                }
              });
              return merged;
            });
          } else {
            setMessages(payload.messages);
          }
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
    setAttachOpen(false);
    setEmojiOpen(false);
    setTimeout(() => {
      setSelectedRoomId(null);
      setMessages([]);
      setNotices([]);
      setOtherUser(null);
    }, 300);
  }

  function handleLeaveRoom() {
    if (!selectedRoomId) return;
    const roomId = selectedRoomId;
    const isClassRoom = selectedConversation?.type === "class";
    closeChat();
    if (!isClassRoom) {
      setConversations((prev) => {
        const next = prev.filter((conv) => conv.id !== roomId);
        writeAllPreviewCaches(next);
        return next;
      });
    }
    fetch(`/api/chat/rooms/${roomId}/members/${userId}`, { method: "DELETE" }).catch(() => {});
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

  const olderLoadingRef = useRef(false);
  const olderFullyLoadedRef = useRef<Set<string>>(new Set());

  function handleChatScroll(event: UIEvent<HTMLDivElement>) {
    const node = event.currentTarget;
    shouldStickToBottomRef.current = node.scrollHeight - node.scrollTop - node.clientHeight < 120;

    if (
      !selectedRoomId ||
      olderLoadingRef.current ||
      olderFullyLoadedRef.current.has(selectedRoomId) ||
      node.scrollTop > 0
    ) return;

    olderLoadingRef.current = true;
    const roomId = selectedRoomId;
    const oldest = messages[0];
    const beforeParam = oldest ? `&before=${encodeURIComponent(oldest.sent_at)}` : "";

    void (async () => {
      try {
        const res = await fetch(`/api/chat/rooms/${roomId}/messages?limit=50${beforeParam}`);
        const json = await res.json();
        if (!res.ok || !json.data) return;
        const olderMsgs = (json.data as ChatMessageApiItem[]).map(mapChatMessage);
        if (olderMsgs.length === 0) {
          olderFullyLoadedRef.current.add(roomId);
          return;
        }
        if (activeChatRoomRef.current === roomId) {
          const prevHeight = node.scrollHeight;
          setMessages((prev) => {
            const existingIds = new Set(prev.map((m) => m.id));
            const newMsgs = olderMsgs.filter((m) => !existingIds.has(m.id));
            if (newMsgs.length === 0) return prev;
            const merged = [...newMsgs, ...prev];
            writeMessageCache(roomId, merged);
            return merged;
          });
          requestAnimationFrame(() => {
            node.scrollTop = node.scrollHeight - prevHeight;
          });
        }
      } catch (error) {
        console.error("이전 메시지 로드 실패", error);
      } finally {
        olderLoadingRef.current = false;
      }
    })();
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

  async function handleFriendMessageSent() {
    await fetchConversationsByType("direct", { force: true });
  }

  return (
    <div className="flex-1 bg-white flex min-h-0 flex-col">
      <ConversationList
        activeMenuTab={activeMenuTab}
        conversations={conversations}
        loading={loading}
        myProfile={myProfile}
        onlineIds={onlineIds}
        onOpenChat={openChat}
        onOpenProfile={(profileId) => router.push(`/users/${profileId}/view`)}
        onOpenSelfChat={() => { void openSelfChat(); }}
        onFriendMessageSent={() => {
          void handleFriendMessageSent();
        }}
        onCreateChat={() => setCreateChatOpen(true)}
        setActiveMenuTab={setActiveMenuTab}
        formatDate={formatDate}
        truncateMessage={truncateMessage}
      />

      <ChatDrawer
        key={`${selectedRoomId ?? "chat-drawer-empty"}:${chatOpen ? "open" : "closed"}`}
        attachOpen={attachOpen}
        canAddMembers={canAddMembers}
        canEditTitle={canEditTitle}
        chatLoading={chatLoading}
        chatOpen={chatOpen}
        chatTitle={selectedConversation?.title ?? null}
        classId={selectedConversation?.class_id ?? null}
        emojiOpen={emojiOpen}
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
        onSendEmoji={(emojiSrc) => {
          void handleSendEmoji(emojiSrc);
        }}
        onVideoUpload={handleVideoUpload}
        onSaveNotice={saveClassNotice}
        onUpdateNotice={updateClassNotice}
        onDeleteNotice={deleteClassNotice}
        onSendMessage={() => {
          void handleSendMessage();
        }}
        onStartLongPress={startLongPress}
        onAvatarClick={(targetUserId) => {
          if (targetUserId !== userId) setProfileModalUserId(targetUserId);
        }}
        onTitleChanged={(title) => {
          patchConversationWithRoom({ id: selectedRoomId, title });
        }}
        onLeaveRoom={() => { void handleLeaveRoom(); }}
        roomCreatedAt={selectedConversation?.created_at ?? null}
        setAttachOpen={setAttachOpen}
        setEmojiOpen={setEmojiOpen}
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
      <CreateChatDrawer
        open={createChatOpen}
        onClose={() => setCreateChatOpen(false)}
        onRoomCreated={(room) => {
          setCreateChatOpen(false);
          const nextRoom = mapCreatedChatRoom(room);
          setConversations((prev) => {
            const next = prev.some((conv) => conv.id === nextRoom.id)
              ? prev.map((conv) => (conv.id === nextRoom.id ? { ...conv, ...nextRoom } : conv))
              : [nextRoom, ...prev];
            writeAllPreviewCaches(next);
            return next;
          });
          void fetchConversationsByType("direct", { force: true });
          void fetchConversationsByType("group", { force: true });
          void openChat(room.id);
        }}
      />
      {profileModalUserId && (
        <UserProfileModal
          userId={profileModalUserId}
          onClose={() => setProfileModalUserId(null)}
        />
      )}
    </div>
  );
}
