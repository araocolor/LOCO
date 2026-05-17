"use client";

import { Check, LayoutGrid, LayoutList, MoreVertical, Plus, UsersRound } from "lucide-react";
import Avatar from "@/components/ui/Avatar";
import type { Dispatch, MouseEvent, SetStateAction } from "react";
import type { Follower, Suggestion } from "../_types/search";
import { getAvatarFloatStyle } from "../_lib/search-utils";

interface FriendsSectionProps {
  suggestionsLoading: boolean;
  suggestions: Suggestion[];
  addedIds: Set<string>;
  onAddFriend: (id: string) => void;
  onViewProfile: (id: string) => void;
  friendListMode: "following" | "friends";
  setFriendListMode: Dispatch<SetStateAction<"following" | "friends">>;
  onResortFriendMembers: () => void;
  followingCount: number;
  friendViewMode: "list" | "grid";
  setFriendViewMode: Dispatch<SetStateAction<"list" | "grid">>;
  friendSearch: string;
  setFriendSearch: Dispatch<SetStateAction<string>>;
  visibleFriendMembers: Follower[];
  followerById: Map<string, Follower>;
  onlineIds: Set<string>;
  closingProfileMemberId: string | null;
  onOpenProfile: (member: Follower) => void;
  onOpenMenu: (member: Follower, event: MouseEvent<HTMLButtonElement>, source?: "social" | "members") => void;
}

export default function FriendsSection({
  suggestionsLoading,
  suggestions,
  addedIds,
  onAddFriend,
  onViewProfile,
  friendListMode,
  setFriendListMode,
  onResortFriendMembers,
  followingCount,
  friendViewMode,
  setFriendViewMode,
  friendSearch,
  setFriendSearch,
  visibleFriendMembers,
  followerById,
  onlineIds,
  closingProfileMemberId,
  onOpenProfile,
  onOpenMenu,
}: FriendsSectionProps) {
  return (
    <div className="px-4 pt-0 bg-white">
      <div className={`mb-0 -mx-4 py-3 h-[120px] ${!suggestionsLoading && suggestions.length === 0 ? "bg-white" : "bg-sky-100/70"}`}>
        {suggestionsLoading ? (
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
            style={{ WebkitOverflowScrolling: "touch", touchAction: "pan-x" }}
          >
            <div className="flex gap-7 w-max">
              {suggestions.map((suggestion) => (
                <div key={suggestion.id} className="flex flex-col items-center gap-1 flex-shrink-0">
                  <div className="relative" style={{ width: 60, height: 60 }}>
                    <div className="relative animate-blacklist-avatar" style={getAvatarFloatStyle(suggestion.id)}>
                      <button onClick={() => onAddFriend(suggestion.id)}>
                        <Avatar
                          src={suggestion.profile_image_url}
                          nickname={suggestion.nickname}
                          size={60}
                          className="bg-black"
                        />
                      </button>
                      <button
                        onClick={() => onAddFriend(suggestion.id)}
                        className={`absolute -top-0.5 -right-0.5 w-6 h-6 rounded-full flex items-center justify-center ${
                          addedIds.has(suggestion.id)
                            ? "bg-gray-400 cursor-default"
                            : "bg-yellow-300"
                        }`}
                      >
                        {addedIds.has(suggestion.id)
                          ? <Check size={11} className="text-white" strokeWidth={3} />
                          : <Plus size={15} className="text-black" strokeWidth={3.5} />
                        }
                      </button>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => onViewProfile(suggestion.id)}
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
      </div>
      <div className="pt-5">
        <div className="relative flex items-center mb-3">
          <button
            type="button"
            onClick={() => {
              setFriendListMode("following");
              onResortFriendMembers();
            }}
            className={`flex items-center gap-1 transition-colors ${friendListMode === "following" ? "text-gray-900" : "text-gray-300"}`}
          >
            <UsersRound size={24} />
            <span className="font-bold tabular-nums" style={{ fontSize: 18 }}>{followingCount}</span>
          </button>
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
                  onClick={() => setFriendSearch("")}
                  className="absolute right-2 top-1/2 -translate-y-1/2 w-4 h-4 rounded-full bg-gray-300 flex items-center justify-center"
                >
                  <span className="text-white text-[10px] leading-none font-bold">×</span>
                </button>
              )}
            </div>
          </div>
        </div>

        {visibleFriendMembers.length === 0 ? (
          <p className="text-sm text-gray-400">
            {friendListMode === "friends" ? "맞팔 회원이 없어요" : "팔로잉한 회원이 없어요"}
          </p>
        ) : friendViewMode === "grid" ? (
          <div className="grid grid-cols-5 gap-x-3 gap-y-4 pb-4">
            {visibleFriendMembers.map((member) => {
              const isNotificationOff = !!member.is_greyed;
              const isMutualFriend = member.status === "friend";
              return (
                <button
                  key={member.id}
                  type="button"
                  onClick={() => onOpenProfile(member)}
                  className={`relative aspect-square min-w-0 flex items-center justify-center ${isNotificationOff ? "grayscale" : ""}`}
                  aria-label={`${member.nickname} 프로필`}
                >
                  <div
                    className={`relative ${isMutualFriend ? "animate-blacklist-avatar" : ""} ${closingProfileMemberId === member.id ? "profile-close-pop" : ""} ${isNotificationOff ? "opacity-50" : ""}`}
                    style={isMutualFriend ? getAvatarFloatStyle(member.id) : undefined}
                  >
                    <Avatar
                      src={member.profile_image_url}
                      nickname={member.nickname}
                      size={48}
                      className={member.status === "approved" ? undefined : "border-2 border-white shadow-[0_0_0_2px_#ef4444]"}
                    />
                    {onlineIds.has(member.id) && (
                      <span className="absolute bottom-0 right-0 w-3 h-3 bg-green-400 rounded-full border-2 border-white" />
                    )}
                  </div>
                </button>
              );
            })}
          </div>
        ) : (
          <div className="flex flex-col">
            {visibleFriendMembers.map((member) => {
              const follower = followerById.get(member.id);
              const followingRelation = member;
              const isNotificationOff = !!followingRelation?.is_greyed;
              const isMutualFriend = member.status === "friend";
              const isFollowingOnly = member.status === "approved";

              return (
                <div key={member.id} className={`flex items-center gap-3 py-3 border-b border-gray-50 ${isNotificationOff ? "grayscale" : ""}`}>
                  <button onClick={() => onOpenProfile(member)}>
                    <div
                      className={`relative ${isMutualFriend ? "animate-blacklist-avatar" : ""} ${isNotificationOff ? "opacity-50" : ""}`}
                      style={isMutualFriend ? getAvatarFloatStyle(member.id) : undefined}
                    >
                      {isFollowingOnly ? (
                        <Avatar
                          src={member.profile_image_url}
                          nickname={member.nickname}
                          size={44}
                        />
                      ) : (
                        <Avatar
                          src={member.profile_image_url}
                          nickname={member.nickname}
                          size={44}
                          className="border-2 border-white shadow-[0_0_0_2px_#ef4444]"
                        />
                      )}
                      {onlineIds.has(member.id) && (
                        <span className="absolute bottom-0 right-0 w-3 h-3 bg-green-400 rounded-full border-2 border-white" />
                      )}
                    </div>
                  </button>
                  <button
                    className="flex-1 text-left min-w-0"
                    onClick={() => onViewProfile(member.id)}
                  >
                    <p className={`font-semibold text-gray-900 truncate ${isNotificationOff ? "opacity-50" : ""}`} style={{ fontSize: 16 }}>
                      {member.nickname}
                    </p>
                    {(member.country || member.region) && (
                      <p className="text-xs text-gray-400 truncate">{[member.country, member.region].filter(Boolean).join(", ")}</p>
                    )}
                  </button>
                  <div className="ml-auto flex items-center gap-2">
                    {isFollowingOnly && (
                      <span className="text-gray-500 border border-gray-300 rounded-full px-2 py-0.5" style={{ fontSize: 14 }}>
                        연결중
                      </span>
                    )}
                    <button
                      type="button"
                      className="p-2 -mr-2 text-gray-400 flex-shrink-0"
                      aria-label="더보기"
                      onClick={(event) => onOpenMenu(followingRelation ?? follower ?? member, event)}
                    >
                      <MoreVertical size={18} />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
