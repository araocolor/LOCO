"use client";

import { useEffect, useState } from "react";
import { PROFILE_RETURN_FOCUS_USER_KEY } from "@/lib/profile-return-focus";
import { writeProfilePreviewCache } from "../_lib/search-utils";
import type { DancerMember, Follower, PendingMember, Tab } from "../_types/search";

interface UseProfileModalParams {
  activeTab: Tab;
  visibleMembers: DancerMember[];
}

export function useProfileModal({ activeTab, visibleMembers }: UseProfileModalParams) {
  const [profileModal, setProfileModal] = useState<Follower | null>(null);
  const [profileModalData, setProfileModalData] = useState<{ bio: string | null; member_type: string[] } | null>(null);
  const [closingProfileMemberId, setClosingProfileMemberId] = useState<string | null>(null);

  function readProfileSummaryCache(memberId: string) {
    const cached = sessionStorage.getItem(`user_view_${memberId}`);
    if (cached) {
      try {
        const json = JSON.parse(cached);
        setProfileModalData({ bio: json.profile?.bio ?? null, member_type: json.profile?.member_type ?? [] });
      } catch {}
      return true;
    }
    return false;
  }

  function loadProfileSummary(memberId: string) {
    if (readProfileSummaryCache(memberId)) return;
    fetch(`/api/users/${memberId}/view-summary`)
      .then((res) => res.json())
      .then((json) => {
        sessionStorage.setItem(`user_view_${memberId}`, JSON.stringify(json));
        setProfileModalData({ bio: json.profile?.bio ?? null, member_type: json.profile?.member_type ?? [] });
      })
      .catch(() => {});
  }

  function openSocialProfile(member: Follower) {
    setProfileModal(member);
    loadProfileSummary(member.id);
  }

  function openPendingProfile(member: PendingMember) {
    setProfileModal({
      id: member.id,
      nickname: member.nickname,
      profile_image_url: member.profile_image_url,
      country: member.country,
      region: member.region,
    });
    loadProfileSummary(member.id);
  }

  function openFriendProfile(member: Follower) {
    setProfileModal(member);
    loadProfileSummary(member.id);
  }

  function openMemberProfile(member: Follower) {
    setProfileModal(member);
    if (readProfileSummaryCache(member.id)) return;

    setProfileModalData({ bio: member.bio ?? null, member_type: member.member_type ?? [] });
    writeProfilePreviewCache(member);
  }

  function closeProfileModal() {
    if (profileModal) {
      setClosingProfileMemberId(profileModal.id);
      window.setTimeout(() => setClosingProfileMemberId(null), 1000);
    }
    setProfileModal(null);
    setProfileModalData(null);
  }

  useEffect(() => {
    if (activeTab !== "members") return;

    let focusUserId: string | null = null;
    try {
      focusUserId = sessionStorage.getItem(PROFILE_RETURN_FOCUS_USER_KEY);
    } catch {
      return;
    }

    if (!focusUserId) return;
    if (!visibleMembers.some((member) => member.id === focusUserId)) return;

    try {
      sessionStorage.removeItem(PROFILE_RETURN_FOCUS_USER_KEY);
    } catch {}

    let timeoutId: number | undefined;
    let cancelled = false;

    queueMicrotask(() => {
      if (cancelled) return;
      setClosingProfileMemberId(focusUserId);
      timeoutId = window.setTimeout(() => {
        setClosingProfileMemberId((current) => (current === focusUserId ? null : current));
      }, 1000);
    });

    return () => {
      cancelled = true;
      if (timeoutId) window.clearTimeout(timeoutId);
    };
  }, [activeTab, visibleMembers]);

  return {
    profileModal,
    profileModalData,
    closingProfileMemberId,
    openSocialProfile,
    openPendingProfile,
    openFriendProfile,
    openMemberProfile,
    closeProfileModal,
  };
}
