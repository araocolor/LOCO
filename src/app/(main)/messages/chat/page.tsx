"use client";

import { useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import Image from "next/image";
import { createClient } from "@/lib/supabase/client";

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

export default function ChatPage() {
  const searchParams = useSearchParams();
  const userId = searchParams.get("userId");

  const [messages, setMessages] = useState<Message[]>([]);
  const [otherUser, setOtherUser] = useState<OtherUser | null>(null);
  const [newMessage, setNewMessage] = useState("");
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);

  useEffect(() => {
    if (!userId) return;

    const supabase = createClient();
    let currentUserId: string | null = null;

    async function loadData() {
      const { data: { user } } = await supabase.auth.getUser();
      currentUserId = user?.id ?? null;

      // 상대방 프로필 조회
      const { data: profile } = await supabase
        .from("profiles")
        .select("id, nickname, profile_image_url")
        .eq("id", userId)
        .single();

      if (profile) {
        setOtherUser(profile);
      }

      // 메시지 조회
      const { data: msgs } = await supabase
        .from("messages")
        .select("*")
        .or(`and(sender_id.eq.${currentUserId},receiver_id.eq.${userId}),and(sender_id.eq.${userId},receiver_id.eq.${currentUserId})`)
        .order("sent_at", { ascending: true });

      if (msgs) {
        setMessages(msgs);
      }

      setLoading(false);
    }

    loadData().then(() => {
      const channel = supabase
        .channel(`chat-${userId}`)
        .on(
          "postgres_changes",
          {
            event: "INSERT",
            schema: "public",
            table: "messages",
          },
          (payload) => {
            const newMsg = payload.new as Message;
            const isRelevant =
              (newMsg.sender_id === userId && newMsg.receiver_id === currentUserId) ||
              (newMsg.sender_id === currentUserId && newMsg.receiver_id === userId);
            if (isRelevant) {
              setMessages((prev) => [...prev, newMsg]);
            }
          }
        )
        .subscribe();

      return () => { supabase.removeChannel(channel); };
    });
  }, [userId]);

  async function handleSendMessage() {
    if (!newMessage.trim() || !userId) return;

    setSending(true);
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      setSending(false);
      return;
    }

    const { data: message, error } = await supabase
      .from("messages")
      .insert({
        sender_id: user.id,
        receiver_id: userId,
        content: newMessage.trim(),
      })
      .select()
      .single();

    if (!error && message) {
      setMessages([...messages, message]);
      setNewMessage("");
    }

    setSending(false);
  }

  function formatTime(dateStr: string) {
    const d = new Date(dateStr);
    const hh = d.getHours().toString().padStart(2, "0");
    const mm = d.getMinutes().toString().padStart(2, "0");
    return `${hh}:${mm}`;
  }

  if (!userId) {
    return (
      <div className="flex items-center justify-center h-screen text-gray-400">
        대화를 선택해주세요
      </div>
    );
  }

  return (
    <div className="max-w-xl mx-auto bg-white h-screen flex flex-col">
      {/* 헤더 */}
      <div className="h-12 flex items-center gap-3 px-4 border-b border-gray-100">
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
            {otherUser?.nickname?.[0]}
          </div>
        )}
        <span className="font-semibold text-gray-900">{otherUser?.nickname ?? "로딩중..."}</span>
      </div>

      {/* 메시지 목록 */}
      <div className="flex-1 overflow-y-auto px-4 py-4 flex flex-col gap-3">
        {loading ? (
          <div className="flex items-center justify-center h-full text-gray-400">
            로딩 중...
          </div>
        ) : messages.length === 0 ? (
          <div className="flex items-center justify-center h-full text-gray-400 text-sm">
            대화 시작하기
          </div>
        ) : (
          messages.map((msg) => (
            <div
              key={msg.id}
              className={`flex ${msg.sender_id === (userId || "") ? "justify-start" : "justify-end"}`}
            >
              <div
                className={`max-w-xs px-3 py-2 rounded-lg text-sm ${
                  msg.sender_id === (userId || "")
                    ? "bg-gray-100 text-gray-900"
                    : "bg-yellow-400 text-gray-900"
                }`}
              >
                <p className="break-words">{msg.content}</p>
                <span className="text-xs text-gray-500 mt-1 block">
                  {formatTime(msg.sent_at)}
                </span>
              </div>
            </div>
          ))
        )}
      </div>

      {/* 입력창 */}
      <div className="border-t border-gray-100 px-3 py-3 flex gap-2">
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
          className="px-4 py-2 bg-yellow-400 text-gray-900 font-semibold rounded-lg hover:bg-yellow-500 disabled:opacity-50 text-sm"
        >
          {sending ? "..." : "전송"}
        </button>
      </div>
    </div>
  );
}
