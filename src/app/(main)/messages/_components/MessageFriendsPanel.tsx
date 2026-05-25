"use client";

import { useMemo, useState } from "react";
import type { MouseEvent, ReactNode } from "react";
import { Check, LayoutGrid, LayoutList, MoreVertical, Plus, UsersRound } from "lucide-react";
import Avatar from "@/components/ui/Avatar";
import SendMessageModal from "@/components/modal/SendMessageModal";
import ProfileModal from "../../search/_components/ProfileModal";
import SearchToasts from "../../search/_components/SearchToasts";
import UserActionMenu from "../../search/_components/UserActionMenu";
import { useFriendActions } from "../../search/_hooks/useFriendActions";
import { useProfileModal } from "../../search/_hooks/useProfileModal";
import { useSearchSocialData } from "../../search/_hooks/useSearchSocialData";
import { useUserMenuActions } from "../../search/_hooks/useUserMenuActions";
import type { DancerMember, Follower, Suggestion } from "../../search/_types/search";
import { formatLocation } from "../../search/_lib/search-utils";

interface MessageFriendsPanelProps {
  onlineIds: Set<string>;
  onMessageSent: (roomId: string) => void;
}

function sortByProfileUpdate(a: Follower, b: Follower) {
  const aTime = new Date(a.profile_updated_at ?? a.relation_updated_at ?? a.joined_at ?? 0).getTime();
  const bTime = new Date(b.profile_updated_at ?? b.relation_updated_at ?? b.joined_at ?? 0).getTime();
  return bTime - aTime;
}

function suggestionToFollower(suggestion: Suggestion): Follower {
  return {
    id: suggestion.id,
    nickname: suggestion.nickname,
    profile_image_url: suggestion.profile_image_url,
    country: suggestion.country ?? null,
    region: suggestion.region ?? null,
  };
}

function FriendRow({
  member,
  onlineIds,
  onOpenProfile,
  onOpenMenu,
  action,
}: {
  member: Follower;
  onlineIds: Set<string>;
  onOpenProfile: (member: Follower) => void;
  onOpenMenu?: (member: Follower, event: MouseEvent<HTMLButtonElement>) => void;
  action?: ReactNode;
}) {
  const isNotificationOff = !!member.is_greyed;
  const isFollowingOnly = member.status === "approved";

  return (
    <div className={`flex items-center gap-3 border-b border-gray-50 py-3 ${isNotificationOff ? "grayscale" : ""}`}>
      <button type="button" onClick={() => onOpenProfile(member)} className="relative shrink-0" aria-label={`${member.nickname} 프로필`}>
        <div className={isNotificationOff ? "opacity-50" : ""}>
          <Avatar
            src={member.profile_image_url}
            nickname={member.nickname}
            size={44}
            className={isFollowingOnly ? undefined : "border-2 border-white shadow-[0_0_0_2px_#ef4444]"}
          />
        </div>
        {onlineIds.has(member.id) && (
          <span className="absolute bottom-0 right-0 h-3 w-3 rounded-full border-2 border-white bg-green-400" />
        )}
      </button>
      <button type="button" onClick={() => onOpenProfile(member)} className="min-w-0 flex-1 text-left">
        <p className={`truncate text-[16px] font-semibold text-gray-900 ${isNotificationOff ? "opacity-50" : ""}`}>{member.nickname}</p>
        {formatLocation(member.country, member.region) && (
          <p className="truncate text-xs text-gray-400">{formatLocation(member.country, member.region)}</p>
        )}
      </button>
      {isFollowingOnly && (
        <span className="rounded-full border border-gray-300 px-2 py-0.5 text-[14px] text-gray-500">
          연결중
        </span>
      )}
      {action}
      {onOpenMenu && (
        <button
          type="button"
          className="p-2 -mr-2 text-gray-400 shrink-0"
          aria-label="더보기"
          onClick={(event) => onOpenMenu(member, event)}
        >
          <MoreVertical size={18} />
        </button>
      )}
    </div>
  );
}

function FriendGrid({
  members,
  onlineIds,
  onOpenProfile,
}: {
  members: Follower[];
  onlineIds: Set<string>;
  onOpenProfile: (member: Follower) => void;
}) {
  return (
    <div className="grid grid-cols-5 gap-x-3 gap-y-4 pb-4">
      {members.map((member) => (
        <button
          key={member.id}
          type="button"
          onClick={() => onOpenProfile(member)}
          className="relative aspect-square min-w-0 flex items-center justify-center"
          aria-label={`${member.nickname} 프로필`}
        >
          <div className="relative">
            <Avatar src={member.profile_image_url} nickname={member.nickname} size={48} className="border-2 border-white shadow-[0_0_0_2px_#ef4444]" />
            {onlineIds.has(member.id) && (
              <span className="absolute bottom-0 right-0 h-3 w-3 rounded-full border-2 border-white bg-green-400" />
            )}
          </div>
        </button>
      ))}
    </div>
  );
}

export default function MessageFriendsPanel({ onlineIds, onMessageSent }: MessageFriendsPanelProps) {
  const [emptyMembers, setEmptyMembers] = useState<DancerMember[]>([]);
  const socialData = useSearchSocialData("friends");
  const friendActions = useFriendActions({
    followers: socialData.followers,
    setFollowers: socialData.setFollowers,
    following: socialData.following,
    setFollowing: socialData.setFollowing,
    followingStatusById: socialData.followingStatusById,
  });
  const profileModal = useProfileModal({ activeTab: "friends", visibleMembers: [] });
  const [messageTarget, setMessageTarget] = useState<{
    id: string;
    nickname: string;
    profile_image_url: string | null;
  } | null>(null);
  const [friendViewMode, setFriendViewMode] = useState<"list" | "grid">("list");
  const [friendSearch, setFriendSearch] = useState("");

  const menuActions = useUserMenuActions({
    followers: socialData.followers,
    setFollowers: socialData.setFollowers,
    following: socialData.following,
    setFollowing: socialData.setFollowing,
    mySubscribers: socialData.mySubscribers,
    setMySubscribers: socialData.setMySubscribers,
    members: emptyMembers,
    setMembers: setEmptyMembers,
    subscriptionCount: socialData.subscriptionCount,
    memberTotalCount: 0,
    memberRegions: [],
    membersFullyLoaded: true,
    followingStatusById: socialData.followingStatusById,
    getMenuRelation: socialData.getMenuRelation,
    setAddedIds: friendActions.setAddedIds,
    writeMembersCache: () => {},
    removeMemberFromMemberList: () => {},
    refreshSocialLists: socialData.refreshSocialLists,
    invalidatePendingCache: () => {},
    lockCurrentFriendOrder: socialData.lockCurrentFriendOrder,
  });

  const connectedFriends = useMemo(
    () => socialData.following.filter((member) => member.status === "friend" || member.status === "approved"),
    [socialData.following]
  );

  const mutualFriends = useMemo(
    () => connectedFriends.filter((member) => member.status === "friend"),
    [connectedFriends]
  );

  const visibleFriends = useMemo(
    () =>
      connectedFriends.filter((member) => {
        const keyword = friendSearch.trim().toLowerCase();
        if (!keyword) return true;
        return member.nickname.toLowerCase().includes(keyword);
      }),
    [connectedFriends, friendSearch]
  );

  const recentlyUpdatedFriends = useMemo(
    () =>
      mutualFriends
        .filter((member) => Boolean(member.profile_updated_at ?? member.relation_updated_at ?? member.joined_at))
        .slice()
        .sort(sortByProfileUpdate)
        .slice(0, 10),
    [mutualFriends]
  );

  const suggestions = friendActions.suggestions.slice(0, 10);

  return (
    <div className="bg-white px-4 pb-6">
      <section className="pt-3">
        <div className="relative mb-3 flex items-center">
          <div className="flex items-center gap-1 text-gray-900">
            <UsersRound size={24} />
            <span className="font-bold tabular-nums" style={{ fontSize: 18 }}>{connectedFriends.length}</span>
          </div>
          <button
            type="button"
            onClick={() => setFriendViewMode((mode) => mode === "list" ? "grid" : "list")}
            className="ml-auto mr-1 h-9 w-9 flex items-center justify-center rounded-full text-gray-500 hover:bg-gray-100 hover:text-gray-900 transition-colors"
            aria-label={friendViewMode === "list" ? "그리드 보기" : "리스트 보기"}
            title={friendViewMode === "list" ? "그리드 보기" : "리스트 보기"}
          >
            {friendViewMode === "list" ? <LayoutGrid size={21} /> : <LayoutList size={21} />}
          </button>
          <div className="absolute left-1/2" style={{ transform: "translateX(calc(-50% + 20px))" }}>
            <div className="relative" style={{ width: 150 }}>
              <input
                type="text"
                placeholder="아이디로 검색"
                value={friendSearch}
                onChange={(e) => setFriendSearch(e.target.value)}
                className="w-full h-8 pl-3 pr-8 border border-gray-200 rounded-full bg-gray-50 focus:outline-none focus:border-gray-400"
                style={{ fontSize: 15 }}
              />
              {friendSearch && (
                <button
                  type="button"
                  onClick={() => setFriendSearch("")}
                  className="absolute right-2 top-1/2 -translate-y-1/2 w-4 h-4 rounded-full bg-gray-300 flex items-center justify-center"
                  aria-label="검색어 지우기"
                >
                  <span className="text-white text-[10px] leading-none font-bold">x</span>
                </button>
              )}
            </div>
          </div>
        </div>
        {visibleFriends.length === 0 ? (
          <p className="py-5 text-sm text-gray-400">맞팔 친구가 없습니다</p>
        ) : friendViewMode === "grid" ? (
          <FriendGrid
            members={visibleFriends}
            onlineIds={onlineIds}
            onOpenProfile={profileModal.openFriendProfile}
          />
        ) : (
          <div className="flex flex-col">
            {visibleFriends.map((member) => (
              <FriendRow
                key={member.id}
                member={member}
                onlineIds={onlineIds}
                onOpenProfile={profileModal.openFriendProfile}
                onOpenMenu={menuActions.openUserMenu}
              />
            ))}
          </div>
        )}
      </section>

      <section className="pt-5">
        <h2 className="mb-1 text-[16px] font-bold text-gray-900">최근 프로필을 수정한 친구</h2>
        {recentlyUpdatedFriends.length === 0 ? (
          <p className="py-5 text-sm text-gray-400">최근 수정한 친구가 없습니다</p>
        ) : (
          <div className="flex flex-col">
            {recentlyUpdatedFriends.map((member) => (
              <FriendRow
                key={member.id}
                member={member}
                onlineIds={onlineIds}
                onOpenProfile={profileModal.openFriendProfile}
                onOpenMenu={menuActions.openUserMenu}
              />
            ))}
          </div>
        )}
      </section>

      <section className="pt-5">
        <h2 className="mb-1 text-[16px] font-bold text-gray-900">친구추천</h2>
        {friendActions.suggestionsLoading ? (
          <div className="flex flex-col">
            {Array.from({ length: 5 }).map((_, index) => (
              <div key={index} className="flex items-center gap-3 border-b border-gray-50 py-3">
                <div className="h-11 w-11 rounded-full bg-gray-200 animate-pulse" />
                <div className="flex-1">
                  <div className="h-4 w-24 rounded bg-gray-200 animate-pulse" />
                  <div className="mt-2 h-3 w-16 rounded bg-gray-100 animate-pulse" />
                </div>
              </div>
            ))}
          </div>
        ) : suggestions.length === 0 ? (
          <p className="py-5 text-sm text-gray-400">친구추천 목록이 없습니다</p>
        ) : (
          <div className="flex flex-col">
            {suggestions.map((suggestion) => {
              const member = suggestionToFollower(suggestion);
              return (
                <FriendRow
                  key={suggestion.id}
                  member={member}
                  onlineIds={onlineIds}
                  onOpenProfile={profileModal.openFriendProfile}
                  action={
                    <button
                      type="button"
                      onClick={() => friendActions.handleAddFriend(suggestion.id)}
                      disabled={friendActions.addedIds.has(suggestion.id)}
                      className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full ${
                        friendActions.addedIds.has(suggestion.id) ? "bg-gray-300 text-white" : "bg-yellow-300 text-gray-900"
                      }`}
                      aria-label={`${suggestion.nickname} 친구추가`}
                    >
                      {friendActions.addedIds.has(suggestion.id) ? <Check size={14} strokeWidth={3} /> : <Plus size={17} strokeWidth={3} />}
                    </button>
                  }
                />
              );
            })}
          </div>
        )}
      </section>

      {profileModal.profileModal && (
        <ProfileModal
          activeTab="pending"
          profileModal={profileModal.profileModal}
          profileModalData={profileModal.profileModalData}
          onClose={profileModal.closeProfileModal}
          onSetMenuTarget={() => {}}
          getMenuRelation={socialData.getMenuRelation}
          getRelationStatusValue={socialData.getRelationStatusValue}
          onOpenMessage={setMessageTarget}
          onFollowFromMenu={friendActions.handleFollowFromMenu}
          onViewProfile={() => {}}
          hideViewProfileButton
        />
      )}

      {menuActions.menuTarget && (
        <UserActionMenu
          menuTarget={menuActions.menuTarget}
          onClose={menuActions.closeMenu}
          onViewProfile={(id) => {
            const member = connectedFriends.find((item) => item.id === id);
            menuActions.closeMenu();
            if (member) profileModal.openFriendProfile(member);
          }}
          onToggleSubscription={menuActions.handleToggleSubscription}
          onSetFollowingGrey={menuActions.handleSetFollowingGrey}
          onUnsetFollowingGrey={menuActions.handleUnsetFollowingGrey}
          onCancelFollowing={menuActions.handleCancelFollowing}
          onAcceptFollower={friendActions.handleAcceptFollower}
          onFollowFromMenu={(member) => {
            menuActions.closeMenu();
            friendActions.handleFollowFromMenu(member);
          }}
          onOpenMessage={(receiver) => {
            menuActions.setMessageModalTarget(receiver);
            menuActions.closeMenu();
          }}
          onHideFriend={menuActions.handleHideFriend}
          onUnhideFriend={menuActions.closeMenu}
          onReportUser={menuActions.handleReportUser}
        />
      )}

      <SearchToasts
        showBlackReportToast={menuActions.showBlackReportToast}
        showHideFriendToast={menuActions.showHideFriendToast}
        friendLinkedNickname={friendActions.friendLinkedNickname}
        followingCancelledNickname={menuActions.followingCancelledNickname}
      />

      {(messageTarget || menuActions.messageModalTarget) && (
        <SendMessageModal
          isOpen={!!(messageTarget || menuActions.messageModalTarget)}
          receiver={(messageTarget ?? menuActions.messageModalTarget)!}
          onClose={() => {
            setMessageTarget(null);
            menuActions.setMessageModalTarget(null);
          }}
          onSent={onMessageSent}
        />
      )}
    </div>
  );
}
