"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import { createClient } from "@/lib/supabase/client";
import { ArrowLeft, Send } from "lucide-react";

interface Conversation {
  id: string;
  other_user: {
    id: string;
    nickname: string;
    profile_image_url: string | null;
  } | null;
  last_message: {
    content: string;
    sent_at: string;
    is_mine: boolean;
  } | null;
  unread_count: number;
  updated_at: string;
}

interface Message {
  id: string;
  sender_id: string;
  receiver_id: string;
  content: string;
  sent_at: string;
  read_at: string | null;
}

interface OtherUser {
  id: string;
  nickname: string;
  profile_image_url: string | null;
}

export default function MessagesPage() {
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [loading, setLoading] = useState(true);

  // 대화창 상태
  const [selectedUserId, setSelectedUserId] = useState<string | null>(null);
  const [chatOpen, setChatOpen] = useState(false);
  const [messages, setMessages] = useState<Message[]>([]);
  const [otherUser, setOtherUser] = useState<OtherUser | null>(null);
  const [chatLoading, setChatLoading] = useState(false);
  const [newMessage, setNewMessage] = useState("");
  const [sending, setSending] = useState(false);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);

  useEffect(() => {
    async function loadConversations() {
      try {
        const res = await fetch("/api/conversations");
        const json = await res.json();
        if (json.data) {
          setConversations(json.data);
        }
      } catch (error) {
        console.error("Failed to load conversations:", error);
      } finally {
        setLoading(false);
      }
    }

    async function loadCurrentUser() {
      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (user) setCurrentUserId(user.id);
    }

    loadConversations();
    loadCurrentUser();
  }, []);

  async function openChat(userId: string) {
    setSelectedUserId(userId);
    setChatOpen(true);
    setChatLoading(true);
    setMessages([]);
    setOtherUser(null);

    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();
    const myId = user?.id;

    const { data: profile } = await supabase
      .from("profiles")
      .select("id, nickname, profile_image_url")
      .eq("id", userId)
      .single();

    if (profile) setOtherUser(profile);

    if (myId) {
      const { data: msgs } = await supabase
        .from("messages")
        .select("*")
        .or(`and(sender_id.eq.${myId},receiver_id.eq.${userId}),and(sender_id.eq.${userId},receiver_id.eq.${myId})`)
        .order("sent_at", { ascending: true });

      if (msgs) setMessages(msgs);
    }

    setChatLoading(false);
  }

  function closeChat() {
    setChatOpen(false);
    setTimeout(() => {
      setSelectedUserId(null);
      setMessages([]);
      setOtherUser(null);
    }, 300);
  }

  async function handleSendMessage() {
    if (!newMessage.trim() || !selectedUserId) return;

    setSending(true);
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) { setSending(false); return; }

    const { data: message, error } = await supabase
      .from("messages")
      .insert({
        sender_id: user.id,
        receiver_id: selectedUserId,
        content: newMessage.trim(),
      })
      .select()
      .single();

    if (!error && message) {
      setMessages((prev) => [...prev, message]);
      setNewMessage("");
    }

    setSending(false);
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

  function truncateMessage(content: string, length: number = 15) {
    return content.length > length ? content.substring(0, length) + "..." : content;
  }

  return (
    <div className="max-w-xl mx-auto bg-white min-h-screen flex flex-col">
      {/* 메시지 목록 */}
      <div className="h-12 flex items-center px-4 border-b border-gray-100">
        <h1 className="text-lg font-bold text-gray-900">메시지</h1>
      </div>

      <div className="flex-1 overflow-y-auto">
        {loading ? (
          <div className="flex items-center justify-center h-32 text-gray-400">로딩 중...</div>
        ) : conversations.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-32 text-gray-400">
            <p className="text-4xl mb-2">💬</p>
            <p className="text-sm">대화가 없습니다</p>
          </div>
        ) : (
          conversations.map((conv) => (
            <div
              key={conv.id}
              onClick={() => conv.other_user && openChat(conv.other_user.id)}
              className="px-3 py-3 border-b border-gray-100 hover:bg-gray-50 cursor-pointer transition-colors"
            >
              <div className="flex items-start gap-3">
                {conv.other_user?.profile_image_url ? (
                  <Image
                    src={conv.other_user.profile_image_url}
                    alt={conv.other_user.nickname}
                    width={40}
                    height={40}
                    className="rounded-full object-cover flex-shrink-0"
                  />
                ) : (
                  <div className="w-10 h-10 rounded-full bg-gray-200 flex items-center justify-center text-gray-500 text-xs font-medium flex-shrink-0">
                    {conv.other_user?.nickname?.[0] ?? "?"}
                  </div>
                )}
                <div className="flex-1 min-w-0">
                  <div className="flex items-baseline justify-between gap-2">
                    <span className="font-semibold text-gray-900 text-sm">
                      {conv.other_user?.nickname ?? "알 수 없음"}
                    </span>
                    <span className="text-gray-400 text-xs flex-shrink-0">
                      {conv.last_message?.sent_at ? formatDate(conv.last_message.sent_at) : ""}
                    </span>
                  </div>
                  <p className="text-gray-600 text-sm line-clamp-1 mt-1">
                    {conv.last_message?.is_mine && <span className="text-gray-400">나: </span>}
                    {truncateMessage(conv.last_message?.content ?? "")}
                  </p>
                </div>
                {conv.unread_count > 0 && (
                  <div className="w-6 h-6 rounded-full bg-yellow-400 flex items-center justify-center text-white text-xs font-bold flex-shrink-0">
                    {conv.unread_count}
                  </div>
                )}
              </div>
            </div>
          ))
        )}
      </div>

      <div className="h-12 border-t border-gray-100" />

      {/* 대화창 슬라이드 오버레이 */}
      <div
        className={`fixed inset-0 z-[60] bg-white flex flex-col transition-transform duration-300 ease-in-out ${
          chatOpen ? "translate-x-0" : "translate-x-full"
        }`}
      >
        {/* 대화창 헤더 */}
        <div className="h-12 flex items-center gap-3 px-4 border-b border-gray-100">
          <button onClick={closeChat} className="p-1 -ml-1 text-gray-600 hover:text-gray-900">
            <ArrowLeft size={20} />
          </button>
          {otherUser?.profile_image_url ? (
            <Image
              src={otherUser.profile_image_url}
              alt={otherUser.nickname}
              width={32}
              height={32}
              className="rounded-full object-cover"
            />
          ) : (
            <div className="w-8 h-8 rounded-full bg-gray-200 flex items-center justify-center text-gray-500 text-xs font-medium">
              {otherUser?.nickname?.[0] ?? "?"}
            </div>
          )}
          <span className="font-semibold text-gray-900">{otherUser?.nickname ?? "로딩중..."}</span>
        </div>

        {/* 메시지 목록 */}
        <div className="flex-1 overflow-y-auto px-4 py-4 flex flex-col gap-3">
          {chatLoading ? (
            <div className="flex items-center justify-center h-full text-gray-400">로딩 중...</div>
          ) : messages.length === 0 ? (
            <div className="flex items-center justify-center h-full text-gray-400 text-sm">
              대화 시작하기
            </div>
          ) : (
            messages.map((msg) => {
              const isMine = msg.sender_id === currentUserId;
              return (
                <div key={msg.id} className={`flex ${isMine ? "justify-end" : "justify-start"}`}>
                  <div
                    className={`max-w-xs px-3 py-2 rounded-lg text-sm ${
                      isMine ? "bg-yellow-400 text-gray-900" : "bg-gray-100 text-gray-900"
                    }`}
                  >
                    <p className="break-words">{msg.content}</p>
                    <span className="text-xs text-gray-500 mt-1 block">{formatTime(msg.sent_at)}</span>
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* 입력창 */}
        <div className="border-t border-gray-100 px-3 py-3 flex gap-2 min-h-[70px] items-center">
          <input
            type="text"
            value={newMessage}
            onChange={(e) => setNewMessage(e.target.value)}
            onKeyPress={(e) => e.key === "Enter" && handleSendMessage()}
            placeholder="메시지 입력..."
            className="flex-1 px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-yellow-400"
            disabled={sending}
          />
          <button
            onClick={handleSendMessage}
            disabled={!newMessage.trim() || sending}
            className="px-3 py-2 bg-yellow-400 text-gray-900 rounded-lg hover:bg-yellow-500 disabled:opacity-50"
          >
            <Send size={16} />
          </button>
        </div>
      </div>
    </div>
  );
}
