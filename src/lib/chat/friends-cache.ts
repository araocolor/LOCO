import { fetchWithAuthRetry } from "@/lib/auth/fetch-with-auth-retry";
import type { Follower } from "@/app/(main)/search/_types/search";

const CACHE_KEY = "chat_friends_cache";
const CACHE_TTL = 5 * 60 * 1000;

interface FriendsCache {
  following: Follower[];
  followers: Follower[];
  ts: number;
}

export function readFriendsCache(): FriendsCache | null {
  try {
    const raw = localStorage.getItem(CACHE_KEY);
    if (!raw) return null;
    return JSON.parse(raw) as FriendsCache;
  } catch {
    return null;
  }
}

export function writeFriendsCache(following: Follower[], followers: Follower[]) {
  try {
    localStorage.setItem(CACHE_KEY, JSON.stringify({ following, followers, ts: Date.now() }));
  } catch {}
}

export function isFriendsCacheFresh(cache: FriendsCache | null): boolean {
  return !!cache && Date.now() - cache.ts < CACHE_TTL;
}

export async function fetchFriends(): Promise<{ following: Follower[]; followers: Follower[] } | null> {
  try {
    const r = await fetchWithAuthRetry("/api/chat/friends");
    if (!r.ok) return null;
    const json = await r.json();
    const following = (json.data?.following ?? []) as Follower[];
    const followers = (json.data?.followers ?? []) as Follower[];
    writeFriendsCache(following, followers);
    return { following, followers };
  } catch {
    return null;
  }
}

// 앱 시작 시 1회 프리로드: 캐시가 신선하면 건너뛰고, 아니면 백그라운드로 채워둔다.
export async function warmFriendsCache(): Promise<void> {
  if (isFriendsCacheFresh(readFriendsCache())) return;
  await fetchFriends();
}
