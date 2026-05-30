"use client";

import { useState } from "react";
import { Check, Ellipsis, Star } from "lucide-react";
import Avatar from "@/components/ui/Avatar";
import type { Follower, MenuRelation, MenuTarget, Tab } from "../_types/search";
import { USER_VIEW_CACHE_PREFIX, formatLocation, formatRecentActiveTime, getMemberTypeLabel } from "../_lib/search-utils";

const STAR_GIFTED_KEY = "loco_star_gifted_ids";

export function getStarGiftedIds(): Set<string> {
  try {
    const raw = sessionStorage.getItem(STAR_GIFTED_KEY);
    return raw ? new Set(JSON.parse(raw) as string[]) : new Set();
  } catch {
    return new Set();
  }
}

function addStarGiftedId(id: string) {
  const ids = getStarGiftedIds();
  ids.add(id);
  sessionStorage.setItem(STAR_GIFTED_KEY, JSON.stringify([...ids]));
}

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
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [giftSubmitting, setGiftSubmitting] = useState(false);
  const [showSuccess, setShowSuccess] = useState(false);
  const [showCelebration, setShowCelebration] = useState(false);
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

  async function handleGiftConfirm() {
    if (giftSubmitting || hasGifted || myStarBalance < 1) return;

    setGiftSubmitting(true);
    setConfirmOpen(false);
    try {
      const response = await fetch("/api/stars/gift", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ receiverId: profileModal.id, count: 1 }),
      });
      const json = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(json?.error ?? "star_gift_failed");
      }

      const remainingBalance = typeof json.remainingBalance === "number" ? json.remainingBalance : Math.max(0, myStarBalance - 1);
      const nextReceivedCount = receivedStarCount + 1;

      setGiftPatch({
        gifted_star_count_by_me: 1,
        my_star_balance: remainingBalance,
        received_star_count: nextReceivedCount,
      });
      addStarGiftedId(profileModal.id);

      setShowSuccess(true);
      setTimeout(() => {
        setShowSuccess(false);
        setShowCelebration(true);
        setTimeout(() => setShowCelebration(false), 1000);
      }, 1000);

      try {
        const cacheKey = `${USER_VIEW_CACHE_PREFIX}${profileModal.id}`;
        sessionStorage.setItem(
          cacheKey,
          JSON.stringify({
            received_star_count: nextReceivedCount,
            gifted_star_count_by_me: 1,
            my_star_balance: remainingBalance,
          })
        );
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
        <div className="relative w-[270px] bg-white rounded-2xl shadow-lg p-6 pointer-events-auto flex flex-col items-center gap-2">
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
          <div className={`relative ${hasGifted ? "animate-breathe" : ""}`}>
            <Avatar src={profileModal.profile_image_url} nickname={profileModal.nickname} size={80} />
            {hasGifted && (
              <span
                className="absolute -right-2 -bottom-2 flex items-center justify-center"
                style={showCelebration ? { animation: "star-drop 0.5s cubic-bezier(0.34, 1.56, 0.64, 1) forwards" } : undefined}
              >
                <Star size={40} className="text-yellow-400" fill="currentColor" />
                <span className="absolute text-[11px] font-bold text-gray-900">{receivedStarCount}</span>
              </span>
            )}
            {showCelebration && (
              <span className="absolute inset-0 pointer-events-none overflow-visible">
                {Array.from({ length: 12 }).map((_, i) => {
                  const angle = i * 30;
                  const xOffset = Math.round(Math.cos((angle * Math.PI) / 180) * 40);
                  return (
                    <span
                      key={i}
                      className="absolute left-1/2 top-1/2"
                      style={{
                        width: 6,
                        height: 6,
                        borderRadius: i % 2 === 0 ? "50%" : "1px",
                        backgroundColor: ["#facc15", "#f87171", "#60a5fa", "#34d399", "#c084fc", "#fb923c"][i % 6],
                        animation: "confetti-pop 1s ease-out forwards",
                        animationDelay: `${i * 40}ms`,
                        "--r": `${angle}deg`,
                        "--x": `${xOffset}px`,
                      } as React.CSSProperties}
                    />
                  );
                })}
              </span>
            )}
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
            </div>
          </div>
          <div className="flex gap-2 w-full mt-2">
            {!hasGifted && !giftSubmitting && (
              <button
                type="button"
                disabled={myStarBalance < 1}
                onClick={() => setConfirmOpen(true)}
                className="flex-1 h-9 rounded-full bg-gray-500 text-white text-sm font-semibold disabled:opacity-50"
              >
                별 선물하기
              </button>
            )}
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
          </div>
          {!hideViewProfileButton && (
            <button
              className="h-9 w-full rounded-full bg-[#FEE500] text-gray-900 font-semibold text-[14px]"
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
      {confirmOpen && (
        <>
          <div className="fixed inset-0 z-[90] bg-black/40" onClick={() => setConfirmOpen(false)} />
          <div className="fixed inset-0 z-[100] flex items-center justify-center pointer-events-none">
            <div className="bg-white rounded-2xl shadow-lg p-6 w-[250px] h-[180px] pointer-events-auto flex flex-col items-center justify-center gap-6">
              <p className="font-semibold text-gray-900 text-center" style={{ fontSize: 17 }}>
                {profileModal.nickname}님에게<br />별 1개 선물합니다
              </p>
              <div className="flex gap-2 w-full">
                <button
                  type="button"
                  onClick={() => setConfirmOpen(false)}
                  className="flex-1 h-10 rounded-full border border-gray-200 text-sm font-semibold text-gray-600"
                >
                  취소
                </button>
                <button
                  type="button"
                  onClick={handleGiftConfirm}
                  className="flex-1 h-10 rounded-full bg-[#FEE500] text-gray-900 text-sm font-semibold"
                >
                  확인
                </button>
              </div>
            </div>
          </div>
        </>
      )}
      {showSuccess && (
        <div className="fixed inset-0 z-[110] flex items-center justify-center pointer-events-none">
          <div className="w-16 h-16 rounded-full bg-yellow-400 flex items-center justify-center shadow-lg" style={{ animation: "fade-in-out 1s ease forwards" }}>
            <Check size={32} className="text-gray-900" strokeWidth={3} />
          </div>
        </div>
      )}
    </>
  );
}
