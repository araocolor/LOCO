import type { CSSProperties } from "react";
import type { DancerMember, Follower } from "../_types/search";
import { MEMBER_GENRE_OPTIONS, MYPAGE_CACHE_KEY, SEARCH_CACHE_KEY } from "./constants";

export const USER_VIEW_CACHE_PREFIX = "user_view_v2_";

export function getMemberTypeLabel(type: string) {
  if (type === "인스트럭터") return "강사";
  if (type === "일반회원") return "활동회원";
  if (type === "독립군") return "잠수중";
  return type;
}

export function getAvatarFloatStyle(id: string): CSSProperties {
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

export function compareFriendsByNotification(a: Follower, b: Follower) {
  const notificationDiff = Number(!!a.is_greyed) - Number(!!b.is_greyed);
  if (notificationDiff !== 0) return notificationDiff;
  const timeDiff = getFriendSortTime(b) - getFriendSortTime(a);
  if (timeDiff !== 0) return timeDiff;
  return (a.nickname ?? "").localeCompare(b.nickname ?? "", "ko");
}

function getSocialCounts(followers: Follower[], following: Follower[], subscriptionCount: number) {
  return {
    following: following.filter((f) => f.status === "approved").length,
    followers: followers.filter((f) => f.status === "approved").length,
    friends: following.filter((f) => f.status === "friend").length,
    subscriptionCount,
  };
}

export function writeSearchSocialCache(
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

export function syncMyPageSocialCounts(followers: Follower[], following: Follower[], subscriptionCount?: number) {
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

export function sortFollowersOnce(followers: Follower[], following: Follower[]) {
  const followingStatusById = new Map(following.map((f) => [f.id, f.status]));
  return followers
    .slice()
    .sort((a, b) =>
      Number(followingStatusById.get(a.id) === "friend") - Number(followingStatusById.get(b.id) === "friend")
    );
}

export function mergeMembersById(current: DancerMember[], incoming: DancerMember[]) {
  const seen = new Set<string>();
  const merged: DancerMember[] = [];
  [...current, ...incoming].forEach((member) => {
    if (seen.has(member.id)) return;
    seen.add(member.id);
    merged.push(member);
  });
  return merged;
}

export function getGenreLabel(value: string) {
  return MEMBER_GENRE_OPTIONS.find((genre) => genre.value === value)?.label ?? value;
}

export function formatLocation(country: string | null | undefined, region: string | null | undefined) {
  const normalizedCountry = country?.trim() ?? "";
  const normalizedRegion = region?.trim() ?? "";
  if (normalizedCountry === "대한민국") return normalizedRegion;
  return [normalizedCountry, normalizedRegion].filter(Boolean).join(", ");
}

export function formatRecentActiveTime(lastActiveAt: string | null | undefined, nowMs: number = Date.now()) {
  if (!lastActiveAt) return null;

  const activeMs = new Date(lastActiveAt).getTime();
  if (Number.isNaN(activeMs)) return null;

  const diffMs = Math.max(0, nowMs - activeMs);
  const diffMinutes = Math.floor(diffMs / (60 * 1000));
  if (diffMinutes < 60) {
    return `${Math.max(1, diffMinutes)}분`;
  }

  const diffHours = Math.floor(diffMs / (60 * 60 * 1000));
  if (diffHours < 24) {
    return `${diffHours}시간`;
  }

  const diffDays = Math.floor(diffMs / (24 * 60 * 60 * 1000));
  if (diffDays < 30) {
    return `${diffDays}일`;
  }

  return `${Math.floor(diffDays / 30)}개월`;
}

export function writeProfilePreviewCache(member: Follower) {
  try {
    sessionStorage.setItem(
      `${USER_VIEW_CACHE_PREFIX}${member.id}`,
      JSON.stringify({
        profile: {
          id: member.id,
          email: null,
          nickname: member.nickname,
          bio: member.bio ?? null,
          country: member.country ?? null,
          last_active_at: member.last_active_at ?? null,
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
