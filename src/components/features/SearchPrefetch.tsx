"use client";

import { useEffect } from "react";

const CACHE_KEY = "search_prefetch_cache";
const SUGGESTIONS_KEY = "search_suggestions_cache";

export default function SearchPrefetch() {
  useEffect(() => {
    if (!localStorage.getItem(CACHE_KEY)) {
      Promise.all([
        fetch("/api/friends/followers").then((r) => r.json()),
        fetch("/api/friends/following").then((r) => r.json()),
      ])
        .then(([followers, following]) => {
          const nextFollowers = followers.data ?? [];
          const nextFollowing = following.data ?? [];
          localStorage.setItem(
            CACHE_KEY,
            JSON.stringify({
              followers: nextFollowers,
              following: nextFollowing,
              ts: Date.now(),
            })
          );
        })
        .catch(() => {});
    }

    if (!localStorage.getItem(SUGGESTIONS_KEY)) {
      fetch("/api/friends/suggestions?limit=30")
        .then((r) => r.json())
        .then((json) => {
          if (json.data) {
            localStorage.setItem(SUGGESTIONS_KEY, JSON.stringify({ suggestions: json.data, ts: Date.now() }));
          }
        })
        .catch(() => {});
    }
  }, []);

  return null;
}
