"use client";

import { useEffect } from "react";
import { usePathname } from "next/navigation";
import { fetchWithAuthRetry } from "@/lib/auth/fetch-with-auth-retry";

const CHAT_ROOMS_CACHE_PREFIX = "loco_chat_rooms_cache_v2:";
const CHAT_ROOMS_CACHE_TTL_MS = 5 * 60 * 1000;
const CHAT_ROOMS_CACHE_LIMIT = 50;
const MYPAGE_CACHE_KEY = "loco_mypage_cache_local_v2";
const SEARCH_CACHE_KEY = "search_prefetch_cache";
const SUGGESTIONS_KEY = "search_suggestions_cache";

function getChatRoomsCacheKey(userId: string) {
  return `${CHAT_ROOMS_CACHE_PREFIX}${userId}`;
}

function hasFreshChatRoomsCache(userId: string) {
  try {
    const raw = localStorage.getItem(getChatRoomsCacheKey(userId));
    if (!raw) return false;
    const parsed = JSON.parse(raw) as { ts?: number };
    return typeof parsed.ts === "number" && Date.now() - parsed.ts < CHAT_ROOMS_CACHE_TTL_MS;
  } catch {
    return false;
  }
}

function prioritizeOneToOneRooms<T extends { type?: string }>(rooms: T[]) {
  const oneToOneRooms = rooms.filter((room) => room.type === "self" || room.type === "direct");
  const otherRooms = rooms.filter((room) => room.type !== "self" && room.type !== "direct");
  return [...oneToOneRooms, ...otherRooms].slice(0, CHAT_ROOMS_CACHE_LIMIT);
}

async function prefetchChatRooms(userId: string) {
  const convRes = await fetch("/api/chat/rooms");
  if (convRes.ok) {
    const json = await convRes.json();
    if (json.data) {
      localStorage.setItem(
        getChatRoomsCacheKey(userId),
        JSON.stringify({
          data: prioritizeOneToOneRooms(json.data),
          ts: Date.now(),
        })
      );
    }
  }
}

async function prefetchMyPage() {
  const mypageRes = await fetch("/api/mypage/summary");
  if (mypageRes.ok) {
    const json = await mypageRes.json();
    if (json.profile) localStorage.setItem(MYPAGE_CACHE_KEY, JSON.stringify(json));
  }
}

async function prefetchSearchSocial() {
  const socialRes = await fetchWithAuthRetry("/api/friends/social");
  if (!socialRes.ok) return;

  const social = await socialRes.json();
  const followers = social.data?.followers ?? [];
  const following = social.data?.following ?? [];
  const mySubscribers = social.data?.mySubscribers ?? [];
  const subscriptionCount = social.data?.subscriptionCount ?? 0;
  localStorage.setItem(
    SEARCH_CACHE_KEY,
    JSON.stringify({
      followers,
      following,
      mySubscribers,
      subscriptionCount,
      ts: Date.now(),
    })
  );

  const mypageRaw = localStorage.getItem(MYPAGE_CACHE_KEY);
  if (mypageRaw) {
    const mypage = JSON.parse(mypageRaw);
    localStorage.setItem(
      MYPAGE_CACHE_KEY,
      JSON.stringify({
        ...mypage,
        socialCounts: {
          following: following.filter((item: { status?: string }) => item.status === "approved").length,
          followers: followers.filter((item: { status?: string }) => item.status === "approved").length,
          friends: following.filter((item: { status?: string }) => item.status === "friend").length,
          subscriptionCount,
        },
      })
    );
  }
}

async function prefetchSuggestions() {
  const suggestionsRes = await fetch("/api/friends/suggestions?limit=30");
  if (suggestionsRes.ok) {
    const json = await suggestionsRes.json();
    if (json.data) localStorage.setItem(SUGGESTIONS_KEY, JSON.stringify({ suggestions: json.data, ts: Date.now() }));
  }
}

export default function AppPrefetcher({ userId }: { userId: string | null }) {
  const pathname = usePathname();

  useEffect(() => {
    async function prefetch() {
      try {
        if (pathname === "/") return;

        const shouldPrefetchConversations = userId ? !hasFreshChatRoomsCache(userId) : false;
        const shouldPrefetchMyPage = !localStorage.getItem(MYPAGE_CACHE_KEY);
        const shouldPrefetchSearch = !localStorage.getItem(SEARCH_CACHE_KEY);
        const shouldPrefetchSuggestions = !localStorage.getItem(SUGGESTIONS_KEY);
        if (
          !userId ||
          (
            !shouldPrefetchConversations &&
            !shouldPrefetchMyPage &&
            !shouldPrefetchSearch &&
            !shouldPrefetchSuggestions
          )
        ) return;

        await Promise.allSettled([
          shouldPrefetchConversations ? prefetchChatRooms(userId) : Promise.resolve(),
          shouldPrefetchMyPage ? prefetchMyPage() : Promise.resolve(),
          shouldPrefetchSearch ? prefetchSearchSocial() : Promise.resolve(),
          shouldPrefetchSuggestions ? prefetchSuggestions() : Promise.resolve(),
        ]);
      } catch {}
    }

    void prefetch();
  }, [userId, pathname]);

  return null;
}
