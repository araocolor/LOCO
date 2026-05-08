"use client";

import { useEffect } from "react";

const CACHE_KEY = "search_prefetch_cache";

export default function SearchPrefetch() {
  useEffect(() => {
    Promise.all([
      fetch("/api/friends/followers").then((r) => r.json()),
      fetch("/api/friends/following").then((r) => r.json()),
      fetch("/api/friends/suggestions").then((r) => r.json()),
    ])
      .then(([followers, following, suggestions]) => {
        localStorage.setItem(
          CACHE_KEY,
          JSON.stringify({
            followers: followers.data ?? [],
            following: following.data ?? [],
            suggestions: suggestions.data ?? [],
            ts: Date.now(),
          })
        );
      })
      .catch(() => {});
  }, []);

  return null;
}
