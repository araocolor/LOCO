"use client";

import { useEffect, useMemo, useState } from "react";
import Avatar from "@/components/ui/Avatar";
import type { ClassWithHost } from "@/components/class/ClassCard";

const SEARCH_CACHE_KEY = "search_social_cache";

interface FriendItem {
  id: string;
  nickname: string;
  profile_image_url: string | null;
  status?: string;
}

interface ClassShareSheetProps {
  open: boolean;
  classData: ClassWithHost;
  onClose: () => void;
  onShared: (count: number) => void;
}

function readCachedFriends() {
  try {
    const raw = localStorage.getItem(SEARCH_CACHE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    const following = Array.isArray(parsed.following) ? parsed.following : [];
    return following.filter((item: FriendItem) => item.status === "friend") as FriendItem[];
  } catch {
    return null;
  }
}

export default function ClassShareSheet({ open, classData, onClose, onShared }: ClassShareSheetProps) {
  const [friends, setFriends] = useState<FriendItem[]>([]);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [message, setMessage] = useState("");
  const [query, setQuery] = useState("");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!open) return;
    queueMicrotask(() => {
      setSelectedIds([]);
      setMessage("");
      setQuery("");
      setError("");
    });

    const cachedFriends = readCachedFriends();
    if (cachedFriends) queueMicrotask(() => setFriends(cachedFriends));

    let cancelled = false;
    async function loadFriends() {
      try {
        const res = await fetch("/api/friends/social");
        if (res.status === 401) return;
        const json = await res.json().catch(() => ({}));
        const following = json.data?.following;
        if (!cancelled && Array.isArray(following)) {
          setFriends(following.filter((item: FriendItem) => item.status === "friend"));
        }
      } catch {}
    }

    void loadFriends();
    return () => {
      cancelled = true;
    };
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, [open]);

  const filteredFriends = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    if (!normalized) return friends;
    return friends.filter((friend) => friend.nickname.toLowerCase().includes(normalized));
  }, [friends, query]);

  const selectedFriends = useMemo(
    () => selectedIds.map((id) => friends.find((friend) => friend.id === id)).filter((friend): friend is FriendItem => Boolean(friend)),
    [friends, selectedIds]
  );

  function toggleFriend(friendId: string) {
    setSelectedIds((prev) => (
      prev.includes(friendId) ? prev.filter((id) => id !== friendId) : [...prev, friendId]
    ));
  }

  async function handleSend() {
    if (selectedIds.length === 0 || sending) return;
    setSending(true);
    setError("");

    try {
      const res = await fetch(`/api/classes/${classData.id}/share`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ target_ids: selectedIds, message: message.trim() }),
      });

      if (res.status === 401) {
        window.location.href = "/login";
        return;
      }

      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(json.error ?? "공유하지 못했습니다.");
        return;
      }

      onShared(json.sent_count ?? selectedIds.length);
      onClose();
    } finally {
      setSending(false);
    }
  }

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[240] flex items-end justify-center">
      <button type="button" className="absolute inset-0 bg-black/40" onClick={onClose} aria-label="공유 닫기" />
      <section className="relative flex h-[50dvh] w-full max-w-[500px] flex-col rounded-t-[24px] bg-white shadow-2xl animate-sheet-slide-up">
        <div className="px-4 pt-4">
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="친구 검색"
            className="h-11 w-full rounded-2xl border border-gray-200 bg-gray-50 px-4 text-sm outline-none focus:border-gray-400"
          />
        </div>

        <div className="min-h-[72px] px-4 py-3">
          {selectedFriends.length > 0 && (
            <div className="flex gap-3 overflow-x-auto">
              {selectedFriends.map((friend) => (
                <button key={friend.id} type="button" onClick={() => toggleFriend(friend.id)} className="flex shrink-0 flex-col items-center gap-1">
                  <Avatar src={friend.profile_image_url} nickname={friend.nickname} size={42} />
                  <span className="max-w-[56px] truncate text-xs text-gray-600">{friend.nickname}</span>
                </button>
              ))}
            </div>
          )}
        </div>

        <div className="border-y border-gray-100 px-4 py-3">
          {filteredFriends.length === 0 ? (
            <p className="py-6 text-center text-sm text-gray-400">공유할 맞팔 친구가 없습니다.</p>
          ) : (
            <div className="flex gap-4 overflow-x-auto">
              {filteredFriends.map((friend) => {
                const selected = selectedIds.includes(friend.id);
                return (
                  <button
                    key={friend.id}
                    type="button"
                    onClick={() => toggleFriend(friend.id)}
                    className="relative flex shrink-0 flex-col items-center gap-1"
                  >
                    <Avatar src={friend.profile_image_url} nickname={friend.nickname} size={50} />
                    {selected && (
                      <span className="absolute right-0 top-0 flex h-5 w-5 items-center justify-center rounded-full bg-green-500 text-xs font-bold text-white">
                        ✓
                      </span>
                    )}
                    <span className="max-w-[64px] truncate text-xs text-gray-700">{friend.nickname}</span>
                  </button>
                );
              })}
            </div>
          )}
        </div>

        <div className="mt-auto px-4 pb-[max(14px,env(safe-area-inset-bottom))] pt-3">
          <input
            value={message}
            onChange={(event) => setMessage(event.target.value)}
            placeholder="메시지 입력"
            className="mb-3 h-11 w-full rounded-2xl border border-gray-200 px-4 text-sm outline-none focus:border-gray-400"
          />
          {error && <p className="mb-2 text-sm text-red-500">{error}</p>}
          <div className="flex gap-2">
            <button type="button" onClick={onClose} className="flex-1 rounded-2xl border border-gray-200 py-3 text-sm font-semibold text-gray-700">
              취소
            </button>
            <button
              type="button"
              onClick={() => void handleSend()}
              disabled={selectedIds.length === 0 || sending}
              className="flex-1 rounded-2xl bg-gray-950 py-3 text-sm font-bold text-white disabled:opacity-40"
            >
              {sending ? "전송 중" : "전송"}
            </button>
          </div>
        </div>
      </section>
    </div>
  );
}
