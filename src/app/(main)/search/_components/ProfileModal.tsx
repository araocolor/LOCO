"use client";

import { useState } from "react";
import { Ellipsis, Star } from "lucide-react";
import Avatar from "@/components/ui/Avatar";
import type { Follower, MenuRelation, MenuTarget, Tab } from "../_types/search";
import { USER_VIEW_CACHE_PREFIX, formatLocation, formatRecentActiveTime, getMemberTypeLabel } from "../_lib/search-utils";

interface ProfileModalProps {
  activeTab: Tab;
  profileModal: Follower;
  profileModalData: {
    bio: string | null;
    member_type: string[];
    last_active_at: string | null;
    received_star_count: number;
    gifted_star_count_by_me: number;
    my_star_balance: number;
  } | null;
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
  const [giftMenuOpen, setGiftMenuOpen] = useState(false);
  const [selectedGiftCount, setSelectedGiftCount] = useState(1);
  const [giftSubmitting, setGiftSubmitting] = useState(false);
  const [giftPatch, setGiftPatch] = useState<{
    gifted_star_count_by_me: number;
    my_star_balance: number;
    received_star_count: number;
  } | null>(null);
  const locationText = formatLocation(profileModal.country, profileModal.region);
  const activeTimeText = formatRecentActiveTime(profileModal.last_active_at ?? profileModalData?.last_active_at ?? null);
  const profileMetaText = [locationText, activeTimeText].filter(Boolean).join(", ");
  const giftedStarCount = giftPatch?.gifted_star_count_by_me ?? profileModalData?.gifted_star_count_by_me ?? 0;
  const myStarBalance = giftPatch?.my_star_balance ?? profileModalData?.my_star_balance ?? 0;
  const receivedStarCount = giftPatch?.received_star_count ?? profileModalData?.received_star_count ?? 0;
  const hasGifted = giftedStarCount > 0;

  async function handleGiftStars(count: number) {
    if (giftSubmitting || hasGifted || count < 1 || count > 3 || myStarBalance < count) return;

    setGiftSubmitting(true);
    try {
      const response = await fetch("/api/stars/gift", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ receiverId: profileModal.id, count }),
      });
      const json = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(json?.error ?? "star_gift_failed");
      }

      const remainingBalance = typeof json.remainingBalance === "number" ? json.remainingBalance : Math.max(0, myStarBalance - count);
      const nextReceivedCount = receivedStarCount + count;

      setGiftPatch({
        gifted_star_count_by_me: count,
        my_star_balance: remainingBalance,
        received_star_count: nextReceivedCount,
      });
      setGiftMenuOpen(false);

      try {
        const cacheKey = `${USER_VIEW_CACHE_PREFIX}${profileModal.id}`;
        const raw = sessionStorage.getItem(cacheKey);
        if (raw) {
          const parsed = JSON.parse(raw);
          sessionStorage.setItem(
            cacheKey,
            JSON.stringify({
              ...parsed,
              profile: {
                ...parsed.profile,
                received_star_count: nextReceivedCount,
              },
              starSummary: {
                ...(parsed.starSummary ?? {}),
                gifted_star_count_by_me: count,
                my_star_balance: remainingBalance,
              },
            })
          );
        }
      } catch {}
    } catch {
      alert("별 선물에 실패했어요. 다시 시도해주세요.");
    } finally {
      setGiftSubmitting(false);
    }
  }

  return (
    <>
      <div className="fixed inset-0 z-[70] bg-black/50" onClick={onClose} />
      <div className="fixed inset-0 z-[80] flex items-center justify-center pointer-events-none">
        <div className="relative w-[250px] bg-white rounded-2xl shadow-lg p-6 pointer-events-auto flex flex-col items-center gap-2">
          {activeTab === "members" && (
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
          <div className="relative">
            <Avatar src={profileModal.profile_image_url} nickname={profileModal.nickname} size={80} />
            <button
              type="button"
              onClick={() => {
                if (hasGifted) return;
                setGiftMenuOpen((open) => !open);
              }}
              className={`absolute -right-1 -bottom-1 flex h-8 w-8 items-center justify-center rounded-full border shadow-sm transition-colors ${
                hasGifted || giftMenuOpen ? "border-yellow-400 bg-yellow-400 text-gray-900" : "border-gray-200 bg-white text-gray-400"
              } ${hasGifted ? "cursor-default" : "hover:bg-yellow-50"}`}
              aria-label="별 선물하기"
              title={hasGifted ? "이미 별을 선물했어요" : "별 선물하기"}
            >
              <Star size={16} fill={hasGifted || giftMenuOpen ? "currentColor" : "none"} />
            </button>
          </div>
          <div className="text-center w-full">
            <p className="font-bold text-gray-900 truncate" style={{ fontSize: 16 }}>
              {profileModal.nickname}
            </p>
            {profileMetaText && (
              <p className="text-xs text-gray-400 mt-0.5">
                {profileMetaText}
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
            <div className="mt-2 flex items-center justify-center gap-2">
              <span className="rounded-full bg-gray-100 px-2.5 py-1 text-xs font-semibold text-gray-600">
                {
                  { 맞팔: "맞팔", 팔로잉: "팔로잉", 팔로워: "팔로워", 구독자: "구독자", 아님: "아님" }[
                    getRelationStatusValue(profileModal.id)
                  ]
                }
              </span>
              <span className="inline-flex items-center gap-1 rounded-full bg-yellow-50 px-2.5 py-1 text-xs font-semibold text-yellow-900">
                <Star size={12} className="text-yellow-500" fill="currentColor" />
                {receivedStarCount}
              </span>
            </div>
          </div>
          {giftMenuOpen && !hasGifted && (
            <div className="w-full rounded-2xl border border-gray-100 bg-gray-50 p-3">
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-semibold text-gray-500">별 선물하기</span>
                <span className="text-xs text-gray-400">잔여 {myStarBalance}</span>
              </div>
              <div className="flex items-center justify-center gap-2">
                {[1, 2, 3].map((count) => (
                  <button
                    key={count}
                    type="button"
                    onClick={() => setSelectedGiftCount(count)}
                    className={`h-8 w-8 rounded-full text-sm font-bold transition-colors ${
                      selectedGiftCount === count
                        ? "bg-yellow-400 text-gray-900"
                        : "bg-white text-gray-500 border border-gray-200"
                    }`}
                  >
                    {count}
                  </button>
                ))}
              </div>
              <button
                type="button"
                disabled={giftSubmitting || myStarBalance < selectedGiftCount}
                onClick={() => handleGiftStars(selectedGiftCount)}
                className="mt-3 h-9 w-full rounded-full bg-gray-900 text-white text-sm font-semibold disabled:opacity-50"
              >
                {giftSubmitting ? "전송 중..." : "선물하기"}
              </button>
            </div>
          )}
          {hasGifted && (
            <div className="w-full rounded-2xl bg-yellow-50 px-3 py-2 text-center text-xs font-semibold text-yellow-900">
              별 {giftedStarCount}개 선물 완료
            </div>
          )}
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
