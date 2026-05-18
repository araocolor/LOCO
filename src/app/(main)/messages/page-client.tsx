"use client";

import { useEffect, useState, useRef } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { PRESENCE_EVENT } from "@/components/features/PresenceTracker";
import ConversationList from "./_components/ConversationList";
import ChatDrawer from "./_components/ChatDrawer";
import ChatMemberDrawer from "./_components/ChatMemberDrawer";
import type { Conversation, Message, MessageMenuTab, MyProfile, OtherUser, SessionClassItem } from "./_types";
import {
  appendMessageCache,
  readMessageCache,
  writeMessageCache,
} from "./_lib/message-cache";

interface ChatRoomApiItem {
  id: string;
  type: "direct" | "group" | "class";
  class_id: string | null;
  owner_id: string | null;
  title: string | null;
  notice: string | null;
  member_count: number;
  members: Array<{
    user_id: string;
    role: "owner" | "admin" | "member";
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
}

export default function MessagesPageClient({ userId }: { userId: string }) {
  const router = useRouter();
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [loading, setLoading] = useState(true);
  const [onlineIds, setOnlineIds] = useState<Set<string>>(new Set());
  const [activeMenuTab, setActiveMenuTab] = useState<MessageMenuTab>("messages");

  // 대화창 상태
  const [selectedRoomId, setSelectedRoomId] = useState<string | null>(null);
  const [chatOpen, setChatOpen] = useState(false);
  const [messages, setMessages] = useState<Message[]>([]);
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
  const longPressTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const activeChatRoomRef = useRef<string | null>(null);
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
    };
  }

  function mapChatRoom(item: ChatRoomApiItem): Conversation {
    const otherMember = item.type === "direct"
      ? item.members.find((member) => member.user_id !== userId)
      : undefined;
    const lastMessage = item.last_message;

    return {
      id: item.id,
      type: item.type,
      title: item.title,
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
      last_text_message: lastMessage && lastMessage.kind !== "image"
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
              last_text_message: message.kind !== "image"
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
      const res = await fetch(`/api/chat/rooms/${roomId}/messages`);
      const json = await res.json();
      if (res.ok && json.data) {
        const nextMessages = (json.data as ChatMessageApiItem[]).map(mapChatMessage);
        writeMessageCache(roomId, nextMessages);
        if (activeChatRoomRef.current === roomId) {
          setMessages(nextMessages);
        }
      }
      if (activeChatRoomRef.current === roomId) {
        setChatLoading(false);
      }
    })();

    if (!hasCachedMessages) setChatLoading(true);
  }

  function closeChat() {
    activeChatRoomRef.current = null;
    setChatOpen(false);
    setMemberDrawerOpen(false);
    setTimeout(() => {
      setSelectedRoomId(null);
      setMessages([]);
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

  function startLongPress(msgId: string, isMine: boolean) {
    if (!isMine) return;
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

  return (
    <div className="max-w-xl mx-auto bg-white flex flex-col" style={{ height: "calc(100vh - 126px)" }}>
      <ConversationList
        activeMenuTab={activeMenuTab}
        conversations={conversations}
        isSpinning={isSpinning}
        loading={loading}
        onlineIds={onlineIds}
        refreshDisabled={refreshDisabled}
        onOpenChat={openChat}
        onOpenProfile={(profileId) => router.push(`/users/${profileId}/view`)}
        onRefresh={() => {
          void fetchConversations({ force: true, manual: true });
        }}
        setActiveMenuTab={setActiveMenuTab}
        formatDate={formatDate}
        truncateMessage={truncateMessage}
      />

      <ChatDrawer
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
        otherUser={otherUser}
        photoInputRef={photoInputRef}
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
        onOpenMemberDrawer={() => setMemberDrawerOpen(true)}
        onPhotoUpload={handlePhotoUpload}
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
