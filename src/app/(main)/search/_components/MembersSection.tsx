"use client";

import { Binoculars, ChevronLeft, ChevronRight, LayoutGrid, LayoutList, Lock, LockOpen, MoreVertical } from "lucide-react";
import Avatar from "@/components/ui/Avatar";
import type { Dispatch, MouseEvent, RefObject, SetStateAction } from "react";
import { MEMBER_TYPES } from "@/lib/constants";
import type { DancerMember, Follower } from "../_types/search";
import { MEMBER_GENRE_OPTIONS, SOLO_MEMBER_GENRES } from "../_lib/constants";
import { formatLocation, getGenreLabel, getMemberTypeLabel } from "../_lib/search-utils";
import { SubscriptionBadge } from "./SearchBadges";

interface MembersSectionProps {
  memberSearchPanelRef: RefObject<HTMLDivElement | null>;
  onMemberSearchPanelScroll: () => void;
  memberRegion: string;
  setMemberRegion: Dispatch<SetStateAction<string>>;
  availableMemberRegions: string[];
  memberSearch: string;
  setMemberSearch: Dispatch<SetStateAction<string>>;
  memberGender: "" | "로" | "라";
  setMemberGender: Dispatch<SetStateAction<"" | "로" | "라">>;
  memberGenres: string[];
  onToggleMemberGenre: (genre: string) => void;
  memberSearchMode: "basic" | "memberType";
  selectedMemberTypes: string[];
  onToggleMemberTypeFilter: (type: string) => void;
  memberResultCount: number;
  basicFilterLocked: boolean;
  setBasicFilterLocked: Dispatch<SetStateAction<boolean>>;
  memberViewMode: "list" | "grid";
  setMemberViewMode: Dispatch<SetStateAction<"list" | "grid">>;
  membersLoaded: boolean;
  membersLoading: boolean;
  visibleMembers: DancerMember[];
  onlineIds: Set<string>;
  closingProfileMemberId: string | null;
  onOpenProfile: (member: Follower) => void;
  onViewProfile: (id: string) => void;
  onOpenMenu: (member: Follower, event: MouseEvent<HTMLButtonElement>, source?: "social" | "members") => void;
}

export default function MembersSection({
  memberSearchPanelRef,
  onMemberSearchPanelScroll,
  memberRegion,
  setMemberRegion,
  availableMemberRegions,
  memberSearch,
  setMemberSearch,
  memberGender,
  setMemberGender,
  memberGenres,
  onToggleMemberGenre,
  memberSearchMode,
  selectedMemberTypes,
  onToggleMemberTypeFilter,
  memberResultCount,
  basicFilterLocked,
  setBasicFilterLocked,
  memberViewMode,
  setMemberViewMode,
  membersLoaded,
  membersLoading,
  visibleMembers,
  onlineIds,
  closingProfileMemberId,
  onOpenProfile,
  onViewProfile,
  onOpenMenu,
}: MembersSectionProps) {
  return (
    <div className="px-4 pt-0 bg-white">
      <div className="h-[120px] -mx-4 bg-gray-100 relative">
        <div
          ref={memberSearchPanelRef}
          onScroll={onMemberSearchPanelScroll}
          className="flex h-full overflow-x-auto snap-x snap-mandatory scrollbar-hide"
          style={{ WebkitOverflowScrolling: "touch", touchAction: "pan-x" }}
        >
          <div className="h-full min-w-full snap-start flex flex-col justify-center px-4 gap-2 bg-gray-100 relative">
            <button
              type="button"
              onClick={() => setBasicFilterLocked((prev) => !prev)}
              className="absolute left-5 top-1/2 -translate-y-1/2"
              aria-label={basicFilterLocked ? "검색 조건 잠금 해제" : "검색 조건 잠금"}
            >
              {basicFilterLocked ? <Lock size={20} strokeWidth={3} className="text-gray-700" /> : <LockOpen size={20} className="text-gray-400" />}
            </button>
            <div className="flex items-center gap-2 justify-center">
              <select
                value={memberRegion}
                onChange={(e) => setMemberRegion(e.target.value)}
                disabled={basicFilterLocked}
                className={`h-8 w-[88px] flex-shrink-0 rounded-full border border-transparent px-3 text-[16px] focus:outline-none focus:border-transparent ${basicFilterLocked ? "bg-gray-200 text-gray-400" : "bg-white text-gray-800"}`}
              >
                {availableMemberRegions.map((region) => (
                  <option key={region} value={region}>
                    {region === "전체" ? "한국" : region}
                  </option>
                ))}
              </select>
              <div className="relative" style={{ width: 110 }}>
                <input
                  type="text"
                  placeholder="아이디"
                  value={memberSearch}
                  onChange={(e) => setMemberSearch(e.target.value)}
                  disabled={basicFilterLocked}
                  className={`w-full h-8 pl-3 pr-8 border border-transparent rounded-full focus:outline-none focus:border-transparent ${basicFilterLocked ? "bg-gray-200 text-gray-400" : "bg-white"}`}
                  style={{ fontSize: 16 }}
                />
                {memberSearch && (
                  <button
                    onClick={() => setMemberSearch("")}
                    className="absolute right-2 top-1/2 -translate-y-1/2 w-4 h-4 rounded-full bg-gray-300 flex items-center justify-center"
                  >
                    <span className="text-white text-[14px] leading-none font-bold">×</span>
                  </button>
                )}
              </div>
              <select
                value={memberGender}
                onChange={(e) => setMemberGender(e.target.value as "" | "로" | "라")}
                disabled={basicFilterLocked}
                className={`h-8 w-[64px] flex-shrink-0 rounded-full border border-transparent px-2 text-[16px] focus:outline-none focus:border-transparent ${basicFilterLocked ? "bg-gray-200 text-gray-400" : "bg-white text-gray-800"}`}
              >
                <option value="">로/라</option>
                <option value="로">로</option>
                <option value="라">라</option>
              </select>
            </div>

            <div className="flex items-center justify-center gap-2 w-full overflow-x-auto scrollbar-hide">
              {MEMBER_GENRE_OPTIONS.map((genre) => {
                const active = memberGenres.includes(genre.value);
                const faded = !active && (memberGenres.length >= 2 || memberGenres.some((g) => SOLO_MEMBER_GENRES.includes(g)));
                return (
                  <button
                    key={genre.value}
                    type="button"
                    disabled={basicFilterLocked}
                    onClick={() => onToggleMemberGenre(genre.value)}
                    className={`h-8 flex-shrink-0 rounded-full px-3 text-[16px] font-semibold transition-colors ${
                      basicFilterLocked
                        ? active ? "bg-gray-300 text-gray-500 border border-transparent" : "bg-gray-200 text-gray-400 border border-transparent"
                        : active ? "bg-yellow-300 text-gray-950 border border-transparent" : "bg-white text-gray-500 border border-transparent"
                    } ${faded && !basicFilterLocked ? "opacity-40" : ""}`}
                  >
                    {genre.label}
                  </button>
                );
              })}
            </div>
          </div>

          <div className="h-full min-w-full snap-start flex flex-col justify-center px-4 gap-2 bg-gray-100">
            <div className="flex flex-wrap items-center justify-center gap-x-2 gap-y-1 overflow-hidden">
              {MEMBER_TYPES.map((type) => {
                const active = selectedMemberTypes.includes(type);
                return (
                  <button
                    key={type}
                    type="button"
                    onClick={() => onToggleMemberTypeFilter(type)}
                    className={`rounded-full border px-2.5 py-1 text-[16px] leading-tight transition-colors ${
                      active
                        ? "bg-gray-900 border-gray-900 text-white font-bold"
                        : "bg-white border-white text-[#595959] font-semibold"
                    } hover:border-gray-900`}
                  >
                    {getMemberTypeLabel(type)}
                  </button>
                );
              })}
            </div>
          </div>
        </div>
        <div className="pointer-events-none -mt-3 flex items-center justify-center gap-1.5">
          <span className={`rounded-full transition-all ${memberSearchMode === "basic" ? "h-2 w-2 bg-gray-900" : "h-1.5 w-1.5 bg-gray-400"}`} />
          <span className={`rounded-full transition-all ${memberSearchMode === "memberType" ? "h-2 w-2 bg-gray-900" : "h-1.5 w-1.5 bg-gray-400"}`} />
        </div>
        {memberSearchMode === "basic" && (
          <button
            type="button"
            onClick={() => memberSearchPanelRef.current?.scrollBy({ left: memberSearchPanelRef.current.offsetWidth, behavior: "smooth" })}
            className="absolute right-3 top-1/2 -translate-y-1/2 flex items-center"
          >
            <ChevronRight size={28} strokeWidth={3} className="text-gray-500" />
          </button>
        )}
        {memberSearchMode === "memberType" && (
          <button
            type="button"
            onClick={() => memberSearchPanelRef.current?.scrollBy({ left: -memberSearchPanelRef.current.offsetWidth, behavior: "smooth" })}
            className="absolute left-1 top-1/2 -translate-y-1/2 flex items-center"
          >
            <ChevronLeft size={28} strokeWidth={3} className="text-gray-500" />
          </button>
        )}
      </div>
      <div className="pt-5">
        <div className="flex items-center gap-3 mb-3">
          <div className="flex items-center gap-1 text-gray-900">
            <Binoculars size={24} />
            <span className="inline-block w-[4ch] text-left tabular-nums font-bold" style={{ fontSize: 18 }}>
              {memberResultCount}
            </span>
          </div>
          <span className="flex-1 text-center text-black font-bold" style={{ fontSize: 17, marginRight: 40 }}>
            {memberRegion === "전체" ? "한국" : memberRegion}
          </span>
          <button
            type="button"
            onClick={() => setMemberViewMode((mode) => mode === "list" ? "grid" : "list")}
            className="h-9 w-9 flex items-center justify-center rounded-full text-gray-500 hover:bg-gray-100 hover:text-gray-900 transition-colors"
            aria-label={memberViewMode === "list" ? "그리드 보기" : "리스트 보기"}
            title={memberViewMode === "list" ? "그리드 보기" : "리스트 보기"}
          >
            {memberViewMode === "list" ? <LayoutGrid size={21} /> : <LayoutList size={21} />}
          </button>
        </div>

        {!membersLoaded && membersLoading ? (
          <div className="flex flex-col">
            {Array.from({ length: 8 }).map((_, index) => (
              <div key={index} className="flex items-center gap-3 py-3 border-b border-gray-50">
                <div className="w-11 h-11 rounded-full bg-gray-200 animate-pulse" />
                <div className="flex-1">
                  <div className="w-24 h-4 rounded bg-gray-200 animate-pulse mb-2" />
                  <div className="w-32 h-3 rounded bg-gray-100 animate-pulse" />
                </div>
              </div>
            ))}
          </div>
        ) : visibleMembers.length === 0 ? (
          <p className="text-sm text-gray-400">조건에 맞는 회원이 없어요</p>
        ) : memberViewMode === "grid" ? (
          <div className="grid grid-cols-5 gap-x-3 gap-y-4 pb-4">
            {visibleMembers.map((member) => (
              <button
                key={member.id}
                type="button"
                onClick={() => onOpenProfile(member)}
                className="relative aspect-square min-w-0 flex items-center justify-center"
                aria-label={`${member.nickname} 프로필`}
              >
                <div className={`relative ${closingProfileMemberId === member.id ? "profile-close-pop" : ""}`}>
                  <Avatar
                    src={member.profile_image_url}
                    nickname={member.nickname}
                    size={48}
                    className="bg-gradient-to-br from-gray-100 to-sky-100"
                  />
                  {onlineIds.has(member.id) && (
                    <span className="absolute bottom-0 right-0 w-3 h-3 bg-green-400 rounded-full border-2 border-white" />
                  )}
                  {member.is_subscribed && <SubscriptionBadge />}
                </div>
              </button>
            ))}
          </div>
        ) : (
          <div className="flex flex-col">
            {visibleMembers.map((member) => {
              const genreLabels = (member.favorite_genre ?? [])
                .filter((genre) => MEMBER_GENRE_OPTIONS.some((option) => option.value === genre))
                .map(getGenreLabel);

              return (
                <div key={member.id} className="flex items-center gap-3 py-3 border-b border-gray-50">
                  <button onClick={() => onOpenProfile(member)}>
                    <div className={`relative ${closingProfileMemberId === member.id ? "profile-close-pop" : ""}`}>
                      <Avatar
                        src={member.profile_image_url}
                        nickname={member.nickname}
                        size={44}
                        className="bg-gradient-to-br from-gray-100 to-sky-100"
                      />
                      {onlineIds.has(member.id) && (
                        <span className="absolute bottom-0 right-0 w-3 h-3 bg-green-400 rounded-full border-2 border-white" />
                      )}
                      {member.is_subscribed && <SubscriptionBadge />}
                    </div>
                  </button>
                  <button
                    className="flex-1 text-left min-w-0"
                    onClick={() => onViewProfile(member.id)}
                  >
                    <p className="font-semibold text-gray-900 truncate" style={{ fontSize: 16 }}>
                      {member.nickname}
                    </p>
                    <p className="text-xs text-gray-400 truncate">
                      {formatLocation(member.country, member.region) || "지역 미입력"}
                      {genreLabels.length > 0 ? ` · ${genreLabels.join(" · ")}` : ""}
                    </p>
                  </button>
                  <button
                    className="p-2 -mr-2 text-gray-400 hover:text-gray-700 flex-shrink-0"
                    onClick={(event) => onOpenMenu(member, event, "members")}
                  >
                    <MoreVertical size={18} />
                  </button>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
