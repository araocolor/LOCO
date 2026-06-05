"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { fetchWithAuthRetry } from "@/lib/auth/fetch-with-auth-retry";
import type { Follower } from "../../search/_types/search";

const CACHE_KEY = "chat_friends_cache";
const CACHE_TTL = 5 * 60 * 1000;

function readCache(): { following: Follower[]; followers: Follower[]; ts: number } | null {
  try {
    const raw = localStorage.getItem(CACHE_KEY);
    if (!raw) return null;
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

function writeCache(following: Follower[], followers: Follower[]) {
  try {
    localStorage.setItem(CACHE_KEY, JSON.stringify({ following, followers, ts: Date.now() }));
  } catch {}
}

export function useChatFriends() {
  const [followers, setFollowers] = useState<Follower[]>([]);
  const [following, setFollowing] = useState<Follower[]>([]);

  const fetchFriends = useCallback(() => {
    fetchWithAuthRetry("/api/chat/friends")
      .then((r) => {
        if (!r.ok) throw new Error("chat friends fetch failed");
        return r.json();
      })
      .then((json) => {
        const f = json.data?.following ?? [];
        const fr = json.data?.followers ?? [];
        setFollowing(f);
        setFollowers(fr);
        writeCache(f, fr);
      })
      .catch(() => {});
  }, []);

  useEffect(() => {
    const cached = readCache();
    if (cached && Date.now() - cached.ts < CACHE_TTL) {
      setFollowing(cached.following);
      setFollowers(cached.followers);
      return;
    }
    if (cached) {
      setFollowing(cached.following);
      setFollowers(cached.followers);
    }
    fetchFriends();
  }, [fetchFriends]);

  const followingStatusById = useMemo(
    () => new Map(following.map((f) => [f.id, f.status])),
    [following]
  );

  return {
    followers,
    setFollowers,
    following,
    setFollowing,
    followingStatusById,
    refreshFriends: fetchFriends,
  };
}
