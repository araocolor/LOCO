"use client";

import { useEffect } from "react";
import { usePathname } from "next/navigation";
import { fetchWithAuthRetry } from "@/lib/auth/fetch-with-auth-retry";

const MYPAGE_CACHE_KEY = "loco_mypage_cache_local_v2";
const SEARCH_CACHE_KEY = "search_prefetch_cache";
const SUGGESTIONS_KEY = "search_suggestions_cache";
const SEARCH_CACHE_TTL_MS = 3 * 60 * 1000;

function hasFreshSearchCache() {
  try {
    const raw = localStorage.getItem(SEARCH_CACHE_KEY);
    if (!raw) return false;
    const parsed = JSON.parse(raw) as { ts?: number };
    return typeof parsed.ts === "number" && Date.now() - parsed.ts < SEARCH_CACHE_TTL_MS;
  } catch {
    return false;
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

        const shouldPrefetchMyPage = !localStorage.getItem(MYPAGE_CACHE_KEY);
        const shouldPrefetchSearch = !localStorage.getItem(SEARCH_CACHE_KEY);
        const shouldPrefetchSuggestions = !localStorage.getItem(SUGGESTIONS_KEY);
        if (
          !userId ||
          (
            !shouldPrefetchMyPage &&
            !shouldPrefetchSearch &&
            !shouldPrefetchSuggestions
          )
        ) return;

        await Promise.allSettled([
          shouldPrefetchMyPage ? prefetchMyPage() : Promise.resolve(),
          shouldPrefetchSearch ? prefetchSearchSocial() : Promise.resolve(),
          shouldPrefetchSuggestions ? prefetchSuggestions() : Promise.resolve(),
        ]);
      } catch {}
    }

    void prefetch();
  }, [userId, pathname]);

  useEffect(() => {
    if (pathname !== "/" || !userId || hasFreshSearchCache()) return;
    void prefetchSearchSocial();
  }, [userId, pathname]);

  return null;
}
