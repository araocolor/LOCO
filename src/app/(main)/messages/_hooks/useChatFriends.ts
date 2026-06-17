"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import type { Follower } from "../../search/_types/search";
import {
  readFriendsCache,
  isFriendsCacheFresh,
  fetchFriends as fetchFriendsCache,
} from "@/lib/chat/friends-cache";

export function useChatFriends() {
  const [followers, setFollowers] = useState<Follower[]>([]);
  const [following, setFollowing] = useState<Follower[]>([]);

  const fetchFriends = useCallback(() => {
    fetchFriendsCache().then((res) => {
      if (!res) return;
      setFollowing(res.following);
      setFollowers(res.followers);
    });
  }, []);

  useEffect(() => {
    const cached = readFriendsCache();
    if (cached) {
      setFollowing(cached.following);
      setFollowers(cached.followers);
      if (isFriendsCacheFresh(cached)) return;
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
