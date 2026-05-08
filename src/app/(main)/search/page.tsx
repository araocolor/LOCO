"use client";

import { useEffect, useState, useCallback } from "react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { MoreVertical, Plus, Check } from "lucide-react";
import SearchHeader from "@/components/layout/SearchHeader";
import { PRESENCE_EVENT } from "@/components/features/PresenceTracker";

type Tab = "followers" | "online";

interface Follower {
  id: string;
  nickname: string;
  profile_image_url: string | null;
  region: string | null;
}

interface Suggestion {
  id: string;
  nickname: string;
  profile_image_url: string | null;
  region: string | null;
}

function Avatar({ src, nickname, size }: { src: string | null; nickname: string; size: number }) {
  if (src) {
    return (
      <Image
        src={src}
        alt={nickname}
        width={size}
        height={size}
        className="rounded-full object-cover flex-shrink-0"
        style={{ width: size, height: size }}
      />
    );
  }
  return (
    <div
      className="rounded-full bg-gray-200 flex items-center justify-center text-gray-500 font-medium flex-shrink-0"
      style={{ width: size, height: size, fontSize: size * 0.4 }}
    >
      {nickname[0]}
    </div>
  );
}

function CheckModal() {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center pointer-events-none">
      <div className="bg-black/70 rounded-2xl w-20 h-20 flex items-center justify-center animate-fade-in-out">
        <Check size={36} className="text-white" strokeWidth={3} />
      </div>
    </div>
  );
}

export default function SearchPage() {
  const router = useRouter();
  const [followers, setFollowers] = useState<Follower[]>([]);
  const [following, setFollowing] = useState<Follower[]>([]);
  const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
  const [suggestionsLoading, setSuggestionsLoading] = useState(true);
  const [addedIds, setAddedIds] = useState<Set<string>>(new Set());
  const [showCheck, setShowCheck] = useState(false);
  const [activeTab, setActiveTab] = useState<Tab>("followers");
  const [friendSearch, setFriendSearch] = useState("");
  const [onlineIds, setOnlineIds] = useState<Set<string>>(new Set());

  const CACHE_KEY = "search_prefetch_cache";

  const loadFromCache = useCallback(() => {
    try {
      const cached = localStorage.getItem(CACHE_KEY);
      if (cached) {
        const { followers, following } = JSON.parse(cached);
        if (followers) setFollowers(followers);
        if (following) setFollowing(following);
      }
    } catch {}
  }, []);

  const fetchFollowersAndFollowing = useCallback(() => {
    Promise.all([
      fetch("/api/friends/followers").then((r) => r.json()),
      fetch("/api/friends/following").then((r) => r.json()),
    ])
      .then(([f, fw]) => {
        const followers = f.data ?? [];
        const following = fw.data ?? [];
        setFollowers(followers);
        setFollowing(following);
        try {
          localStorage.setItem(CACHE_KEY, JSON.stringify({ followers, following, ts: Date.now() }));
        } catch {}
      })
      .catch(() => {});
  }, []);

  useEffect(() => {
    loadFromCache();
    fetchFollowersAndFollowing();
    // 추천친구는 매번 새로 fetch
    setSuggestionsLoading(true);
    fetch("/api/friends/suggestions")
      .then((r) => r.json())
      .then((json) => { if (json.data) setSuggestions(json.data); })
      .catch(() => {})
      .finally(() => setSuggestionsLoading(false));
  }, [loadFromCache, fetchFollowersAndFollowing]);

  // PresenceTracker에서 브로드캐스트하는 이벤트 수신
  useEffect(() => {
    if (window.__onlineIds) setOnlineIds(window.__onlineIds);
    const handler = (e: Event) => {
      setOnlineIds((e as CustomEvent<Set<string>>).detail);
    };
    window.addEventListener(PRESENCE_EVENT, handler);
    return () => window.removeEventListener(PRESENCE_EVENT, handler);
  }, []);

  function handleAddFriend(id: string) {
    if (addedIds.has(id)) return;
    const added = suggestions.find((s) => s.id === id);

    // 1. 즉시 UI + 캐시 업데이트
    setAddedIds((prev) => new Set(prev).add(id));
    setSuggestions((prev) => prev.filter((s) => s.id !== id));
    if (added) {
      setFollowing((prev) => {
        const updated = [added, ...prev];
        try {
          const cached = localStorage.getItem(CACHE_KEY);
          const parsed = cached ? JSON.parse(cached) : {};
          localStorage.setItem(CACHE_KEY, JSON.stringify({ ...parsed, following: updated, ts: Date.now() }));
        } catch {}
        return updated;
      });
    }
    setShowCheck(true);
    setTimeout(() => setShowCheck(false), 1200);

    // 2. 백그라운드 API 호출, 실패 시 롤백
    fetch("/api/friends", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ target_id: id }),
    }).then((res) => {
      if (!res.ok) throw new Error();
    }).catch(() => {
      // 롤백
      setAddedIds((prev) => { const next = new Set(prev); next.delete(id); return next; });
      if (added) {
        setSuggestions((prev) => [added, ...prev]);
        setFollowing((prev) => {
          const updated = prev.filter((f) => f.id !== id);
          try {
            const cached = localStorage.getItem(CACHE_KEY);
            const parsed = cached ? JSON.parse(cached) : {};
            localStorage.setItem(CACHE_KEY, JSON.stringify({ ...parsed, following: updated, ts: Date.now() }));
          } catch {}
          return updated;
        });
      }
    });
  }

  return (
    <>
      <SearchHeader activeTab={activeTab} onTabChange={setActiveTab} />

      {activeTab === "followers" && (
        <div className="px-4 pt-4 min-h-screen bg-white">
          {suggestionsLoading ? (
            <div className="flex gap-7 overflow-x-auto pb-3 pt-2 mb-6 scrollbar-hide">
              {Array.from({ length: 8 }).map((_, i) => (
                <div key={i} className="flex flex-col items-center gap-1 flex-shrink-0">
                  <div className="w-[60px] h-[60px] rounded-full bg-gray-200 animate-pulse" />
                  <div className="w-10 h-3 rounded bg-gray-200 animate-pulse mt-1" />
                </div>
              ))}
            </div>
          ) : suggestions.length > 0 && (
            <div className="flex gap-7 overflow-x-auto pb-3 pt-2 mb-6 scrollbar-hide">
              {suggestions.map((s) => (
                <div key={s.id} className="flex flex-col items-center gap-1 flex-shrink-0">
                  <div className="relative" style={{ width: 60, height: 60 }}>
                    <button onClick={() => router.push(`/users/${s.id}/view`)}>
                      <Avatar src={s.profile_image_url} nickname={s.nickname} size={60} />
                    </button>
                    <button
                      onClick={() => handleAddFriend(s.id)}
                      className={`absolute -top-1 -right-1 w-5 h-5 rounded-full flex items-center justify-center shadow ${
                        addedIds.has(s.id)
                          ? "bg-gray-400 cursor-default"
                          : "bg-black"
                      }`}
                    >
                      {addedIds.has(s.id)
                        ? <Check size={11} className="text-white" strokeWidth={3} />
                        : <Plus size={11} className="text-white" strokeWidth={3} />
                      }
                    </button>
                  </div>
                  <span className="text-gray-700 w-[55px] truncate text-center" style={{ fontSize: 14 }}>{s.nickname}</span>
                </div>
              ))}
            </div>
          )}

          {/* 친구들 리스트 */}
          <div className="border-t border-gray-100 pt-3">
            <div className="flex items-center mb-3">
              <p className="text-base font-bold text-gray-400">친구들</p>
              <div className="flex-1 flex justify-center">
                <div className="relative" style={{ width: 200 }}>
                  <input
                    type="text"
                    placeholder="아이디로 검색"
                    value={friendSearch}
                    onChange={(e) => setFriendSearch(e.target.value)}
                    className="w-full h-8 pl-3 pr-8 border border-gray-200 rounded-full bg-gray-50 focus:outline-none focus:border-gray-400"
                    style={{ fontSize: 15 }}
                  />
                  {friendSearch && (
                    <button
                      onClick={() => setFriendSearch("")}
                      className="absolute right-2 top-1/2 -translate-y-1/2 w-4 h-4 rounded-full bg-gray-300 flex items-center justify-center"
                    >
                      <span className="text-white text-[10px] leading-none font-bold">×</span>
                    </button>
                  )}
                </div>
              </div>
            </div>
            {following.length === 0 ? (
              <p className="text-sm text-gray-400">아직 친구가 없어요</p>
            ) : (
              <div className="flex flex-col">
                {following.filter((f) =>
                  friendSearch === "" || f.nickname.toLowerCase().includes(friendSearch.toLowerCase())
                ).map((f) => (
                  <div key={f.id} className="flex items-center gap-3 py-3 border-b border-gray-50">
                    <button onClick={() => router.push(`/users/${f.id}/view`)}>
                      <div className="relative">
                        <Avatar src={f.profile_image_url} nickname={f.nickname} size={44} />
                        {onlineIds.has(f.id) && (
                          <span className="absolute bottom-0 right-0 w-3 h-3 bg-green-400 rounded-full border-2 border-white" />
                        )}
                      </div>
                    </button>
                    <button
                      className="flex-1 text-left min-w-0"
                      onClick={() => router.push(`/users/${f.id}/view`)}
                    >
                      <p className="font-semibold text-gray-900 truncate" style={{ fontSize: 16 }}>{f.nickname}</p>
                      <p className="text-xs text-gray-400 truncate">{f.region ?? "지역 미설정"}</p>
                    </button>
                    <button className="p-1 text-gray-400 hover:text-gray-700 flex-shrink-0">
                      <MoreVertical size={18} />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {activeTab === "online" && (
        <div className="px-4 pt-4 min-h-screen bg-white">
          <div className="border-t border-gray-100 pt-3">
            <div className="flex items-center mb-3">
              <p className="text-base font-bold text-gray-400">팔로워</p>
            </div>
            {followers.length === 0 ? (
              <p className="text-sm text-gray-400">아직 팔로워가 없어요</p>
            ) : (
              <div className="flex flex-col">
                {followers.map((f) => (
                  <div key={f.id} className="flex items-center gap-3 py-3 border-b border-gray-50">
                    <button onClick={() => router.push(`/users/${f.id}/view`)}>
                      <Avatar src={f.profile_image_url} nickname={f.nickname} size={44} />
                    </button>
                    <button
                      className="flex-1 text-left min-w-0"
                      onClick={() => router.push(`/users/${f.id}/view`)}
                    >
                      <p className="font-semibold text-gray-900 truncate" style={{ fontSize: 16 }}>{f.nickname}</p>
                      <p className="text-xs text-gray-400 truncate">{f.region ?? "지역 미설정"}</p>
                    </button>
                    <button className="p-1 text-gray-400 hover:text-gray-700 flex-shrink-0">
                      <MoreVertical size={18} />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {showCheck && <CheckModal />}
    </>
  );
}
