"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Check, Ellipsis, Star, UserCircle, Send, Ban, UserPlus, UserMinus } from "lucide-react";
import Avatar from "@/components/ui/Avatar";
import SendMessageModal from "@/components/modal/SendMessageModal";

const USER_VIEW_CACHE_PREFIX = "user_view_v2_";
const SEARCH_SOCIAL_CACHE_KEY = "search_social_cache";
const USER_SEARCH_INFO_KEY = "user_search_info";
const STAR_GIFTED_KEY = "loco_star_gifted_ids";

function getStarGiftedIds(): Set<string> {
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

function getMemberTypeLabel(type: string) {
  if (type === "인스트럭터") return "강사";
  if (type === "일반회원") return "활동회원";
  if (type === "독립군") return "잠수중";
  return type;
}

function formatLocation(country: string | null, region: string | null) {
  if (!country && !region) return "";
  if (country === "대한민국") return region ?? "";
  return [country, region].filter(Boolean).join(" ");
}

function formatRecentActiveTime(lastActiveAt: string | null) {
  if (!lastActiveAt) return "";
  const diff = Date.now() - new Date(lastActiveAt).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "방금";
  if (mins < 60) return `${mins}분 전`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}시간 전`;
  const days = Math.floor(hours / 24);
  if (days < 30) return `${days}일 전`;
  return "";
}

type RelationStatus = "맞팔" | "팔로잉" | "팔로워" | "구독자" | "아님";

interface ProfileData {
  nickname: string;
  profile_image_url: string | null;
  bio: string | null;
  member_type: string[];
  country: string | null;
  region: string | null;
  last_active_at: string | null;
  received_star_count: number;
  gifted_star_count_by_me: number;
  my_star_balance: number;
}

interface CachedProfileSeed {
  id?: string;
  nickname?: string;
  profile_image_url?: string | null;
  bio?: string | null;
  member_type?: string[];
  country?: string | null;
  region?: string | null;
  last_active_at?: string | null;
  status?: "pending" | "approved" | "friend";
}

interface UserProfileModalProps {
  userId: string;
  onClose: () => void;
  initialProfile?: CachedProfileSeed | null;
}

function buildProfileData(member: CachedProfileSeed): ProfileData {
  return {
    nickname: member.nickname ?? "",
    profile_image_url: member.profile_image_url ?? null,
    bio: member.bio ?? null,
    member_type: member.member_type ?? [],
    country: member.country ?? null,
    region: member.region ?? null,
    last_active_at: member.last_active_at ?? null,
    received_star_count: 0,
    gifted_star_count_by_me: 0,
    my_star_balance: 0,
  };
}

function getRelationStatusFromMember(member: CachedProfileSeed | null): RelationStatus {
  if (!member?.status) return "아님";
  if (member.status === "friend") return "맞팔";
  if (member.status === "approved") return "팔로잉";
  return "아님";
}

function readSearchSocialCacheProfile(userId: string): { profile: ProfileData; relationStatus: RelationStatus } | null {
  try {
    const raw = localStorage.getItem(SEARCH_SOCIAL_CACHE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as {
      following?: CachedProfileSeed[];
      followers?: CachedProfileSeed[];
      mySubscribers?: CachedProfileSeed[];
    };
    const following = parsed.following?.find((member) => member.id === userId) ?? null;
    const follower = parsed.followers?.find((member) => member.id === userId) ?? null;
    const subscriber = parsed.mySubscribers?.find((member) => member.id === userId) ?? null;
    const member = following ?? follower ?? subscriber;
    if (!member) return null;
    return {
      profile: buildProfileData(member),
      relationStatus: following
        ? getRelationStatusFromMember(following)
        : follower
          ? "팔로워"
          : "구독자",
    };
  } catch {
    return null;
  }
}

function readUserViewSessionCache(userId: string): ProfileData | null {
  try {
    const raw = sessionStorage.getItem(`${USER_VIEW_CACHE_PREFIX}${userId}`);
    if (!raw) return null;
    const json = JSON.parse(raw);
    return {
      nickname: json.profile?.nickname ?? "",
      profile_image_url: json.profile?.profile_image_url ?? null,
      bio: json.profile?.bio ?? null,
      member_type: json.profile?.member_type ?? [],
      country: json.profile?.country ?? null,
      region: json.profile?.region ?? null,
      last_active_at: json.profile?.last_active_at ?? null,
      received_star_count: json.profile?.received_star_count ?? 0,
      gifted_star_count_by_me: json.starSummary?.gifted_star_count_by_me ?? 0,
      my_star_balance: json.starSummary?.my_star_balance ?? 0,
    };
  } catch {
    return null;
  }
}

function readUserSearchInfoCache(userId: string): ProfileData | null {
  try {
    const raw = localStorage.getItem(USER_SEARCH_INFO_KEY);
    if (!raw) return null;
    const arr = JSON.parse(raw) as CachedProfileSeed[];
    const found = arr.find((e) => e.id === userId);
    if (!found) return null;
    return buildProfileData(found);
  } catch {
    return null;
  }
}

export default function UserProfileModal({ userId, onClose, initialProfile = null }: UserProfileModalProps) {
  const router = useRouter();
  const [profileData, setProfileData] = useState<ProfileData | null>(null);
  const [relationStatus, setRelationStatus] = useState<RelationStatus>("아님");
  const [menuOpen, setMenuOpen] = useState(false);
  const [menuPosition, setMenuPosition] = useState<{ x: number; y: number; placement: "top" | "bottom" } | null>(null);
  const [messageTarget, setMessageTarget] = useState<{ id: string; nickname: string; profile_image_url: string | null } | null>(null);

  const [confirmOpen, setConfirmOpen] = useState(false);
  const [friendCancelOpen, setFriendCancelOpen] = useState(false);
  const [showFriendCancelSuccess, setShowFriendCancelSuccess] = useState(false);
  const [giftSubmitting, setGiftSubmitting] = useState(false);
  const [showSuccess, setShowSuccess] = useState(false);
  const [showCelebration, setShowCelebration] = useState(false);
  const [giftPatch, setGiftPatch] = useState<{
    gifted_star_count_by_me: number;
    my_star_balance: number;
    received_star_count: number;
  } | null>(null);

  const giftedStarCount = giftPatch?.gifted_star_count_by_me ?? profileData?.gifted_star_count_by_me ?? 0;
  const myStarBalance = giftPatch?.my_star_balance ?? profileData?.my_star_balance ?? 0;
  const receivedStarCount = giftPatch?.received_star_count ?? profileData?.received_star_count ?? 0;
  const hasGifted = giftedStarCount > 0;

  useEffect(() => {
    const socialCached = readSearchSocialCacheProfile(userId);
    const seedProfile = initialProfile ? buildProfileData(initialProfile) : null;
    const dancerCached = readUserSearchInfoCache(userId);
    const sessionCached = readUserViewSessionCache(userId);
    let nextCachedProfile = seedProfile ?? socialCached?.profile ?? dancerCached ?? sessionCached;
    if (nextCachedProfile && nextCachedProfile !== sessionCached && sessionCached) {
      nextCachedProfile = { ...nextCachedProfile, received_star_count: sessionCached.received_star_count, gifted_star_count_by_me: sessionCached.gifted_star_count_by_me, my_star_balance: sessionCached.my_star_balance };
    }

    queueMicrotask(() => {
      setProfileData(nextCachedProfile);
      setGiftPatch(null);
      if (initialProfile?.status) {
        setRelationStatus(getRelationStatusFromMember(initialProfile));
      } else if (socialCached) {
        setRelationStatus(socialCached.relationStatus);
      } else {
        setRelationStatus("아님");
      }
    });

    let cancelled = false;

    fetch(`/api/users/${userId}/view-summary`)
      .then((res) => res.json())
      .then((json) => {
        if (cancelled) return;
        sessionStorage.setItem(`${USER_VIEW_CACHE_PREFIX}${userId}`, JSON.stringify(json));
        setProfileData({
          nickname: json.profile?.nickname ?? "",
          profile_image_url: json.profile?.profile_image_url ?? null,
          bio: json.profile?.bio ?? null,
          member_type: json.profile?.member_type ?? [],
          country: json.profile?.country ?? null,
          region: json.profile?.region ?? null,
          last_active_at: json.profile?.last_active_at ?? null,
          received_star_count: json.profile?.received_star_count ?? 0,
          gifted_star_count_by_me: json.starSummary?.gifted_star_count_by_me ?? 0,
          my_star_balance: json.starSummary?.my_star_balance ?? 0,
        });
      })
      .catch(() => {});

    return () => { cancelled = true; };
  }, [initialProfile, userId]);

  useEffect(() => {
    if (!profileData) return;

    const socialCached = readSearchSocialCacheProfile(userId);
    if (!socialCached) return;
    queueMicrotask(() => setRelationStatus(socialCached.relationStatus));
  }, [profileData, userId]);

  if (!profileData) return null;

  const locationText = formatLocation(profileData.country, profileData.region);
  const activeTimeText = formatRecentActiveTime(profileData.last_active_at);
  const profileMetaText = [locationText, activeTimeText].filter(Boolean).join(", ");

  function handleMenuOpen(e: React.MouseEvent<HTMLButtonElement>) {
    const r = e.currentTarget.getBoundingClientRect();
    const placement = r.top > window.innerHeight / 2 ? "top" : "bottom";
    setMenuPosition({
      x: r.right,
      y: placement === "top" ? r.top : r.bottom,
      placement,
    });
    setMenuOpen(true);
  }

  async function handleGiftConfirm() {
    if (giftSubmitting || hasGifted || myStarBalance < 1) return;
    setGiftSubmitting(true);
    setConfirmOpen(false);
    try {
      const response = await fetch("/api/stars/gift", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ receiverId: userId, count: 1 }),
      });
      const json = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(json?.error ?? "star_gift_failed");

      const remainingBalance = typeof json.remainingBalance === "number" ? json.remainingBalance : Math.max(0, myStarBalance - 1);
      const nextReceivedCount = receivedStarCount + 1;

      setGiftPatch({
        gifted_star_count_by_me: 1,
        my_star_balance: remainingBalance,
        received_star_count: nextReceivedCount,
      });
      addStarGiftedId(userId);

      setShowSuccess(true);
      setTimeout(() => {
        setShowSuccess(false);
        setShowCelebration(true);
        setTimeout(() => setShowCelebration(false), 1000);
      }, 1000);

      try {
        const cacheKey = `${USER_VIEW_CACHE_PREFIX}${userId}`;
        const raw = sessionStorage.getItem(cacheKey);
        if (raw) {
          const parsed = JSON.parse(raw);
          sessionStorage.setItem(cacheKey, JSON.stringify({
            ...parsed,
            profile: { ...parsed.profile, received_star_count: nextReceivedCount },
            starSummary: { ...(parsed.starSummary ?? {}), gifted_star_count_by_me: 1, my_star_balance: remainingBalance },
          }));
        }
      } catch {}
    } catch {
      alert("별 선물에 실패했어요. 다시 시도해주세요.");
    } finally {
      setGiftSubmitting(false);
    }
  }

  async function handleHideFriend() {
    setMenuOpen(false);
    try {
      const res = await fetch("/api/friends/hide", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ target_id: userId }),
      });
      if (!res.ok) throw new Error();
      onClose();
    } catch {
      alert("숨김 처리 중 오류가 발생했습니다.");
    }
  }

  return (
    <>
      <div className="fixed inset-0 z-[75] bg-black/50" onClick={onClose} />
      <div className="fixed inset-0 z-[80] flex items-center justify-center pointer-events-none">
        <div className="relative w-[250px] bg-white rounded-2xl shadow-lg p-6 pointer-events-auto flex flex-col items-center gap-2">
          <button
            type="button"
            className="absolute top-3 right-3 rounded-full p-1 text-gray-500 hover:bg-gray-100"
            onClick={handleMenuOpen}
            aria-label="더보기"
            title="더보기"
          >
            <Ellipsis size={20} />
          </button>

          <div className={`relative ${hasGifted ? "animate-breathe" : ""}`}>
            <Avatar src={profileData.profile_image_url} nickname={profileData.nickname} size={80} />
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
              {profileData.nickname}
            </p>
            {profileMetaText && (
              <p className="text-xs text-gray-400 mt-0.5">{profileMetaText}</p>
            )}
            {profileData.member_type?.[0] && (
              <div className="flex items-center justify-center mt-2">
                <span className="px-2.5 py-1 rounded-full bg-gray-800 text-white text-[12px] font-medium">
                  {getMemberTypeLabel(profileData.member_type[0])}
                </span>
              </div>
            )}
            {profileData.bio && (
              <p className="text-[17px] text-gray-600 line-clamp-4 mt-1 whitespace-pre-wrap">
                {profileData.bio}
              </p>
            )}
            <div className="mt-2 flex items-center justify-center gap-2">
              <span className="rounded-full bg-gray-100 px-2.5 py-1 text-xs font-semibold text-gray-600">
                {relationStatus}
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
            <button
              className="flex-1 h-9 rounded-full bg-[#FEE500] text-gray-900 font-semibold text-[14px]"
              onClick={() => {
                setMessageTarget({
                  id: userId,
                  nickname: profileData.nickname,
                  profile_image_url: profileData.profile_image_url,
                });
              }}
            >
              메시지 전송
            </button>
          </div>
        </div>
      </div>

      {/* 더보기 메뉴 */}
      {menuOpen && menuPosition && (
        <>
          <div className="fixed inset-0 z-[85]" onClick={() => setMenuOpen(false)} />
          <div
            className="fixed z-[90] bg-white rounded-xl shadow-lg border border-gray-100 overflow-hidden"
            style={{
              width: 180,
              top: menuPosition.placement === "bottom" ? menuPosition.y : "auto",
              bottom: menuPosition.placement === "top" ? window.innerHeight - menuPosition.y + 8 : "auto",
              left: menuPosition.x - 180,
            }}
          >
            <button
              className="flex items-center justify-between w-full px-4 py-3 text-gray-700"
              style={{ fontSize: "16px" }}
              onClick={() => {
                setMenuOpen(false);
                router.push(`/users/${userId}/view`);
                onClose();
              }}
            >
              <span>프로필 보기</span>
              <UserCircle size={20} className="text-gray-500" />
            </button>
            <div className="border-t border-gray-100 mx-3" />
            <button
              className={`flex items-center justify-between w-full px-4 py-3 ${hasGifted ? "text-gray-300" : "text-gray-700"}`}
              style={{ fontSize: "16px" }}
              disabled={hasGifted || myStarBalance < 1}
              onClick={() => {
                setMenuOpen(false);
                setConfirmOpen(true);
              }}
            >
              <span>{hasGifted ? "별선물완료" : "별 선물하기"}</span>
              <Star size={20} className={hasGifted ? "text-yellow-400 fill-yellow-400" : "text-gray-500"} />
            </button>
            <div className="border-t border-gray-100 mx-3" />
            <button
              className="flex items-center justify-between w-full px-4 py-3 text-gray-700"
              style={{ fontSize: "16px" }}
              onClick={() => {
                setMenuOpen(false);
                setMessageTarget({
                  id: userId,
                  nickname: profileData.nickname,
                  profile_image_url: profileData.profile_image_url,
                });
              }}
            >
              <span>메시지 전송</span>
              <Send size={20} className="text-gray-500" />
            </button>
            {relationStatus === "아님" && (
              <>
                <div className="border-t border-gray-100 mx-3" />
                <button
                  className="flex items-center justify-between w-full px-4 py-3 text-gray-700"
                  style={{ fontSize: "16px" }}
                  onClick={async () => {
                    setMenuOpen(false);
                    const res = await fetch("/api/friends", {
                      method: "POST",
                      headers: { "Content-Type": "application/json" },
                      body: JSON.stringify({ target_id: userId }),
                    });
                    if (res.ok) setRelationStatus("팔로잉");
                  }}
                >
                  <span>친구신청</span>
                  <UserPlus size={20} className="text-gray-500" />
                </button>
              </>
            )}
            {(relationStatus === "팔로잉" || relationStatus === "맞팔") && (
              <>
                <div className="border-t border-gray-100 mx-3" />
                <button
                  className="flex items-center justify-between w-full px-4 py-3 text-gray-700"
                  style={{ fontSize: "16px" }}
                  onClick={async () => {
                    setMenuOpen(false);
                    if (relationStatus === "맞팔") {
                      setFriendCancelOpen(true);
                    } else {
                      const res = await fetch("/api/friends", {
                        method: "DELETE",
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify({ target_id: userId }),
                      });
                      if (res.ok) {
                        setRelationStatus("아님");
                        setShowFriendCancelSuccess(true);
                        setTimeout(() => setShowFriendCancelSuccess(false), 1500);
                      }
                    }
                  }}
                >
                  <span>친구취소</span>
                  <UserMinus size={20} className="text-gray-500" />
                </button>
              </>
            )}
            <div className="border-t border-gray-100 mx-3" />
            <button
              className="flex items-center justify-between w-full px-4 py-3 text-gray-700"
              style={{ fontSize: "16px" }}
              onClick={handleHideFriend}
            >
              <span>숨김처리</span>
              <Ban size={20} className="text-gray-500" />
            </button>
          </div>
        </>
      )}

      {/* 별 선물 확인 */}
      {confirmOpen && (
        <>
          <div className="fixed inset-0 z-[90] bg-black/40" onClick={() => setConfirmOpen(false)} />
          <div className="fixed inset-0 z-[100] flex items-center justify-center pointer-events-none">
            <div className="bg-white rounded-2xl shadow-lg p-6 w-[250px] h-[180px] pointer-events-auto flex flex-col items-center justify-center gap-6">
              <p className="font-semibold text-gray-900 text-center" style={{ fontSize: 17 }}>
                {profileData.nickname}님에게<br />별 1개 선물합니다
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

      {/* 별 선물 성공 */}
      {showSuccess && (
        <div className="fixed inset-0 z-[110] flex items-center justify-center pointer-events-none">
          <div className="w-16 h-16 rounded-full bg-yellow-400 flex items-center justify-center shadow-lg" style={{ animation: "fade-in-out 1s ease forwards" }}>
            <Check size={32} className="text-gray-900" strokeWidth={3} />
          </div>
        </div>
      )}

      {/* 친구취소 확인 */}
      {friendCancelOpen && (
        <>
          <div className="fixed inset-0 z-[90] bg-black/40" onClick={() => setFriendCancelOpen(false)} />
          <div className="fixed inset-0 z-[100] flex items-center justify-center pointer-events-none">
            <div className="bg-white rounded-2xl shadow-lg p-6 w-[250px] pointer-events-auto flex flex-col items-center justify-center gap-5">
              <p className="font-semibold text-gray-900 text-center" style={{ fontSize: 17 }}>
                회원삭제는 상대방에게<br />전달하지 않습니다
              </p>
              <div className="flex gap-2 w-full">
                <button
                  type="button"
                  onClick={() => setFriendCancelOpen(false)}
                  className="flex-1 h-10 rounded-full border border-gray-200 text-sm font-semibold text-gray-600"
                >
                  취소
                </button>
                <button
                  type="button"
                  onClick={async () => {
                    setFriendCancelOpen(false);
                    const res = await fetch("/api/friends", {
                      method: "DELETE",
                      headers: { "Content-Type": "application/json" },
                      body: JSON.stringify({ target_id: userId }),
                    });
                    if (res.ok) {
                      setRelationStatus("아님");
                      setShowFriendCancelSuccess(true);
                      setTimeout(() => setShowFriendCancelSuccess(false), 1500);
                    }
                  }}
                  className="flex-1 h-10 rounded-full bg-red-500 text-white text-sm font-semibold"
                >
                  확인
                </button>
              </div>
            </div>
          </div>
        </>
      )}

      {/* 친구취소 완료 */}
      {showFriendCancelSuccess && (
        <div className="fixed inset-0 z-[110] flex items-center justify-center pointer-events-none">
          <div className="w-16 h-16 rounded-full bg-red-500 flex items-center justify-center shadow-lg" style={{ animation: "fade-in-out 1s ease forwards" }}>
            <Check size={32} className="text-white" strokeWidth={3} />
          </div>
        </div>
      )}

      {/* 메시지 전송 모달 */}
      {messageTarget && (
        <SendMessageModal
          isOpen={!!messageTarget}
          onClose={() => setMessageTarget(null)}
          onSent={() => {
            setMessageTarget(null);
            onClose();
          }}
          receiver={messageTarget}
        />
      )}
    </>
  );
}
