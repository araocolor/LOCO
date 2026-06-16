"use client";

import { useMemo, useState } from "react";
import type { ReactNode, UIEvent } from "react";
import Image from "next/image";
import { Check, LayoutGrid, LayoutList, Plus, UsersRound } from "lucide-react";
import Avatar from "@/components/ui/Avatar";
import SendMessageModal from "@/components/modal/SendMessageModal";
import UserProfileModal from "@/components/user/UserProfileModal";
import { useFriendActions } from "../../search/_hooks/useFriendActions";
import { useChatFriends } from "../_hooks/useChatFriends";
import type { Follower, Suggestion } from "../../search/_types/search";
import { formatLocation, formatRecentActiveTime, getAvatarFloatStyle } from "../../search/_lib/search-utils";

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
  action,
}: {
  member: Follower;
  onlineIds: Set<string>;
  onOpenProfile: (member: Follower) => void;
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
          className="min-w-0 flex flex-col items-center"
          aria-label={`${member.nickname} 프로필`}
        >
          <div className="relative">
            <Avatar src={member.profile_image_url} nickname={member.nickname} size={48} className={member.status === "friend" ? "border-2 border-white shadow-[0_0_0_2px_#ef4444]" : undefined} />
            {onlineIds.has(member.id) && (
              <span className="absolute bottom-0 right-0 h-3 w-3 rounded-full border-2 border-white bg-green-400" />
            )}
          </div>
          <span className="mt-1 max-w-full truncate text-center text-[13px] font-semibold text-gray-900">
            {member.nickname}
          </span>
          {(formatLocation(member.country, member.region) || member.last_active_at) && (
            <span className="max-w-full truncate text-center text-[11px] text-gray-400">
              {[formatLocation(member.country, member.region), formatRecentActiveTime(member.last_active_at ?? null)].filter(Boolean).join(",")}
            </span>
          )}
        </button>
      ))}
    </div>
  );
}

export default function MessageFriendsPanel({ onlineIds, onMessageSent }: MessageFriendsPanelProps) {

  const chatFriends = useChatFriends();
  const friendActions = useFriendActions({
    followers: chatFriends.followers,
    setFollowers: chatFriends.setFollowers,
    following: chatFriends.following,
    setFollowing: chatFriends.setFollowing,
    followingStatusById: chatFriends.followingStatusById,
  });
  const [profileModalTarget, setProfileModalTarget] = useState<Follower | null>(null);
  const [messageTarget, setMessageTarget] = useState<{
    id: string;
    nickname: string;
    profile_image_url: string | null;
  } | null>(null);
  const [friendViewMode, setFriendViewMode] = useState<"list" | "grid">("grid");
  const [friendSearch, setFriendSearch] = useState("");

  const connectedFriends = useMemo(
    () => chatFriends.following.filter((member) => member.status === "friend" || member.status === "approved"),
    [chatFriends.following]
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

  const suggestions = friendActions.suggestions;

  function handleSuggestionsScroll(event: UIEvent<HTMLDivElement>) {
    const target = event.currentTarget;
    const remaining = target.scrollWidth - target.scrollLeft - target.clientWidth;
    if (remaining < 160) friendActions.loadMoreSuggestions();
  }

  return (
    <div className="bg-white px-4 pb-6">
      <section className="-mx-4 py-3 h-[120px] bg-gray-100">
        {friendActions.suggestionsLoading ? (
          <div className="flex gap-7 overflow-x-auto pb-1 pt-3 scrollbar-hide">
            {Array.from({ length: 8 }).map((_, index) => (
              <div key={index} className="flex flex-col items-center gap-1 flex-shrink-0">
                <div className="w-[60px] h-[60px] rounded-full bg-gray-200 animate-pulse" />
                <div className="w-10 h-3 rounded bg-gray-200 animate-pulse mt-1" />
              </div>
            ))}
          </div>
        ) : suggestions.length === 0 ? (
          <div className="flex items-center justify-center py-3">
            <p className="text-gray-400 animate-blacklist-avatar" style={{ fontSize: 16 }}>친구추천 목록 없음</p>
          </div>
        ) : (
          <div
            className="overflow-x-auto scrollbar-hide pt-3 pb-1"
            onScroll={handleSuggestionsScroll}
            style={{ WebkitOverflowScrolling: "touch", touchAction: "pan-x" }}
          >
            <div className="flex gap-7 w-max">
              {suggestions.map((suggestion) => (
                <div key={suggestion.id} className="flex flex-col items-center gap-1 flex-shrink-0">
                  <div className="relative" style={{ width: 60, height: 60 }}>
                    <div className="relative animate-blacklist-avatar" style={getAvatarFloatStyle(suggestion.id)}>
                      <button onClick={() => friendActions.handleAddFriend(suggestion.id)}>
                        <Avatar
                          src={suggestion.profile_image_url}
                          nickname={suggestion.nickname}
                          size={60}
                          className="bg-black"
                        />
                      </button>
                      <button
                        onClick={() => friendActions.handleAddFriend(suggestion.id)}
                        className={`absolute -top-0.5 -right-0.5 w-6 h-6 rounded-full flex items-center justify-center ${
                          friendActions.addedIds.has(suggestion.id)
                            ? "bg-gray-400 cursor-default"
                            : "bg-yellow-300"
                        }`}
                      >
                        {friendActions.addedIds.has(suggestion.id)
                          ? <Check size={11} className="text-white" strokeWidth={3} />
                          : <Plus size={15} className="text-black" strokeWidth={3.5} />
                        }
                      </button>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => setProfileModalTarget(suggestionToFollower(suggestion))}
                    className="max-w-[62px] text-center font-bold text-gray-900 truncate"
                    style={{ fontSize: 14 }}
                  >
                    {suggestion.nickname}
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}
      </section>

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
                style={{ fontSize: 16 }}
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

        <section className="pt-3">
          <h2 className="mb-1 text-[16px] font-bold text-gray-900">프로필 업데이트</h2>
          {recentlyUpdatedFriends.length === 0 ? (
            <p className="py-5 text-sm text-gray-400">최근 수정한 친구가 없습니다</p>
          ) : (
            <div
              className="overflow-x-auto scrollbar-hide pt-3 pb-1"
              style={{ WebkitOverflowScrolling: "touch", touchAction: "pan-x" }}
            >
              <div className="flex gap-5 w-max">
                {recentlyUpdatedFriends.map((member) => (
                  <button
                    key={member.id}
                    type="button"
                    onClick={() => setProfileModalTarget(member)}
                    className="flex flex-col items-center gap-1 flex-shrink-0"
                    aria-label={`${member.nickname} 프로필`}
                  >
                    <div className="relative">
                      <Avatar src={member.profile_image_url} nickname={member.nickname} size={52} />
                      {onlineIds.has(member.id) && (
                        <span className="absolute bottom-0 right-0 h-3 w-3 rounded-full border-2 border-white bg-green-400" />
                      )}
                    </div>
                    <span className="max-w-[58px] truncate text-center text-[13px] text-gray-700">
                      {member.nickname}
                    </span>
                  </button>
                ))}
              </div>
            </div>
          )}
        </section>

        <h2 className="mb-1 mt-3 text-[16px] font-bold text-gray-900">친구들</h2>
        {visibleFriends.length === 0 ? (
          <p className="py-5 text-sm text-gray-400">맞팔 친구가 없습니다</p>
        ) : friendViewMode === "grid" ? (
          <FriendGrid
            members={visibleFriends}
            onlineIds={onlineIds}
            onOpenProfile={setProfileModalTarget}
          />
        ) : (
          <div className="flex flex-col">
            {visibleFriends.map((member) => (
              <FriendRow
                key={member.id}
                member={member}
                onlineIds={onlineIds}
                onOpenProfile={setProfileModalTarget}

              />
            ))}
          </div>
        )}
      </section>

      {connectedFriends.length <= 5 && (
        <div className="flex flex-col items-center justify-center py-8">
          <Image src="/app_img/serch.png" alt="" width={80} height={80} unoptimized />
          <p className="text-sm text-gray-400 mt-3">위에 친구를 추가하실 수 있습니다</p>
        </div>
      )}

      {profileModalTarget && (
        <UserProfileModal
          userId={profileModalTarget.id}
          initialProfile={profileModalTarget}
          onClose={() => setProfileModalTarget(null)}
        />
      )}

      {messageTarget && (
        <SendMessageModal
          isOpen={!!messageTarget}
          receiver={messageTarget}
          onClose={() => setMessageTarget(null)}
          onSent={onMessageSent}
        />
      )}
    </div>
  );
}
