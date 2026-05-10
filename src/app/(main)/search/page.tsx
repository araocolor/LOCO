"use client";

import { useEffect, useMemo, useState, useCallback, useSyncExternalStore } from "react";
import Avatar from "@/components/ui/Avatar";
import { useRouter } from "next/navigation";
import { MoreVertical, Plus, Check, UserMinus, MessageCircle, Ban, UserCircle } from "lucide-react";
import SearchHeader from "@/components/layout/SearchHeader";
import { PRESENCE_EVENT } from "@/components/features/PresenceTracker";

type Tab = "friends" | "follower" | "pending";

interface Follower {
  id: string;
  nickname: string;
  profile_image_url: string | null;
  region: string | null;
  status?: "approved" | "friend";
}

interface Suggestion {
  id: string;
  nickname: string;
  profile_image_url: string | null;
  region: string | null;
}

interface PendingMember {
  id: string;
  nickname: string;
  profile_image_url: string | null;
  region: string | null;
  state: "hidden" | "blocked" | "black";
  updated_at: string;
}

const SEARCH_CACHE_KEY = "search_prefetch_cache";
const PENDING_CACHE_KEY = "search_pending_members_cache_v2";
const MYPAGE_CACHE_KEY = "loco_mypage_cache_local_v2";
const SEARCH_TAB_CHANGE_EVENT = "loco-search-tab-change";

function getSearchTab(): Tab {
  if (typeof window === "undefined") return "friends";
  const tab = new URLSearchParams(window.location.search).get("tab");
  if (tab === "follower") return "follower";
  if (tab === "pending") return "pending";
  return "friends";
}

function subscribeSearchTab(onStoreChange: () => void) {
  window.addEventListener("popstate", onStoreChange);
  window.addEventListener(SEARCH_TAB_CHANGE_EVENT, onStoreChange);
  return () => {
    window.removeEventListener("popstate", onStoreChange);
    window.removeEventListener(SEARCH_TAB_CHANGE_EVENT, onStoreChange);
  };
}

function replaceSearchTab(tab: Tab) {
  const url = new URL(window.location.href);
  url.searchParams.set("tab", tab);
  window.history.replaceState(null, "", `${url.pathname}${url.search}${url.hash}`);
  window.dispatchEvent(new Event(SEARCH_TAB_CHANGE_EVENT));
}

function syncMyPageSocialCounts(followers: Follower[], following: Follower[]) {
  try {
    const raw = localStorage.getItem(MYPAGE_CACHE_KEY);
    if (!raw) return;
    const parsed = JSON.parse(raw);
    localStorage.setItem(
      MYPAGE_CACHE_KEY,
      JSON.stringify({
        ...parsed,
        socialCounts: {
          following: following.length,
          followers: followers.length,
        },
      })
    );
  } catch {}
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
  const [pendingMembers, setPendingMembers] = useState<PendingMember[]>([]);
  const [pendingLoaded, setPendingLoaded] = useState(false);
  const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
  const [suggestionsLoading, setSuggestionsLoading] = useState(true);
  const [addedIds, setAddedIds] = useState<Set<string>>(new Set());
  const [acceptingFollowerIds, setAcceptingFollowerIds] = useState<Set<string>>(new Set());
  const [acceptedFollowerIds, setAcceptedFollowerIds] = useState<Set<string>>(new Set());
  const [acceptedAnimatingIds, setAcceptedAnimatingIds] = useState<Set<string>>(new Set());
  const [showCheck, setShowCheck] = useState(false);
  const activeTab = useSyncExternalStore(subscribeSearchTab, getSearchTab, (): Tab => "friends");
  const [friendSearch, setFriendSearch] = useState("");
  const [onlineIds, setOnlineIds] = useState<Set<string>>(new Set());
  const [menuTarget, setMenuTarget] = useState<{ id: string; nickname: string; x: number; y: number; source: "friends" | "follower" } | null>(null);

  const handleTabChange = useCallback((tab: Tab) => {
    replaceSearchTab(tab);
  }, []);

  const followingStatusById = useMemo(
    () => new Map(following.map((f) => [f.id, f.status])),
    [following]
  );
  const acceptedFriendCount = useMemo(
    () => following.filter((f) => f.status === "friend").length,
    [following]
  );

  const loadFromCache = useCallback(() => {
    try {
      const cached = localStorage.getItem(SEARCH_CACHE_KEY);
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
          localStorage.setItem(SEARCH_CACHE_KEY, JSON.stringify({ followers, following, ts: Date.now() }));
        } catch {}
      })
      .catch(() => {});
  }, []);

  const writePendingCache = useCallback((members: PendingMember[]) => {
    try {
      sessionStorage.setItem(PENDING_CACHE_KEY, JSON.stringify({ members, ts: Date.now() }));
    } catch {}
  }, []);

  const fetchPendingMembers = useCallback(() => {
    fetch("/api/friends/pending")
      .then((r) => r.json())
      .then((json) => {
        const members = json.data ?? [];
        setPendingMembers(members);
        writePendingCache(members);
      })
      .catch(() => {})
      .finally(() => setPendingLoaded(true));
  }, [writePendingCache]);

  useEffect(() => {
    queueMicrotask(() => loadFromCache());
    fetchFollowersAndFollowing();
    const cached = localStorage.getItem("search_suggestions_cache");
    if (cached) {
      try {
        const { suggestions } = JSON.parse(cached);
        if (suggestions) {
          queueMicrotask(() => {
            setSuggestions(suggestions);
            setSuggestionsLoading(false);
          });
          return;
        }
      } catch {}
    }
    queueMicrotask(() => setSuggestionsLoading(true));
    fetch("/api/friends/suggestions")
      .then((r) => r.json())
      .then((json) => { if (json.data) setSuggestions(json.data); })
      .catch(() => {})
      .finally(() => setSuggestionsLoading(false));
  }, [loadFromCache, fetchFollowersAndFollowing]);

  useEffect(() => {
    if (activeTab !== "pending" || pendingLoaded) return;
    try {
      const cached = sessionStorage.getItem(PENDING_CACHE_KEY);
      if (cached) {
        const parsed = JSON.parse(cached);
        const members = parsed?.members;
        if (Array.isArray(members)) {
          queueMicrotask(() => {
            setPendingMembers(members);
            setPendingLoaded(true);
          });
          return;
        }
      }
    } catch {}
    fetchPendingMembers();
  }, [activeTab, pendingLoaded, fetchPendingMembers]);

  // PresenceTracker에서 브로드캐스트하는 이벤트 수신
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

  function refillSuggestionsCache(excludeIds: Set<string>, count: number) {
    fetch(`/api/friends/suggestions?limit=${count}`)
      .then((r) => r.json())
      .then((json) => {
        if (!json.data) return;
        const sc = localStorage.getItem("search_suggestions_cache");
        const existing: Suggestion[] = sc ? (JSON.parse(sc).suggestions ?? []) : [];
        const existingIds = new Set(existing.map((s) => s.id));
        const newItems = (json.data as Suggestion[]).filter((s) => !existingIds.has(s.id) && !excludeIds.has(s.id));
        const merged = [...existing, ...newItems].slice(0, 30);
        localStorage.setItem("search_suggestions_cache", JSON.stringify({ suggestions: merged, ts: Date.now() }));
        setSuggestions((prev) => {
          const prevIds = new Set(prev.map((s) => s.id));
          return [...prev, ...newItems.filter((s) => !prevIds.has(s.id))];
        });
      })
      .catch(() => {});
  }

  function handleAddFriend(id: string) {
    if (addedIds.has(id)) return;
    const added = suggestions.find((s) => s.id === id);

    // 1. 즉시 UI + 캐시 업데이트
    const nextAddedIds = new Set(addedIds).add(id);
    setAddedIds(nextAddedIds);
    setSuggestions((prev) => prev.filter((s) => s.id !== id));
    try {
      const sc = localStorage.getItem("search_suggestions_cache");
      if (sc) {
        const parsed = JSON.parse(sc);
        parsed.suggestions = (parsed.suggestions ?? []).filter((s: { id: string }) => s.id !== id);
        localStorage.setItem("search_suggestions_cache", JSON.stringify(parsed));
      }
    } catch {}

    if (nextAddedIds.size === 10) {
      refillSuggestionsCache(nextAddedIds, 10);
    }
    if (added) {
      setFollowing((prev) => {
        const updated = [added, ...prev];
        try {
          const cached = localStorage.getItem(SEARCH_CACHE_KEY);
          const parsed = cached ? JSON.parse(cached) : {};
          localStorage.setItem(SEARCH_CACHE_KEY, JSON.stringify({ ...parsed, following: updated, ts: Date.now() }));
          syncMyPageSocialCounts(followers, updated);
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
            const cached = localStorage.getItem(SEARCH_CACHE_KEY);
            const parsed = cached ? JSON.parse(cached) : {};
            localStorage.setItem(SEARCH_CACHE_KEY, JSON.stringify({ ...parsed, following: updated, ts: Date.now() }));
            syncMyPageSocialCounts(followers, updated);
          } catch {}
          return updated;
        });
      }
    });
  }

  async function handleAcceptFollower(follower: Follower) {
    if (followingStatusById.get(follower.id) === "friend" || acceptingFollowerIds.has(follower.id)) return;

    setAcceptingFollowerIds((prev) => new Set(prev).add(follower.id));
    setAcceptedAnimatingIds((prev) => new Set(prev).add(follower.id));

    const previousFollowing = following;
    const acceptedFollower = { ...follower, status: "friend" as const };
    const hasFollowing = following.some((item) => item.id === follower.id);
    const nextFollowing = hasFollowing
      ? following.map((item) => item.id === follower.id ? { ...item, status: "friend" as const } : item)
      : [acceptedFollower, ...following];

    setFollowing(nextFollowing);
    try {
      const cached = localStorage.getItem(SEARCH_CACHE_KEY);
      const parsed = cached ? JSON.parse(cached) : {};
      localStorage.setItem(SEARCH_CACHE_KEY, JSON.stringify({ ...parsed, following: nextFollowing, ts: Date.now() }));
      syncMyPageSocialCounts(followers, nextFollowing);
    } catch {}

    let failed = false;
    const animationTimer = window.setTimeout(() => {
      if (failed) return;
      setAcceptedFollowerIds((prev) => new Set(prev).add(follower.id));
      setAcceptedAnimatingIds((prev) => {
        const next = new Set(prev);
        next.delete(follower.id);
        return next;
      });
    }, 1000);

    try {
      const res = await fetch("/api/friends", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ target_id: follower.id }),
      });

      if (!res.ok && res.status !== 409) throw new Error();
      refreshSocialLists();
    } catch {
      failed = true;
      window.clearTimeout(animationTimer);
      setFollowing(previousFollowing);
      setAcceptedFollowerIds((prev) => {
        const next = new Set(prev);
        next.delete(follower.id);
        return next;
      });
      setAcceptedAnimatingIds((prev) => {
        const next = new Set(prev);
        next.delete(follower.id);
        return next;
      });
      try {
        const cached = localStorage.getItem(SEARCH_CACHE_KEY);
        const parsed = cached ? JSON.parse(cached) : {};
        localStorage.setItem(SEARCH_CACHE_KEY, JSON.stringify({ ...parsed, following: previousFollowing, ts: Date.now() }));
        syncMyPageSocialCounts(followers, previousFollowing);
      } catch {}
      alert("신청수락 처리 중 오류가 발생했습니다.");
    } finally {
      setAcceptingFollowerIds((prev) => {
        const next = new Set(prev);
        next.delete(follower.id);
        return next;
      });
    }
  }

  async function handleUnfriend(targetId: string) {
    setMenuTarget(null);
    await fetch("/api/friends", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ target_id: targetId }),
    });
    setFollowing((prev) => {
      const updated = prev.filter((f) => f.id !== targetId);
      try {
        const cached = localStorage.getItem(SEARCH_CACHE_KEY);
        const parsed = cached ? JSON.parse(cached) : {};
        localStorage.setItem(SEARCH_CACHE_KEY, JSON.stringify({ ...parsed, following: updated, ts: Date.now() }));
        syncMyPageSocialCounts(followers, updated);
      } catch {}
      return updated;
    });
  }

  function refreshSocialLists() {
    fetchFollowersAndFollowing();
  }

  function invalidatePendingCache() {
    setPendingLoaded(false);
    try {
      sessionStorage.removeItem(PENDING_CACHE_KEY);
    } catch {}
  }

  async function handleReportUser(targetId: string) {
    setMenuTarget(null);
    try {
      const res = await fetch("/api/black-reports", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ target_id: targetId }),
      });

      if (!res.ok) throw new Error();
      setFollowers((prev) => {
        const updated = prev.filter((f) => f.id !== targetId);
        try {
          const cached = localStorage.getItem(SEARCH_CACHE_KEY);
          const parsed = cached ? JSON.parse(cached) : {};
          localStorage.setItem(SEARCH_CACHE_KEY, JSON.stringify({ ...parsed, followers: updated, ts: Date.now() }));
          syncMyPageSocialCounts(updated, following);
        } catch {}
        return updated;
      });
      refreshSocialLists();
      invalidatePendingCache();
      alert("신고과 완료되었습니다.");
    } catch {
      alert("신고 처리 중 오류가 발생했습니다.");
    }
  }

  async function handleBlockUser(targetId: string) {
    setMenuTarget(null);
    try {
      const res = await fetch("/api/friends/block", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ target_id: targetId }),
      });

      if (!res.ok) throw new Error();

      refreshSocialLists();
      invalidatePendingCache();
      alert("차단이 완료되었습니다.");
    } catch {
      alert("차단 처리 중 오류가 발생했습니다.");
    }
  }

  async function handleHideFriend(targetId: string) {
    setMenuTarget(null);
    try {
      const res = await fetch("/api/friends/hide", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ target_id: targetId }),
      });
      if (!res.ok) throw new Error();
      setFollowing((prev) => prev.filter((f) => f.id !== targetId));
      refreshSocialLists();
      invalidatePendingCache();
      alert("친구가 숨김 처리되었습니다.");
    } catch {
      alert("숨김 처리 중 오류가 발생했습니다.");
    }
  }

  async function handleUnhideFriend(targetId: string) {
    const prevPending = pendingMembers;
    const nextPending = pendingMembers.filter((m) => !(m.id === targetId && m.state === "hidden"));
    setPendingMembers(nextPending);
    writePendingCache(nextPending);

    try {
      const res = await fetch("/api/friends/hide", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ target_id: targetId }),
      });
      if (!res.ok) throw new Error();
      refreshSocialLists();
      alert("숨김이 해제되었습니다.");
    } catch {
      setPendingMembers(prevPending);
      writePendingCache(prevPending);
      alert("숨김해제 처리 중 오류가 발생했습니다.");
    }
  }

  async function handleUnreportUser(targetId: string) {
    const prevPending = pendingMembers;
    const nextPending = pendingMembers.filter((m) => !(m.id === targetId && m.state === "black"));
    setPendingMembers(nextPending);
    writePendingCache(nextPending);

    try {
      const res = await fetch("/api/black-reports", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ target_id: targetId }),
      });
      if (!res.ok) throw new Error();
      refreshSocialLists();
      alert("블랙신고가 해제되었습니다.");
    } catch {
      setPendingMembers(prevPending);
      writePendingCache(prevPending);
      alert("블랙해제 처리 중 오류가 발생했습니다.");
    }
  }

  async function handleUnblockUser(targetId: string) {
    const prevPending = pendingMembers;
    const nextPending = pendingMembers.filter((m) => !(m.id === targetId && m.state === "blocked"));
    setPendingMembers(nextPending);
    writePendingCache(nextPending);

    try {
      const res = await fetch("/api/friends/block", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ target_id: targetId }),
      });
      if (!res.ok) throw new Error();
      refreshSocialLists();
      alert("차단이 해제되었습니다.");
    } catch {
      setPendingMembers(prevPending);
      writePendingCache(prevPending);
      alert("차단해제 처리 중 오류가 발생했습니다.");
    }
  }

  return (
    <>
      <SearchHeader activeTab={activeTab} onTabChange={handleTabChange} />

      {activeTab === "friends" && (
        <div className="px-4 pt-4 bg-white">
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
                      className={`absolute -top-0.5 -right-0.5 w-5 h-5 rounded-full flex items-center justify-center ${
                        addedIds.has(s.id)
                          ? "bg-gray-400 cursor-default"
                          : "bg-yellow-300"
                      }`}
                    >
                      {addedIds.has(s.id)
                        ? <Check size={11} className="text-white" strokeWidth={3} />
                        : <Plus size={15} className="text-black" strokeWidth={3.5} />
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
              <p className="font-bold" style={{ fontSize: 15, color: "#333333" }}>
                친구연결 <span className="font-bold" style={{ fontSize: 15 }}>{acceptedFriendCount}</span><span className="font-normal text-sm">/{following.length}</span>
              </p>
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
                {following
                  .filter((f) => friendSearch === "" || f.nickname.toLowerCase().includes(friendSearch.toLowerCase()))
                  .sort((a, b) => Number(b.status === "friend") - Number(a.status === "friend"))
                  .map((f) => (
                  <div key={f.id} className="flex items-center gap-3 py-3 border-b border-gray-50">
                    <button onClick={() => router.push(`/users/${f.id}/view`)}>
                      <div className="relative">
                        <Avatar
                          src={f.profile_image_url}
                          nickname={f.nickname}
                          size={44}
                          className={f.status === "friend" ? "border-2 border-white shadow-[0_0_0_2px_#ef4444]" : ""}
                        />
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
                    <button
                      className="p-1 text-gray-400 hover:text-gray-700 flex-shrink-0"
                      onClick={(e) => {
                        e.stopPropagation();
                        const r = e.currentTarget.getBoundingClientRect();
                        setMenuTarget({ id: f.id, nickname: f.nickname, x: r.right, y: r.bottom, source: "friends" });
                        fetch(`/api/users/${f.id}/view-summary`)
                          .then((res) => res.json())
                          .then((json) => { sessionStorage.setItem(`user_view_${f.id}`, JSON.stringify(json)); })
                          .catch(() => {});
                      }}
                    >
                      <MoreVertical size={18} />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {activeTab === "follower" && (
        <div className="px-4 pt-4 bg-white">
          <div className="pt-3">
            <div className="flex items-center mb-3">
              <p className="text-base font-bold text-gray-400">팔로워</p>
            </div>
            {followers.length === 0 ? (
              <p className="text-sm text-gray-400">아직 팔로워가 없어요</p>
            ) : (
              <div className="flex flex-col">
                {followers
                  .slice()
                  .sort((a, b) => {
                    const aDone = acceptedFollowerIds.has(a.id) || followingStatusById.get(a.id) === "friend";
                    const bDone = acceptedFollowerIds.has(b.id) || followingStatusById.get(b.id) === "friend";
                    return Number(aDone) - Number(bDone);
                  })
                  .map((f) => {
                  const isAccepted = acceptedFollowerIds.has(f.id);
                  const isAccepting = acceptingFollowerIds.has(f.id);
                  const isFriend = isAccepted || (followingStatusById.get(f.id) === "friend" && !isAccepting);
                  const isAnimating = acceptedAnimatingIds.has(f.id);

                  return (
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
                    <button
                      type="button"
                      disabled={isFriend || isAccepting}
                      className={`px-3 py-1.5 rounded-full text-xs font-semibold flex-shrink-0 ${
                        isFriend
                          ? "bg-gray-100 text-gray-500"
                          : "bg-[#FEE500] text-gray-900"
                      } ${isAnimating ? "animate-friend-accepted" : ""}`}
                      onClick={() => handleAcceptFollower(f)}
                    >
                      {isFriend ? "친구완료" : "신청수락"}
                    </button>
                    <button
                      className="p-1 text-gray-400 hover:text-gray-700 flex-shrink-0"
                      onClick={(e) => { e.stopPropagation(); const r = e.currentTarget.getBoundingClientRect(); setMenuTarget({ id: f.id, nickname: f.nickname, x: r.right, y: r.bottom, source: "follower" }); }}
                    >
                      <MoreVertical size={18} />
                    </button>
                  </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      )}

      {activeTab === "pending" && (
        <div className="px-4 pt-4 bg-white">
          <div className="pt-3">
            <div className="flex items-center mb-3">
              <p className="text-base font-bold text-gray-400">블랙리스트</p>
            </div>
            {pendingMembers.length === 0 ? (
              <p className="text-sm text-gray-400">블랙리스트 회원이 없어요</p>
            ) : (
              <div className="flex flex-col">
                {pendingMembers.map((m) => (
                  <div key={m.id} className="flex items-center gap-3 py-3 border-b border-gray-50">
                    <button onClick={() => router.push(`/users/${m.id}/view`)}>
                      <Avatar src={m.profile_image_url} nickname={m.nickname} size={44} />
                    </button>
                    <button
                      className="flex-1 text-left min-w-0"
                      onClick={() => router.push(`/users/${m.id}/view`)}
                    >
                      <p className="font-semibold text-gray-900 truncate" style={{ fontSize: 16 }}>{m.nickname}</p>
                      <p className="text-xs text-gray-400 truncate">{m.region ?? "지역 미설정"}</p>
                      <p className="text-[11px] text-gray-400 mt-0.5">{new Date(m.updated_at).toLocaleDateString("ko-KR")}</p>
                    </button>
                    <div className="flex items-center gap-1">
                      {m.state === "hidden" && (
                        <button
                          className="px-2 py-1 rounded-full text-[11px] font-semibold bg-blue-50 text-blue-600"
                          onClick={() => handleUnhideFriend(m.id)}
                        >
                          숨김해제
                        </button>
                      )}
                      {m.state === "blocked" && (
                        <button
                          className="px-2 py-1 rounded-full text-[11px] font-semibold bg-red-50 text-red-500"
                          onClick={() => handleUnblockUser(m.id)}
                        >
                          차단해제
                        </button>
                      )}
                      {m.state === "black" && (
                        <button
                          className="px-2 py-1 rounded-full text-[11px] font-semibold bg-gray-100 text-gray-700"
                          onClick={() => handleUnreportUser(m.id)}
                        >
                          블랙해제
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {showCheck && <CheckModal />}

      {menuTarget && (
        <>
          <div className="fixed inset-0 z-[70]" onClick={() => setMenuTarget(null)} />
          <div className="fixed z-[80] bg-white rounded-xl shadow-lg border border-gray-100 overflow-hidden" style={{ width: 180, top: menuTarget.y, left: menuTarget.x - 180 }}>
            <button
              className="flex items-center justify-between w-full px-4 py-3 text-gray-700"
              style={{ fontSize: "16px" }}
              onClick={() => { setMenuTarget(null); router.push(`/users/${menuTarget.id}/view`); }}
            >
              <span>친구 프로필</span>
              <UserCircle size={20} className="text-gray-500" />
            </button>
            <div className="border-t border-gray-100 mx-3" />
            {menuTarget.source === "friends" && (
              <>
                <button
                  className="flex items-center justify-between w-full px-4 py-3 text-gray-700"
                  style={{ fontSize: "16px" }}
                  onClick={() => handleUnfriend(menuTarget.id)}
                >
                  <span>친구 취소</span>
                  <UserMinus size={20} className="text-gray-500" />
                </button>
                <div className="border-t border-gray-100 mx-3" />
                <button
                  className="flex items-center justify-between w-full px-4 py-3 text-gray-700"
                  style={{ fontSize: "16px" }}
                  onClick={() => handleHideFriend(menuTarget.id)}
                >
                  <span>친구 숨김</span>
                  <UserMinus size={20} className="text-gray-500" />
                </button>
                <div className="border-t border-gray-100 mx-3" />
              </>
            )}
            <button
              className="flex items-center justify-between w-full px-4 py-3 text-gray-700"
              style={{ fontSize: "16px" }}
              onClick={() => { setMenuTarget(null); router.push(`/messages?userId=${menuTarget.id}`); }}
            >
              <span>메시지 보내기</span>
              <MessageCircle size={20} className="text-gray-500" />
            </button>
            <div className="border-t border-gray-100 mx-3" />
            <button
              className="flex items-center justify-between w-full px-4 py-3 text-red-500"
              style={{ fontSize: "16px" }}
              onClick={() => handleBlockUser(menuTarget.id)}
            >
              <span>차단하기</span>
              <Ban size={20} className="text-red-400" />
            </button>
            <div className="border-t border-gray-100 mx-3" />
            <button
              className="flex items-center justify-between w-full px-4 py-3 text-gray-700"
              style={{ fontSize: "16px" }}
              onClick={() => handleReportUser(menuTarget.id)}
            >
              <span>블랙신고</span>
              <Ban size={20} className="text-gray-500" />
            </button>
          </div>
        </>
      )}
    </>
  );
}
