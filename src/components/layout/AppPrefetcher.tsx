"use client";

import { useEffect } from "react";
import { fetchWithAuthRetry } from "@/lib/auth/fetch-with-auth-retry";

const CHAT_ROOMS_CACHE_KEY = "loco_chat_rooms_cache_v1";
const MYPAGE_CACHE_KEY = "loco_mypage_cache_local_v2";
const SEARCH_CACHE_KEY = "search_prefetch_cache";
const SUGGESTIONS_KEY = "search_suggestions_cache";

export default function AppPrefetcher({ isLoggedIn }: { isLoggedIn: boolean }) {
  useEffect(() => {
    async function prefetch() {
      try {
        const shouldPrefetchConversations = !localStorage.getItem(CHAT_ROOMS_CACHE_KEY);
        const shouldPrefetchMyPage = !localStorage.getItem(MYPAGE_CACHE_KEY);
        const shouldPrefetchSearch = !localStorage.getItem(SEARCH_CACHE_KEY);
        const shouldPrefetchSuggestions = !localStorage.getItem(SUGGESTIONS_KEY);
        if (
          !isLoggedIn ||
          (
            !shouldPrefetchConversations &&
            !shouldPrefetchMyPage &&
            !shouldPrefetchSearch &&
            !shouldPrefetchSuggestions
          )
        ) return;

        if (shouldPrefetchConversations) {
          const convRes = await fetch("/api/chat/rooms");
          if (convRes.ok) {
            const json = await convRes.json();
            if (json.data) localStorage.setItem(CHAT_ROOMS_CACHE_KEY, JSON.stringify(json.data.slice(0, 20)));
          }
        }

        if (shouldPrefetchMyPage) {
          const mypageRes = await fetch("/api/mypage/summary");
          if (mypageRes.ok) {
            const json = await mypageRes.json();
            if (json.profile) localStorage.setItem(MYPAGE_CACHE_KEY, JSON.stringify(json));
          }
        }

        if (shouldPrefetchSearch) {
          const socialRes = await fetchWithAuthRetry("/api/friends/social");
          if (socialRes.ok) {
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
        }

        if (shouldPrefetchSuggestions) {
          const suggestionsRes = await fetch("/api/friends/suggestions?limit=30");
          if (suggestionsRes.ok) {
            const json = await suggestionsRes.json();
            if (json.data) localStorage.setItem(SUGGESTIONS_KEY, JSON.stringify({ suggestions: json.data, ts: Date.now() }));
          }
        }
      } catch {}
    }

    void prefetch();
  }, [isLoggedIn]);

  return null;
}
