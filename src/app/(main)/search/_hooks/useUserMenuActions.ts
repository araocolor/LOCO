"use client";

import { type Dispatch, type MouseEvent, type SetStateAction, useCallback, useState } from "react";
import {
  USER_VIEW_CACHE_PREFIX,
  syncMyPageSocialCounts,
  writeSearchSocialCache,
} from "../_lib/search-utils";
import type { DancerMember, Follower, MenuRelation, MenuTarget } from "../_types/search";

interface UseUserMenuActionsParams {
  followers: Follower[];
  setFollowers: Dispatch<SetStateAction<Follower[]>>;
  following: Follower[];
  setFollowing: Dispatch<SetStateAction<Follower[]>>;
  mySubscribers: Follower[];
  setMySubscribers: Dispatch<SetStateAction<Follower[]>>;
  members: DancerMember[];
  setMembers: Dispatch<SetStateAction<DancerMember[]>>;
  subscriptionCount: number;
  memberTotalCount: number;
  memberRegions: string[];
  membersFullyLoaded: boolean;
  followingStatusById: Map<string, Follower["status"]>;
  getMenuRelation: (id: string) => MenuRelation;
  setAddedIds: Dispatch<SetStateAction<Set<string>>>;
  writeMembersCache: (nextMembers: DancerMember[], totalCount: number, availableRegions: string[], fullyLoaded: boolean) => void;
  removeMemberFromMemberList: (targetId: string) => void;
  refreshSocialLists: () => void;
  invalidatePendingCache: () => void;
  lockCurrentFriendOrder: () => void;
}

export function useUserMenuActions({
  followers,
  setFollowers,
  following,
  setFollowing,
  mySubscribers,
  setMySubscribers,
  members,
  setMembers,
  subscriptionCount,
  memberTotalCount,
  memberRegions,
  membersFullyLoaded,
  followingStatusById,
  getMenuRelation,
  setAddedIds,
  writeMembersCache,
  removeMemberFromMemberList,
  refreshSocialLists,
  invalidatePendingCache,
  lockCurrentFriendOrder,
}: UseUserMenuActionsParams) {
  const [menuTarget, setMenuTarget] = useState<MenuTarget | null>(null);
  const [messageModalTarget, setMessageModalTarget] = useState<{ id: string; nickname: string; profile_image_url: string | null } | null>(null);
  const [showBlackReportToast, setShowBlackReportToast] = useState(false);
  const [showHideFriendToast, setShowHideFriendToast] = useState(false);
  const [followingCancelledNickname, setFollowingCancelledNickname] = useState<string | null>(null);

  const closeMenu = useCallback(() => {
    setMenuTarget(null);
  }, []);

  function updateSubscriptionState(targetId: string, isSubscribed: boolean) {
    const nextFollowers = followers.map((member) =>
      member.id === targetId ? { ...member, is_subscribed: isSubscribed } : member
    );
    const nextFollowing = following.map((member) =>
      member.id === targetId ? { ...member, is_subscribed: isSubscribed } : member
    );
    const nextMySubscribers = mySubscribers.map((member) =>
      member.id === targetId ? { ...member, is_subscribed: isSubscribed } : member
    );
    const nextMembers = members.map((member) =>
      member.id === targetId ? { ...member, is_subscribed: isSubscribed } : member
    );
    setFollowers(nextFollowers);
    setFollowing(nextFollowing);
    setMySubscribers(nextMySubscribers);
    setMembers(nextMembers);
    try {
      writeSearchSocialCache(nextFollowers, nextFollowing, subscriptionCount, Date.now(), nextMySubscribers);
      syncMyPageSocialCounts(nextFollowers, nextFollowing, subscriptionCount);
      writeMembersCache(nextMembers, memberTotalCount, memberRegions, membersFullyLoaded);
    } catch {}
  }

  async function handleToggleSubscription(targetId: string, nextSubscribed: boolean) {
    setMenuTarget(null);
    updateSubscriptionState(targetId, nextSubscribed);

    try {
      const res = await fetch("/api/user-subscriptions", {
        method: nextSubscribed ? "POST" : "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ target_id: targetId }),
      });

      if (!res.ok) throw new Error();
    } catch {
      updateSubscriptionState(targetId, !nextSubscribed);
      alert(nextSubscribed ? "구독 처리 중 오류가 발생했습니다." : "구독취소 처리 중 오류가 발생했습니다.");
    }
  }

  async function handleReportUser(targetId: string) {
    setMenuTarget(null);
    try {
      const res = await fetch("/api/black-reports", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ target_id: targetId }),
      });

      if (!res.ok) throw new Error();
      setFollowers((prev) => {
        const updated = prev.filter((follower) => follower.id !== targetId);
        try {
          writeSearchSocialCache(updated, following);
          syncMyPageSocialCounts(updated, following);
        } catch {}
        return updated;
      });
      removeMemberFromMemberList(targetId);
      refreshSocialLists();
      invalidatePendingCache();
      setShowBlackReportToast(true);
      setTimeout(() => setShowBlackReportToast(false), 1500);
    } catch {
      alert("신고 처리 중 오류가 발생했습니다.");
    }
  }

  async function handleHideFriend(targetId: string) {
    setMenuTarget(null);
    try {
      const res = await fetch("/api/friends/hide", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ target_id: targetId }),
      });

      if (!res.ok) throw new Error();

      const nextFollowers = followers.filter((member) => member.id !== targetId);
      const nextFollowing = following.filter((member) => member.id !== targetId);
      setFollowers(nextFollowers);
      setFollowing(nextFollowing);
      removeMemberFromMemberList(targetId);
      try {
        writeSearchSocialCache(nextFollowers, nextFollowing);
        syncMyPageSocialCounts(nextFollowers, nextFollowing);
      } catch {}
      refreshSocialLists();
      invalidatePendingCache();
      setShowHideFriendToast(true);
      setTimeout(() => setShowHideFriendToast(false), 2000);
    } catch {
      alert("친구숨김 처리 중 오류가 발생했습니다.");
    }
  }

  async function handleSetFollowingGrey(targetId: string) {
    setMenuTarget(null);
    lockCurrentFriendOrder();
    const prevFollowing = following;
    const nextFollowing = following.map((item) =>
      item.id === targetId ? { ...item, is_greyed: true } : item
    );
    setFollowing(nextFollowing);
    try {
      writeSearchSocialCache(followers, nextFollowing);
      syncMyPageSocialCounts(followers, nextFollowing);
    } catch {}

    try {
      const res = await fetch("/api/friends/grey", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ target_id: targetId }),
      });
      if (!res.ok) throw new Error();
    } catch {
      setFollowing(prevFollowing);
      try {
        writeSearchSocialCache(followers, prevFollowing);
        syncMyPageSocialCounts(followers, prevFollowing);
      } catch {}
      alert("알림끄기 처리 중 오류가 발생했습니다.");
    }
  }

  async function handleUnsetFollowingGrey(targetId: string) {
    setMenuTarget(null);
    lockCurrentFriendOrder();
    const prevFollowing = following;
    const nextFollowing = following.map((item) =>
      item.id === targetId ? { ...item, is_greyed: false } : item
    );
    setFollowing(nextFollowing);
    try {
      writeSearchSocialCache(followers, nextFollowing);
      syncMyPageSocialCounts(followers, nextFollowing);
    } catch {}

    try {
      const res = await fetch("/api/friends/grey", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ target_id: targetId }),
      });
      if (!res.ok) throw new Error();
    } catch {
      setFollowing(prevFollowing);
      try {
        writeSearchSocialCache(followers, prevFollowing);
        syncMyPageSocialCounts(followers, prevFollowing);
      } catch {}
      alert("알림켜기 처리 중 오류가 발생했습니다.");
    }
  }

  async function handleCancelFollowing(member: Follower) {
    setMenuTarget(null);
    const prevFollowing = following;
    const nextFollowing = following.filter((item) => item.id !== member.id);
    setFollowing(nextFollowing);
    setAddedIds((prev) => {
      const next = new Set(prev);
      next.delete(member.id);
      return next;
    });
    try {
      writeSearchSocialCache(followers, nextFollowing);
      syncMyPageSocialCounts(followers, nextFollowing);
    } catch {}

    try {
      const res = await fetch("/api/friends", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ target_id: member.id }),
      });

      if (!res.ok) throw new Error();
      setFollowingCancelledNickname(member.nickname);
      setTimeout(() => setFollowingCancelledNickname(null), 1500);
    } catch {
      setFollowing(prevFollowing);
      try {
        writeSearchSocialCache(followers, prevFollowing);
        syncMyPageSocialCounts(followers, prevFollowing);
      } catch {}
      alert("팔로잉취소 처리 중 오류가 발생했습니다.");
    }
  }

  function openUserMenu(member: Follower, event: MouseEvent<HTMLButtonElement>, source?: "social" | "members") {
    event.stopPropagation();
    const rect = event.currentTarget.getBoundingClientRect();
    const placement = rect.top > window.innerHeight / 2 ? "top" : "bottom";
    setMenuTarget({
      id: member.id,
      nickname: member.nickname,
      status: source === "members" ? followingStatusById.get(member.id) : member.status,
      relation: getMenuRelation(member.id),
      x: rect.right,
      y: placement === "top" ? rect.top : rect.bottom,
      placement,
      member,
      isHidden: !!member.is_hidden,
      source,
    });
    fetch(`/api/users/${member.id}/view-summary`)
      .then((res) => res.json())
      .then((json) => {
        sessionStorage.setItem(`${USER_VIEW_CACHE_PREFIX}${member.id}`, JSON.stringify(json));
      })
      .catch(() => {});
  }

  return {
    menuTarget,
    setMenuTarget,
    closeMenu,
    messageModalTarget,
    setMessageModalTarget,
    showBlackReportToast,
    showHideFriendToast,
    followingCancelledNickname,
    handleToggleSubscription,
    handleReportUser,
    handleHideFriend,
    handleSetFollowingGrey,
    handleUnsetFollowingGrey,
    handleCancelFollowing,
    openUserMenu,
  };
}
