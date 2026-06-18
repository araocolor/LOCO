"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { fetchWithAuthRetry } from "@/lib/auth/fetch-with-auth-retry";
import { SEARCH_CACHE_KEY } from "../_lib/constants";
import {
  compareFriendsByNotification,
  sortFollowersOnce,
  syncMyPageSocialCounts,
  writeSearchSocialCache,
} from "../_lib/search-utils";
import { getInitialFriendListMode } from "../_lib/tab";
import type { Follower, MenuRelation, SocialListMode, Tab } from "../_types/search";

export function useSearchSocialData(activeTab: Tab) {
  const [followers, setFollowers] = useState<Follower[]>([]);
  const [following, setFollowing] = useState<Follower[]>([]);
  const [mySubscribers, setMySubscribers] = useState<Follower[]>([]);
  const [socialViewMode, setSocialViewMode] = useState<"list" | "grid">("list");
  const [friendSearch, setFriendSearch] = useState("");
  const [friendViewMode, setFriendViewMode] = useState<"list" | "grid">("grid");
  const [friendOrderIds, setFriendOrderIds] = useState<string[]>([]);
  const [friendListMode, setFriendListMode] = useState<"following" | "friends">(getInitialFriendListMode);
  const [socialListMode, setSocialListMode] = useState<SocialListMode>("followers");
  const [subscriptionCount, setSubscriptionCount] = useState(0);
  const [socialLoadError, setSocialLoadError] = useState(false);

  const prevActiveTabRef = useRef<Tab>(activeTab);

  const hasSocialCache = useCallback(() => {
    try {
      return Boolean(localStorage.getItem(SEARCH_CACHE_KEY));
    } catch {
      return false;
    }
  }, []);

  const loadFromCache = useCallback(() => {
    try {
      const cached = localStorage.getItem(SEARCH_CACHE_KEY);
      if (cached) {
        const { followers, following, mySubscribers, subscriptionCount } = JSON.parse(cached);
        if (Array.isArray(following)) setFollowing(following);
        if (Array.isArray(followers)) setFollowers(followers);
        if (Array.isArray(mySubscribers)) setMySubscribers(mySubscribers);
        if (typeof subscriptionCount === "number") setSubscriptionCount(subscriptionCount);
      }
    } catch {}
  }, []);

  const fetchFollowersAndFollowing = useCallback(() => {
    fetchWithAuthRetry("/api/friends/social")
      .then((r) => {
        if (!r.ok) throw new Error("social fetch failed");
        return r.json();
      })
      .then((json) => {
        const followers = json.data?.followers ?? [];
        const following = json.data?.following ?? [];
        const mySubscribers = json.data?.mySubscribers ?? [];
        const subscriptionCount = json.data?.subscriptionCount ?? 0;
        const sortedFollowers = sortFollowersOnce(followers, following);
        setFollowers(sortedFollowers);
        setFollowing(following);
        setMySubscribers(mySubscribers);
        setSubscriptionCount(subscriptionCount);
        setSocialLoadError(false);
        try {
          writeSearchSocialCache(sortedFollowers, following, subscriptionCount, Date.now(), mySubscribers);
          syncMyPageSocialCounts(sortedFollowers, following, subscriptionCount);
        } catch {}
      })
      .catch(() => {
        setSocialLoadError(true);
      });
  }, []);

  useEffect(() => {
    const hasCache = hasSocialCache();
    if (hasCache) {
      queueMicrotask(() => loadFromCache());
      return;
    }
    fetchFollowersAndFollowing();
  }, [activeTab, hasSocialCache, loadFromCache, fetchFollowersAndFollowing]);

  useEffect(() => {
    if (activeTab === "followings" && prevActiveTabRef.current !== "followings") {
      setSocialListMode("followers");
    }
    prevActiveTabRef.current = activeTab;
  }, [activeTab]);

  const followingStatusById = useMemo(
    () => new Map(following.map((follower) => [follower.id, follower.status])),
    [following]
  );

  const visibleFollowers = useMemo(() => followers, [followers]);

  const visibleSubscriptions = useMemo(() => {
    const byId = new Map<string, Follower>();
    following.forEach((member) => {
      if (member.is_subscribed) byId.set(member.id, member);
    });
    followers.forEach((member) => {
      if (member.is_subscribed) byId.set(member.id, member);
    });
    mySubscribers.forEach((member) => {
      if (member.is_subscribed) byId.set(member.id, member);
    });
    return Array.from(byId.values()).sort((a, b) => (a.nickname ?? "").localeCompare(b.nickname ?? "", "ko"));
  }, [following, followers, mySubscribers]);

  const socialListMembers = useMemo(() => {
    if (socialListMode === "followers") return visibleFollowers;
    if (socialListMode === "mySubscribers") return mySubscribers;
    if (socialListMode === "subscriptions") return visibleSubscriptions;
    if (socialListMode === "following") return following;
    return [];
  }, [following, mySubscribers, socialListMode, visibleFollowers, visibleSubscriptions]);

  const followerById = useMemo(
    () => new Map(followers.map((item) => [item.id, item])),
    [followers]
  );

  const subscriberById = useMemo(
    () => new Map(mySubscribers.map((item) => [item.id, item])),
    [mySubscribers]
  );

  const getRelationStatusValue = useCallback((id: string) => {
    const status = followingStatusById.get(id);
    if (status === "friend") return "맞팔";
    if (status === "approved") return "팔로잉";
    if (followerById.has(id)) return "팔로워";
    if (subscriberById.has(id)) return "구독자";
    return "아님";
  }, [followingStatusById, followerById, subscriberById]);

  const getMenuRelation = useCallback((id: string): MenuRelation => {
    const myStatus = followingStatusById.get(id);
    if (myStatus === "friend") return "mutual";
    if (myStatus === "approved") return "following";
    if (followerById.has(id)) return "follower";
    return "none";
  }, [followingStatusById, followerById]);

  const visibleFriendMembers = useMemo(() => {
    const orderById = new Map(friendOrderIds.map((id, index) => [id, index]));

    return following
      .filter((member) => {
        if (friendListMode === "friends") return member.status === "friend";
        return member.status === "friend" || member.status === "approved";
      })
      .filter((member) => {
        if (friendSearch === "") return true;
        return member.nickname.toLowerCase().includes(friendSearch.toLowerCase());
      })
      .slice()
      .sort((a, b) => {
        const aOrder = orderById.get(a.id);
        const bOrder = orderById.get(b.id);
        if (aOrder != null && bOrder != null) return aOrder - bOrder;
        if (aOrder != null) return -1;
        if (bOrder != null) return 1;
        return compareFriendsByNotification(a, b);
      });
  }, [following, friendSearch, friendOrderIds, friendListMode]);

  const lockCurrentFriendOrder = useCallback(() => {
    setFriendOrderIds((prev) => {
      if (prev.length > 0) return prev;
      return following
        .filter((member) => member.status === "friend")
        .slice()
        .sort(compareFriendsByNotification)
        .map((member) => member.id);
    });
  }, [following]);

  const resortFriendMembers = useCallback(() => {
    setFriendOrderIds(
      following
        .filter((member) => member.status === "friend")
        .slice()
        .sort(compareFriendsByNotification)
        .map((member) => member.id)
    );
  }, [following]);

  return {
    followers,
    setFollowers,
    following,
    setFollowing,
    mySubscribers,
    setMySubscribers,
    socialViewMode,
    setSocialViewMode,
    friendSearch,
    setFriendSearch,
    friendViewMode,
    setFriendViewMode,
    friendListMode,
    setFriendListMode,
    socialListMode,
    setSocialListMode,
    subscriptionCount,
    socialLoadError,
    followingStatusById,
    socialListMembers,
    followerById,
    getRelationStatusValue,
    getMenuRelation,
    visibleFriendMembers,
    lockCurrentFriendOrder,
    resortFriendMembers,
    refreshSocialLists: fetchFollowersAndFollowing,
  };
}
