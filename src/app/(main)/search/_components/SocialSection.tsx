"use client";

import { LayoutGrid, LayoutList, MoreVertical, Users } from "lucide-react";
import Avatar from "@/components/ui/Avatar";
import type { Dispatch, MouseEvent, ReactNode, SetStateAction } from "react";
import type { Follower, SocialListMode } from "../_types/search";
import { SOCIAL_LIST_OPTIONS, SOCIAL_LIST_ROWS } from "../_lib/constants";
import { formatLocation } from "../_lib/search-utils";
import { SubscriptionBadge } from "./SearchBadges";

interface SocialSectionProps {
  socialListMode: SocialListMode;
  setSocialListMode: Dispatch<SetStateAction<SocialListMode>>;
  pendingCount: number;
  socialListMembers: Follower[];
  socialViewMode: "list" | "grid";
  setSocialViewMode: Dispatch<SetStateAction<"list" | "grid">>;
  socialLoadError: boolean;
  managementPanel: ReactNode;
  onlineIds: Set<string>;
  closingProfileMemberId: string | null;
  onOpenProfile: (member: Follower) => void;
  onOpenMenu: (member: Follower, event: MouseEvent<HTMLButtonElement>, source?: "social" | "members") => void;
}

export default function SocialSection({
  socialListMode,
  setSocialListMode,
  pendingCount,
  socialListMembers,
  socialViewMode,
  setSocialViewMode,
  socialLoadError,
  managementPanel,
  onlineIds,
  closingProfileMemberId,
  onOpenProfile,
  onOpenMenu,
}: SocialSectionProps) {
  return (
    <div className="px-4 pt-0 bg-white">
      <div className="h-[120px] -mx-4 bg-sky-100/70 flex items-center justify-center px-4">
        <div className="flex flex-col items-center gap-y-2 overflow-hidden">
          {SOCIAL_LIST_ROWS.map((row, rowIndex) => (
            <div key={rowIndex} className="flex items-center justify-center gap-x-2">
              {row.map((mode) => {
                const option = SOCIAL_LIST_OPTIONS.find((item) => item.value === mode);
                if (!option) return null;
                const active = socialListMode === option.value;
                return (
                  <button
                    key={option.value}
                    type="button"
                    onClick={() => setSocialListMode(option.value)}
                    className={`h-8 rounded-full px-3 text-[16px] leading-tight transition-colors ${
                      active ? "bg-gray-900 text-lime-100 font-bold" : "bg-white/90 text-[#595959] font-semibold"
                    }`}
                  >
                    {option.label}
                  </button>
                );
              })}
            </div>
          ))}
        </div>
      </div>
      <div className="border-t border-gray-100 pt-0">
        <div className="flex items-center justify-start gap-1 mt-3 mb-3 text-gray-900">
          <Users size={22} />
          <span className="text-[18px] font-bold tabular-nums">
            {socialListMode === "management" ? pendingCount : socialListMembers.length}
          </span>
          {socialListMode !== "management" && (
            <button
              type="button"
              onClick={() => setSocialViewMode((mode) => mode === "list" ? "grid" : "list")}
              className="ml-auto h-9 w-9 flex items-center justify-center rounded-full text-gray-500 hover:bg-gray-100 hover:text-gray-900 transition-colors"
              aria-label={socialViewMode === "list" ? "그리드 보기" : "리스트 보기"}
              title={socialViewMode === "list" ? "그리드 보기" : "리스트 보기"}
            >
              {socialViewMode === "list" ? <LayoutGrid size={21} /> : <LayoutList size={21} />}
            </button>
          )}
        </div>
        {socialLoadError && (
          <p className="mb-3 text-center text-xs text-red-500">목록을 새로 불러오지 못했어요</p>
        )}
        {socialListMode === "management" ? (
          managementPanel
        ) : socialListMembers.length === 0 ? (
          <p className="text-sm text-gray-400">아직 목록이 없어요</p>
        ) : socialViewMode === "grid" ? (
          <div className="grid grid-cols-5 gap-x-3 gap-y-4 pb-4">
            {socialListMembers.map((member) => {
              const isNotificationOff = !!member.is_greyed;
              return (
                <button
                  key={member.id}
                  type="button"
                  onClick={() => onOpenProfile(member)}
                  className={`relative aspect-square min-w-0 flex items-center justify-center ${isNotificationOff ? "grayscale" : ""}`}
                  aria-label={`${member.nickname} 프로필`}
                >
                  <div className={`relative ${closingProfileMemberId === member.id ? "profile-close-pop" : ""}`}>
                    <div className={`relative ${isNotificationOff ? "opacity-50" : ""}`}>
                      <Avatar
                        src={member.profile_image_url}
                        nickname={member.nickname}
                        size={48}
                        className="border-2 border-white"
                      />
                    </div>
                    {onlineIds.has(member.id) && (
                      <span className="absolute bottom-0 right-0 w-3 h-3 bg-green-400 rounded-full border-2 border-white" />
                    )}
                    {socialListMode === "subscriptions" && member.is_subscribed && <SubscriptionBadge />}
                  </div>
                </button>
              );
            })}
          </div>
        ) : (
          <div className="flex flex-col">
            {socialListMembers.map((member) => {
              const isNotificationOff = !!member.is_greyed;
              return (
                <div key={member.id} className={`flex items-center gap-3 py-3 border-b border-gray-50 ${isNotificationOff ? "grayscale" : ""}`}>
                  <button onClick={() => onOpenProfile(member)}>
                    <div className={`relative ${closingProfileMemberId === member.id ? "profile-close-pop" : ""}`}>
                      <div className={`relative ${isNotificationOff ? "opacity-50" : ""}`}>
                        <Avatar
                          src={member.profile_image_url}
                          nickname={member.nickname}
                          size={44}
                          className="border-2 border-white"
                        />
                      </div>
                      {onlineIds.has(member.id) && (
                        <span className="absolute bottom-0 right-0 w-3 h-3 bg-green-400 rounded-full border-2 border-white" />
                      )}
                      {socialListMode === "subscriptions" && member.is_subscribed && <SubscriptionBadge />}
                    </div>
                  </button>
                  <div className="flex-1 min-w-0">
                    <p className={`font-semibold text-gray-900 truncate ${isNotificationOff ? "opacity-50" : ""}`} style={{ fontSize: 16 }}>
                      {member.nickname}
                    </p>
                    {formatLocation(member.country, member.region) && (
                      <p className="text-xs text-gray-400 truncate">{formatLocation(member.country, member.region)}</p>
                    )}
                  </div>
                  <button
                    className="p-2 -mr-2 text-gray-400 hover:text-gray-700 flex-shrink-0"
                    onClick={(event) => onOpenMenu(member, event)}
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
