"use client";

import { useEffect, useMemo, useState, useCallback, useSyncExternalStore, type CSSProperties } from "react";
import Avatar from "@/components/ui/Avatar";
import { useRouter } from "next/navigation";
import { MoreVertical, Plus, Check, UserMinus, MessageCircle, Ban, UserCircle, Users, Rss } from "lucide-react";
import { RiVerifiedBadgeFill } from "react-icons/ri";
import SearchHeader from "@/components/layout/SearchHeader";
import { PRESENCE_EVENT } from "@/components/features/PresenceTracker";
import { REGIONS } from "@/lib/constants";

type Tab = "friends" | "my-region" | "follower" | "pending";
type MenuRelation = "mutual" | "following" | "follower" | "none";

interface Follower {
  id: string;
  nickname: string;
  profile_image_url: string | null;
  country: string | null;
  region: string | null;
  member_type?: string[];
  role?: "member" | "pro" | "admin";
  status?: "pending" | "approved" | "friend";
  is_greyed?: boolean;
  is_hidden?: boolean;
  is_blocked?: boolean;
  friend_accepted_at?: string | null;
  joined_at?: string | null;
  relation_updated_at?: string | null;
}

interface MenuTarget {
  id: string;
  nickname: string;
  status?: "pending" | "approved" | "friend";
  relation: MenuRelation;
  x: number;
  y: number;
  placement: "top" | "bottom";
  member: Follower;
  isHidden?: boolean;
}

interface Suggestion {
  id: string;
  nickname: string;
  profile_image_url: string | null;
  country: string | null;
  region: string | null;
}

interface PendingMember {
  id: string;
  nickname: string;
  profile_image_url: string | null;
  country: string | null;
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
  if (tab === "subscription") return "friends";
  if (tab === "my-region") return "my-region";
  if (tab === "follower") return "follower";
  if (tab === "pending") return "pending";
  return "friends";
}

function formatCompactDate(value?: string | null) {
  const date = value ? new Date(value) : new Date();
  if (Number.isNaN(date.getTime())) return "";
  return `${String(date.getFullYear()).slice(-2)}/${String(date.getMonth() + 1).padStart(2, "0")}/${String(date.getDate()).padStart(2, "0")}`;
}

function getMemberTypeLabel(type: string) {
  return type === "인스트럭터" ? "강사" : type;
}

function getAvatarFloatStyle(id: string): CSSProperties {
  let hash = 0;
  for (let i = 0; i < id.length; i += 1) {
    hash = (hash * 31 + id.charCodeAt(i)) >>> 0;
  }

  const duration = 1.6 + (hash % 11) * 0.1;
  const delay = -((hash >> 3) % 18) * 0.12;

  return {
    animationDuration: `${duration.toFixed(2)}s`,
    animationDelay: `${delay.toFixed(2)}s`,
  };
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
    const followingCount = following.filter((f) => f.status === "approved").length;
    const followersCount = followers.filter((f) => f.status === "approved").length;
    const friendsCount = following.filter((f) => f.status === "friend").length;
    localStorage.setItem(
      MYPAGE_CACHE_KEY,
      JSON.stringify({
        ...parsed,
        socialCounts: {
          following: followingCount,
          followers: followersCount,
          friends: friendsCount,
        },
      })
    );
  } catch {}
}

function sortFollowersOnce(followers: Follower[], following: Follower[]) {
  const followingStatusById = new Map(following.map((f) => [f.id, f.status]));
  return followers
    .slice()
    .sort((a, b) =>
      Number(followingStatusById.get(a.id) === "friend") - Number(followingStatusById.get(b.id) === "friend")
    );
}

function CheckModal() {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center pointer-events-none">
      <div className="bg-yellow-400 rounded-full w-20 h-20 flex items-center justify-center animate-fade-in-out">
        <Check size={36} className="text-black" strokeWidth={3} />
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
  const [myRegionSuggestions, setMyRegionSuggestions] = useState<Suggestion[]>([]);
  const [myRegionSuggestionsLoading, setMyRegionSuggestionsLoading] = useState(false);
  const [addedIds, setAddedIds] = useState<Set<string>>(new Set());
  const [acceptingFollowerIds, setAcceptingFollowerIds] = useState<Set<string>>(new Set());
  const [acceptedFollowerIds, setAcceptedFollowerIds] = useState<Set<string>>(new Set());
  const [acceptedAnimatingIds, setAcceptedAnimatingIds] = useState<Set<string>>(new Set());
  const [showCheck, setShowCheck] = useState(false);
  const activeTab = useSyncExternalStore(subscribeSearchTab, getSearchTab, (): Tab => "friends");
  const [friendSearch, setFriendSearch] = useState("");
  const [showMutualOnly, setShowMutualOnly] = useState(false);
  const [showMyRegionMutualOnly, setShowMyRegionMutualOnly] = useState(false);
  const [onlineIds, setOnlineIds] = useState<Set<string>>(new Set());
  const [menuTarget, setMenuTarget] = useState<MenuTarget | null>(null);
  const [hasBlacklistPin, setHasBlacklistPin] = useState<boolean | null>(null);
  const [isBlacklistUnlocked, setIsBlacklistUnlocked] = useState(false);
  const [blacklistPinInput, setBlacklistPinInput] = useState("");
  const [blacklistPinSubmitting, setBlacklistPinSubmitting] = useState(false);
  const [blacklistPinError, setBlacklistPinError] = useState("");
  const [blacklistPinFailCount, setBlacklistPinFailCount] = useState(0);
  const [showBlackReportToast, setShowBlackReportToast] = useState(false);
  const [friendLinkedNickname, setFriendLinkedNickname] = useState<string | null>(null);
  const [removingPendingIds, setRemovingPendingIds] = useState<Set<string>>(new Set());
  const [profileModal, setProfileModal] = useState<Follower | null>(null);
  const [profileModalData, setProfileModalData] = useState<{ bio: string | null; member_type: string[] } | null>(null);
  const [myRegionMembers, setMyRegionMembers] = useState<Follower[]>([]);
  const [myRegionName, setMyRegionName] = useState<string | null>(null);
  const [myRegionOptions, setMyRegionOptions] = useState<string[]>([]);
  const [selectedRegion, setSelectedRegion] = useState("");
  const [showAllRegionOptions, setShowAllRegionOptions] = useState(false);
  const [myRegionLoaded, setMyRegionLoaded] = useState(false);
  const [myRegionLoading, setMyRegionLoading] = useState(false);

  const handleTabChange = useCallback((tab: Tab) => {
    replaceSearchTab(tab);
  }, []);

  const followingStatusById = useMemo(
    () => new Map(following.map((f) => [f.id, f.status])),
    [following]
  );
  const mutualFollowingCount = useMemo(
    () => following.filter((f) => f.status === "friend").length,
    [following]
  );
  const visibleFollowing = useMemo(
    () => {
      const filtered = following.filter((f) => {
        if (showMutualOnly && f.status !== "friend") return false;
        if (friendSearch === "") return true;
        return f.nickname.toLowerCase().includes(friendSearch.toLowerCase());
      });

      const normal = filtered.filter((f) => !f.is_greyed);
      const greyed = filtered.filter((f) => !!f.is_greyed);
      return [...normal, ...greyed];
    },
    [following, friendSearch, showMutualOnly]
  );
  const followerOnly = useMemo(
    () => followers,
    [followers]
  );
  const friendRelationIds = useMemo(() => {
    const ids = new Set<string>();
    following.forEach((item) => {
      if (item.status === "friend") ids.add(item.id);
    });
    return ids;
  }, [following]);
  const followerById = useMemo(
    () => new Map(followers.map((item) => [item.id, item])),
    [followers]
  );
  const getRelationStatusValue = useCallback((id: string) => {
    return followingStatusById.get(id) === "friend" ? "맞팔" : "아님";
  }, [followingStatusById]);
  const getMenuRelation = useCallback((id: string): MenuRelation => {
    const myStatus = followingStatusById.get(id);
    if (myStatus === "friend") return "mutual";
    if (myStatus === "approved") return "following";
    if (followerById.has(id)) return "follower";
    return "none";
  }, [followingStatusById, followerById]);
  const myRegionMutualCount = useMemo(
    () => myRegionMembers.filter((member) => followingStatusById.get(member.id) === "friend").length,
    [myRegionMembers, followingStatusById]
  );
  const visibleMyRegionMembers = useMemo(() => {
    return myRegionMembers
      .filter((member) => !showMyRegionMutualOnly || followingStatusById.get(member.id) === "friend")
      .slice()
      .sort((a, b) => {
        const getSortGroup = (id: string) => {
          if (followingStatusById.get(id) === "friend") return 0;
          if (followerById.has(id)) return 1;
          return 2;
        };
        const groupDiff = getSortGroup(a.id) - getSortGroup(b.id);
        if (groupDiff !== 0) return groupDiff;
        return (a.nickname ?? "").localeCompare(b.nickname ?? "", "ko");
      });
  }, [myRegionMembers, showMyRegionMutualOnly, followingStatusById, followerById]);
  const myRegionOptionsForSelect = useMemo(() => {
    if (!showAllRegionOptions) return myRegionOptions;
    const merged = [...myRegionOptions];
    for (const region of REGIONS) {
      if (!merged.includes(region)) merged.push(region);
    }
    return merged;
  }, [myRegionOptions, showAllRegionOptions]);
  const loadFromCache = useCallback(() => {
    try {
      const cached = localStorage.getItem(SEARCH_CACHE_KEY);
      if (cached) {
        const { followers, following } = JSON.parse(cached);
        if (followers) setFollowers(Array.isArray(following) ? sortFollowersOnce(followers, following) : followers);
        if (Array.isArray(following)) setFollowing(following);
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
        const sortedFollowers = sortFollowersOnce(followers, following);
        setFollowers(sortedFollowers);
        setFollowing(following);
        try {
          localStorage.setItem(SEARCH_CACHE_KEY, JSON.stringify({ followers: sortedFollowers, following, ts: Date.now() }));
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

  const fetchMyRegionMembers = useCallback((region?: string) => {
    setMyRegionLoading(true);
    const params = new URLSearchParams();
    if (region?.trim()) params.set("region", region.trim());
    const query = params.toString();
    fetch(`/api/users/my-region${query ? `?${query}` : ""}`)
      .then((r) => r.json())
      .then((json) => {
        setMyRegionMembers(json.data ?? []);
        setMyRegionName(json.region ?? null);
        setMyRegionOptions(json.availableRegions ?? []);
        setSelectedRegion((prev) => prev || (json.region ?? ""));
      })
      .catch(() => {
        setMyRegionMembers([]);
        setMyRegionName(null);
        setMyRegionOptions([]);
      })
      .finally(() => {
        setMyRegionLoaded(true);
        setMyRegionLoading(false);
      });
  }, []);

  const fetchMyRegionMeta = useCallback(() => {
    fetch("/api/users/my-region?metaOnly=1")
      .then((r) => r.json())
      .then((json) => {
        setMyRegionName(json.region ?? null);
        setMyRegionOptions(json.availableRegions ?? []);
        setSelectedRegion((prev) => prev || (json.region ?? ""));
      })
      .catch(() => {
        setMyRegionName(null);
        setMyRegionOptions([]);
      });
  }, []);

  useEffect(() => {
    queueMicrotask(() => loadFromCache());
    fetchFollowersAndFollowing();
    fetchMyRegionMeta();
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
  }, [loadFromCache, fetchFollowersAndFollowing, fetchMyRegionMeta]);

  useEffect(() => {
    if (activeTab !== "pending" || !isBlacklistUnlocked || pendingLoaded) return;
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
  }, [activeTab, isBlacklistUnlocked, pendingLoaded, fetchPendingMembers]);

  useEffect(() => {
    if (activeTab !== "pending") {
      queueMicrotask(() => {
        setIsBlacklistUnlocked(false);
        setBlacklistPinInput("");
        setBlacklistPinError("");
      });
      return;
    }

    if (hasBlacklistPin !== null) return;

    fetch("/api/friends/blacklist-pin")
      .then((r) => r.json())
      .then((json) => {
        setHasBlacklistPin(!!json.hasPin);
      })
      .catch(() => {
        setHasBlacklistPin(true);
      });
  }, [activeTab, hasBlacklistPin]);

  useEffect(() => {
    if (activeTab !== "my-region" || myRegionLoaded || myRegionLoading) return;
    queueMicrotask(() => fetchMyRegionMembers());
  }, [activeTab, myRegionLoaded, myRegionLoading, fetchMyRegionMembers]);

  useEffect(() => {
    if (activeTab !== "my-region") return;
    const region = selectedRegion.trim();
    if (!region) {
      setMyRegionSuggestions([]);
      setMyRegionSuggestionsLoading(false);
      return;
    }
    setMyRegionSuggestionsLoading(true);
    fetch(`/api/friends/suggestions?region=${encodeURIComponent(region)}&limit=30`)
      .then((r) => r.json())
      .then((json) => {
        setMyRegionSuggestions(json.data ?? []);
      })
      .catch(() => {
        setMyRegionSuggestions([]);
      })
      .finally(() => setMyRegionSuggestionsLoading(false));
  }, [activeTab, selectedRegion]);

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
      const addedWithStatus: Follower = { ...added, status: "approved" };
      setFollowing((prev) => {
        const updated = [addedWithStatus, ...prev];
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

  function handleAddMyRegionFriend(id: string) {
    if (addedIds.has(id)) return;
    const added = myRegionSuggestions.find((s) => s.id === id);

    const nextAddedIds = new Set(addedIds).add(id);
    setAddedIds(nextAddedIds);
    setMyRegionSuggestions((prev) => prev.filter((s) => s.id !== id));

    if (added) {
      const addedWithStatus: Follower = { ...added, status: "approved" };
      setFollowing((prev) => {
        const updated = [addedWithStatus, ...prev];
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

    fetch("/api/friends", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ target_id: id }),
    }).then((res) => {
      if (!res.ok) throw new Error();
    }).catch(() => {
      setAddedIds((prev) => { const next = new Set(prev); next.delete(id); return next; });
      if (added) {
        setMyRegionSuggestions((prev) => [added, ...prev]);
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

  function handleFollowFromMenu(member: Follower) {
    setMenuTarget(null);
    if (followingStatusById.has(member.id) || addedIds.has(member.id)) return;

    const nextAddedIds = new Set(addedIds).add(member.id);
    const addedWithStatus: Follower = { ...member, status: "approved" };
    setAddedIds(nextAddedIds);
    setFollowing((prev) => {
      const updated = [addedWithStatus, ...prev.filter((item) => item.id !== member.id)];
      try {
        const cached = localStorage.getItem(SEARCH_CACHE_KEY);
        const parsed = cached ? JSON.parse(cached) : {};
        localStorage.setItem(SEARCH_CACHE_KEY, JSON.stringify({ ...parsed, following: updated, ts: Date.now() }));
        syncMyPageSocialCounts(followers, updated);
      } catch {}
      return updated;
    });
    setShowCheck(true);
    setTimeout(() => setShowCheck(false), 1200);

    fetch("/api/friends", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ target_id: member.id }),
    }).then((res) => {
      if (!res.ok) throw new Error();
    }).catch(() => {
      setAddedIds((prev) => {
        const next = new Set(prev);
        next.delete(member.id);
        return next;
      });
      setFollowing((prev) => {
        const updated = prev.filter((item) => item.id !== member.id);
        try {
          const cached = localStorage.getItem(SEARCH_CACHE_KEY);
          const parsed = cached ? JSON.parse(cached) : {};
          localStorage.setItem(SEARCH_CACHE_KEY, JSON.stringify({ ...parsed, following: updated, ts: Date.now() }));
          syncMyPageSocialCounts(followers, updated);
        } catch {}
        return updated;
      });
      alert("팔로잉 처리 중 오류가 발생했습니다.");
    });
  }

  async function handleAcceptFollower(follower: Follower, showFriendLinkedToast = false) {
    if (followingStatusById.get(follower.id) === "friend" || acceptingFollowerIds.has(follower.id)) return;

    setAcceptingFollowerIds((prev) => new Set(prev).add(follower.id));
    setAcceptedAnimatingIds((prev) => new Set(prev).add(follower.id));

    const previousFollowing = following;
    const acceptedFollower = {
      ...follower,
      status: "friend" as const,
      friend_accepted_at: new Date().toISOString(),
    };
    const hasFollowing = following.some((item) => item.id === follower.id);
    const nextFollowing = hasFollowing
      ? following.map((item) => item.id === follower.id ? { ...item, status: "friend" as const, friend_accepted_at: acceptedFollower.friend_accepted_at } : item)
      : [acceptedFollower, ...following];

    const nextFollowers = followers.map((item) =>
      item.id === follower.id
        ? { ...item, status: "friend" as const, friend_accepted_at: acceptedFollower.friend_accepted_at }
        : item
    );
    setFollowers(nextFollowers);
    setFollowing(nextFollowing);
    try {
      const cached = localStorage.getItem(SEARCH_CACHE_KEY);
      const parsed = cached ? JSON.parse(cached) : {};
      localStorage.setItem(SEARCH_CACHE_KEY, JSON.stringify({ ...parsed, followers: nextFollowers, following: nextFollowing, ts: Date.now() }));
      syncMyPageSocialCounts(nextFollowers, nextFollowing);
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
      if (showFriendLinkedToast) {
        setFriendLinkedNickname(follower.nickname);
        setTimeout(() => setFriendLinkedNickname(null), 1500);
      }
    } catch {
      failed = true;
      window.clearTimeout(animationTimer);
      setFollowers(followers);
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
        localStorage.setItem(SEARCH_CACHE_KEY, JSON.stringify({ ...parsed, followers, following: previousFollowing, ts: Date.now() }));
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
      setShowBlackReportToast(true);
      setTimeout(() => setShowBlackReportToast(false), 1500);
    } catch {
      alert("신고 처리 중 오류가 발생했습니다.");
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

      const nextFollowers = followers.filter((member) => member.id !== targetId);
      const nextFollowing = following.filter((member) => member.id !== targetId);
      setFollowers(nextFollowers);
      setFollowing(nextFollowing);
      setMyRegionMembers((prev) =>
        prev.filter((member) => member.id !== targetId)
      );
      try {
        const cached = localStorage.getItem(SEARCH_CACHE_KEY);
        const parsed = cached ? JSON.parse(cached) : {};
        localStorage.setItem(SEARCH_CACHE_KEY, JSON.stringify({ ...parsed, followers: nextFollowers, following: nextFollowing, ts: Date.now() }));
        syncMyPageSocialCounts(nextFollowers, nextFollowing);
      } catch {}
      refreshSocialLists();
      invalidatePendingCache();
      alert("친구숨김이 완료되었습니다.");
    } catch {
      alert("친구숨김 처리 중 오류가 발생했습니다.");
    }
  }

  async function handleUnhideFriendFromMenu(targetId: string) {
    setMenuTarget(null);
    try {
      const res = await fetch("/api/friends/hide", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ target_id: targetId }),
      });

      if (!res.ok) throw new Error();

      setMyRegionMembers((prev) =>
        prev.map((member) => member.id === targetId ? { ...member, is_hidden: false } : member)
      );
      setPendingMembers((prev) => {
        const next = prev.filter((member) => !(member.id === targetId && member.state === "hidden"));
        writePendingCache(next);
        return next;
      });
      refreshSocialLists();
      invalidatePendingCache();
      alert("숨김해제가 완료되었습니다.");
    } catch {
      alert("숨김해제 처리 중 오류가 발생했습니다.");
    }
  }

  async function handleSetFollowingGrey(targetId: string) {
    setMenuTarget(null);
    const prevFollowing = following;
    const nextFollowing = following.map((item) =>
      item.id === targetId ? { ...item, is_greyed: true } : item
    );
    setFollowing(nextFollowing);
    try {
      const cached = localStorage.getItem(SEARCH_CACHE_KEY);
      const parsed = cached ? JSON.parse(cached) : {};
      localStorage.setItem(SEARCH_CACHE_KEY, JSON.stringify({ ...parsed, following: nextFollowing, ts: Date.now() }));
      syncMyPageSocialCounts(followers, nextFollowing);
    } catch {}

    try {
      const res = await fetch("/api/friends/grey", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ target_id: targetId }),
      });
      if (!res.ok) throw new Error();
    } catch {
      setFollowing(prevFollowing);
      try {
        const cached = localStorage.getItem(SEARCH_CACHE_KEY);
        const parsed = cached ? JSON.parse(cached) : {};
        localStorage.setItem(SEARCH_CACHE_KEY, JSON.stringify({ ...parsed, following: prevFollowing, ts: Date.now() }));
        syncMyPageSocialCounts(followers, prevFollowing);
      } catch {}
      alert("알림끄기 처리 중 오류가 발생했습니다.");
    }
  }

  async function handleUnsetFollowingGrey(targetId: string) {
    setMenuTarget(null);
    const prevFollowing = following;
    const nextFollowing = following.map((item) =>
      item.id === targetId ? { ...item, is_greyed: false } : item
    );
    setFollowing(nextFollowing);
    try {
      const cached = localStorage.getItem(SEARCH_CACHE_KEY);
      const parsed = cached ? JSON.parse(cached) : {};
      localStorage.setItem(SEARCH_CACHE_KEY, JSON.stringify({ ...parsed, following: nextFollowing, ts: Date.now() }));
      syncMyPageSocialCounts(followers, nextFollowing);
    } catch {}

    try {
      const res = await fetch("/api/friends/grey", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ target_id: targetId }),
      });
      if (!res.ok) throw new Error();
    } catch {
      setFollowing(prevFollowing);
      try {
        const cached = localStorage.getItem(SEARCH_CACHE_KEY);
        const parsed = cached ? JSON.parse(cached) : {};
        localStorage.setItem(SEARCH_CACHE_KEY, JSON.stringify({ ...parsed, following: prevFollowing, ts: Date.now() }));
        syncMyPageSocialCounts(followers, prevFollowing);
      } catch {}
      alert("알림켜기 처리 중 오류가 발생했습니다.");
    }
  }

  async function playPendingRemoveAnimation(targetId: string) {
    setRemovingPendingIds((prev) => {
      const next = new Set(prev);
      next.add(targetId);
      return next;
    });
    await new Promise((resolve) => setTimeout(resolve, 1000));
  }

  async function handleUnreportUser(targetId: string) {
    await playPendingRemoveAnimation(targetId);
    const prevPending = pendingMembers;
    const nextPending = pendingMembers.filter((m) => !(m.id === targetId && m.state === "black"));
    setPendingMembers(nextPending);
    writePendingCache(nextPending);
    setRemovingPendingIds((prev) => {
      const next = new Set(prev);
      next.delete(targetId);
      return next;
    });

    try {
      const res = await fetch("/api/black-reports", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ target_id: targetId }),
      });
      if (!res.ok) throw new Error();
      refreshSocialLists();
    } catch {
      setPendingMembers(prevPending);
      writePendingCache(prevPending);
      alert("블랙해제 처리 중 오류가 발생했습니다.");
    }
  }

  async function handleUnblockUser(targetId: string) {
    await playPendingRemoveAnimation(targetId);
    const prevPending = pendingMembers;
    const nextPending = pendingMembers.filter((m) => !(m.id === targetId && m.state === "blocked"));
    setPendingMembers(nextPending);
    writePendingCache(nextPending);
    setRemovingPendingIds((prev) => {
      const next = new Set(prev);
      next.delete(targetId);
      return next;
    });

    try {
      const res = await fetch("/api/friends/block", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ target_id: targetId }),
      });
      if (!res.ok) throw new Error();
      refreshSocialLists();
    } catch {
      setPendingMembers(prevPending);
      writePendingCache(prevPending);
      alert("차단해제 처리 중 오류가 발생했습니다.");
    }
  }

  async function handleBlacklistPinSubmit() {
    if (blacklistPinSubmitting) return;
    const pin = blacklistPinInput.trim();

    if (!/^\d{4}$/.test(pin)) {
      setBlacklistPinError("숫자 4자리를 입력해 주세요.");
      return;
    }

    setBlacklistPinSubmitting(true);
    setBlacklistPinError("");

    try {
      if (hasBlacklistPin === false) {
        const res = await fetch("/api/friends/blacklist-pin", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ pin }),
        });

        if (!res.ok) {
          if (res.status === 409) {
            setHasBlacklistPin(true);
            setBlacklistPinError("이미 비밀번호가 설정되어 있어요. 비밀번호를 입력해 주세요.");
            return;
          }
          throw new Error();
        }
        setHasBlacklistPin(true);
        setIsBlacklistUnlocked(true);
        setBlacklistPinInput("");
        return;
      }

      const res = await fetch("/api/friends/blacklist-pin", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ pin }),
      });

      if (!res.ok) {
        if (res.status === 401) {
          const nextFail = blacklistPinFailCount + 1;
          if (nextFail >= 5) {
            try {
              await fetch("/api/friends/blacklist-pin", { method: "DELETE" });
            } catch {}
            setHasBlacklistPin(false);
            setBlacklistPinFailCount(0);
            setBlacklistPinInput("");
            setBlacklistPinError("새 비밀번호 입력하세요 ㅋ");
            return;
          }
          setBlacklistPinFailCount(nextFail);
          setBlacklistPinError(`비밀번호가 맞지 않습니다. (${nextFail}/5)`);
          return;
        }
        if (res.status === 404) {
          setHasBlacklistPin(false);
          setBlacklistPinError("비밀번호를 먼저 설정해 주세요.");
          return;
        }
        throw new Error();
      }

      setIsBlacklistUnlocked(true);
      setBlacklistPinInput("");
      setBlacklistPinFailCount(0);
    } catch {
      setBlacklistPinError("처리 중 오류가 발생했습니다.");
    } finally {
      setBlacklistPinSubmitting(false);
    }
  }

  return (
    <>
      <SearchHeader activeTab={activeTab} onTabChange={handleTabChange} myRegionLabel="지역회원" />

      {activeTab === "friends" && (
        <div className="px-4 pt-0 bg-white">
          <div className={`mb-0 -mx-4 py-3 ${!suggestionsLoading && suggestions.length === 0 ? "bg-white" : "bg-sky-100/70"}`}>
            {suggestionsLoading ? (
              <div className="flex gap-7 overflow-x-auto pb-1 pt-3 scrollbar-hide">
                {Array.from({ length: 8 }).map((_, i) => (
                  <div key={i} className="flex flex-col items-center gap-1 flex-shrink-0">
                    <div className="w-[60px] h-[60px] rounded-full bg-gray-200 animate-pulse" />
                    <div className="w-10 h-3 rounded bg-gray-200 animate-pulse mt-1" />
                  </div>
                ))}
              </div>
            ) : suggestions.length === 0 ? (
              <div className="flex items-center justify-center py-3">
                <p className="text-gray-400 animate-blacklist-avatar" style={{ fontSize: 16 }}>친구추천 목록 없음</p>
              </div>
            ) : (
              <div
                className="overflow-x-auto scrollbar-hide pt-3 pb-1"
                style={{ WebkitOverflowScrolling: "touch", touchAction: "pan-x" }}
              >
                <div className="flex gap-7 w-max">
                  {suggestions.map((s) => (
                    <div key={s.id} className="flex flex-col items-center gap-1 flex-shrink-0">
                      <div className="relative" style={{ width: 60, height: 60 }}>
                        <div className="relative animate-blacklist-avatar" style={getAvatarFloatStyle(s.id)}>
                          <button onClick={() => handleAddFriend(s.id)}>
                            <Avatar src={s.profile_image_url} nickname={s.nickname} size={60} />
                          </button>
                          <button
                            onClick={() => handleAddFriend(s.id)}
                            className={`absolute -top-0.5 -right-0.5 w-6 h-6 rounded-full flex items-center justify-center ${
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
                      </div>
                      <button
                        type="button"
                        onClick={() => router.push(`/users/${s.id}/view`)}
                        className="max-w-[62px] rounded-full bg-gray-400 px-2 py-0.5 text-center text-xs text-gray-100 truncate"
                      >
                        {s.nickname}
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* 친구목록 리스트 */}
          <div className="border-t border-gray-100 pt-0">
            <div className="relative flex items-center mt-3 mb-3">
              <div className="flex items-center gap-1">
                <button
                  type="button"
                  onClick={() => setShowMutualOnly(false)}
                  className={`p-1 flex items-center gap-1 justify-center transition-colors ${
                    showMutualOnly ? "text-gray-400" : "text-gray-900"
                  }`}
                  aria-label="전체 구독 보기"
                  title="전체 구독 보기"
                >
                  <Rss size={17} strokeWidth={2.5} />
                  <span className="font-bold" style={{ fontSize: 15 }}>
                    {following.length}
                  </span>
                </button>
              </div>
              <div className="absolute left-1/2" style={{ transform: "translateX(calc(-50% + 30px))" }}>
                <div className="relative" style={{ width: 150 }}>
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
              <button
                type="button"
                onClick={() => setShowMutualOnly(true)}
                className={`ml-auto p-1 flex items-center gap-1 justify-center transition-colors ${
                  showMutualOnly ? "text-gray-900" : "text-gray-400"
                }`}
                aria-label="맞팔만 보기"
                title="맞팔만 보기"
              >
                <Users size={20} strokeWidth={2.5} />
                <span className="font-bold" style={{ fontSize: 15 }}>
                  {mutualFollowingCount}
                </span>
              </button>
            </div>
            {visibleFollowing.length === 0 ? (
              <p className="text-sm text-gray-400">{showMutualOnly ? "맞팔 회원이 없어요" : "아직 친구목록이 없어요"}</p>
            ) : (
              <div className="flex flex-col">
                {visibleFollowing.map((f) => {
                  const memberTypeLabel = f.member_type?.[0] ? getMemberTypeLabel(f.member_type[0]) : "";
                  const isNotificationOff = !!f.is_greyed;
                  const isFriendFollowing = f.status === "friend" || f.status === "approved";

                  return (
                  <div key={f.id} className={`flex items-center gap-3 py-3 border-b border-gray-50 ${isNotificationOff ? "grayscale" : ""}`}>
                    <button onClick={() => {
                      setProfileModal(f);
                      const cached = sessionStorage.getItem(`user_view_${f.id}`);
                      if (cached) {
                        try {
                          const json = JSON.parse(cached);
                          setProfileModalData({ bio: json.profile?.bio ?? null, member_type: json.profile?.member_type ?? [] });
                        } catch {}
                      } else {
                        fetch(`/api/users/${f.id}/view-summary`)
                          .then((res) => res.json())
                          .then((json) => {
                            sessionStorage.setItem(`user_view_${f.id}`, JSON.stringify(json));
                            setProfileModalData({ bio: json.profile?.bio ?? null, member_type: json.profile?.member_type ?? [] });
                          })
                          .catch(() => {});
                      }
                    }}>
                      <div className="relative">
                        <div
                          className={`relative ${isFriendFollowing ? "animate-blacklist-avatar" : ""} ${isNotificationOff ? "opacity-50" : ""}`}
                          style={isFriendFollowing ? getAvatarFloatStyle(f.id) : undefined}
                        >
                          <Avatar
                            src={f.profile_image_url}
                            nickname={f.nickname}
                            size={44}
                            className="border-2 border-white shadow-[0_0_0_2px_#ef4444]"
                          />
                        </div>
                        {onlineIds.has(f.id) && (
                          <span className="absolute bottom-0 right-0 w-3 h-3 bg-green-400 rounded-full border-2 border-white" />
                        )}
                      </div>
                    </button>
                    <button
                      className="flex-1 text-left min-w-0"
                      onClick={() => {
                        setProfileModal(f);
                        const cached = sessionStorage.getItem(`user_view_${f.id}`);
                        if (cached) {
                          try {
                            const json = JSON.parse(cached);
                            setProfileModalData({ bio: json.profile?.bio ?? null, member_type: json.profile?.member_type ?? [] });
                          } catch {}
                        } else {
                          fetch(`/api/users/${f.id}/view-summary`)
                            .then((res) => res.json())
                            .then((json) => {
                              sessionStorage.setItem(`user_view_${f.id}`, JSON.stringify(json));
                              setProfileModalData({ bio: json.profile?.bio ?? null, member_type: json.profile?.member_type ?? [] });
                            })
                            .catch(() => {});
                        }
                      }}
                    >
                      <p className={`font-semibold text-gray-900 truncate ${isNotificationOff ? "opacity-50" : ""}`} style={{ fontSize: 16 }}>{f.nickname}</p>
                      {(f.country || f.region) && <p className="text-xs text-gray-400 truncate">{[f.country, f.region].filter(Boolean).join(", ")}</p>}
                    </button>
                    {f.member_type?.[0] && (
                      <span className={`text-[16px] flex-shrink-0 inline-flex items-center gap-1 ${isNotificationOff ? "opacity-50" : ""}`} style={{ color: "#000000B3" }}>
                        {memberTypeLabel === "강사" && (
                          <RiVerifiedBadgeFill size={18} color="#FEE500" />
                        )}
                        {memberTypeLabel === "운영진" && (
                          <RiVerifiedBadgeFill size={18} color="#1D9BF0" />
                        )}
                        {memberTypeLabel}
                      </span>
                    )}
                    <button
                      className="p-2 -mr-2 text-gray-400 hover:text-gray-700 flex-shrink-0"
                      onClick={(e) => {
                        e.stopPropagation();
                        const r = e.currentTarget.getBoundingClientRect();
                        const placement = r.top > window.innerHeight / 2 ? "top" : "bottom";
                        setMenuTarget({
                          id: f.id,
                          nickname: f.nickname,
                          status: f.status,
                          relation: getMenuRelation(f.id),
                          x: r.right,
                          y: placement === "top" ? r.top : r.bottom,
                          placement,
                          member: f,
                          isHidden: !!f.is_hidden,
                        });
                        fetch(`/api/users/${f.id}/view-summary`)
                          .then((res) => res.json())
                          .then((json) => { sessionStorage.setItem(`user_view_${f.id}`, JSON.stringify(json)); })
                          .catch(() => {});
                      }}
                    >
                      <MoreVertical size={18} />
                    </button>
                  </div>
                )})}
              </div>
            )}
          </div>
        </div>
      )}

      {activeTab === "my-region" && (
        <div className="px-4 pt-0 bg-white">
          <div className={`mb-0 -mx-4 py-3 ${!myRegionSuggestionsLoading && myRegionSuggestions.length === 0 ? "bg-white" : "bg-sky-100/70"}`}>
            {myRegionSuggestionsLoading ? (
              <div className="flex gap-7 overflow-x-auto pb-1 pt-3 scrollbar-hide">
                {Array.from({ length: 8 }).map((_, i) => (
                  <div key={i} className="flex flex-col items-center gap-1 flex-shrink-0">
                    <div className="w-[60px] h-[60px] rounded-full bg-gray-200 animate-pulse" />
                    <div className="w-10 h-3 rounded bg-gray-200 animate-pulse mt-1" />
                  </div>
                ))}
              </div>
            ) : myRegionSuggestions.length === 0 ? (
              <div className="flex items-center justify-center py-3">
                <p className="text-gray-400 animate-blacklist-avatar" style={{ fontSize: 16 }}>친구추천 목록 없음</p>
              </div>
            ) : (
              <div
                className="overflow-x-auto scrollbar-hide pt-3 pb-1"
                style={{ WebkitOverflowScrolling: "touch", touchAction: "pan-x" }}
              >
                <div className="flex gap-7 w-max">
                  {myRegionSuggestions.map((s) => (
                    <div key={s.id} className="flex flex-col items-center gap-1 flex-shrink-0">
                      <div className="relative" style={{ width: 60, height: 60 }}>
                        <div className="relative animate-blacklist-avatar" style={getAvatarFloatStyle(s.id)}>
                          <button onClick={() => handleAddMyRegionFriend(s.id)}>
                            <Avatar src={s.profile_image_url} nickname={s.nickname} size={60} />
                          </button>
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={() => router.push(`/users/${s.id}/view`)}
                        className="max-w-[62px] rounded-full bg-gray-400 px-2 py-0.5 text-center text-xs text-gray-100 truncate"
                      >
                        {s.nickname}
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          <div className="pt-3">
            <div className="flex items-center mb-3">
              <div className="flex items-center gap-2">
                <select
                  value={selectedRegion}
                  onFocus={() => setShowAllRegionOptions(true)}
                  onChange={(e) => {
                    const nextRegion = e.target.value;
                    setSelectedRegion(nextRegion);
                    fetchMyRegionMembers(nextRegion);
                  }}
                  className="w-auto min-w-[88px] h-8 px-3 border border-gray-200 rounded-full bg-white text-[15px] font-semibold text-gray-700 focus:outline-none focus:border-gray-400"
                >
                  {myRegionOptionsForSelect.map((region) => (
                    <option key={region} value={region}>
                      {region}
                    </option>
                  ))}
                </select>
                <span className="text-base font-bold text-gray-900">{myRegionMembers.length}</span>
              </div>
              <button
                type="button"
                onClick={() => setShowMyRegionMutualOnly((prev) => !prev)}
                className={`ml-auto p-1 flex items-center gap-1 justify-center transition-colors ${
                  showMyRegionMutualOnly ? "text-gray-900" : "text-gray-400"
                }`}
                aria-label="지역 맞팔만 보기"
                title="지역 맞팔만 보기"
              >
                <Users size={20} strokeWidth={2.5} />
                <span className="font-bold" style={{ fontSize: 15 }}>
                  {myRegionMutualCount}
                </span>
              </button>
            </div>

            {myRegionLoading ? (
              <p className="text-sm text-gray-400">불러오는 중...</p>
            ) : !myRegionName ? (
              <p className="text-sm text-gray-400">내 지역 정보가 없어요. 마이페이지에서 지역을 설정해 주세요.</p>
            ) : myRegionMembers.length === 0 ? (
              <p className="text-sm text-gray-400">같은 지역 회원이 아직 없어요</p>
            ) : visibleMyRegionMembers.length === 0 ? (
              <p className="text-sm text-gray-400">맞팔 회원이 없어요</p>
            ) : (
              <div className="flex flex-col">
                {visibleMyRegionMembers.map((m) => {
                  const hasFriendRelation = friendRelationIds.has(m.id);
                  const follower = followerById.get(m.id);
                  const followingRelation = following.find((item) => item.id === m.id);
                  const isNotificationOff = !!followingRelation?.is_greyed;
                  const canShowMutualFollow = !hasFriendRelation && !!follower;
                  const isMutualFollowProcessing = !!follower && acceptingFollowerIds.has(follower.id);

                  return (
                    <div key={m.id} className={`flex items-center gap-3 py-3 border-b border-gray-50 ${isNotificationOff ? "grayscale" : ""}`}>
                      <button onClick={() => {
                        setProfileModal(m);
                        const cached = sessionStorage.getItem(`user_view_${m.id}`);
                        if (cached) {
                          try {
                            const json = JSON.parse(cached);
                            setProfileModalData({ bio: json.profile?.bio ?? null, member_type: json.profile?.member_type ?? [] });
                          } catch {}
                        } else {
                          fetch(`/api/users/${m.id}/view-summary`)
                            .then((res) => res.json())
                            .then((json) => {
                              sessionStorage.setItem(`user_view_${m.id}`, JSON.stringify(json));
                              setProfileModalData({ bio: json.profile?.bio ?? null, member_type: json.profile?.member_type ?? [] });
                            })
                            .catch(() => {});
                        }
                      }}>
                        <div className={`relative ${isNotificationOff ? "opacity-50" : ""}`}>
                          <Avatar src={m.profile_image_url} nickname={m.nickname} size={44} />
                          {onlineIds.has(m.id) && (
                            <span className="absolute bottom-0 right-0 w-3 h-3 bg-green-400 rounded-full border-2 border-white" />
                          )}
                        </div>
                      </button>
                      <button
                        className="flex-1 text-left min-w-0"
                        onClick={() => router.push(`/users/${m.id}/view`)}
                      >
                        <p className={`font-semibold text-gray-900 truncate ${isNotificationOff ? "opacity-50" : ""}`} style={{ fontSize: 16 }}>{m.nickname}</p>
                        {(m.country || m.region) && <p className="text-xs text-gray-400 truncate">{[m.country, m.region].filter(Boolean).join(", ")}</p>}
                      </button>
                      <div className="ml-auto flex items-center gap-2">
                        {canShowMutualFollow ? (
                          <button
                            type="button"
                            disabled={isMutualFollowProcessing}
                            onClick={() => {
                              if (!follower) return;
                              handleAcceptFollower(follower, true);
                            }}
                            className="px-3 py-1.5 rounded-full text-xs font-semibold bg-[#000000CC] text-white disabled:opacity-60"
                          >
                            맞팔로우
                          </button>
                        ) : !hasFriendRelation && (
                          <button
                            type="button"
                            className="px-3 py-1.5 rounded-full text-xs font-semibold bg-[#FEE500] text-gray-900"
                          >
                            팔로잉
                          </button>
                        )}
                        <button
                          type="button"
                          className="p-2 -mr-2 text-gray-400 flex-shrink-0"
                          aria-label="더보기"
                          onClick={(e) => {
                            e.stopPropagation();
                            const r = e.currentTarget.getBoundingClientRect();
                            const placement = r.top > window.innerHeight / 2 ? "top" : "bottom";
                            setMenuTarget({
                              id: m.id,
                              nickname: m.nickname,
                              status: followingRelation?.status,
                              relation: getMenuRelation(m.id),
                              x: r.right,
                              y: placement === "top" ? r.top : r.bottom,
                              placement,
                              member: followingRelation ?? follower ?? m,
                              isHidden: !!m.is_hidden,
                            });
                            fetch(`/api/users/${m.id}/view-summary`)
                              .then((res) => res.json())
                              .then((json) => { sessionStorage.setItem(`user_view_${m.id}`, JSON.stringify(json)); })
                              .catch(() => {});
                          }}
                        >
                          <MoreVertical size={18} />
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      )}

      {activeTab === "follower" && (
        <div className="px-4 pt-4 bg-white">
          <div className="pt-3">
            <div className="flex items-center mb-3">
              <p className="text-base font-bold text-gray-400">
                구독회원 <span className="text-gray-900">{followerOnly.length}</span>
              </p>
            </div>
            {followerOnly.length === 0 ? (
              <p className="text-sm text-gray-400">아직 팔로워가 없어요</p>
            ) : (
              <div className="flex flex-col">
                {followerOnly.map((f) => {
                  const isAccepted = acceptedFollowerIds.has(f.id);
                  const isAccepting = acceptingFollowerIds.has(f.id);
                  const isFriend = isAccepted || (followingStatusById.get(f.id) === "friend" && !isAccepting);
                  const isFriendRequest = f.status === "pending";
                  const canShowMutualFollow = !isFriend;
                  const isAnimating = acceptedAnimatingIds.has(f.id);
                  const myFollowingRelation = following.find((item) => item.id === f.id);
                  const friendDate = formatCompactDate(
                    myFollowingRelation?.friend_accepted_at ??
                    myFollowingRelation?.relation_updated_at ??
                    myFollowingRelation?.joined_at ??
                    f.friend_accepted_at
                  );

                  return (
                  <div key={f.id} className="flex items-center gap-3 py-3 border-b border-gray-50">
                    <button onClick={() => {
                      setProfileModal(f);
                      const cached = sessionStorage.getItem(`user_view_${f.id}`);
                      if (cached) {
                        try {
                          const json = JSON.parse(cached);
                          setProfileModalData({ bio: json.profile?.bio ?? null, member_type: json.profile?.member_type ?? [] });
                        } catch {}
                      } else {
                        fetch(`/api/users/${f.id}/view-summary`)
                          .then((res) => res.json())
                          .then((json) => {
                            sessionStorage.setItem(`user_view_${f.id}`, JSON.stringify(json));
                            setProfileModalData({ bio: json.profile?.bio ?? null, member_type: json.profile?.member_type ?? [] });
                          })
                          .catch(() => {});
                      }
                    }}>
                      <div className="relative">
                        <div className={`relative${isFriendRequest ? " animate-blacklist-avatar" : ""}`} style={isFriendRequest ? getAvatarFloatStyle(f.id) : undefined}>
                          <Avatar src={f.profile_image_url} nickname={f.nickname} size={44} />
                          {isFriendRequest && (
                            <span className="absolute -top-1 -right-1 flex h-5 w-5 items-center justify-center rounded-full bg-white text-sm leading-none shadow-sm">
                              🖐️
                            </span>
                          )}
                        </div>
                      </div>
                    </button>
                    <button
                      className="flex-1 text-left min-w-0"
                      onClick={() => router.push(`/users/${f.id}/view`)}
                    >
                      <p className="font-semibold text-gray-900 truncate" style={{ fontSize: 16 }}>
                        {f.nickname}
                      </p>
                      {(f.country || f.region) && <p className="text-xs text-gray-400 truncate">{[f.country, f.region].filter(Boolean).join(", ")}</p>}
                    </button>
                    <div className="flex items-center gap-2 flex-shrink-0">
                      <button
                        type="button"
                        disabled={isFriend || isAccepting}
                        className={`px-3 py-1.5 rounded-full text-xs font-semibold flex-shrink-0 ${
                          isFriend
                            ? "bg-transparent text-gray-400"
                            : isFriendRequest ? "bg-[#FEE500] text-gray-900" : "bg-[#000000CC] text-white"
                        } ${isAnimating ? "animate-friend-accepted" : ""}`}
                        onClick={() => {
                          if (!canShowMutualFollow) return;
                          handleAcceptFollower(f, true);
                        }}
                      >
                        {isFriend ? friendDate : "맞팔로우"}
                      </button>
                    </div>
                    <button
                      className="p-2 -mr-2 text-gray-400 hover:text-gray-700 flex-shrink-0"
                      onClick={(e) => {
                        e.stopPropagation();
                        const r = e.currentTarget.getBoundingClientRect();
                        const placement = r.top > window.innerHeight / 2 ? "top" : "bottom";
                        setMenuTarget({
                          id: f.id,
                          nickname: f.nickname,
                          status: f.status,
                          relation: getMenuRelation(f.id),
                          x: r.right,
                          y: placement === "top" ? r.top : r.bottom,
                          placement,
                          member: f,
                          isHidden: !!f.is_hidden,
                        });
                      }}
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
          {!isBlacklistUnlocked ? (
            <div className="min-h-[60vh] flex items-center justify-center">
              <div>
                <div className="flex items-center gap-2">
                  <input
                    type="password"
                    inputMode="numeric"
                    maxLength={4}
                    value={blacklistPinInput}
                    onChange={(e) => {
                      setBlacklistPinInput(e.target.value.replace(/\D/g, "").slice(0, 4));
                      if (blacklistPinError) setBlacklistPinError("");
                    }}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") handleBlacklistPinSubmit();
                    }}
                    placeholder="비밀번호 입력"
                    className="w-40 h-10 px-4 border border-gray-300 rounded-full bg-white focus:outline-none focus:border-gray-500 text-center text-[15px] placeholder:text-center placeholder:text-[15px]"
                  />
                  <button
                    type="button"
                    onClick={handleBlacklistPinSubmit}
                    disabled={blacklistPinSubmitting || hasBlacklistPin === null}
                    className="h-10 px-4 rounded-full bg-gray-900 text-white text-sm font-semibold animate-pill-breathe disabled:opacity-60 disabled:animate-none"
                  >
                    {hasBlacklistPin === false ? "설정" : "확인"}
                  </button>
                </div>
                {blacklistPinError && (
                  <p className="mt-2 text-[15px] text-red-500 text-center">{blacklistPinError}</p>
                )}
              </div>
            </div>
          ) : (
            <div className="pt-3">
              <div className="flex items-center mb-3">
                <p className="text-base font-bold text-gray-400">회원관리</p>
              </div>
              {pendingMembers.length === 0 ? null : (
                <div className="flex flex-col">
                  {pendingMembers.map((m) => {
                    const isRemoving = removingPendingIds.has(m.id);
                    return (
                    <div
                      key={m.id}
                      className="flex items-center gap-3 py-3 border-b border-gray-50 relative"
                    >
                      {isRemoving && (
                        <span
                          className="absolute left-[10px] top-0 text-red-500 text-[40px] pointer-events-none z-10 leading-none"
                          style={{ animation: "heartFloatUp 1.4s ease-out forwards" }}
                        >
                          ❤
                        </span>
                      )}
                      <button
                        onClick={() => {
                          setProfileModal({
                            id: m.id,
                            nickname: m.nickname,
                            profile_image_url: m.profile_image_url,
                            country: m.country,
                            region: m.region,
                          });
                          const cached = sessionStorage.getItem(`user_view_${m.id}`);
                          if (cached) {
                            try {
                              const json = JSON.parse(cached);
                              setProfileModalData({ bio: json.profile?.bio ?? null, member_type: json.profile?.member_type ?? [] });
                            } catch {}
                          } else {
                            fetch(`/api/users/${m.id}/view-summary`)
                              .then((res) => res.json())
                              .then((json) => {
                                sessionStorage.setItem(`user_view_${m.id}`, JSON.stringify(json));
                                setProfileModalData({ bio: json.profile?.bio ?? null, member_type: json.profile?.member_type ?? [] });
                              })
                              .catch(() => {});
                          }
                        }}
                      >
                        <div className="animate-blacklist-avatar" style={getAvatarFloatStyle(m.id)}>
                          <Avatar src={m.profile_image_url} nickname={m.nickname} size={44} />
                        </div>
                      </button>
                      <button
                        className="flex-1 text-left min-w-0"
                        onClick={() => router.push(`/users/${m.id}/view`)}
                      >
                        <p className="font-semibold text-gray-900 truncate" style={{ fontSize: 16 }}>{m.nickname}</p>
                        {(m.country || m.region) && <p className="text-xs text-gray-400 truncate">{[m.country, m.region].filter(Boolean).join(", ")}</p>}
                        <p className="text-[11px] text-gray-400 mt-0.5">{new Date(m.updated_at).toLocaleDateString("ko-KR")}</p>
                      </button>
                      <div className="flex items-center gap-1">
                        {m.state === "hidden" && (
                          <button
                            className="px-2 py-1 rounded-full text-[11px] font-semibold bg-blue-50 text-blue-600"
                            onClick={() => handleUnhideFriendFromMenu(m.id)}
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
                    );
                  })}
                </div>
              )}
            </div>
          )}
        </div>
      )}

      <style jsx global>{`
        @keyframes heartFloatUp {
          0% { transform: translateY(0) scale(0.6); opacity: 0; }
          20% { opacity: 1; }
          100% { transform: translateY(-120px) scale(1.2); opacity: 0; }
        }
        @keyframes floatY {
          0%, 100% { transform: translateY(0); }
          50% { transform: translateY(-6px); }
        }
      `}</style>
      {showCheck && <CheckModal />}
      {showBlackReportToast && (
        <div className="fixed inset-0 z-50 flex items-center justify-center pointer-events-none">
          <div className="bg-black/70 text-white rounded-full px-5 py-3 text-[15px] font-semibold animate-fade-in-out">
            블랙신고완료
          </div>
        </div>
      )}
      {friendLinkedNickname && (
        <div className="fixed inset-0 z-50 flex items-center justify-center pointer-events-none">
          <div className="bg-black/70 text-white rounded-full px-5 py-3 text-[15px] font-semibold animate-fade-in-out">
            {friendLinkedNickname}님과 이제 친구가 되었습니다.
          </div>
        </div>
      )}

      {menuTarget && (
        <>
          <div className="fixed inset-0 z-[70]" onClick={() => setMenuTarget(null)} />
          <div
            className="fixed z-[80] bg-white rounded-xl shadow-lg border border-gray-100 overflow-hidden"
            style={{
              width: 180,
              top: menuTarget.placement === "bottom" ? menuTarget.y : "auto",
              bottom: menuTarget.placement === "top" ? window.innerHeight - menuTarget.y + 8 : "auto",
              left: menuTarget.x - 180,
            }}
          >
            <button
              className="flex items-center justify-between w-full px-4 py-3 text-gray-700"
              style={{ fontSize: "16px" }}
              onClick={() => { setMenuTarget(null); router.push(`/users/${menuTarget.id}/view`); }}
            >
              <span>프로필 보기</span>
              <UserCircle size={20} className="text-gray-500" />
            </button>
            <div className="border-t border-gray-100 mx-3" />
            {(menuTarget.relation === "mutual" || menuTarget.relation === "following") && (
              <>
                <button
                  className="flex items-center justify-between w-full px-4 py-3 text-gray-700"
                  style={{ fontSize: "16px" }}
                  onClick={() =>
                    menuTarget.member.is_greyed
                      ? handleUnsetFollowingGrey(menuTarget.id)
                      : handleSetFollowingGrey(menuTarget.id)
                  }
                >
                  <span>{menuTarget.member.is_greyed ? "알림켜기" : "알림끄기"}</span>
                  <UserMinus size={20} className="text-gray-500" />
                </button>
                <div className="border-t border-gray-100 mx-3" />
              </>
            )}
            {menuTarget.relation === "follower" && (
              <>
                <button
                  className="flex items-center justify-between w-full px-4 py-3 text-gray-700"
                  style={{ fontSize: "16px" }}
                  onClick={() => handleAcceptFollower(menuTarget.member, true)}
                >
                  <span>맞팔로우</span>
                  <Check size={20} className="text-gray-500" />
                </button>
                <div className="border-t border-gray-100 mx-3" />
              </>
            )}
            {menuTarget.relation === "none" && (
              <>
                <button
                  className="flex items-center justify-between w-full px-4 py-3 text-gray-700"
                  style={{ fontSize: "16px" }}
                  onClick={() => handleFollowFromMenu(menuTarget.member)}
                >
                  <span>팔로잉</span>
                  <Check size={20} className="text-gray-500" />
                </button>
                <div className="border-t border-gray-100 mx-3" />
              </>
            )}
            {menuTarget.relation !== "none" && (
              <>
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
                  onClick={() =>
                    menuTarget.isHidden
                      ? handleUnhideFriendFromMenu(menuTarget.id)
                      : handleHideFriend(menuTarget.id)
                  }
                >
                  <span>{menuTarget.isHidden ? "숨김해제" : "친구숨김"}</span>
                  <Ban size={20} className="text-red-400" />
                </button>
                <div className="border-t border-gray-100 mx-3" />
              </>
            )}
            <button
              className="flex items-center justify-between w-full px-4 py-3 text-gray-700"
              style={{ fontSize: "16px" }}
              onClick={() => handleReportUser(menuTarget.id)}
            >
              <span>신고하기</span>
              <Ban size={20} className="text-gray-500" />
            </button>
          </div>
        </>
      )}

      {profileModal && (
        <>
          <div className="fixed inset-0 z-[70] bg-black/50" onClick={() => { setProfileModal(null); setProfileModalData(null); }} />
          <div className="fixed inset-0 z-[80] flex items-center justify-center pointer-events-none">
            <div className="w-[250px] bg-white rounded-2xl shadow-lg p-6 pointer-events-auto flex flex-col items-center gap-2">
              <Avatar src={profileModal.profile_image_url} nickname={profileModal.nickname} size={80} />
              <div className="text-center w-full">
                <p className="font-bold text-gray-900 truncate" style={{ fontSize: 16 }}>{profileModal.nickname}</p>
                {(profileModal.country || profileModal.region) && (
                  <p className="text-xs text-gray-400 mt-0.5">{[profileModal.country, profileModal.region].filter(Boolean).join(", ")}</p>
                )}
                {profileModalData?.member_type?.[0] && (
                  <div className="flex items-center justify-center mt-2">
                    <span className="px-2.5 py-1 rounded-full bg-gray-800 text-white text-[12px] font-medium">
                      {profileModalData.member_type[0]}
                    </span>
                  </div>
                )}
                {profileModalData?.bio && (
                  <p className="text-[17px] text-gray-600 line-clamp-4 mt-1 whitespace-pre-wrap">{profileModalData.bio}</p>
                )}
                <p className="text-xs text-gray-500 mt-2">친구상태: {getRelationStatusValue(profileModal.id)}</p>
              </div>
            </div>
          </div>
        </>
      )}

    </>
  );
}
