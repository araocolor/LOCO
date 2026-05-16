"use client";

import { useEffect, useMemo, useRef, useState, useCallback, useSyncExternalStore, type CSSProperties } from "react";
import Avatar from "@/components/ui/Avatar";
import { useRouter } from "next/navigation";
import { MoreVertical, Plus, Check, UserMinus, Send, Ban, UserCircle, Bookmark, Coffee, Binoculars, Users, UsersRound, LayoutGrid, LayoutList, Ellipsis } from "lucide-react";
import SearchHeader from "@/components/layout/SearchHeader";
import SendMessageModal from "@/components/modal/SendMessageModal";
import { PRESENCE_EVENT } from "@/components/features/PresenceTracker";
import { MEMBER_TYPES, REGIONS_WITH_ALL } from "@/lib/constants";
import { fetchWithAuthRetry } from "@/lib/auth/fetch-with-auth-retry";
import { PROFILE_RETURN_FOCUS_USER_KEY } from "@/lib/profile-return-focus";

type Tab = "friends" | "members" | "followings" | "pending";
type MenuRelation = "mutual" | "following" | "follower" | "none";
type SocialListMode = "followers" | "mySubscribers" | "subscriptions" | "management" | "following";

interface Follower {
  id: string;
  nickname: string;
  profile_image_url: string | null;
  bio?: string | null;
  country: string | null;
  region: string | null;
  gender?: "로" | "라" | null;
  member_type?: string[];
  role?: "member" | "pro" | "admin";
  status?: "pending" | "approved" | "friend";
  is_greyed?: boolean;
  is_hidden?: boolean;
  is_blocked?: boolean;
  is_subscribed?: boolean;
  friend_accepted_at?: string | null;
  joined_at?: string | null;
  relation_updated_at?: string | null;
  favorite_genre?: string[];
  created_at?: string | null;
}

interface DancerMember extends Follower {
  favorite_genre: string[];
  created_at: string | null;
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
  source?: "social" | "members";
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
const MEMBERS_CACHE_KEY = "search_members_cache_v3";
const PENDING_CACHE_KEY = "search_pending_members_cache_v2";
const MYPAGE_CACHE_KEY = "loco_mypage_cache_local_v2";
const SEARCH_TAB_CHANGE_EVENT = "loco-search-tab-change";
const MEMBERS_PAGE_SIZE = 30;
const SOCIAL_LIST_OPTIONS: { value: SocialListMode; label: string }[] = [
  { value: "mySubscribers", label: "구독자" },
  { value: "followers", label: "팔로워" },
  { value: "subscriptions", label: "내구독" },
  { value: "following", label: "팔로잉" },
  { value: "management", label: "회원관리" },
];
const SOCIAL_LIST_ROWS: SocialListMode[][] = [
  ["subscriptions", "mySubscribers"],
  ["following", "followers", "management"],
];
const MEMBER_GENRE_OPTIONS = [
  { value: "salsa", label: "살사" },
  { value: "bachata", label: "바차타" },
  { value: "kizomba", label: "키좀바" },
  { value: "other", label: "기타" },
] as const;

function getSearchTab(): Tab {
  if (typeof window === "undefined") return "friends";
  const tab = new URLSearchParams(window.location.search).get("tab");
  if (tab === "friends") return "friends";
  if (tab === "members") return "members";
  if (tab === "followings") return "followings";
  if (tab === "pending") return "pending";
  return "friends";
}

function getMemberTypeLabel(type: string) {
  if (type === "인스트럭터") return "강사";
  if (type === "일반회원") return "활동회원";
  if (type === "독립군") return "잠수중";
  return type;
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

function getFriendSortTime(member: Follower) {
  const time = member.relation_updated_at || member.friend_accepted_at || member.joined_at || "";
  return time ? new Date(time).getTime() : 0;
}

function compareFriendsByNotification(a: Follower, b: Follower) {
  const notificationDiff = Number(!!a.is_greyed) - Number(!!b.is_greyed);
  if (notificationDiff !== 0) return notificationDiff;
  const timeDiff = getFriendSortTime(b) - getFriendSortTime(a);
  if (timeDiff !== 0) return timeDiff;
  return (a.nickname ?? "").localeCompare(b.nickname ?? "", "ko");
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
  url.searchParams.delete("mode");
  window.history.replaceState(null, "", `${url.pathname}${url.search}${url.hash}`);
  window.dispatchEvent(new Event(SEARCH_TAB_CHANGE_EVENT));
}

function getInitialFriendListMode(): "following" | "friends" {
  if (typeof window === "undefined") return "following";
  const mode = new URLSearchParams(window.location.search).get("mode");
  if (mode === "friends") return "friends";
  return "following";
}

function getSocialCounts(followers: Follower[], following: Follower[], subscriptionCount: number) {
  return {
    following: following.filter((f) => f.status === "approved").length,
    followers: followers.filter((f) => f.status === "approved").length,
    friends: following.filter((f) => f.status === "friend").length,
    subscriptionCount,
  };
}

function writeSearchSocialCache(
  followers: Follower[],
  following: Follower[],
  subscriptionCount?: number,
  ts: number | string = Date.now(),
  mySubscribers?: Follower[]
) {
  const raw = localStorage.getItem(SEARCH_CACHE_KEY);
  const parsed = raw ? JSON.parse(raw) : {};
  const nextSubscriptionCount =
    typeof subscriptionCount === "number"
      ? subscriptionCount
      : typeof parsed.subscriptionCount === "number"
      ? parsed.subscriptionCount
      : 0;
  localStorage.setItem(
    SEARCH_CACHE_KEY,
    JSON.stringify({
      ...parsed,
      followers,
      following,
      mySubscribers: Array.isArray(mySubscribers) ? mySubscribers : parsed.mySubscribers,
      subscriptionCount: nextSubscriptionCount,
      ts,
    })
  );
}

function syncMyPageSocialCounts(followers: Follower[], following: Follower[], subscriptionCount?: number) {
  try {
    const raw = localStorage.getItem(MYPAGE_CACHE_KEY);
    if (!raw) return;
    const parsed = JSON.parse(raw);
    const nextSubscriptionCount =
      typeof subscriptionCount === "number"
        ? subscriptionCount
        : typeof parsed?.socialCounts?.subscriptionCount === "number"
        ? parsed.socialCounts.subscriptionCount
        : 0;
    localStorage.setItem(
      MYPAGE_CACHE_KEY,
      JSON.stringify({
        ...parsed,
        socialCounts: getSocialCounts(followers, following, nextSubscriptionCount),
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

function mergeMembersById(current: DancerMember[], incoming: DancerMember[]) {
  const seen = new Set<string>();
  const merged: DancerMember[] = [];
  [...current, ...incoming].forEach((member) => {
    if (seen.has(member.id)) return;
    seen.add(member.id);
    merged.push(member);
  });
  return merged;
}

function getGenreLabel(value: string) {
  return MEMBER_GENRE_OPTIONS.find((genre) => genre.value === value)?.label ?? value;
}

function formatLocation(country: string | null | undefined, region: string | null | undefined) {
  const normalizedCountry = country?.trim() ?? "";
  const normalizedRegion = region?.trim() ?? "";
  if (normalizedCountry === "대한민국") return normalizedRegion;
  return [normalizedCountry, normalizedRegion].filter(Boolean).join(", ");
}

function writeProfilePreviewCache(member: Follower) {
  try {
    sessionStorage.setItem(
      `user_view_${member.id}`,
      JSON.stringify({
        profile: {
          id: member.id,
          email: null,
          nickname: member.nickname,
          bio: member.bio ?? null,
          country: member.country ?? null,
          member_type: member.member_type ?? [],
          profile_image_url: member.profile_image_url ?? null,
          region: member.region ?? null,
        },
        myClasses: [],
        bookmarkClasses: [],
      })
    );
  } catch {}
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

function SubscriptionBadge() {
  return (
    <span className="absolute -bottom-1 -right-1 flex h-5 w-5 items-center justify-center bg-white rounded-full">
      <Bookmark size={17} strokeWidth={2.5} className="text-red-500" />
    </span>
  );
}

export default function SearchPage() {
  const router = useRouter();
  const membersBootstrappedRef = useRef(false);
  const [followers, setFollowers] = useState<Follower[]>([]);
  const [following, setFollowing] = useState<Follower[]>([]);
  const [mySubscribers, setMySubscribers] = useState<Follower[]>([]);
  const [pendingMembers, setPendingMembers] = useState<PendingMember[]>([]);
  const [pendingLoaded, setPendingLoaded] = useState(false);
  const [members, setMembers] = useState<DancerMember[]>([]);
  const [membersLoaded, setMembersLoaded] = useState(false);
  const [membersLoading, setMembersLoading] = useState(false);
  const [membersFullyLoaded, setMembersFullyLoaded] = useState(false);
  const [memberTotalCount, setMemberTotalCount] = useState(0);
  const [memberRegions, setMemberRegions] = useState<string[]>([]);
  const [memberSearch, setMemberSearch] = useState("");
  const [memberRegion, setMemberRegion] = useState("전체");
  const [memberGenres, setMemberGenres] = useState<string[]>([]);
  const [memberGender, setMemberGender] = useState<"" | "로" | "라">("");
  const [memberSearchMode, setMemberSearchMode] = useState<"basic" | "memberType">("basic");
  const [selectedMemberTypes, setSelectedMemberTypes] = useState<string[]>([]);
  const memberSearchPanelRef = useRef<HTMLDivElement | null>(null);
  const [memberViewMode, setMemberViewMode] = useState<"list" | "grid">("grid");
  const [socialViewMode, setSocialViewMode] = useState<"list" | "grid">("list");
  const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
  const [suggestionsLoading, setSuggestionsLoading] = useState(true);
  const [addedIds, setAddedIds] = useState<Set<string>>(new Set());
  const [acceptingFollowerIds, setAcceptingFollowerIds] = useState<Set<string>>(new Set());
  const [showCheck, setShowCheck] = useState(false);
  const activeTab = useSyncExternalStore(subscribeSearchTab, getSearchTab, (): Tab => "friends");
  const [friendSearch, setFriendSearch] = useState("");
  const [friendViewMode, setFriendViewMode] = useState<"list" | "grid">("grid");
  const [onlineIds, setOnlineIds] = useState<Set<string>>(new Set());
  const [menuTarget, setMenuTarget] = useState<MenuTarget | null>(null);
  const [messageModalTarget, setMessageModalTarget] = useState<{ id: string; nickname: string; profile_image_url: string | null } | null>(null);
  const [hasBlacklistPin, setHasBlacklistPin] = useState<boolean | null>(null);
  const [isBlacklistUnlocked, setIsBlacklistUnlocked] = useState(false);
  const [blacklistPinInput, setBlacklistPinInput] = useState("");
  const [blacklistPinSubmitting, setBlacklistPinSubmitting] = useState(false);
  const [blacklistPinError, setBlacklistPinError] = useState("");
  const [blacklistPinFailCount, setBlacklistPinFailCount] = useState(0);
  const [showBlackReportToast, setShowBlackReportToast] = useState(false);
  const [showHideFriendToast, setShowHideFriendToast] = useState(false);
  const [friendLinkedNickname, setFriendLinkedNickname] = useState<string | null>(null);
  const [followingCancelledNickname, setFollowingCancelledNickname] = useState<string | null>(null);
  const [removingPendingIds, setRemovingPendingIds] = useState<Set<string>>(new Set());
  const [profileModal, setProfileModal] = useState<Follower | null>(null);
  const [profileModalData, setProfileModalData] = useState<{ bio: string | null; member_type: string[] } | null>(null);
  const [closingProfileMemberId, setClosingProfileMemberId] = useState<string | null>(null);
  const [friendOrderIds, setFriendOrderIds] = useState<string[]>([]);
  const [friendListMode, setFriendListMode] = useState<"following" | "friends">(getInitialFriendListMode);
  const [socialListMode, setSocialListMode] = useState<SocialListMode>("followers");
  const [subscriptionCount, setSubscriptionCount] = useState(0);
  const [socialLoadError, setSocialLoadError] = useState(false);

  const handleTabChange = useCallback((tab: Tab) => {
    replaceSearchTab(tab);
    setFriendListMode("following");
    if (tab === "friends") {
      setFriendViewMode("grid");
    }
    if (tab === "members") {
      setMemberViewMode("grid");
    }
    if (tab === "followings") {
      setSocialListMode("subscriptions");
    }
  }, []);

  const prevActiveTabRef = useRef<Tab>(activeTab);
  useEffect(() => {
    if (activeTab === "followings" && prevActiveTabRef.current !== "followings") {
      setSocialListMode("subscriptions");
    }
    prevActiveTabRef.current = activeTab;
  }, [activeTab]);

  function openSocialProfile(member: Follower) {
    setProfileModal(member);
    const cached = sessionStorage.getItem(`user_view_${member.id}`);
    if (cached) {
      try {
        const json = JSON.parse(cached);
        setProfileModalData({ bio: json.profile?.bio ?? null, member_type: json.profile?.member_type ?? [] });
      } catch {}
      return;
    }

    fetch(`/api/users/${member.id}/view-summary`)
      .then((res) => res.json())
      .then((json) => {
        sessionStorage.setItem(`user_view_${member.id}`, JSON.stringify(json));
        setProfileModalData({ bio: json.profile?.bio ?? null, member_type: json.profile?.member_type ?? [] });
      })
      .catch(() => {});
  }

  const followingStatusById = useMemo(
    () => new Map(following.map((f) => [f.id, f.status])),
    [following]
  );
  const visibleFollowers = useMemo(() => followers, [followers]);
  const visibleSubscriptions = useMemo(
    () => {
      const byId = new Map<string, Follower>();
      following.forEach((member) => {
        if (member.is_subscribed) byId.set(member.id, member);
      });
      followers.forEach((member) => {
        if (member.is_subscribed) byId.set(member.id, member);
      });
      mySubscribers.forEach((member) => {
        if (member.is_subscribed) byId.set(member.id, member);
      });
      return Array.from(byId.values()).sort((a, b) => (a.nickname ?? "").localeCompare(b.nickname ?? "", "ko"));
    },
    [following, followers, mySubscribers]
  );
  const socialListMembers = useMemo(() => {
    if (socialListMode === "followers") return visibleFollowers;
    if (socialListMode === "mySubscribers") return mySubscribers;
    if (socialListMode === "subscriptions") return visibleSubscriptions;
    if (socialListMode === "following") return following;
    return [];
  }, [following, mySubscribers, socialListMode, visibleFollowers, visibleSubscriptions]);
  const followerById = useMemo(
    () => new Map(followers.map((item) => [item.id, item])),
    [followers]
  );
  const subscriberById = useMemo(
    () => new Map(mySubscribers.map((item) => [item.id, item])),
    [mySubscribers]
  );
  const getRelationStatusValue = useCallback((id: string) => {
    const status = followingStatusById.get(id);
    if (status === "friend") return "맞팔";
    if (status === "approved") return "팔로잉";
    if (followerById.has(id)) return "팔로워";
    if (subscriberById.has(id)) return "구독자";
    return "아님";
  }, [followingStatusById, followerById, subscriberById]);
  const getMenuRelation = useCallback((id: string): MenuRelation => {
    const myStatus = followingStatusById.get(id);
    if (myStatus === "friend") return "mutual";
    if (myStatus === "approved") return "following";
    if (followerById.has(id)) return "follower";
    return "none";
  }, [followingStatusById, followerById]);
  const visibleFriendMembers = useMemo(() => {
    const orderById = new Map(friendOrderIds.map((id, index) => [id, index]));

    return following
      .filter((member) => {
        if (friendListMode === "friends") return member.status === "friend";
        return member.status === "friend" || member.status === "approved";
      })
      .filter((member) => {
        if (friendSearch === "") return true;
        return member.nickname.toLowerCase().includes(friendSearch.toLowerCase());
      })
      .slice()
      .sort((a, b) => {
        const aOrder = orderById.get(a.id);
        const bOrder = orderById.get(b.id);
        if (aOrder != null && bOrder != null) return aOrder - bOrder;
        if (aOrder != null) return -1;
        if (bOrder != null) return 1;
        return compareFriendsByNotification(a, b);
      });
  }, [following, friendSearch, friendOrderIds, friendListMode]);
  const availableMemberRegions = useMemo(() => {
    const regionSet = new Set<string>();
    REGIONS_WITH_ALL.forEach((region) => {
      if (region !== "전체") regionSet.add(region);
    });
    memberRegions.forEach((region) => {
      if (region) regionSet.add(region);
    });
    return ["전체", ...Array.from(regionSet)];
  }, [memberRegions]);
  const visibleMembers = useMemo(() => {
    if (memberSearchMode === "memberType") {
      if (selectedMemberTypes.length === 0) return members;

      return members.filter((member) =>
        selectedMemberTypes.some((type) => member.member_type?.includes(type))
      );
    }

    const search = memberSearch.trim().toLowerCase();

    return members.filter((member) => {
      const matchesSearch = search === "" || member.nickname.toLowerCase().includes(search);
      const matchesRegion = memberRegion === "전체" || member.region === memberRegion;
      const selectedSalsaBachata = memberGenres.filter((g) => g === "salsa" || g === "bachata");
      const memberSalsaBachata = (member.favorite_genre ?? []).filter((g) => g === "salsa" || g === "bachata");
      const matchesGenre =
        memberGenres.length === 0 ||
        (memberGenres.includes("kizomba") && member.favorite_genre?.includes("kizomba")) ||
        (selectedSalsaBachata.length > 0 &&
          selectedSalsaBachata.length === memberSalsaBachata.length &&
          selectedSalsaBachata.every((g) => memberSalsaBachata.includes(g)));
      const matchesGender = memberGender === "" || member.gender === memberGender;
      return matchesSearch && matchesRegion && matchesGenre && matchesGender;
    });
  }, [members, memberSearch, memberRegion, memberGenres, memberGender, memberSearchMode, selectedMemberTypes]);
  const hasMemberFilter = useMemo(
    () => {
      if (memberSearchMode === "memberType") return selectedMemberTypes.length > 0;

      return (
        memberSearch.trim() !== "" ||
        memberRegion !== "전체" ||
        memberGenres.length > 0 ||
        memberGender !== ""
      );
    },
    [memberSearch, memberRegion, memberGenres, memberGender, memberSearchMode, selectedMemberTypes]
  );
  const memberResultCount = hasMemberFilter ? visibleMembers.length : Math.max(memberTotalCount, visibleMembers.length);

  useEffect(() => {
    if (activeTab !== "members") return;

    let focusUserId: string | null = null;
    try {
      focusUserId = sessionStorage.getItem(PROFILE_RETURN_FOCUS_USER_KEY);
    } catch {
      return;
    }

    if (!focusUserId) return;
    if (!visibleMembers.some((member) => member.id === focusUserId)) return;

    try {
      sessionStorage.removeItem(PROFILE_RETURN_FOCUS_USER_KEY);
    } catch {}

    let timeoutId: number | undefined;
    let cancelled = false;

    queueMicrotask(() => {
      if (cancelled) return;
      setClosingProfileMemberId(focusUserId);
      timeoutId = window.setTimeout(() => {
        setClosingProfileMemberId((current) => (current === focusUserId ? null : current));
      }, 1000);
    });

    return () => {
      cancelled = true;
      if (timeoutId) window.clearTimeout(timeoutId);
    };
  }, [activeTab, visibleMembers]);

  const handleMemberSearchPanelScroll = useCallback(() => {
    const node = memberSearchPanelRef.current;
    if (!node) return;

    const nextMode = node.scrollLeft > node.clientWidth / 2 ? "memberType" : "basic";
    setMemberSearchMode((current) => (current === nextMode ? current : nextMode));
  }, []);

  const toggleMemberTypeFilter = useCallback((type: string) => {
    setSelectedMemberTypes((prev) => {
      if (prev.includes(type)) return prev.filter((item) => item !== type);
      return [type];
    });
  }, []);

  const lockCurrentFriendOrder = useCallback(() => {
    setFriendOrderIds((prev) => {
      if (prev.length > 0) return prev;
      return following
        .filter((member) => member.status === "friend")
        .slice()
        .sort(compareFriendsByNotification)
        .map((member) => member.id);
    });
  }, [following]);

  const resortFriendMembers = useCallback(() => {
    setFriendOrderIds(
      following
        .filter((member) => member.status === "friend")
        .slice()
        .sort(compareFriendsByNotification)
        .map((member) => member.id)
    );
  }, [following]);
  const loadFromCache = useCallback(() => {
    try {
      const cached = localStorage.getItem(SEARCH_CACHE_KEY);
      if (cached) {
        const { followers, following, mySubscribers } = JSON.parse(cached);
        if (Array.isArray(following)) setFollowing(following);
        if (Array.isArray(followers)) {
          setFollowers(followers);
        }
        if (Array.isArray(mySubscribers)) setMySubscribers(mySubscribers);
      }
    } catch {}
  }, []);

  const fetchFollowersAndFollowing = useCallback(() => {
    fetchWithAuthRetry("/api/friends/social")
      .then((r) => {
        if (!r.ok) throw new Error("social fetch failed");
        return r.json();
      })
      .then((json) => {
        const followers = json.data?.followers ?? [];
        const following = json.data?.following ?? [];
        const mySubscribers = json.data?.mySubscribers ?? [];
        const subscriptionCount = json.data?.subscriptionCount ?? 0;
        const sortedFollowers = sortFollowersOnce(followers, following);
        setFollowers(sortedFollowers);
        setFollowing(following);
        setMySubscribers(mySubscribers);
        setSubscriptionCount(subscriptionCount);
        setSocialLoadError(false);
        try {
          writeSearchSocialCache(sortedFollowers, following, subscriptionCount, Date.now(), mySubscribers);
          syncMyPageSocialCounts(sortedFollowers, following, subscriptionCount);
        } catch {}
      })
      .catch(() => {
        setSocialLoadError(true);
      });
  }, []);

  const writeMembersCache = useCallback(
    (nextMembers: DancerMember[], totalCount: number, availableRegions: string[], fullyLoaded: boolean) => {
      try {
        localStorage.setItem(
          MEMBERS_CACHE_KEY,
          JSON.stringify({
            members: nextMembers,
            totalCount,
            availableRegions,
            fullyLoaded,
            ts: Date.now(),
          })
        );
      } catch {}
    },
    []
  );

  const loadMembersFromCache = useCallback(() => {
    try {
      const cached = localStorage.getItem(MEMBERS_CACHE_KEY);
      if (!cached) return { count: 0, fullyLoaded: false, totalCount: 0 };
      const parsed = JSON.parse(cached);
      const cachedMembers = parsed?.members;
      if (!Array.isArray(cachedMembers)) return { count: 0, fullyLoaded: false, totalCount: 0 };

      // gender 필드가 없는 구버전 캐시는 사용하지 않고 다시 받아온다.
      const hasLegacyRow = cachedMembers.some(
        (member) =>
          !member ||
          typeof member !== "object" ||
          !Object.prototype.hasOwnProperty.call(member, "gender")
      );
      if (hasLegacyRow) {
        localStorage.removeItem(MEMBERS_CACHE_KEY);
        return { count: 0, fullyLoaded: false, totalCount: 0 };
      }

      const totalCount = typeof parsed.totalCount === "number" ? parsed.totalCount : cachedMembers.length;
      const availableRegions = Array.isArray(parsed.availableRegions) ? parsed.availableRegions : [];
      const fullyLoaded = !!parsed.fullyLoaded || cachedMembers.length >= totalCount;
      setMembers(cachedMembers);
      setMemberTotalCount(totalCount);
      setMemberRegions(availableRegions);
      setMembersFullyLoaded(fullyLoaded);
      setMembersLoaded(true);
      return { count: cachedMembers.length, fullyLoaded, totalCount };
    } catch {
      return { count: 0, fullyLoaded: false, totalCount: 0 };
    }
  }, []);

  const fetchMembersBatch = useCallback(
    async (offset: number, limit: number, append: boolean) => {
      if (offset === 0) setMembersLoading(true);

      try {
        const res = await fetch(`/api/users/members?limit=${limit}&offset=${offset}`);
        if (!res.ok) throw new Error();
        const json = await res.json();
        const incoming = (json.data ?? []) as DancerMember[];
        const totalCount = typeof json.totalCount === "number" ? json.totalCount : incoming.length;
        const availableRegions = Array.isArray(json.availableRegions) ? json.availableRegions : [];
        const fullyLoaded = offset + incoming.length >= totalCount || incoming.length < limit;

        setMemberTotalCount(totalCount);
        setMemberRegions(availableRegions);
        setMembersFullyLoaded(fullyLoaded);
        setMembersLoaded(true);
        setMembers((prev) => {
          const nextMembers = append ? mergeMembersById(prev, incoming) : incoming;
          writeMembersCache(nextMembers, totalCount, availableRegions, fullyLoaded);
          return nextMembers;
        });

        return { incomingCount: incoming.length, totalCount, fullyLoaded };
      } finally {
        if (offset === 0) setMembersLoading(false);
      }
    },
    [writeMembersCache]
  );

  const fetchRemainingMembers = useCallback(
    (startOffset: number, totalCount: number) => {
      const run = async () => {
        let offset = startOffset;
        let expectedTotal = totalCount;

        while (offset < expectedTotal) {
          const result = await fetchMembersBatch(offset, 100, true);
          if (result.incomingCount === 0 || result.fullyLoaded) break;
          offset += result.incomingCount;
          expectedTotal = result.totalCount;
          await new Promise((resolve) => window.setTimeout(resolve, 250));
        }
      };

      run().catch(() => {});
    },
    [fetchMembersBatch]
  );

  const removeMemberFromMemberList = useCallback(
    (targetId: string) => {
      setMembers((prev) => {
        const nextMembers = prev.filter((member) => member.id !== targetId);
        const nextTotalCount = Math.max(0, memberTotalCount - 1);
        writeMembersCache(nextMembers, nextTotalCount, memberRegions, membersFullyLoaded);
        return nextMembers;
      });
      setMemberTotalCount((prev) => Math.max(0, prev - 1));
    },
    [memberRegions, memberTotalCount, membersFullyLoaded, writeMembersCache]
  );

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
    if (activeTab !== "members" || membersBootstrappedRef.current) return;
    membersBootstrappedRef.current = true;

    queueMicrotask(() => {
      const cached = loadMembersFromCache();
      if (cached.count > 0) {
        if (!cached.fullyLoaded) {
          fetchMembersBatch(cached.count, MEMBERS_PAGE_SIZE, true)
            .then((result) => {
              const nextOffset = cached.count + result.incomingCount;
              if (!result.fullyLoaded && nextOffset < result.totalCount) {
                fetchRemainingMembers(nextOffset, result.totalCount);
              }
            })
            .catch(() => {});
        }
        return;
      }

      fetchMembersBatch(0, MEMBERS_PAGE_SIZE, false)
        .then((firstResult) => {
          if (firstResult.incomingCount === 0 || firstResult.fullyLoaded) return;
          return fetchMembersBatch(firstResult.incomingCount, MEMBERS_PAGE_SIZE, true).then((secondResult) => {
            const nextOffset = firstResult.incomingCount + secondResult.incomingCount;
            if (!secondResult.fullyLoaded && nextOffset < secondResult.totalCount) {
              fetchRemainingMembers(nextOffset, secondResult.totalCount);
            }
          });
        })
        .catch(() => {
          membersBootstrappedRef.current = false;
          setMembersLoaded(true);
        });
    });
  }, [activeTab, fetchMembersBatch, fetchRemainingMembers, loadMembersFromCache]);

  useEffect(() => {
    const shouldLoadPending =
      (activeTab === "pending" && isBlacklistUnlocked) ||
      (activeTab === "followings" && socialListMode === "management" && isBlacklistUnlocked);
    if (!shouldLoadPending || pendingLoaded) return;
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
  }, [activeTab, isBlacklistUnlocked, pendingLoaded, fetchPendingMembers, socialListMode]);

  useEffect(() => {
    const isManagementGuardTab =
      activeTab === "pending" || (activeTab === "followings" && socialListMode === "management");

    if (!isManagementGuardTab) {
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
  }, [activeTab, hasBlacklistPin, socialListMode]);

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
      const addedWithStatus: Follower = { ...added, status: "approved", relation_updated_at: new Date().toISOString() };
      setFollowing((prev) => {
        const updated = [addedWithStatus, ...prev];
        try {
          writeSearchSocialCache(followers, updated);
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
            writeSearchSocialCache(followers, updated);
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
    const addedWithStatus: Follower = { ...member, status: "approved", relation_updated_at: new Date().toISOString() };
    setAddedIds(nextAddedIds);
    setFollowing((prev) => {
      const updated = [addedWithStatus, ...prev.filter((item) => item.id !== member.id)];
      try {
        writeSearchSocialCache(followers, updated);
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
          writeSearchSocialCache(followers, updated);
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
      writeSearchSocialCache(nextFollowers, nextFollowing, undefined, acceptedFollower.friend_accepted_at);
      syncMyPageSocialCounts(nextFollowers, nextFollowing);
    } catch {}

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
      setFollowers(followers);
      setFollowing(previousFollowing);
      try {
        writeSearchSocialCache(followers, previousFollowing, undefined, acceptedFollower.friend_accepted_at);
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

  function updateSubscriptionState(targetId: string, isSubscribed: boolean) {
    const nextFollowers = followers.map((member) =>
      member.id === targetId ? { ...member, is_subscribed: isSubscribed } : member
    );
    const nextFollowing = following.map((member) =>
      member.id === targetId ? { ...member, is_subscribed: isSubscribed } : member
    );
    const nextMySubscribers = mySubscribers.map((member) =>
      member.id === targetId ? { ...member, is_subscribed: isSubscribed } : member
    );
    const nextMembers = members.map((member) =>
      member.id === targetId ? { ...member, is_subscribed: isSubscribed } : member
    );
    setFollowers(nextFollowers);
    setFollowing(nextFollowing);
    setMySubscribers(nextMySubscribers);
    setMembers(nextMembers);
    try {
      writeSearchSocialCache(nextFollowers, nextFollowing, subscriptionCount, Date.now(), nextMySubscribers);
      syncMyPageSocialCounts(nextFollowers, nextFollowing, subscriptionCount);
      writeMembersCache(nextMembers, memberTotalCount, memberRegions, membersFullyLoaded);
    } catch {}
  }

  async function handleToggleSubscription(targetId: string, nextSubscribed: boolean) {
    setMenuTarget(null);
    updateSubscriptionState(targetId, nextSubscribed);

    try {
      const res = await fetch("/api/user-subscriptions", {
        method: nextSubscribed ? "POST" : "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ target_id: targetId }),
      });

      if (!res.ok) throw new Error();
    } catch {
      updateSubscriptionState(targetId, !nextSubscribed);
      alert(nextSubscribed ? "구독 처리 중 오류가 발생했습니다." : "구독취소 처리 중 오류가 발생했습니다.");
    }
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
          writeSearchSocialCache(updated, following);
          syncMyPageSocialCounts(updated, following);
        } catch {}
        return updated;
      });
      removeMemberFromMemberList(targetId);
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
      removeMemberFromMemberList(targetId);
      try {
        writeSearchSocialCache(nextFollowers, nextFollowing);
        syncMyPageSocialCounts(nextFollowers, nextFollowing);
      } catch {}
      refreshSocialLists();
      invalidatePendingCache();
      setShowHideFriendToast(true);
      setTimeout(() => setShowHideFriendToast(false), 2000);
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

      setRemovingPendingIds((prev) => { const next = new Set(prev); next.add(targetId); return next; });
      setTimeout(() => {
        setRemovingPendingIds((prev) => { const next = new Set(prev); next.delete(targetId); return next; });
        setPendingMembers((prev) => {
          const next = prev.filter((member) => !(member.id === targetId && member.state === "hidden"));
          writePendingCache(next);
          return next;
        });
        refreshSocialLists();
        invalidatePendingCache();
      }, 1400);
    } catch {
      alert("숨김해제 처리 중 오류가 발생했습니다.");
    }
  }

  async function handleSetFollowingGrey(targetId: string) {
    setMenuTarget(null);
    lockCurrentFriendOrder();
    const prevFollowing = following;
    const nextFollowing = following.map((item) =>
      item.id === targetId ? { ...item, is_greyed: true } : item
    );
    setFollowing(nextFollowing);
    try {
      writeSearchSocialCache(followers, nextFollowing);
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
        writeSearchSocialCache(followers, prevFollowing);
        syncMyPageSocialCounts(followers, prevFollowing);
      } catch {}
      alert("알림끄기 처리 중 오류가 발생했습니다.");
    }
  }

  async function handleUnsetFollowingGrey(targetId: string) {
    setMenuTarget(null);
    lockCurrentFriendOrder();
    const prevFollowing = following;
    const nextFollowing = following.map((item) =>
      item.id === targetId ? { ...item, is_greyed: false } : item
    );
    setFollowing(nextFollowing);
    try {
      writeSearchSocialCache(followers, nextFollowing);
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
        writeSearchSocialCache(followers, prevFollowing);
        syncMyPageSocialCounts(followers, prevFollowing);
      } catch {}
      alert("알림켜기 처리 중 오류가 발생했습니다.");
    }
  }

  async function handleCancelFollowing(member: Follower) {
    setMenuTarget(null);
    const prevFollowing = following;
    const nextFollowing = following.filter((item) => item.id !== member.id);
    setFollowing(nextFollowing);
    setAddedIds((prev) => {
      const next = new Set(prev);
      next.delete(member.id);
      return next;
    });
    try {
      writeSearchSocialCache(followers, nextFollowing);
      syncMyPageSocialCounts(followers, nextFollowing);
    } catch {}

    try {
      const res = await fetch("/api/friends", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ target_id: member.id }),
      });

      if (!res.ok) throw new Error();
      setFollowingCancelledNickname(member.nickname);
      setTimeout(() => setFollowingCancelledNickname(null), 1500);
    } catch {
      setFollowing(prevFollowing);
      try {
        writeSearchSocialCache(followers, prevFollowing);
        syncMyPageSocialCounts(followers, prevFollowing);
      } catch {}
      alert("팔로잉취소 처리 중 오류가 발생했습니다.");
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

  const SOLO_MEMBER_GENRES = ["kizomba", "other"];
  function toggleMemberGenre(genre: string) {
    setMemberGenres((prev) => {
      if (prev.includes(genre)) return prev.filter((item) => item !== genre);
      if (SOLO_MEMBER_GENRES.includes(genre)) return [genre];
      if (prev.some((g) => SOLO_MEMBER_GENRES.includes(g))) return [genre];
      if (prev.length >= 2) return prev;
      return [...prev, genre];
    });
  }

  function openFriendProfile(member: Follower) {
    setProfileModal(member);
    const cached = sessionStorage.getItem(`user_view_${member.id}`);
    if (cached) {
      try {
        const json = JSON.parse(cached);
        setProfileModalData({ bio: json.profile?.bio ?? null, member_type: json.profile?.member_type ?? [] });
      } catch {}
      return;
    }

    fetch(`/api/users/${member.id}/view-summary`)
      .then((res) => res.json())
      .then((json) => {
        sessionStorage.setItem(`user_view_${member.id}`, JSON.stringify(json));
        setProfileModalData({ bio: json.profile?.bio ?? null, member_type: json.profile?.member_type ?? [] });
      })
      .catch(() => {});
  }

  function openMemberProfile(member: Follower) {
    setProfileModal(member);
    const cached = sessionStorage.getItem(`user_view_${member.id}`);
    if (cached) {
      try {
        const json = JSON.parse(cached);
        setProfileModalData({ bio: json.profile?.bio ?? null, member_type: json.profile?.member_type ?? [] });
        return;
      } catch {}
    }

    setProfileModalData({ bio: member.bio ?? null, member_type: member.member_type ?? [] });
    writeProfilePreviewCache(member);
  }

  function closeProfileModal() {
    if (profileModal) {
      setClosingProfileMemberId(profileModal.id);
      window.setTimeout(() => setClosingProfileMemberId(null), 1000);
    }
    setProfileModal(null);
    setProfileModalData(null);
  }

  function renderManagementPanel() {
    if (!isBlacklistUnlocked) {
      return (
        <div className="min-h-[60vh] flex items-center justify-center">
          <div>
            <div className="relative" style={{ width: 200 }}>
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
                className="w-full h-10 pl-4 pr-10 border border-gray-300 rounded-full bg-white focus:outline-none focus:border-gray-500 text-center text-[15px] placeholder:text-center placeholder:text-[15px]"
              />
              <button
                type="button"
                onClick={handleBlacklistPinSubmit}
                disabled={blacklistPinSubmitting || hasBlacklistPin === null}
                className="absolute right-1 top-1/2 -translate-y-1/2 h-8 w-8 rounded-full bg-gray-900 text-white text-sm font-semibold flex items-center justify-center animate-pill-breathe disabled:opacity-60 disabled:animate-none"
              >
                ✓
              </button>
            </div>
            {blacklistPinError && (
              <p className="mt-2 text-[15px] text-red-500 text-center">{blacklistPinError}</p>
            )}
          </div>
        </div>
      );
    }

    return (
      <div className="pt-3">
        <div className="flex items-center mb-3">
          <p className="text-base font-bold text-gray-400">회원관리</p>
        </div>
        {pendingMembers.length === 0 ? (
          <div className="min-h-[60vh] flex flex-col items-center justify-center gap-3">
            <Coffee size={40} className="text-gray-400" />
            <p className="text-gray-400 text-base">현재 관리회원이 없습니다.</p>
          </div>
        ) : (
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
    );
  }

  return (
    <>
      <SearchHeader activeTab={activeTab} onTabChange={handleTabChange} myRegionLabel="친구들" />

      {activeTab === "followings" && (
        <div className="px-4 pt-0 bg-white">
          <div className="h-[120px] -mx-4 bg-gray-100 flex items-center justify-center px-4">
            <div className="flex flex-col items-center gap-y-2 overflow-hidden">
              {SOCIAL_LIST_ROWS.map((row, rowIndex) => (
                <div key={rowIndex} className="flex items-center justify-center gap-x-2">
                  {row.map((mode) => {
                    const option = SOCIAL_LIST_OPTIONS.find((item) => item.value === mode);
                    if (!option) return null;
                    const active = socialListMode === option.value;
                    return (
                      <button
                        key={option.value}
                        type="button"
                        onClick={() => setSocialListMode(option.value)}
                        className={`h-8 rounded-full px-3 text-[16px] font-semibold leading-tight transition-colors ${
                          active
                            ? "bg-gray-900 text-lime-100"
                            : "bg-white/90 text-[#595959]"
                        }`}
                      >
                        {option.label}
                      </button>
                    );
                  })}
                </div>
              ))}
            </div>
          </div>
          <div className="border-t border-gray-100 pt-0">
            <div className="flex items-center justify-start gap-1 mt-3 mb-3 text-gray-900">
              <Users size={22} />
              <span className="text-[18px] font-bold tabular-nums">
                {socialListMode === "management" ? pendingMembers.length : socialListMembers.length}
              </span>
              {socialListMode !== "management" && (
                <button
                  type="button"
                  onClick={() => setSocialViewMode((mode) => mode === "list" ? "grid" : "list")}
                  className="ml-auto h-9 w-9 flex items-center justify-center rounded-full text-gray-500 hover:bg-gray-100 hover:text-gray-900 transition-colors"
                  aria-label={socialViewMode === "list" ? "그리드 보기" : "리스트 보기"}
                  title={socialViewMode === "list" ? "그리드 보기" : "리스트 보기"}
                >
                  {socialViewMode === "list" ? <LayoutGrid size={21} /> : <LayoutList size={21} />}
                </button>
              )}
            </div>
            {socialLoadError && (
              <p className="mb-3 text-center text-xs text-red-500">목록을 새로 불러오지 못했어요</p>
            )}
            {socialListMode === "management" ? (
              renderManagementPanel()
            ) : socialListMembers.length === 0 ? (
              <p className="text-sm text-gray-400">아직 목록이 없어요</p>
            ) : socialViewMode === "grid" ? (
              <div className="grid grid-cols-5 gap-x-3 gap-y-4 pb-4">
                {socialListMembers.map((f) => {
                  const isNotificationOff = !!f.is_greyed;
                  return (
                    <button
                      key={f.id}
                      type="button"
                      onClick={() => openSocialProfile(f)}
                      className={`relative aspect-square min-w-0 flex items-center justify-center ${isNotificationOff ? "grayscale" : ""}`}
                      aria-label={`${f.nickname} 프로필`}
                    >
                      <div className={`relative ${closingProfileMemberId === f.id ? "profile-close-pop" : ""}`}>
                        <div className={`relative ${isNotificationOff ? "opacity-50" : ""}`}>
                          <Avatar
                            src={f.profile_image_url}
                            nickname={f.nickname}
                            size={48}
                            className="border-2 border-white"
                          />
                        </div>
                        {onlineIds.has(f.id) && (
                          <span className="absolute bottom-0 right-0 w-3 h-3 bg-green-400 rounded-full border-2 border-white" />
                        )}
                        {socialListMode === "subscriptions" && f.is_subscribed && <SubscriptionBadge />}
                      </div>
                    </button>
                  );
                })}
              </div>
            ) : (
              <div className="flex flex-col">
                {socialListMembers.map((f) => {
                  const isNotificationOff = !!f.is_greyed;
                  return (
                  <div key={f.id} className={`flex items-center gap-3 py-3 border-b border-gray-50 ${isNotificationOff ? "grayscale" : ""}`}>
                    <button onClick={() => openSocialProfile(f)}>
                      <div className={`relative ${closingProfileMemberId === f.id ? "profile-close-pop" : ""}`}>
                        <div className={`relative ${isNotificationOff ? "opacity-50" : ""}`}>
                          <Avatar
                            src={f.profile_image_url}
                            nickname={f.nickname}
                            size={44}
                            className="border-2 border-white"
                          />
                        </div>
                        {onlineIds.has(f.id) && (
                          <span className="absolute bottom-0 right-0 w-3 h-3 bg-green-400 rounded-full border-2 border-white" />
                        )}
                        {socialListMode === "subscriptions" && f.is_subscribed && <SubscriptionBadge />}
                      </div>
                    </button>
                    <div className="flex-1 min-w-0">
                      <p className={`font-semibold text-gray-900 truncate ${isNotificationOff ? "opacity-50" : ""}`} style={{ fontSize: 16 }}>{f.nickname}</p>
                      {formatLocation(f.country, f.region) && (
                        <p className="text-xs text-gray-400 truncate">{formatLocation(f.country, f.region)}</p>
                      )}
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

      {activeTab === "members" && (
        <div className="px-4 pt-0 bg-white">
          <div className="h-[120px] -mx-4 bg-yellow-200">
            <div
              ref={memberSearchPanelRef}
              onScroll={handleMemberSearchPanelScroll}
              className="flex h-full overflow-x-auto snap-x snap-mandatory scrollbar-hide"
              style={{ WebkitOverflowScrolling: "touch", touchAction: "pan-x" }}
            >
              <div className="h-full min-w-full snap-start flex flex-col justify-center px-4 gap-2 bg-yellow-200">
                <div className="flex items-center gap-2 justify-center">
                  <select
                    value={memberRegion}
                    onChange={(e) => setMemberRegion(e.target.value)}
                    className="h-8 w-[88px] flex-shrink-0 rounded-full border border-transparent bg-white px-3 text-[16px] text-gray-800 focus:outline-none focus:border-transparent"
                  >
                    {availableMemberRegions.map((region) => (
                      <option key={region} value={region}>
                        {region}
                      </option>
                    ))}
                  </select>
                  <div className="relative" style={{ width: 110 }}>
                    <input
                      type="text"
                      placeholder="아이디"
                      value={memberSearch}
                      onChange={(e) => setMemberSearch(e.target.value)}
                      className="w-full h-8 pl-3 pr-8 border border-transparent rounded-full bg-white focus:outline-none focus:border-transparent"
                      style={{ fontSize: 16 }}
                    />
                    {memberSearch && (
                      <button
                        onClick={() => setMemberSearch("")}
                        className="absolute right-2 top-1/2 -translate-y-1/2 w-4 h-4 rounded-full bg-gray-300 flex items-center justify-center"
                      >
                        <span className="text-white text-[14px] leading-none font-bold">×</span>
                      </button>
                    )}
                  </div>
                  <select
                    value={memberGender}
                    onChange={(e) => setMemberGender(e.target.value as "" | "로" | "라")}
                    className="h-8 w-[64px] flex-shrink-0 rounded-full border border-transparent bg-white px-2 text-[16px] text-gray-800 focus:outline-none focus:border-transparent"
                  >
                    <option value="">전체</option>
                    <option value="로">로</option>
                    <option value="라">라</option>
                  </select>
                </div>

                <div className="flex items-center justify-center gap-2 w-full overflow-x-auto scrollbar-hide">
                  {MEMBER_GENRE_OPTIONS.map((genre) => {
                    const active = memberGenres.includes(genre.value);
                    const faded = !active && (memberGenres.length >= 2 || memberGenres.some((g) => SOLO_MEMBER_GENRES.includes(g)));
                    return (
                      <button
                        key={genre.value}
                        type="button"
                        onClick={() => toggleMemberGenre(genre.value)}
                        className={`h-8 flex-shrink-0 rounded-full px-3 text-[16px] font-semibold transition-colors ${
                          active
                            ? "bg-yellow-300 text-gray-950 border border-transparent"
                            : "bg-white text-gray-500 border border-transparent"
                        } ${faded ? "opacity-40" : ""}`}
                      >
                        {genre.label}
                      </button>
                    );
                  })}
                </div>
              </div>

              <div className="h-full min-w-full snap-start flex flex-col justify-center px-4 gap-2 bg-yellow-200">
                <div className="flex flex-wrap items-center justify-center gap-x-2 gap-y-1 overflow-hidden">
                  {MEMBER_TYPES.map((type) => {
                    const active = selectedMemberTypes.includes(type);
                    return (
                      <button
                        key={type}
                        type="button"
                        onClick={() => toggleMemberTypeFilter(type)}
                        className={`rounded-full border px-2.5 py-1 text-[16px] font-semibold leading-tight transition-colors ${
                          active
                            ? "bg-gray-900 border-gray-900 text-yellow-200"
                            : "bg-white/90 border-yellow-300 text-[#595959]"
                        } hover:border-gray-700`}
                      >
                        {getMemberTypeLabel(type)}
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>
            <div className="pointer-events-none -mt-3 flex justify-center gap-1.5">
              <span className={`rounded-full transition-all ${memberSearchMode === "basic" ? "h-2 w-2 bg-gray-900" : "h-1.5 w-1.5 bg-gray-400"}`} />
              <span className={`rounded-full transition-all ${memberSearchMode === "memberType" ? "h-2 w-2 bg-gray-900" : "h-1.5 w-1.5 bg-gray-400"}`} />
            </div>
          </div>
          <div className="pt-5">
            <div className="flex items-center gap-3 mb-3">
              <div className="flex items-center gap-1 text-gray-900">
                <Binoculars size={24} />
                <span className="inline-block w-[4ch] text-left tabular-nums font-bold" style={{ fontSize: 18 }}>
                  {memberResultCount}
                </span>
              </div>
              <button
                type="button"
                onClick={() => setMemberViewMode((mode) => mode === "list" ? "grid" : "list")}
                className="ml-auto h-9 w-9 flex items-center justify-center rounded-full text-gray-500 hover:bg-gray-100 hover:text-gray-900 transition-colors"
                aria-label={memberViewMode === "list" ? "그리드 보기" : "리스트 보기"}
                title={memberViewMode === "list" ? "그리드 보기" : "리스트 보기"}
              >
                {memberViewMode === "list" ? <LayoutGrid size={21} /> : <LayoutList size={21} />}
              </button>
            </div>

            {!membersLoaded && membersLoading ? (
              <div className="flex flex-col">
                {Array.from({ length: 8 }).map((_, index) => (
                  <div key={index} className="flex items-center gap-3 py-3 border-b border-gray-50">
                    <div className="w-11 h-11 rounded-full bg-gray-200 animate-pulse" />
                    <div className="flex-1">
                      <div className="w-24 h-4 rounded bg-gray-200 animate-pulse mb-2" />
                      <div className="w-32 h-3 rounded bg-gray-100 animate-pulse" />
                    </div>
                  </div>
                ))}
              </div>
            ) : visibleMembers.length === 0 ? (
              <p className="text-sm text-gray-400">조건에 맞는 회원이 없어요</p>
            ) : memberViewMode === "grid" ? (
              <div className="grid grid-cols-5 gap-x-3 gap-y-4 pb-4">
                {visibleMembers.map((member) => (
                  <button
                    key={member.id}
                    type="button"
                    onClick={() => openMemberProfile(member)}
                    className="relative aspect-square min-w-0 flex items-center justify-center"
                    aria-label={`${member.nickname} 프로필`}
                  >
                    <div className={`relative ${closingProfileMemberId === member.id ? "profile-close-pop" : ""}`}>
                      <Avatar
                        src={member.profile_image_url}
                        nickname={member.nickname}
                        size={48}
                        className="bg-gradient-to-br from-gray-100 to-sky-100"
                      />
                      {onlineIds.has(member.id) && (
                        <span className="absolute bottom-0 right-0 w-3 h-3 bg-green-400 rounded-full border-2 border-white" />
                      )}
                      {member.is_subscribed && <SubscriptionBadge />}
                    </div>
                  </button>
                ))}
              </div>
            ) : (
              <div className="flex flex-col">
                {visibleMembers.map((member) => {
                  const genreLabels = (member.favorite_genre ?? [])
                    .filter((genre) => MEMBER_GENRE_OPTIONS.some((option) => option.value === genre))
                    .map(getGenreLabel);

                  return (
                    <div key={member.id} className="flex items-center gap-3 py-3 border-b border-gray-50">
                      <button
                        onClick={() => openMemberProfile(member)}
                      >
                        <div className={`relative ${closingProfileMemberId === member.id ? "profile-close-pop" : ""}`}>
                          <Avatar
                            src={member.profile_image_url}
                            nickname={member.nickname}
                            size={44}
                            className="bg-gradient-to-br from-gray-100 to-sky-100"
                          />
                          {onlineIds.has(member.id) && (
                            <span className="absolute bottom-0 right-0 w-3 h-3 bg-green-400 rounded-full border-2 border-white" />
                          )}
                          {member.is_subscribed && <SubscriptionBadge />}
                        </div>
                      </button>
                      <button
                        className="flex-1 text-left min-w-0"
                        onClick={() => router.push(`/users/${member.id}/view`)}
                      >
                        <p className="font-semibold text-gray-900 truncate" style={{ fontSize: 16 }}>
                          {member.nickname}
                        </p>
                        <p className="text-xs text-gray-400 truncate">
                          {formatLocation(member.country, member.region) || "지역 미입력"}
                          {genreLabels.length > 0 ? ` · ${genreLabels.join(" · ")}` : ""}
                        </p>
                      </button>
                      <button
                        className="p-2 -mr-2 text-gray-400 hover:text-gray-700 flex-shrink-0"
                        onClick={(e) => {
                          e.stopPropagation();
                          const r = e.currentTarget.getBoundingClientRect();
                          const placement = r.top > window.innerHeight / 2 ? "top" : "bottom";
                          setMenuTarget({
                            id: member.id,
                            nickname: member.nickname,
                            status: followingStatusById.get(member.id),
                            relation: getMenuRelation(member.id),
                            x: r.right,
                            y: placement === "top" ? r.top : r.bottom,
                            placement,
                            member,
                            isHidden: !!member.is_hidden,
                            source: "members",
                          });
                          fetch(`/api/users/${member.id}/view-summary`)
                            .then((res) => res.json())
                            .then((json) => { sessionStorage.setItem(`user_view_${member.id}`, JSON.stringify(json)); })
                            .catch(() => {});
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
      {activeTab === "friends" && (
        <div className="px-4 pt-0 bg-white">
          <div className={`mb-0 -mx-4 py-3 h-[120px] ${!suggestionsLoading && suggestions.length === 0 ? "bg-white" : "bg-sky-100/70"}`}>
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
                            <Avatar
                              src={s.profile_image_url}
                              nickname={s.nickname}
                              size={60}
                              className="bg-black"
                            />
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
                        className="max-w-[62px] text-center font-bold text-gray-900 truncate"
                        style={{ fontSize: 14 }}
                      >
                        {s.nickname}
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
          <div className="pt-5">
            <div className="relative flex items-center mb-3">
              <button
                type="button"
                onClick={() => { setFriendListMode("following"); resortFriendMembers(); }}
                className={`flex items-center gap-1 transition-colors ${friendListMode === "following" ? "text-gray-900" : "text-gray-300"}`}
              >
                <UsersRound size={24} />
                <span className="font-bold tabular-nums" style={{ fontSize: 18 }}>{following.length}</span>
              </button>
              <button
                type="button"
                onClick={() => setFriendViewMode((mode) => mode === "list" ? "grid" : "list")}
                className="ml-auto mr-1 h-9 w-9 flex items-center justify-center rounded-full text-gray-500 hover:bg-gray-100 hover:text-gray-900 transition-colors"
                aria-label={friendViewMode === "list" ? "그리드 보기" : "리스트 보기"}
                title={friendViewMode === "list" ? "그리드 보기" : "리스트 보기"}
              >
                {friendViewMode === "list" ? <LayoutGrid size={21} /> : <LayoutList size={21} />}
              </button>
              <div className="absolute left-1/2" style={{ transform: "translateX(calc(-50% + 20px))" }}>
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
            </div>

            {visibleFriendMembers.length === 0 ? (
              <p className="text-sm text-gray-400">
                {friendListMode === "friends" ? "맞팔 회원이 없어요" : "팔로잉한 회원이 없어요"}
              </p>
            ) : friendViewMode === "grid" ? (
              <div className="grid grid-cols-5 gap-x-3 gap-y-4 pb-4">
                {visibleFriendMembers.map((m) => {
                  const isNotificationOff = !!m.is_greyed;
                  const isMutualFriend = m.status === "friend";
                  return (
                    <button
                      key={m.id}
                      type="button"
                      onClick={() => openFriendProfile(m)}
                      className={`relative aspect-square min-w-0 flex items-center justify-center ${isNotificationOff ? "grayscale" : ""}`}
                      aria-label={`${m.nickname} 프로필`}
                    >
                      <div
                        className={`relative ${isMutualFriend ? "animate-blacklist-avatar" : ""} ${closingProfileMemberId === m.id ? "profile-close-pop" : ""} ${isNotificationOff ? "opacity-50" : ""}`}
                        style={isMutualFriend ? getAvatarFloatStyle(m.id) : undefined}
                      >
                        <Avatar
                          src={m.profile_image_url}
                          nickname={m.nickname}
                          size={48}
                          className={m.status === "approved" ? undefined : "border-2 border-white shadow-[0_0_0_2px_#ef4444]"}
                        />
                        {onlineIds.has(m.id) && (
                          <span className="absolute bottom-0 right-0 w-3 h-3 bg-green-400 rounded-full border-2 border-white" />
                        )}
                      </div>
                    </button>
                  );
                })}
              </div>
            ) : (
              <div className="flex flex-col">
                {visibleFriendMembers.map((m) => {
                  const follower = followerById.get(m.id);
                  const followingRelation = m;
                  const isNotificationOff = !!followingRelation?.is_greyed;
                  const isMutualFriend = m.status === "friend";
                  const isFollowingOnly = m.status === "approved";

                  return (
                    <div key={m.id} className={`flex items-center gap-3 py-3 border-b border-gray-50 ${isNotificationOff ? "grayscale" : ""}`}>
                      <button onClick={() => openFriendProfile(m)}>
                        <div className={`relative ${isMutualFriend ? "animate-blacklist-avatar" : ""} ${isNotificationOff ? "opacity-50" : ""}`}
                          style={isMutualFriend ? getAvatarFloatStyle(m.id) : undefined}
                        >
                          {isFollowingOnly ? (
                            <Avatar
                              src={m.profile_image_url}
                              nickname={m.nickname}
                              size={44}
                            />
                          ) : (
                          <Avatar
                            src={m.profile_image_url}
                            nickname={m.nickname}
                            size={44}
                            className="border-2 border-white shadow-[0_0_0_2px_#ef4444]"
                          />
                          )}
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
                        {isFollowingOnly && (
                          <span className="text-gray-500 border border-gray-300 rounded-full px-2 py-0.5" style={{ fontSize: 14 }}>연결중</span>
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


      {activeTab === "pending" && (
        <div className="px-4 pt-4 bg-white">
          {renderManagementPanel()}
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
        @keyframes profileClosePop {
          0% { transform: scale(1); }
          45% { transform: scale(1.22); }
          100% { transform: scale(1); }
        }
        .profile-close-pop {
          animation: profileClosePop 1s ease-out both;
          transform-origin: center;
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
      {showHideFriendToast && (
        <div className="fixed inset-0 z-50 flex items-center justify-center pointer-events-none">
          <div className="bg-black/70 text-white rounded-full px-5 py-3 text-[15px] font-semibold animate-fade-in-out">
            해당 회원을 친구관리로 이동하였습니다.
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
      {followingCancelledNickname && (
        <div className="fixed inset-0 z-50 flex items-center justify-center pointer-events-none">
          <div className="bg-black/70 text-white rounded-full px-5 py-3 text-[15px] font-semibold animate-fade-in-out">
            {followingCancelledNickname}님에 팔로잉이 취소되었습니다.
          </div>
        </div>
      )}

      {menuTarget && (
        <>
          <div className="fixed inset-0 z-[85]" onClick={() => setMenuTarget(null)} />
          <div
            className="fixed z-[90] bg-white rounded-xl shadow-lg border border-gray-100 overflow-hidden"
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
            <button
              className="flex items-center justify-between w-full px-4 py-3 text-gray-700"
              style={{ fontSize: "16px" }}
              onClick={() => handleToggleSubscription(menuTarget.id, !menuTarget.member.is_subscribed)}
            >
              <span>{menuTarget.member.is_subscribed ? "구독취소" : "구독하기"}</span>
              <Bookmark
                size={20}
                fill={menuTarget.member.is_subscribed ? "#FEE500" : "none"}
                className="text-gray-500"
              />
            </button>
            <div className="border-t border-gray-100 mx-3" />
            {menuTarget.source !== "members" && menuTarget.relation === "mutual" && (
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
            {menuTarget.source !== "members" && menuTarget.relation === "following" && (
              <>
                <button
                  className="flex items-center justify-between w-full px-4 py-3 text-gray-700"
                  style={{ fontSize: "16px" }}
                  onClick={() => handleCancelFollowing(menuTarget.member)}
                >
                  <span>연결취소</span>
                  <UserMinus size={20} className="text-gray-500" />
                </button>
                <div className="border-t border-gray-100 mx-3" />
              </>
            )}
            {menuTarget.source !== "members" && menuTarget.relation === "follower" && (
              <>
                <button
                  className="flex items-center justify-between w-full px-4 py-3 text-gray-700"
                  style={{ fontSize: "16px" }}
                  onClick={() => handleAcceptFollower(menuTarget.member, true)}
                >
                  <span>친구연결</span>
                  <Check size={20} className="text-gray-500" />
                </button>
                <div className="border-t border-gray-100 mx-3" />
              </>
            )}
            {menuTarget.source !== "members" && menuTarget.relation === "none" && (
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
            {(menuTarget.source === "members" || menuTarget.relation !== "none") && (
              <>
                <button
                  className="flex items-center justify-between w-full px-4 py-3 text-gray-700"
                  style={{ fontSize: "16px" }}
                  onClick={() => { setMessageModalTarget({ id: menuTarget.id, nickname: menuTarget.nickname, profile_image_url: menuTarget.member?.profile_image_url ?? null }); setMenuTarget(null); }}
                >
                  <span>메시지 전송</span>
                  <Send size={20} className="text-gray-500" />
                </button>
                <div className="border-t border-gray-100 mx-3" />
                <button
                  className="flex items-center justify-between w-full px-4 py-3 text-gray-700"
                  style={{ fontSize: "16px" }}
                  onClick={() =>
                    menuTarget.isHidden
                      ? handleUnhideFriendFromMenu(menuTarget.id)
                      : handleHideFriend(menuTarget.id)
                  }
                >
                  <span>{menuTarget.isHidden ? "숨김해제" : "친구숨김"}</span>
                  <Ban size={20} className="text-gray-500" />
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
          <div className="fixed inset-0 z-[70] bg-black/50" onClick={closeProfileModal} />
          <div className="fixed inset-0 z-[80] flex items-center justify-center pointer-events-none">
            <div className="relative w-[250px] bg-white rounded-2xl shadow-lg p-6 pointer-events-auto flex flex-col items-center gap-2">
              {(activeTab === "friends" || activeTab === "members") && (
                <button
                  type="button"
                  className="absolute top-3 right-3 rounded-full p-1 text-gray-500 hover:bg-gray-100"
                  onClick={(e) => {
                    e.stopPropagation();
                    const r = e.currentTarget.getBoundingClientRect();
                    const placement = r.top > window.innerHeight / 2 ? "top" : "bottom";
                    setMenuTarget({
                      id: profileModal.id,
                      nickname: profileModal.nickname,
                      status: profileModal.status,
                      relation: getMenuRelation(profileModal.id),
                      x: r.right,
                      y: placement === "top" ? r.top : r.bottom,
                      placement,
                      member: profileModal,
                      isHidden: !!profileModal.is_hidden,
                      source: activeTab === "members" ? "members" : "social",
                    });
                  }}
                  aria-label="더보기"
                  title="더보기"
                >
                  <Ellipsis size={20} />
                </button>
              )}
              <Avatar src={profileModal.profile_image_url} nickname={profileModal.nickname} size={80} />
              <div className="text-center w-full">
                <p className="font-bold text-gray-900 truncate" style={{ fontSize: 16 }}>{profileModal.nickname}</p>
                {formatLocation(profileModal.country, profileModal.region) && (
                  <p className="text-xs text-gray-400 mt-0.5">{formatLocation(profileModal.country, profileModal.region)}</p>
                )}
                {profileModalData?.member_type?.[0] && (
                  <div className="flex items-center justify-center mt-2">
                    <span className="px-2.5 py-1 rounded-full bg-gray-800 text-white text-[12px] font-medium">
                      {getMemberTypeLabel(profileModalData.member_type[0])}
                    </span>
                  </div>
                )}
                {profileModalData?.bio && (
                  <p className="text-[17px] text-gray-600 line-clamp-4 mt-1 whitespace-pre-wrap">{profileModalData.bio}</p>
                )}
                <p className="text-xs text-gray-500 mt-2">{{"맞팔": "Friends", "팔로잉": "Following", "팔로워": "Follower", "구독자": "Subscriber", "아님": "None"}[getRelationStatusValue(profileModal.id)]}</p>
              </div>
              <div className="flex gap-2 w-full mt-2">
                {getRelationStatusValue(profileModal.id) === "맞팔" ? (
                  <button
                    className="flex-1 h-9 rounded-full bg-[#FEE500] text-gray-900 font-semibold text-[14px]"
                    onClick={() => { setMessageModalTarget({ id: profileModal.id, nickname: profileModal.nickname, profile_image_url: profileModal.profile_image_url ?? null }); closeProfileModal(); }}
                  >
                    메시지 전송
                  </button>
                ) : (
                  <button
                    className="flex-1 h-9 rounded-full bg-[#FEE500] text-gray-900 font-semibold text-[14px]"
                    onClick={() => { handleFollowFromMenu(profileModal); closeProfileModal(); }}
                  >
                    {getRelationStatusValue(profileModal.id) === "팔로잉" ? "구독하기" : "친구추가"}
                  </button>
                )}
                <button
                  className="flex-1 h-9 rounded-full bg-[#FEE500] text-gray-900 font-semibold text-[14px]"
                  onClick={() => { router.push(`/users/${profileModal.id}/view`); closeProfileModal(); }}
                >
                  프로필보기
                </button>
              </div>
            </div>
          </div>
        </>
      )}

      {messageModalTarget && (
        <SendMessageModal
          isOpen={!!messageModalTarget}
          onClose={() => setMessageModalTarget(null)}
          receiver={messageModalTarget}
        />
      )}
    </>
  );
}
