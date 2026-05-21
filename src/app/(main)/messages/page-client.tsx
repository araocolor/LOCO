"use client";

import { useEffect, useState, useRef } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { PRESENCE_EVENT } from "@/components/features/PresenceTracker";
import ConversationList from "./_components/ConversationList";
import ChatDrawer from "./_components/ChatDrawer";
import ChatMemberDrawer from "./_components/ChatMemberDrawer";
import type { ChatNotice, Conversation, Message, MessageMenuTab, MessageReactionType, MyProfile, NoticeKind, NoticeReactionType, NoticeVoteType, OtherUser, SessionClassItem } from "./_types";
import {
  appendMessageCache,
  readMessageCache,
  writeMessageCache,
  readNoticeCache,
  writeNoticeCache,
  patchMessageCache,
} from "./_lib/message-cache";

interface ChatRoomApiItem {
  id: string;
  type: "direct" | "group" | "class";
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

const EMPTY_MESSAGE_REACTION_COUNTS: Record<MessageReactionType, number> = {
  heart: 0,
  like: 0,
  laugh: 0,
  wow: 0,
  sad: 0,
};

const FINDER_SOUND_ENABLED_KEY = "loco_finder_sound_enabled";
const MAX_VIDEO_UPLOAD_BYTES = 50 * 1024 * 1024;
const VIDEO_UPLOAD_TIMEOUT_MS = 180000;
const ALLOWED_VIDEO_TYPES = new Set(["video/mp4", "video/quicktime", "video/webm"]);

function readFinderSoundEnabled() {
  if (typeof window === "undefined") return true;
  try {
    return localStorage.getItem(FINDER_SOUND_ENABLED_KEY) !== "false";
  } catch {
    return true;
  }
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
  const [finderSoundEnabled, setFinderSoundEnabled] = useState(readFinderSoundEnabled);

  // 대화창 상태
  const [selectedRoomId, setSelectedRoomId] = useState<string | null>(null);
  const [chatOpen, setChatOpen] = useState(false);
  const [messages, setMessages] = useState<Message[]>([]);
  const [notices, setNotices] = useState<ChatNotice[]>([]);
  const [otherUser, setOtherUser] = useState<OtherUser | null>(null);
  const [myProfile, setMyProfile] = useState<MyProfile | null>(null);
  const [chatLoading, setChatLoading] = useState(false);
  const [newMessage, setNewMessage] = useState("");
  const [sending, setSending] = useState(false);
  const [chatMenuOpen, setChatMenuOpen] = useState(false);
  const [memberDrawerOpen, setMemberDrawerOpen] = useState(false);
  const [attachOpen, setAttachOpen] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [refreshDisabled, setRefreshDisabled] = useState(false);
  const [isSpinning, setIsSpinning] = useState(false);
  const [shakingMsgId, setShakingMsgId] = useState<string | null>(null);
  const photoInputRef = useRef<HTMLInputElement>(null);
  const videoInputRef = useRef<HTMLInputElement>(null);
  const longPressTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
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

  const CACHE_KEY = "loco_chat_rooms_cache_v1";
  const CONVERSATIONS_LIMIT = 20;
  const MESSAGE_USER_SESSION_KEY = "message_userid_session";

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

  function isPreviewableTextMessage(message: ChatRoomApiItem["last_message"] | Message | null) {
    if (!message || message.kind === "image" || message.kind === "system") return false;
    try {
      const parsed = JSON.parse(message.content);
      if (parsed.type === "image" || parsed.type === "video") return false;
    } catch {}
    return true;
  }

  function mapChatRoom(item: ChatRoomApiItem): Conversation {
    const otherMember = item.type === "direct"
      ? item.members.find((member) => member.user_id !== userId)
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
      try { localStorage.setItem(CACHE_KEY, JSON.stringify(sorted.slice(0, CONVERSATIONS_LIMIT))); } catch {}
      return sorted;
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
      try { localStorage.setItem(CACHE_KEY, JSON.stringify(next.slice(0, CONVERSATIONS_LIMIT))); } catch {}
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

      sessionStorage.setItem(MESSAGE_USER_SESSION_KEY, JSON.stringify(sessionMap));
    } catch {}
  }

  async function fetchConversations(options?: { force?: boolean; manual?: boolean }) {
    const force = options?.force ?? false;
    const manual = options?.manual ?? false;
    const hasUserSession = Boolean(sessionStorage.getItem(MESSAGE_USER_SESSION_KEY));
    if (!force && hasUserSession) {
      const cached = localStorage.getItem(CACHE_KEY);
      if (cached) {
        setConversations(JSON.parse(cached) as Conversation[]);
      }
      setLoading(false);
    }

    if (manual) {
      setRefreshDisabled(true);
      setIsSpinning(true);
      setTimeout(() => setRefreshDisabled(false), 60000);
      setTimeout(() => setIsSpinning(false), 2000);
    }
    try {
      const res = await fetch("/api/chat/rooms");
      const json = await res.json();
      if (json.data) {
        const incomingConversations = (json.data as ChatRoomApiItem[]).map(mapChatRoom);
        setConversations(incomingConversations);
        localStorage.setItem(CACHE_KEY, JSON.stringify(incomingConversations.slice(0, CONVERSATIONS_LIMIT)));
        await saveMessageUserSession(incomingConversations);
      }
    } catch (error) {
      console.error("Failed to load conversations:", error);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    // v1: 로컬 목록 캐시 즉시 표시
    const cached = localStorage.getItem(CACHE_KEY);
    if (cached) {
      const next = JSON.parse(cached) as Conversation[];
      queueMicrotask(() => {
        setConversations(next);
        setLoading(false);
      });
    }

    // v2: 백그라운드에서 최신 데이터 갱신
    queueMicrotask(() => {
      void fetchConversations({ force: !cached });
    });
    // 첫 진입 때 로컬 캐시를 먼저 보여주고, 최신 목록은 한 번만 백그라운드 갱신합니다.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

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

          setMessages((prev) => {
            const existing = prev.find((message) => message.id === updatedMsg.id);
            if (!existing) return prev;

            const merged = {
              ...existing,
              ...updatedMsg,
              sender: existing.sender ?? updatedMsg.sender ?? null,
              my_reaction: existing.my_reaction ?? updatedMsg.my_reaction ?? null,
              reaction_counts: existing.reaction_counts ?? updatedMsg.reaction_counts,
            };

            patchMessageCache(selectedRoomId, merged);
            return prev.map((message) => (message.id === updatedMsg.id ? merged : message));
          });
        }
      )
      .subscribe();

    return () => { supabase.removeChannel(channel); };
    // 실시간 구독은 현재 열린 방과 현재 사용자 기준으로만 다시 연결합니다.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedRoomId, userId]);

  useEffect(() => {
    if (messages.length > 0) {
      messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    }
  }, [messages]);

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

  async function openChat(roomId: string) {
    activeChatRoomRef.current = roomId;
    setSelectedRoomId(roomId);
    setChatOpen(true);
    setChatLoading(true);

    const localConversation = conversations.find((conv) => conv.id === roomId) ?? null;
    const localOtherUser = localConversation?.other_user ?? null;
    let hasCachedMessages = false;

    setOtherUser(localOtherUser);

    const cachedNotices = readNoticeCache(roomId);
    if (cachedNotices.length > 0) {
      setNotices(cachedNotices);
    } else {
      setNotices([]);
    }

    try {
      const cachedMessages = readMessageCache(roomId);
      if (cachedMessages.length > 0) {
        hasCachedMessages = true;
        setMessages(cachedMessages);
        setChatLoading(false);
      } else {
        setMessages([]);
      }
    } catch {
      setMessages([]);
    }

    setConversations((prev) => {
      const next = prev.map((conv) =>
        conv.id === roomId ? { ...conv, unread_count: 0 } : conv
      );
      try { localStorage.setItem(CACHE_KEY, JSON.stringify(next)); } catch {}
      return next;
    });

    void (async () => {
      const [messageRes, noticeRes] = await Promise.all([
        fetch(`/api/chat/rooms/${roomId}/messages`),
        fetch(`/api/chat/rooms/${roomId}/notices`),
      ]);
      const messageJson = await messageRes.json();
      const noticeJson = await noticeRes.json();
      if (messageRes.ok && messageJson.data) {
        const nextMessages = (messageJson.data as ChatMessageApiItem[]).map(mapChatMessage);
        writeMessageCache(roomId, nextMessages);
        if (activeChatRoomRef.current === roomId) {
          setMessages(nextMessages);
        }
      }
      if (noticeRes.ok && noticeJson.data && activeChatRoomRef.current === roomId) {
        const fetchedNotices = noticeJson.data as ChatNotice[];
        writeNoticeCache(roomId, fetchedNotices);
        setNotices(fetchedNotices);
      }
      if (activeChatRoomRef.current === roomId) {
        setChatLoading(false);
      }
    })();

    if (!hasCachedMessages) setChatLoading(true);
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

  async function handleSendMessage() {
    if (!newMessage.trim() || !selectedRoomId) return;

    setSending(true);
    try {
      const res = await fetch(`/api/chat/rooms/${selectedRoomId}/messages`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ kind: "text", content: newMessage.trim() }),
      });
      const json = await res.json();
      const message = json.data ? mapChatMessage(json.data as ChatMessageApiItem) : null;

      if (res.ok && message) {
        setMessages((prev) => [...prev, message]);
        appendMessageCache(selectedRoomId, message);
        setNewMessage("");
        patchConversationWithMessage(selectedRoomId, message);
      }
    } catch (error) {
      console.error("Failed to send chat message:", error);
    } finally {
      setSending(false);
    }
  }

  function startLongPress(msgId: string) {
    longPressTimer.current = setTimeout(() => {
      setShakingMsgId(msgId);
    }, 500);
  }

  function cancelLongPress() {
    if (longPressTimer.current) clearTimeout(longPressTimer.current);
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

  async function handleFriendRequest() {
    if (!otherUser?.id) return;
    setChatMenuOpen(false);
    const res = await fetch("/api/friends", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ target_id: otherUser.id }),
    });
    const data = await res.json();
    alert(res.ok ? "친구 신청 완료!" : (data.error ?? "오류가 발생했습니다"));
  }

  async function saveClassNotice(notice: string, kind: NoticeKind = "notice", closesAt: string | null = null) {
    if (!selectedRoomId) return;

    const res = await fetch(`/api/chat/rooms/${selectedRoomId}/notices`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ kind, content: notice, closes_at: closesAt }),
    });
    const data = await res.json();
    if (!res.ok) {
      throw new Error(data.error ?? "공지 저장 중 오류가 발생했습니다");
    }
    if (data.data) setNotices(data.data as ChatNotice[]);
  }

  async function updateClassNotice(noticeId: string, content: string, kind: NoticeKind, closesAt: string | null) {
    const res = await fetch(`/api/chat/notices/${noticeId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ kind, content, closes_at: closesAt }),
    });
    const data = await res.json();
    if (!res.ok) {
      throw new Error(data.error ?? "공지 수정 중 오류가 발생했습니다");
    }
    setNotices((prev) =>
      prev.map((item) =>
        item.id === noticeId ? { ...item, content, kind, closes_at: closesAt } : item
      )
    );
  }

  async function deleteClassNotice(noticeId: string) {
    const res = await fetch(`/api/chat/notices/${noticeId}`, { method: "DELETE" });
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      throw new Error(data.error ?? "공지 삭제 중 오류가 발생했습니다");
    }
    setNotices((prev) => prev.filter((item) => item.id !== noticeId));
  }

  async function markNoticeRead(noticeId: string) {
    const notice = notices.find((item) => item.id === noticeId);
    if (!notice || notice.read_by_me) return;

    setNotices((prev) =>
      prev.map((item) =>
        item.id === noticeId
          ? { ...item, read_by_me: true, read_count: item.read_count + 1 }
          : item
      )
    );

    try {
      const res = await fetch(`/api/chat/notices/${noticeId}/read`, { method: "POST" });
      if (!res.ok) {
        setNotices((prev) =>
          prev.map((item) =>
            item.id === noticeId
              ? { ...item, read_by_me: false, read_count: Math.max(0, item.read_count - 1) }
              : item
          )
        );
      }
    } catch {
      setNotices((prev) =>
        prev.map((item) =>
          item.id === noticeId
            ? { ...item, read_by_me: false, read_count: Math.max(0, item.read_count - 1) }
            : item
        )
      );
    }
  }

  async function reactToNotice(noticeId: string, reactionType: NoticeReactionType) {
    const prevNotice = notices.find((item) => item.id === noticeId);
    if (!prevNotice) return;
    const nextReaction = prevNotice.my_reaction === reactionType ? null : reactionType;

    setNotices((prev) =>
      prev.map((item) => {
        if (item.id !== noticeId) return item;
        const counts = { ...item.reaction_counts };
        if (item.my_reaction) counts[item.my_reaction] = Math.max(0, counts[item.my_reaction] - 1);
        if (nextReaction) counts[nextReaction] += 1;
        return { ...item, my_reaction: nextReaction, reaction_counts: counts };
      })
    );

    try {
      const res = await fetch(`/api/chat/notices/${noticeId}/reaction`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reaction_type: reactionType }),
      });
      if (!res.ok) setNotices((prev) => prev.map((item) => item.id === noticeId ? prevNotice : item));
    } catch {
      setNotices((prev) => prev.map((item) => item.id === noticeId ? prevNotice : item));
    }
  }

  async function voteNotice(noticeId: string, voteType: NoticeVoteType) {
    const prevNotice = notices.find((item) => item.id === noticeId);
    if (!prevNotice) return;

    setNotices((prev) =>
      prev.map((item) => {
        if (item.id !== noticeId) return item;
        const counts = { ...item.vote_counts };
        if (item.my_vote) counts[item.my_vote] = Math.max(0, counts[item.my_vote] - 1);
        counts[voteType] += 1;
        return { ...item, my_vote: voteType, vote_counts: counts };
      })
    );

    try {
      const res = await fetch(`/api/chat/notices/${noticeId}/vote`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ vote_type: voteType }),
      });
      if (!res.ok) setNotices((prev) => prev.map((item) => item.id === noticeId ? prevNotice : item));
    } catch {
      setNotices((prev) => prev.map((item) => item.id === noticeId ? prevNotice : item));
    }
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

  function toggleFinderSound() {
    setFinderSoundEnabled((prev) => {
      const next = !prev;
      try {
        localStorage.setItem(FINDER_SOUND_ENABLED_KEY, String(next));
      } catch {}
      return next;
    });
  }

  return (
    <div className="max-w-xl mx-auto bg-white flex flex-col" style={{ height: "calc(100vh - 126px)" }}>
      <ConversationList
        activeMenuTab={activeMenuTab}
        conversations={conversations}
        finderSoundEnabled={finderSoundEnabled}
        isSpinning={isSpinning}
        loading={loading}
        onlineIds={onlineIds}
        refreshDisabled={refreshDisabled}
        onOpenChat={openChat}
        onOpenProfile={(profileId) => router.push(`/users/${profileId}/view`)}
        onRefresh={() => {
          void fetchConversations({ force: true, manual: true });
        }}
        onToggleFinderSound={toggleFinderSound}
        setActiveMenuTab={setActiveMenuTab}
        formatDate={formatDate}
        truncateMessage={truncateMessage}
      />

      <ChatDrawer
        key={selectedRoomId ?? "chat-drawer-empty"}
        attachOpen={attachOpen}
        canAddMembers={canAddMembers}
        chatLoading={chatLoading}
        chatMenuOpen={chatMenuOpen}
        chatOpen={chatOpen}
        chatTitle={selectedConversation?.title ?? null}
        messages={messages}
        messagesEndRef={messagesEndRef}
        myProfile={myProfile}
        newMessage={newMessage}
        notices={notices}
        otherUser={otherUser}
        roomMembers={selectedConversation?.members}
        roomType={selectedConversation?.type}
        photoInputRef={photoInputRef}
        videoInputRef={videoInputRef}
        selectedUserId={selectedRoomId}
        sending={sending}
        shakingMsgId={shakingMsgId}
        uploading={uploading}
        userId={userId}
        onCancelLongPress={cancelLongPress}
        onClose={closeChat}
        onDeleteMessage={(msgId) => {
          void deleteMessage(msgId);
        }}
        onFriendRequest={() => {
          void handleFriendRequest();
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
        setAttachOpen={setAttachOpen}
        setChatMenuOpen={setChatMenuOpen}
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
