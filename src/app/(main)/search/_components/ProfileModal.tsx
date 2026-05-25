"use client";

import { Ellipsis } from "lucide-react";
import Avatar from "@/components/ui/Avatar";
import type { Follower, MenuRelation, MenuTarget, Tab } from "../_types/search";
import { formatLocation, getMemberTypeLabel } from "../_lib/search-utils";

interface ProfileModalProps {
  activeTab: Tab;
  profileModal: Follower;
  profileModalData: { bio: string | null; member_type: string[] } | null;
  onClose: () => void;
  onSetMenuTarget: (target: MenuTarget) => void;
  getMenuRelation: (id: string) => MenuRelation;
  getRelationStatusValue: (id: string) => string;
  onOpenMessage: (receiver: { id: string; nickname: string; profile_image_url: string | null }) => void;
  onFollowFromMenu: (member: Follower) => void;
  onViewProfile: (id: string) => void;
  hideViewProfileButton?: boolean;
}

export default function ProfileModal({
  activeTab,
  profileModal,
  profileModalData,
  onClose,
  onSetMenuTarget,
  getMenuRelation,
  getRelationStatusValue,
  onOpenMessage,
  onFollowFromMenu,
  onViewProfile,
  hideViewProfileButton = false,
}: ProfileModalProps) {
  return (
    <>
      <div className="fixed inset-0 z-[70] bg-black/50" onClick={onClose} />
      <div className="fixed inset-0 z-[80] flex items-center justify-center pointer-events-none">
        <div className="relative w-[250px] bg-white rounded-2xl shadow-lg p-6 pointer-events-auto flex flex-col items-center gap-2">
          {(activeTab === "friends" || activeTab === "members") && (
            <button
              type="button"
              className="absolute top-3 right-3 rounded-full p-1 text-gray-500 hover:bg-gray-100"
              onClick={(e) => {
                e.stopPropagation();
                const r = e.currentTarget.getBoundingClientRect();
                const placement = r.top > window.innerHeight / 2 ? "top" : "bottom";
                onSetMenuTarget({
                  id: profileModal.id,
                  nickname: profileModal.nickname,
                  status: profileModal.status,
                  relation: getMenuRelation(profileModal.id),
                  x: r.right,
                  y: placement === "top" ? r.top : r.bottom,
                  placement,
                  member: profileModal,
                  isHidden: !!profileModal.is_hidden,
                  source: activeTab === "members" ? "members" : "social",
                });
              }}
              aria-label="더보기"
              title="더보기"
            >
              <Ellipsis size={20} />
            </button>
          )}
          <Avatar src={profileModal.profile_image_url} nickname={profileModal.nickname} size={80} />
          <div className="text-center w-full">
            <p className="font-bold text-gray-900 truncate" style={{ fontSize: 16 }}>
              {profileModal.nickname}
            </p>
            {formatLocation(profileModal.country, profileModal.region) && (
              <p className="text-xs text-gray-400 mt-0.5">
                {formatLocation(profileModal.country, profileModal.region)}
              </p>
            )}
            {profileModalData?.member_type?.[0] && (
              <div className="flex items-center justify-center mt-2">
                <span className="px-2.5 py-1 rounded-full bg-gray-800 text-white text-[12px] font-medium">
                  {getMemberTypeLabel(profileModalData.member_type[0])}
                </span>
              </div>
            )}
            {profileModalData?.bio && (
              <p className="text-[17px] text-gray-600 line-clamp-4 mt-1 whitespace-pre-wrap">
                {profileModalData.bio}
              </p>
            )}
            <p className="text-xs text-gray-500 mt-2">
              {
                { 맞팔: "Friends", 팔로잉: "Following", 팔로워: "Follower", 구독자: "Subscriber", 아님: "None" }[
                  getRelationStatusValue(profileModal.id)
                ]
              }
            </p>
          </div>
          <div className="flex gap-2 w-full mt-2">
            {getRelationStatusValue(profileModal.id) === "맞팔" ? (
              <button
                className="flex-1 h-9 rounded-full bg-[#FEE500] text-gray-900 font-semibold text-[14px]"
                onClick={() => {
                  onOpenMessage({
                    id: profileModal.id,
                    nickname: profileModal.nickname,
                    profile_image_url: profileModal.profile_image_url ?? null,
                  });
                  onClose();
                }}
              >
                메시지 전송
              </button>
            ) : (
              <button
                className="flex-1 h-9 rounded-full bg-[#FEE500] text-gray-900 font-semibold text-[14px]"
                onClick={() => {
                  onFollowFromMenu(profileModal);
                  onClose();
                }}
              >
                {getRelationStatusValue(profileModal.id) === "팔로잉" ? "구독하기" : "친구추가"}
              </button>
            )}
            {!hideViewProfileButton && (
              <button
                className="flex-1 h-9 rounded-full bg-[#FEE500] text-gray-900 font-semibold text-[14px]"
                onClick={() => {
                  onViewProfile(profileModal.id);
                  onClose();
                }}
              >
                프로필보기
              </button>
            )}
          </div>
        </div>
      </div>
    </>
  );
}
