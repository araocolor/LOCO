"use client";

import { Ban, Bookmark, Check, Send, UserCircle, UserMinus } from "lucide-react";
import type { Follower, MenuTarget } from "../_types/search";

interface UserActionMenuProps {
  menuTarget: MenuTarget;
  onClose: () => void;
  onViewProfile: (id: string) => void;
  onToggleSubscription: (targetId: string, nextSubscribed: boolean) => void;
  onSetFollowingGrey: (targetId: string) => void;
  onUnsetFollowingGrey: (targetId: string) => void;
  onCancelFollowing: (member: Follower) => void;
  onAcceptFollower: (member: Follower, showFriendLinkedToast: boolean) => void;
  onFollowFromMenu: (member: Follower) => void;
  onOpenMessage: (receiver: { id: string; nickname: string; profile_image_url: string | null }) => void;
  onHideFriend: (targetId: string) => void;
  onUnhideFriend: (targetId: string) => void;
  onReportUser: (targetId: string) => void;
}

export default function UserActionMenu({
  menuTarget,
  onClose,
  onViewProfile,
  onToggleSubscription,
  onSetFollowingGrey,
  onUnsetFollowingGrey,
  onCancelFollowing,
  onAcceptFollower,
  onFollowFromMenu,
  onOpenMessage,
  onHideFriend,
  onUnhideFriend,
  onReportUser,
}: UserActionMenuProps) {
  return (
    <>
      <div className="fixed inset-0 z-[85]" onClick={onClose} />
      <div
        className="fixed z-[90] bg-white rounded-xl shadow-lg border border-gray-100 overflow-hidden"
        style={{
          width: 180,
          top: menuTarget.placement === "bottom" ? menuTarget.y : "auto",
          bottom: menuTarget.placement === "top" ? window.innerHeight - menuTarget.y + 8 : "auto",
          left: menuTarget.x - 180,
        }}
      >
        <button
          className="flex items-center justify-between w-full px-4 py-3 text-gray-700"
          style={{ fontSize: "16px" }}
          onClick={() => onViewProfile(menuTarget.id)}
        >
          <span>프로필 보기</span>
          <UserCircle size={20} className="text-gray-500" />
        </button>
        <div className="border-t border-gray-100 mx-3" />
        <button
          className="flex items-center justify-between w-full px-4 py-3 text-gray-700"
          style={{ fontSize: "16px" }}
          onClick={() => onToggleSubscription(menuTarget.id, !menuTarget.member.is_subscribed)}
        >
          <span>{menuTarget.member.is_subscribed ? "구독취소" : "구독하기"}</span>
          <Bookmark
            size={20}
            fill={menuTarget.member.is_subscribed ? "#FEE500" : "none"}
            className="text-gray-500"
          />
        </button>
        <div className="border-t border-gray-100 mx-3" />
        {menuTarget.source !== "members" && menuTarget.relation === "mutual" && (
          <>
            <button
              className="flex items-center justify-between w-full px-4 py-3 text-gray-700"
              style={{ fontSize: "16px" }}
              onClick={() =>
                menuTarget.member.is_greyed
                  ? onUnsetFollowingGrey(menuTarget.id)
                  : onSetFollowingGrey(menuTarget.id)
              }
            >
              <span>{menuTarget.member.is_greyed ? "알림켜기" : "알림끄기"}</span>
              <UserMinus size={20} className="text-gray-500" />
            </button>
            <div className="border-t border-gray-100 mx-3" />
          </>
        )}
        {menuTarget.source !== "members" && menuTarget.relation === "following" && (
          <>
            <button
              className="flex items-center justify-between w-full px-4 py-3 text-gray-700"
              style={{ fontSize: "16px" }}
              onClick={() => onCancelFollowing(menuTarget.member)}
            >
              <span>연결취소</span>
              <UserMinus size={20} className="text-gray-500" />
            </button>
            <div className="border-t border-gray-100 mx-3" />
          </>
        )}
        {menuTarget.source !== "members" && menuTarget.relation === "follower" && (
          <>
            <button
              className="flex items-center justify-between w-full px-4 py-3 text-gray-700"
              style={{ fontSize: "16px" }}
              onClick={() => onAcceptFollower(menuTarget.member, true)}
            >
              <span>친구연결</span>
              <Check size={20} className="text-gray-500" />
            </button>
            <div className="border-t border-gray-100 mx-3" />
          </>
        )}
        {menuTarget.source !== "members" && menuTarget.relation === "none" && (
          <>
            <button
              className="flex items-center justify-between w-full px-4 py-3 text-gray-700"
              style={{ fontSize: "16px" }}
              onClick={() => onFollowFromMenu(menuTarget.member)}
            >
              <span>팔로잉</span>
              <Check size={20} className="text-gray-500" />
            </button>
            <div className="border-t border-gray-100 mx-3" />
          </>
        )}
        {(menuTarget.source === "members" || menuTarget.relation !== "none") && (
          <>
            <button
              className="flex items-center justify-between w-full px-4 py-3 text-gray-700"
              style={{ fontSize: "16px" }}
              onClick={() =>
                onOpenMessage({
                  id: menuTarget.id,
                  nickname: menuTarget.nickname,
                  profile_image_url: menuTarget.member?.profile_image_url ?? null,
                })
              }
            >
              <span>메시지 전송</span>
              <Send size={20} className="text-gray-500" />
            </button>
            <div className="border-t border-gray-100 mx-3" />
            <button
              className="flex items-center justify-between w-full px-4 py-3 text-gray-700"
              style={{ fontSize: "16px" }}
              onClick={() => (menuTarget.isHidden ? onUnhideFriend(menuTarget.id) : onHideFriend(menuTarget.id))}
            >
              <span>{menuTarget.isHidden ? "숨김해제" : "친구숨김"}</span>
              <Ban size={20} className="text-gray-500" />
            </button>
            <div className="border-t border-gray-100 mx-3" />
          </>
        )}
        <button
          className="flex items-center justify-between w-full px-4 py-3 text-gray-700"
          style={{ fontSize: "16px" }}
          onClick={() => onReportUser(menuTarget.id)}
        >
          <span>신고하기</span>
          <Ban size={20} className="text-gray-500" />
        </button>
      </div>
    </>
  );
}
