"use client";

import { useEffect, useState, useRef } from "react";
import Image from "next/image";
import { createClient } from "@/lib/supabase/client";
import { ArrowLeft, Send, Paperclip, Image as ImageIcon, FileText, MapPin, CalendarDays, Search, RefreshCw } from "lucide-react";

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
  last_text_message: {
    content: string;
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

interface MyProfile {
  nickname: string;
  profile_image_url: string | null;
}

export default function MessagesPageClient({ userId }: { userId: string }) {
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [loading, setLoading] = useState(true);

  // 대화창 상태
  const [selectedUserId, setSelectedUserId] = useState<string | null>(null);
  const [chatOpen, setChatOpen] = useState(false);
  const [messages, setMessages] = useState<Message[]>([]);
  const [otherUser, setOtherUser] = useState<OtherUser | null>(null);
  const [myProfile, setMyProfile] = useState<MyProfile | null>(null);
  const [chatLoading, setChatLoading] = useState(false);
  const [newMessage, setNewMessage] = useState("");
  const [sending, setSending] = useState(false);
  const [chatMenuOpen, setChatMenuOpen] = useState(false);
  const [attachOpen, setAttachOpen] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [uploadDone, setUploadDone] = useState(false);
  const [refreshDisabled, setRefreshDisabled] = useState(false);
  const [isSpinning, setIsSpinning] = useState(false);
  const photoInputRef = useRef<HTMLInputElement>(null);

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
    if (!selectedUserId) return;

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

      const content = JSON.stringify({ type: "image", thumb: url300, full: url1024 });

      const { data: message, error } = await supabase
        .from("messages")
        .insert({ sender_id: userId, receiver_id: selectedUserId, content })
        .select()
        .single();

      if (!error && message) {
        setMessages((prev) => [...prev, message]);
        appendMessageCache(selectedUserId, message);
        setAttachOpen(false);
        setUploadDone(true);
        setTimeout(() => setUploadDone(false), 2000);
      }
    } catch (e) {
      console.error("업로드 실패", e);
    } finally {
      setUploading(false);
    }
  }

  const CACHE_KEY = "loco_conversations_cache";
  const MESSAGES_CACHE_PREFIX = "loco_messages_cache_";

  function isImageMessage(content: string) {
    try { return JSON.parse(content)?.type === "image"; } catch { return false; }
  }

  function limitImageMessages(msgs: Message[]) {
    let imageCount = 0;
    return msgs.reduceRight<Message[]>((acc, msg) => {
      if (isImageMessage(msg.content)) {
        if (imageCount < 1) {
          imageCount++;
          try {
            const parsed = JSON.parse(msg.content);
            const { full: _full, ...rest } = parsed;
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

  function warmImageMessages(msgs: Message[]) {
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

  function appendMessageCache(userId: string, message: Message) {
    const cacheKey = `${MESSAGES_CACHE_PREFIX}${userId}`;
    const cached = localStorage.getItem(cacheKey);
    const msgs: Message[] = cached ? JSON.parse(cached) : [];
    localStorage.setItem(cacheKey, JSON.stringify(limitImageMessages([...msgs, message])));
  }


  async function fetchConversations() {
    setRefreshDisabled(true);
    setIsSpinning(true);
    setTimeout(() => setRefreshDisabled(false), 60000);
    setTimeout(() => setIsSpinning(false), 2000);
    try {
      const res = await fetch("/api/conversations");
      const json = await res.json();
      if (json.data) {
        setConversations(json.data);
        localStorage.setItem(CACHE_KEY, JSON.stringify(json.data));
      }
    } catch (error) {
      console.error("Failed to load conversations:", error);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    const cached = localStorage.getItem(CACHE_KEY);

    if (cached) {
      setConversations(JSON.parse(cached));
      setLoading(false);
    } else {
      fetchConversations();
    }
  }, []);

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

  async function openChat(otherId: string) {
    setSelectedUserId(otherId);
    setChatOpen(true);
    setChatLoading(true);
    setMessages([]);
    setOtherUser(null);

    const supabase = createClient();

    const { data: profile } = await supabase
      .from("profiles")
      .select("id, nickname, profile_image_url")
      .eq("id", otherId)
      .single();

    if (profile) setOtherUser(profile);

    const cacheKey = `${MESSAGES_CACHE_PREFIX}${otherId}`;
    const cached = localStorage.getItem(cacheKey);
    if (cached) {
      setMessages(JSON.parse(cached));
    } else {
      const { data: msgs } = await supabase
        .from("messages")
        .select("*")
        .or(`and(sender_id.eq.${userId},receiver_id.eq.${otherId}),and(sender_id.eq.${otherId},receiver_id.eq.${userId})`)
        .order("sent_at", { ascending: true });
      if (msgs) {
        setMessages(msgs);
        localStorage.setItem(cacheKey, JSON.stringify(msgs));
      }
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

    const { data: message, error } = await supabase
      .from("messages")
      .insert({
        sender_id: userId,
        receiver_id: selectedUserId,
        content: newMessage.trim(),
      })
      .select()
      .single();

    if (!error && message) {
      setMessages((prev) => [...prev, message]);
      appendMessageCache(selectedUserId, message);
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

  function truncateMessage(content: string, length: number = 20) {
    return content.length > length ? content.substring(0, length) + "..." : content;
  }

  return (
    <div className="max-w-xl mx-auto bg-white min-h-screen flex flex-col">
      {/* 메시지 목록 */}
      <div className="h-12 flex items-center justify-between px-4 border-b border-gray-100">
        <h1 className="text-lg font-bold text-gray-900">메시지</h1>
        <button
          onClick={fetchConversations}
          disabled={refreshDisabled && !isSpinning}
          className={`p-1 ${refreshDisabled && !isSpinning ? "text-gray-400 cursor-not-allowed" : "text-gray-800 hover:text-gray-900"}`}
        >
          <RefreshCw size={18} className={isSpinning ? "animate-spin" : ""} style={{ animationDuration: "0.8s" }} />
        </button>
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
              className="border-b border-gray-100 hover:bg-gray-50 cursor-pointer transition-colors"
            >
              {(() => {
                const isMine = conv.last_message?.is_mine;
                const lastContent = conv.last_message?.content ?? "";
                let lastImage: { thumb: string } | null = null;
                try {
                  const parsed = JSON.parse(lastContent);
                  if (parsed.type === "image") lastImage = parsed;
                } catch {}

                const avatarUser = isMine
                  ? {
                      nickname: myProfile?.nickname ?? "나",
                      profile_image_url: myProfile?.profile_image_url ?? null,
                    }
                  : conv.other_user;

                const avatar = avatarUser?.profile_image_url ? (
                  <Image
                    src={avatarUser.profile_image_url}
                    alt={avatarUser.nickname}
                    width={40}
                    height={40}
                    className="rounded-full object-cover flex-shrink-0"
                  />
                ) : (
                  <div className="w-10 h-10 rounded-full bg-gray-200 flex items-center justify-center text-gray-500 text-xs font-medium flex-shrink-0">
                    {avatarUser?.nickname?.[0] ?? "?"}
                  </div>
                );
                const displayNickname = conv.other_user?.nickname ?? "알 수 없음";
                return (
                  <div className={`flex items-stretch gap-2 ${isMine ? "" : "flex-row-reverse"}`}>
                    {lastImage && (
                      <div className="flex-shrink-0 w-[80px] flex items-center justify-center">
                        <Image
                          src={lastImage.thumb}
                          alt="사진"
                          width={50}
                          height={50}
                          className="w-[50px] h-[50px] object-cover rounded-[5px]"
                        />
                      </div>
                    )}
                    <div className={`flex-1 px-3 py-3`}>
                      <div className={`flex items-start gap-3 ${isMine ? "flex-row-reverse" : ""}`}>
                        {avatar}
                        <div className={`flex-1 min-w-0 ${isMine ? "text-right" : ""}`}>
                          <div className={`flex items-baseline gap-2 ${isMine ? "flex-row-reverse" : ""}`}>
                            <span className="font-bold text-gray-900" style={{ fontSize: "17px" }}>
                              {displayNickname}
                              {isMine && (
                                <span className="font-normal text-gray-900 ml-1" style={{ fontSize: "15px" }}>
                                  에게
                                </span>
                              )}
                            </span>
                            <span className="text-gray-400 text-xs flex-shrink-0">
                              {conv.last_message?.sent_at ? formatDate(conv.last_message.sent_at) : ""}
                            </span>
                          </div>
                          {conv.last_text_message && (
                            <p className="text-gray-900 line-clamp-1 mt-1" style={{ fontSize: "16px" }}>
                              {truncateMessage(conv.last_text_message.content)}
                            </p>
                          )}
                        </div>
                        {conv.unread_count > 0 && (
                          <div className="w-6 h-6 rounded-full bg-yellow-400 flex items-center justify-center text-white text-xs font-bold flex-shrink-0">
                            {conv.unread_count}
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })()}
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
        <div className="h-[70px] flex items-center justify-between px-4 border-b border-gray-100">
          <button onClick={closeChat} className="p-1 -ml-1 text-gray-600 hover:text-gray-900">
            <ArrowLeft size={20} />
          </button>
          <div className="absolute left-1/2 -translate-x-1/2">
            <span className="font-bold text-gray-900" style={{ fontSize: "18px" }}>{otherUser?.nickname ?? "로딩중..."}</span>
          </div>
          <div className="flex items-center gap-1">
            <button className="p-1 text-gray-600">
              <Search size={20} />
            </button>
            <div className="relative">
            <button onClick={() => setChatMenuOpen((v) => !v)} className="p-1 text-gray-600 hover:text-gray-900">
              <svg xmlns="http://www.w3.org/2000/svg" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <line x1="3" y1="6" x2="21" y2="6" />
                <line x1="3" y1="12" x2="21" y2="12" />
                <line x1="3" y1="18" x2="21" y2="18" />
              </svg>
            </button>
            {chatMenuOpen && (
              <>
                <div className="fixed inset-0 z-[70]" onClick={() => setChatMenuOpen(false)} />
                <div className="absolute right-0 top-full z-[80] bg-white rounded-xl shadow-lg border border-gray-100 overflow-hidden" style={{ width: 180 }}>
                  <button className="flex items-center justify-between w-full px-4 py-3 text-sm text-gray-700">
                    <span>친구 신청</span>
                    <svg xmlns="http://www.w3.org/2000/svg" width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-gray-500">
                      <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><line x1="19" y1="8" x2="19" y2="14"/><line x1="22" y1="11" x2="16" y2="11"/>
                    </svg>
                  </button>
                  <div className="border-t border-gray-100 mx-3" />
                  <button className="flex items-center justify-between w-full px-4 py-3 text-sm text-gray-700">
                    <span>대화 삭제</span>
                    <svg xmlns="http://www.w3.org/2000/svg" width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-gray-500">
                      <polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/><path d="M10 11v6"/><path d="M14 11v6"/><path d="M9 6V4h6v2"/>
                    </svg>
                  </button>
                  <div className="border-t border-gray-100 mx-3" />
                  <button className="flex items-center justify-between w-full px-4 py-3 text-sm text-red-500">
                    <span>차단하기</span>
                    <svg xmlns="http://www.w3.org/2000/svg" width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-red-400">
                      <circle cx="12" cy="12" r="10"/><line x1="4.93" y1="4.93" x2="19.07" y2="19.07"/>
                    </svg>
                  </button>
                </div>
              </>
            )}
            </div>
          </div>
        </div>

        {/* 메시지 목록 */}
        <div className="flex-1 overflow-y-auto px-4 py-4 flex flex-col gap-3" style={{ backgroundColor: "#B2C7D9" }} onClick={() => setAttachOpen(false)}>
          {chatLoading ? (
            <div className="flex items-center justify-center h-full text-gray-600">로딩 중...</div>
          ) : messages.length === 0 ? (
            <div className="flex items-center justify-center h-full text-gray-600 text-sm">
              대화 시작하기
            </div>
          ) : (
            messages.map((msg, idx) => {
              const isMine = msg.sender_id === userId;
              const prevMsg = idx > 0 ? messages[idx - 1] : null;
              const isNewGroup = !prevMsg || prevMsg.sender_id !== msg.sender_id;
              const showSenderName = !isMine && isNewGroup;
              const showMyAvatar = isMine && isNewGroup;
              let imageData: { thumb: string; full: string } | null = null;
              try {
                const parsed = JSON.parse(msg.content);
                if (parsed.type === "image") imageData = parsed;
              } catch {}
              return (
                <div key={msg.id}>
                  {showMyAvatar && (
                    <div className="flex justify-end mb-2">
                      {myProfile?.profile_image_url ? (
                        <Image
                          src={myProfile.profile_image_url}
                          alt={myProfile.nickname ?? "나"}
                          width={35}
                          height={35}
                          className="rounded-full object-cover flex-shrink-0"
                        />
                      ) : (
                        <div className="w-[35px] h-[35px] rounded-full bg-gray-200 flex items-center justify-center text-gray-500 text-xs font-medium flex-shrink-0">
                          {myProfile?.nickname?.[0] ?? "나"}
                        </div>
                      )}
                    </div>
                  )}
                  {showSenderName && (
                    <div className="flex items-center gap-2 mb-2">
                      {otherUser?.profile_image_url ? (
                        <Image
                          src={otherUser.profile_image_url}
                          alt={otherUser.nickname}
                          width={30}
                          height={30}
                          className="rounded-full object-cover flex-shrink-0"
                        />
                      ) : (
                        <div className="w-[30px] h-[30px] rounded-full bg-gray-200 flex items-center justify-center text-gray-500 text-xs font-medium flex-shrink-0">
                          {otherUser?.nickname?.[0] ?? "?"}
                        </div>
                      )}
                      <span className="text-base text-gray-800">{otherUser?.nickname}</span>
                    </div>
                  )}
                  <div className={`flex ${isMine ? "justify-end" : "justify-start"} gap-2 items-end`}>
                    {!isMine && <span className="text-xs text-gray-700 flex-shrink-0 order-2">{formatTime(msg.sent_at)}</span>}
                    <div className={`flex ${isMine ? "flex-col items-end" : ""} gap-1`}>
                      <div
                        className={`rounded-lg text-base overflow-hidden ${
                          imageData ? "" : "px-3 py-2"
                        } ${isMine ? "text-gray-900" : "bg-white text-gray-900"}`}
                        style={{
                          ...(isMine ? { maxWidth: "75%" } : { maxWidth: "270px" }),
                          ...(isMine && !imageData ? { backgroundColor: "#FEE500" } : {}),
                        }}
                      >
                        {imageData ? (
                          <a href={imageData.full} target="_blank" rel="noreferrer">
                            <Image src={imageData.thumb} alt="사진" width={200} height={200} className="rounded-lg object-cover" />
                          </a>
                        ) : (
                          <p className="break-words">{msg.content}</p>
                        )}
                      </div>
                      {isMine && <span className="text-xs text-gray-700">{formatTime(msg.sent_at)}</span>}
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* 입력창 */}
        <div className="border-t border-gray-100 px-3 py-3 flex gap-2 items-center min-h-[70px]">
          <button className="text-gray-500 flex-shrink-0" onClick={() => setAttachOpen((v) => !v)}>
            <Paperclip size={22} strokeWidth={2.5} />
          </button>
          <input
            type="text"
            value={newMessage}
            onChange={(e) => setNewMessage(e.target.value)}
            onKeyPress={(e) => e.key === "Enter" && handleSendMessage()}
            placeholder="메시지 입력..."
            className="flex-1 px-3 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-yellow-400" style={{ fontSize: "16px", color: "#000000cc" }}
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

        {/* 첨부 영역 */}
        <div
          className="overflow-hidden transition-all duration-300 ease-in-out bg-white"
          style={{ height: attachOpen ? "140px" : "0px" }}
        >
          <input
            ref={photoInputRef}
            type="file"
            accept="image/jpeg,image/png,image/gif"
            className="hidden"
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) handlePhotoUpload(file);
              e.target.value = "";
            }}
          />
          <div className="grid grid-cols-4 gap-4 px-6 pt-6 pb-6">
            {[
              { icon: <ImageIcon size={28} strokeWidth={2} />, label: "사진", onClick: () => photoInputRef.current?.click() },
              { icon: <FileText size={28} strokeWidth={2} />, label: "파일", onClick: undefined },
              { icon: <MapPin size={28} strokeWidth={2} />, label: "지도", onClick: undefined },
              { icon: <CalendarDays size={28} strokeWidth={2} />, label: "클래스", onClick: undefined },
            ].map(({ icon, label, onClick }) => (
              <button key={label} onClick={onClick} disabled={uploading} className="flex flex-col items-center gap-2">
                <div className="w-14 h-14 rounded-2xl bg-gray-100 flex items-center justify-center text-gray-600">
                  {icon}
                </div>
                <span className="text-xs text-gray-500">{label}</span>
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
