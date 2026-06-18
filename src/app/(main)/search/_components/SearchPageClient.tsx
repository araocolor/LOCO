"use client";

import { useCallback, useEffect, useState, useSyncExternalStore } from "react";
import { useRouter } from "next/navigation";
import SearchHeader from "@/components/layout/SearchHeader";
import UserProfileModal from "@/components/user/UserProfileModal";
import { PRESENCE_EVENT } from "@/components/features/PresenceTracker";
import FinderSection from "./FinderSection";
import { CheckModal } from "./SearchBadges";
import ManagementPanel from "./ManagementPanel";
import MembersSection from "./MembersSection";
import SocialSection from "./SocialSection";
import { getSearchTab, replaceSearchTab, subscribeSearchTab } from "../_lib/tab";
import { useFriendActions } from "../_hooks/useFriendActions";
import { useSearchManagementData } from "../_hooks/useSearchManagementData";
import { useSearchMembersData } from "../_hooks/useSearchMembersData";
import { useSearchSocialData } from "../_hooks/useSearchSocialData";
import type { Tab } from "../_types/search";

export default function SearchPage() {
  const router = useRouter();
  const activeTab = useSyncExternalStore(subscribeSearchTab, getSearchTab, (): Tab => "friends");
  const [onlineIds, setOnlineIds] = useState<Set<string>>(new Set());

  const socialData = useSearchSocialData(activeTab);
  const membersData = useSearchMembersData(activeTab);
  const managementData = useSearchManagementData({
    activeTab,
    socialListMode: socialData.socialListMode,
    refreshSocialLists: socialData.refreshSocialLists,
  });
  const friendActions = useFriendActions({
    followers: socialData.followers,
    setFollowers: socialData.setFollowers,
    following: socialData.following,
    setFollowing: socialData.setFollowing,
    followingStatusById: socialData.followingStatusById,
  });
  const [profileModalId, setProfileModalId] = useState<string | null>(null);
  const { setFriendListMode, setSocialListMode } = socialData;
  const { setMemberViewMode } = membersData;

  const handleTabChange = useCallback((tab: Tab) => {
    replaceSearchTab(tab);
    setFriendListMode("following");
if (tab === "members") {
      setMemberViewMode("grid");
    }
    if (tab === "followings") {
      setSocialListMode("followers");
    }
  }, [setFriendListMode, setMemberViewMode, setSocialListMode]);

  useEffect(() => {
    navigator.geolocation?.getCurrentPosition(() => {}, () => {});
  }, []);

  useEffect(() => {
    queueMicrotask(() => {
      if (window.__onlineIds) setOnlineIds(window.__onlineIds);
    });
    const handler = (event: Event) => {
      setOnlineIds((event as CustomEvent<Set<string>>).detail);
    };
    window.addEventListener(PRESENCE_EVENT, handler);
    return () => window.removeEventListener(PRESENCE_EVENT, handler);
  }, []);

  const managementPanel = (
    <ManagementPanel
      isBlacklistUnlocked={managementData.isBlacklistUnlocked}
      blacklistPinInput={managementData.blacklistPinInput}
      blacklistPinError={managementData.blacklistPinError}
      blacklistPinSubmitting={managementData.blacklistPinSubmitting}
      hasBlacklistPin={managementData.hasBlacklistPin}
      pendingMembers={managementData.pendingMembers}
      removingPendingIds={managementData.removingPendingIds}
      onPinChange={managementData.handleBlacklistPinInputChange}
      onPinSubmit={managementData.handleBlacklistPinSubmit}
      onOpenProfile={setProfileModalId}
      onViewProfile={(id) => router.push(`/users/${id}/view`)}
      onUnhideFriend={managementData.handleUnhideFriendFromMenu}
      onUnblockUser={managementData.handleUnblockUser}
      onUnreportUser={managementData.handleUnreportUser}
    />
  );

  return (
    <>
      <SearchHeader activeTab={activeTab} onTabChange={handleTabChange} />

      {activeTab === "followings" && (
        <SocialSection
          socialListMode={socialData.socialListMode}
          setSocialListMode={socialData.setSocialListMode}
          pendingCount={managementData.pendingMembers.length}
          socialListMembers={socialData.socialListMembers}
          socialViewMode={socialData.socialViewMode}
          setSocialViewMode={socialData.setSocialViewMode}
          socialLoadError={socialData.socialLoadError}
          managementPanel={managementPanel}
          onlineIds={onlineIds}
          closingProfileMemberId={null}
          onOpenProfile={setProfileModalId}
        />
      )}

      {activeTab === "members" && (
        <MembersSection
          memberSearchPanelRef={membersData.memberSearchPanelRef}
          onMemberSearchPanelScroll={membersData.handleMemberSearchPanelScroll}
          memberRegion={membersData.memberRegion}
          setMemberRegion={membersData.setMemberRegion}
          availableMemberRegions={membersData.availableMemberRegions}
          memberSearch={membersData.memberSearch}
          setMemberSearch={membersData.setMemberSearch}
          memberGender={membersData.memberGender}
          setMemberGender={membersData.setMemberGender}
          memberGenres={membersData.memberGenres}
          onToggleMemberGenre={membersData.toggleMemberGenre}
          memberSearchMode={membersData.memberSearchMode}
          selectedMemberTypes={membersData.selectedMemberTypes}
          onToggleMemberTypeFilter={membersData.toggleMemberTypeFilter}
          memberResultCount={membersData.memberResultCount}
          basicFilterLocked={membersData.basicFilterLocked}
          setBasicFilterLocked={membersData.setBasicFilterLocked}
          memberViewMode={membersData.memberViewMode}
          setMemberViewMode={membersData.setMemberViewMode}
          membersLoaded={membersData.membersLoaded}
          membersLoading={membersData.membersLoading}
          visibleMembers={membersData.visibleMembers}
          onlineIds={onlineIds}
          closingProfileMemberId={null}
          onOpenProfile={setProfileModalId}
          onViewProfile={(id) => router.push(`/users/${id}/view`)}
          membersFullyLoaded={membersData.membersFullyLoaded}
          onLoadMore={membersData.fetchNextPage}
        />
      )}

{activeTab === "pending" && (
        <div className="px-4 pt-4 bg-white">
          {managementPanel}
        </div>
      )}

      {activeTab === "finder" && <FinderSection />}

      <style jsx global>{`
        @keyframes heartFloatUp {
          0% { transform: translateY(0) scale(0.6); opacity: 0; }
          20% { opacity: 1; }
          100% { transform: translateY(-120px) scale(1.2); opacity: 0; }
        }
        @keyframes floatY {
          0%, 100% { transform: translateY(0); }
          50% { transform: translateY(-6px); }
        }
        @keyframes profileClosePop {
          0% { transform: scale(1); }
          45% { transform: scale(1.22); }
          100% { transform: scale(1); }
        }
        .profile-close-pop {
          animation: profileClosePop 1s ease-out both;
          transform-origin: center;
        }
      `}</style>

      {friendActions.showCheck && <CheckModal />}

      {profileModalId && (
        <UserProfileModal
          userId={profileModalId}
          onClose={() => setProfileModalId(null)}
        />
      )}
    </>
  );
}
