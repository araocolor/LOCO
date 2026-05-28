"use client";

import { type Dispatch, type SetStateAction, useEffect, useState } from "react";
import { syncMyPageSocialCounts, writeSearchSocialCache } from "../_lib/search-utils";
import type { Follower, Suggestion } from "../_types/search";

interface UseFriendActionsParams {
  followers: Follower[];
  setFollowers: Dispatch<SetStateAction<Follower[]>>;
  following: Follower[];
  setFollowing: Dispatch<SetStateAction<Follower[]>>;
  followingStatusById: Map<string, Follower["status"]>;
}

export function useFriendActions({
  followers,
  setFollowers,
  following,
  setFollowing,
  followingStatusById,
}: UseFriendActionsParams) {
  const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
  const [suggestionsLoading, setSuggestionsLoading] = useState(true);
  const [addedIds, setAddedIds] = useState<Set<string>>(new Set());
  const [acceptingFollowerIds, setAcceptingFollowerIds] = useState<Set<string>>(new Set());
  const [showCheck, setShowCheck] = useState(false);
  const [friendLinkedNickname, setFriendLinkedNickname] = useState<string | null>(null);

  useEffect(() => {
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
      .then((json) => {
        if (json.data) {
          setSuggestions(json.data);
          try {
            localStorage.setItem("search_suggestions_cache", JSON.stringify({ suggestions: json.data, ts: Date.now() }));
          } catch {}
        }
      })
      .catch(() => {})
      .finally(() => setSuggestionsLoading(false));
  }, []);

  function refillSuggestionsCache(excludeIds: Set<string>, count: number) {
    fetch(`/api/friends/suggestions?limit=${count}`)
      .then((r) => r.json())
      .then((json) => {
        if (!json.data) return;
        const sc = localStorage.getItem("search_suggestions_cache");
        const existing: Suggestion[] = sc ? (JSON.parse(sc).suggestions ?? []) : [];
        const existingIds = new Set(existing.map((suggestion) => suggestion.id));
        const newItems = (json.data as Suggestion[]).filter(
          (suggestion) => !existingIds.has(suggestion.id) && !excludeIds.has(suggestion.id)
        );
        const merged = [...existing, ...newItems].slice(0, 30);
        localStorage.setItem("search_suggestions_cache", JSON.stringify({ suggestions: merged, ts: Date.now() }));
        setSuggestions((prev) => {
          const prevIds = new Set(prev.map((suggestion) => suggestion.id));
          return [...prev, ...newItems.filter((suggestion) => !prevIds.has(suggestion.id))];
        });
      })
      .catch(() => {});
  }

  function handleAddFriend(id: string) {
    if (addedIds.has(id)) return;
    const added = suggestions.find((suggestion) => suggestion.id === id);

    const nextAddedIds = new Set(addedIds).add(id);
    setAddedIds(nextAddedIds);
    setSuggestions((prev) => prev.filter((suggestion) => suggestion.id !== id));
    try {
      const sc = localStorage.getItem("search_suggestions_cache");
      if (sc) {
        const parsed = JSON.parse(sc);
        parsed.suggestions = (parsed.suggestions ?? []).filter((suggestion: { id: string }) => suggestion.id !== id);
        localStorage.setItem("search_suggestions_cache", JSON.stringify(parsed));
      }
    } catch {}

    if (nextAddedIds.size === 10) {
      refillSuggestionsCache(nextAddedIds, 10);
    }
    if (added) {
      const addedWithStatus: Follower = {
        ...added,
        status: "approved",
        relation_updated_at: new Date().toISOString(),
      };
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

    fetch("/api/friends", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ target_id: id }),
    }).then((res) => {
      if (!res.ok) throw new Error();
    }).catch(() => {
      setAddedIds((prev) => {
        const next = new Set(prev);
        next.delete(id);
        return next;
      });
      if (added) {
        setSuggestions((prev) => [added, ...prev]);
        setFollowing((prev) => {
          const updated = prev.filter((follower) => follower.id !== id);
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
    if (followingStatusById.has(member.id) || addedIds.has(member.id)) return;

    const nextAddedIds = new Set(addedIds).add(member.id);
    const addedWithStatus: Follower = {
      ...member,
      status: "approved",
      relation_updated_at: new Date().toISOString(),
    };
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
      ? following.map((item) =>
          item.id === follower.id
            ? { ...item, status: "friend" as const, friend_accepted_at: acceptedFollower.friend_accepted_at }
            : item
        )
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

  return {
    suggestions,
    suggestionsLoading,
    addedIds,
    setAddedIds,
    acceptingFollowerIds,
    showCheck,
    friendLinkedNickname,
    handleAddFriend,
    handleFollowFromMenu,
    handleAcceptFollower,
  };
}
