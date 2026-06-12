"use client";

import { type Dispatch, type SetStateAction, useEffect, useState } from "react";
import { syncMyPageSocialCounts, writeSearchSocialCache } from "../_lib/search-utils";
import type { Follower, Suggestion } from "../_types/search";

const SUGGESTIONS_CACHE_KEY = "search_suggestions_cache";
const CHAT_FRIENDS_CACHE_KEY = "chat_friends_cache";
const SUGGESTIONS_CACHE_VERSION = 2;
const SUGGESTIONS_PAGE_SIZE = 20;
const SUGGESTIONS_MAX_COUNT = 40;

interface UseFriendActionsParams {
  followers: Follower[];
  setFollowers: Dispatch<SetStateAction<Follower[]>>;
  following: Follower[];
  setFollowing: Dispatch<SetStateAction<Follower[]>>;
  followingStatusById: Map<string, Follower["status"]>;
}

function writeChatFriendsCache(followers: Follower[], following: Follower[]) {
  try {
    localStorage.setItem(CHAT_FRIENDS_CACHE_KEY, JSON.stringify({ following, followers, ts: Date.now() }));
  } catch {}
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
  const [suggestionsLoadingMore, setSuggestionsLoadingMore] = useState(false);
  const [suggestionsHasMore, setSuggestionsHasMore] = useState(false);
  const [addedIds, setAddedIds] = useState<Set<string>>(new Set());
  const [acceptingFollowerIds, setAcceptingFollowerIds] = useState<Set<string>>(new Set());
  const [showCheck, setShowCheck] = useState(false);
  const [friendLinkedNickname, setFriendLinkedNickname] = useState<string | null>(null);

  useEffect(() => {
    const cached = localStorage.getItem(SUGGESTIONS_CACHE_KEY);
    if (cached) {
      try {
        const parsed = JSON.parse(cached);
        if (parsed.version === SUGGESTIONS_CACHE_VERSION && parsed.suggestions) {
          queueMicrotask(() => {
            setSuggestions(parsed.suggestions);
            setSuggestionsHasMore(Boolean(parsed.hasMore));
            setSuggestionsLoading(false);
          });
          return;
        }
      } catch {}
    }
    queueMicrotask(() => setSuggestionsLoading(true));
    fetch(`/api/friends/suggestions?limit=${SUGGESTIONS_PAGE_SIZE}&offset=0`)
      .then((r) => r.json())
      .then((json) => {
        if (json.data) {
          setSuggestions(json.data);
          setSuggestionsHasMore(Boolean(json.meta?.hasMore));
          try {
            localStorage.setItem(
              SUGGESTIONS_CACHE_KEY,
              JSON.stringify({
                version: SUGGESTIONS_CACHE_VERSION,
                suggestions: json.data,
                hasMore: Boolean(json.meta?.hasMore),
                ts: Date.now(),
              })
            );
          } catch {}
        }
      })
      .catch(() => {})
      .finally(() => setSuggestionsLoading(false));
  }, []);

  function refillSuggestionsCache(excludeIds: Set<string>, count: number) {
    fetch(`/api/friends/suggestions?limit=${count}&offset=${suggestions.length}`)
      .then((r) => r.json())
      .then((json) => {
        if (!json.data) return;
        const sc = localStorage.getItem(SUGGESTIONS_CACHE_KEY);
        const existing: Suggestion[] = sc ? (JSON.parse(sc).suggestions ?? []) : [];
        const existingIds = new Set(existing.map((suggestion) => suggestion.id));
        const newItems = (json.data as Suggestion[]).filter(
          (suggestion) => !existingIds.has(suggestion.id) && !excludeIds.has(suggestion.id)
        );
        const merged = [...existing, ...newItems].slice(0, SUGGESTIONS_MAX_COUNT);
        const hasMore = Boolean(json.meta?.hasMore) && merged.length < SUGGESTIONS_MAX_COUNT;
        setSuggestionsHasMore(hasMore);
        localStorage.setItem(
          SUGGESTIONS_CACHE_KEY,
          JSON.stringify({ version: SUGGESTIONS_CACHE_VERSION, suggestions: merged, hasMore, ts: Date.now() })
        );
        setSuggestions((prev) => {
          const prevIds = new Set(prev.map((suggestion) => suggestion.id));
          return [...prev, ...newItems.filter((suggestion) => !prevIds.has(suggestion.id))].slice(0, SUGGESTIONS_MAX_COUNT);
        });
      })
      .catch(() => {});
  }

  function loadMoreSuggestions() {
    if (suggestionsLoading || suggestionsLoadingMore || !suggestionsHasMore || suggestions.length >= SUGGESTIONS_MAX_COUNT) return;
    setSuggestionsLoadingMore(true);
    fetch(`/api/friends/suggestions?limit=${SUGGESTIONS_PAGE_SIZE}&offset=${suggestions.length}`)
      .then((r) => r.json())
      .then((json) => {
        if (!json.data) return;
        setSuggestions((prev) => {
          const prevIds = new Set(prev.map((suggestion) => suggestion.id));
          const newItems = (json.data as Suggestion[]).filter((suggestion) => !prevIds.has(suggestion.id));
          const merged = [...prev, ...newItems].slice(0, SUGGESTIONS_MAX_COUNT);
          const hasMore = Boolean(json.meta?.hasMore) && merged.length < SUGGESTIONS_MAX_COUNT;
          queueMicrotask(() => {
            setSuggestionsHasMore(hasMore);
            try {
              localStorage.setItem(
                SUGGESTIONS_CACHE_KEY,
                JSON.stringify({ version: SUGGESTIONS_CACHE_VERSION, suggestions: merged, hasMore, ts: Date.now() })
              );
            } catch {}
          });
          return merged;
        });
      })
      .catch(() => {})
      .finally(() => setSuggestionsLoadingMore(false));
  }

  function handleAddFriend(id: string) {
    if (addedIds.has(id)) return;
    const added = suggestions.find((suggestion) => suggestion.id === id);

    const nextAddedIds = new Set(addedIds).add(id);
    setAddedIds(nextAddedIds);
    setSuggestions((prev) => prev.filter((suggestion) => suggestion.id !== id));
    try {
      const sc = localStorage.getItem(SUGGESTIONS_CACHE_KEY);
      if (sc) {
        const parsed = JSON.parse(sc);
        parsed.suggestions = (parsed.suggestions ?? []).filter((suggestion: { id: string }) => suggestion.id !== id);
        localStorage.setItem(SUGGESTIONS_CACHE_KEY, JSON.stringify(parsed));
      }
    } catch {}

    if (suggestions.length < SUGGESTIONS_PAGE_SIZE && suggestionsHasMore) {
      refillSuggestionsCache(nextAddedIds, SUGGESTIONS_PAGE_SIZE);
    }
    if (added) {
      const addedWithStatus: Follower = {
        ...added,
        country: added.country ?? null,
        region: added.region ?? null,
        status: "approved",
        relation_updated_at: new Date().toISOString(),
      };
      setFollowing((prev) => {
        const updated = [addedWithStatus, ...prev];
        try {
          writeSearchSocialCache(followers, updated);
          writeChatFriendsCache(followers, updated);
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
            writeChatFriendsCache(followers, updated);
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
        writeChatFriendsCache(followers, updated);
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
          writeChatFriendsCache(followers, updated);
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
      writeChatFriendsCache(nextFollowers, nextFollowing);
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
        writeChatFriendsCache(followers, previousFollowing);
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
    suggestionsLoadingMore,
    suggestionsHasMore,
    addedIds,
    setAddedIds,
    acceptingFollowerIds,
    showCheck,
    friendLinkedNickname,
    handleAddFriend,
    loadMoreSuggestions,
    handleFollowFromMenu,
    handleAcceptFollower,
  };
}
