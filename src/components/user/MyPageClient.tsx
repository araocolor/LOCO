"use client";

import { useState, useEffect } from "react";
import Image from "next/image";
import { UserCircle, X, Settings, HeartHandshake, Star, SmilePlus, UsersRound, CreditCard, Megaphone, Headphones, FileText, ShieldCheck, ChevronRight, ReceiptText, Award } from "lucide-react";
import { fetchWithAuthRetry } from "@/lib/auth/fetch-with-auth-retry";
import { prefetchBoardPostsCache } from "@/lib/board-session-cache";
import { PROFILE_AVATAR_UPDATED_EVENT, PROFILE_EDIT_OPEN_EVENT } from "@/lib/profile-events";
import type { ProfileAvatarUpdatedDetail, ProfileEditMode, ProfileEditOpenDetail } from "@/lib/profile-events";
import ProfileEditDrawer from "./ProfileEditDrawer";
import { ClassImage } from "@/types/class";
import { RiVerifiedBadgeFill } from "react-icons/ri";
import Avatar from "@/components/ui/Avatar";
import type { StarGiver } from "@/types/user";
import UserProfileModal from "./UserProfileModal";
import LegalDrawer from "@/components/legal/LegalDrawer";
import PrivacyPolicyContent from "@/components/legal/PrivacyPolicyContent";
import TermsOfServiceContent from "@/components/legal/TermsOfServiceContent";
import RefundPolicyContent from "@/components/legal/RefundPolicyContent";
import StarChargeSheet from "@/components/star/StarChargeSheet";
import StarGiftersPanel from "@/components/star/StarGiftersPanel";
import CustomerServiceDrawer from "./CustomerServiceDrawer";
import type { CustomerServiceTab } from "./CustomerServiceDrawer";
import CachedClassDetailPage from "@/components/class/CachedClassDetailPage";
import ClassHeader from "@/components/layout/ClassHeader";

const HOME_MY_CLASSES_CACHE_KEY = "loco_home_my_classes_v1";

const DEFAULT_AVATAR = "/no face/noface.png";

function getMemberTypeLabel(type: string) {
  if (type === "인스트럭터") return "강사";
  if (type === "활동회원") return "활동회원";
  if (type === "독립군") return "잠수중";
  return type;
}


interface GridClass {
  id: string;
  images: ClassImage[] | null;
  title: string;
  status?: string;
  created_at?: string;
  isBookmark?: boolean;
  isOwned?: boolean;
  isApplied?: boolean;
}

interface HomeMyClassesCache {
  profile?: {
    id?: string;
    region?: string | null;
  };
  regionalClasses?: GridClass[];
}

function getHomeMyClassesCacheKey(userId: string) {
  return `${HOME_MY_CLASSES_CACHE_KEY}:${userId}`;
}

interface Profile {
  id: string;
  email: string | null;
  nickname: string;
  nickname_changed_at?: string | null;
  bio: string | null;
  country: string | null;
  region: string | null;
  favorite_genre: string[];
  member_type: string[];
  profile_image_url: string | null;
  org_name: string | null;
  role?: string;
  received_star_count?: number;
  star_balance?: number;
}

interface Props {
  profile: Profile;
  allClasses: GridClass[];
  starGivers?: StarGiver[];
  socialCounts?: {
    following: number;
    followers: number;
    friends: number;
    subscriptionCount?: number;
  };
}

type CacheProfilePatch = Partial<Pick<Profile, "bio" | "country" | "region" | "favorite_genre" | "member_type" | "profile_image_url" | "org_name">>;
const STAR_BALANCE_UPDATED_EVENT = "loco:star-balance-updated";

function readMyPageCachedProfile(cacheKey: string): CacheProfilePatch | null {
  try {
    const raw = localStorage.getItem(cacheKey);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as { profile?: CacheProfilePatch };
    return parsed.profile ?? null;
  } catch {
    return null;
  }
}

export default function MyPageClient({
  profile,
  allClasses: initialAllClasses,
  socialCounts,
  starGivers: initialStarGivers = [],
}: Props) {
  const MY_PAGE_CACHE_KEY = "loco_mypage_cache_local_v3";
  const [editOpen, setEditOpen] = useState(false);
  const [editMode, setEditMode] = useState<ProfileEditMode>("normal");
  const [avatarUrl, setAvatarUrl] = useState<string | null>(() => {
    if (profile.profile_image_url) return profile.profile_image_url;
    if (typeof window === "undefined") return DEFAULT_AVATAR;
    try {
      const raw = localStorage.getItem(MY_PAGE_CACHE_KEY);
      if (raw) {
        const cached = JSON.parse(raw)?.profile?.profile_image_url;
        if (cached) return cached;
      }
    } catch {}
    try {
      const raw = localStorage.getItem(MY_PAGE_CACHE_KEY);
      const parsed = raw ? JSON.parse(raw) : {};
      localStorage.setItem(MY_PAGE_CACHE_KEY, JSON.stringify({
        ...parsed,
        profile: { ...parsed.profile, profile_image_url: DEFAULT_AVATAR },
      }));
    } catch {}
    return DEFAULT_AVATAR;
  });
  const [avatarHdUrl, setAvatarHdUrl] = useState<string | null>(() => {
    const url = profile.profile_image_url ?? (() => {
      if (typeof window === "undefined") return null;
      try {
        const raw = localStorage.getItem(MY_PAGE_CACHE_KEY);
        if (raw) return JSON.parse(raw)?.profile?.profile_image_url ?? null;
      } catch {}
      return null;
    })();
    return url ? url.replace(/\.webp$/, "_hd.webp") : null;
  });
  const [allClasses, setAllClasses] = useState<GridClass[]>(initialAllClasses);
  const [regionalClasses, setRegionalClasses] = useState<GridClass[]>([]);
  const [regionalClassRegion, setRegionalClassRegion] = useState<string | null>(profile.region);
  const [friendsCount, setFriendsCount] = useState<number>(socialCounts?.friends ?? 0);
  const [followingCount, setFollowingCount] = useState<number>(socialCounts?.following ?? 0);
  const [starBalanceOverride, setStarBalanceOverride] = useState<number | null>(null);
  const starBalance = starBalanceOverride ?? profile.star_balance ?? 0;

  useEffect(() => {
    setAllClasses(initialAllClasses);
  }, [initialAllClasses]);

  useEffect(() => {
    function handleBookmarkChanged(e: Event) {
      const detail = (e as CustomEvent<{ classId: string; bookmarked: boolean; classInfo?: GridClass | null }>).detail;
      if (!detail) return;
      if (detail.bookmarked && detail.classInfo) {
        setAllClasses((prev) => {
          if (prev.some((c) => c.id === detail.classId)) {
            return prev.map((c) => c.id === detail.classId ? { ...c, isBookmark: true } : c);
          }
          return [...prev, { ...detail.classInfo!, isBookmark: true }];
        });
      } else {
        setAllClasses((prev) =>
          prev.flatMap((c) => {
            if (c.id !== detail.classId) return [c];
            if (c.isOwned || c.isApplied) return [{ ...c, isBookmark: false }];
            return [];
          })
        );
      }
    }
    window.addEventListener("bookmarkChanged", handleBookmarkChanged);
    return () => window.removeEventListener("bookmarkChanged", handleBookmarkChanged);
  }, []);

  useEffect(() => {
    if (socialCounts?.friends != null) setFriendsCount(socialCounts.friends);
    if (socialCounts?.following != null) setFollowingCount(socialCounts.following);
  }, [socialCounts?.friends, socialCounts?.following]);

  useEffect(() => {
    function handleStarBalanceUpdated(event: Event) {
      const detail = (event as CustomEvent<{ starBalance?: number; delta?: number }>).detail;
      if (typeof detail?.delta === "number") {
        setStarBalanceOverride((prev) => (prev ?? profile.star_balance ?? 0) + detail.delta!);
      } else if (typeof detail?.starBalance === "number") {
        setStarBalanceOverride(detail.starBalance);
      }
    }

    window.addEventListener(STAR_BALANCE_UPDATED_EVENT, handleStarBalanceUpdated);
    return () => window.removeEventListener(STAR_BALANCE_UPDATED_EVENT, handleStarBalanceUpdated);
  }, [profile.star_balance]);

  useEffect(() => {
    function handleAvatarUpdated(event: Event) {
      const detail = (event as CustomEvent<ProfileAvatarUpdatedDetail>).detail;
      setAvatarUrl(detail.profile_image_url);
      setAvatarHdUrl(detail.profile_image_url ? detail.profile_image_url.replace(/\.webp$/, "_hd.webp") : null);
    }

    window.addEventListener(PROFILE_AVATAR_UPDATED_EVENT, handleAvatarUpdated);
    return () => window.removeEventListener(PROFILE_AVATAR_UPDATED_EVENT, handleAvatarUpdated);
  }, []);

  const [starGiversOpen, setStarGiversOpen] = useState(false);
  const [privacyOpen, setPrivacyOpen] = useState(false);
  const [termsOpen, setTermsOpen] = useState(false);
  const [refundOpen, setRefundOpen] = useState(false);
  const [starChargeOpen, setStarChargeOpen] = useState(false);
  const [businessInfoOpen, setBusinessInfoOpen] = useState(true);
  const [starGiverProfileId, setStarGiverProfileId] = useState<string | null>(null);
  const [avatarZoomOpen, setAvatarZoomOpen] = useState(false);
  const [proProfileModalOpen, setProProfileModalOpen] = useState(false);
  const [csDrawerOpen, setCsDrawerOpen] = useState(false);
  const [csInitialTab, setCsInitialTab] = useState<CustomerServiceTab>("notice");
  const [classDetailId, setClassDetailId] = useState<string | null>(null);

  useEffect(() => {
    void prefetchBoardPostsCache();
  }, []);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(MY_PAGE_CACHE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        const sc = parsed?.socialCounts;
        queueMicrotask(() => {
          if (sc?.friends != null) setFriendsCount(sc.friends);
          if (sc?.following != null) setFollowingCount(sc.following);
        });
      }
      fetchWithAuthRetry("/api/friends/social").then((res) => {
        if (!res.ok) return;
        res.json().then((social) => {
          const followingCount = (social.data?.following ?? []).filter((item: { status?: string }) => item.status === "approved").length;
          setFollowingCount(followingCount);
          try {
            const raw = localStorage.getItem(MY_PAGE_CACHE_KEY);
            if (raw) {
              const parsed = JSON.parse(raw);
              localStorage.setItem(
                MY_PAGE_CACHE_KEY,
                JSON.stringify({
                  ...parsed,
                  socialCounts: {
                    ...parsed.socialCounts,
                    following: followingCount,
                  },
                })
              );
            }
            localStorage.setItem(
              "search_social_cache",
              JSON.stringify({
                followers: social.data?.followers ?? [],
                following: social.data?.following ?? [],
                mySubscribers: social.data?.mySubscribers ?? [],
                subscriptionCount: social.data?.subscriptionCount ?? 0,
                ts: Date.now(),
              })
            );
          } catch {}
        });
      }).catch(() => {});
    } catch {}
  }, []);

  function patchMyPageProfileCache(patch: CacheProfilePatch) {
    try {
      const raw = localStorage.getItem(MY_PAGE_CACHE_KEY);
      if (!raw) return;
      const parsed = JSON.parse(raw) as { profile?: Record<string, unknown> };
      if (!parsed.profile) return;
      const next = {
        ...parsed,
        profile: {
          ...parsed.profile,
          ...patch,
        },
      };
      localStorage.setItem(MY_PAGE_CACHE_KEY, JSON.stringify(next));
    } catch {}
  }

  useEffect(() => {
    const cacheKey = getHomeMyClassesCacheKey(profile.id);

    function readRegionalClassesCache() {
      try {
        const raw = localStorage.getItem(cacheKey);
        if (!raw) return;
        const parsed = JSON.parse(raw) as HomeMyClassesCache;
        if (parsed.profile?.id && parsed.profile.id !== profile.id) return;
        setRegionalClasses(Array.isArray(parsed.regionalClasses) ? parsed.regionalClasses : []);
        setRegionalClassRegion(parsed.profile?.region ?? profile.region ?? null);
      } catch {}
    }

    readRegionalClassesCache();

    function handleStorage(event: StorageEvent) {
      if (event.key === cacheKey) readRegionalClassesCache();
    }

    window.addEventListener("storage", handleStorage);
    return () => window.removeEventListener("storage", handleStorage);
  }, [profile.id, profile.region]);

  function handleOpenEditModal(mode?: ProfileEditMode) {
    setEditMode(mode ?? (profile.role === "pro" ? "professional" : "normal"));
    setEditOpen(true);
  }

  useEffect(() => {
    function onProfileEditOpen(e: Event) {
      const detail = (e as CustomEvent<ProfileEditOpenDetail>).detail;
      handleOpenEditModal(detail?.mode ?? "normal");
    }
    window.addEventListener(PROFILE_EDIT_OPEN_EVENT, onProfileEditOpen);
    return () => {
      window.removeEventListener(PROFILE_EDIT_OPEN_EVENT, onProfileEditOpen);
    };
  });
  const receivedStarCount = profile.received_star_count ?? 0;
  const starGivers = initialStarGivers;

  return (
    <div className="flex flex-col h-full">
      {/* 상단 30% */}
      <div className="bg-white flex flex-col items-start px-4 pt-5 pb-5">
        <div className="flex flex-col w-full gap-1">
          {/* 1행: 내 아바타 | 친구 아바타 */}
          <div className="flex items-center w-full">
            <div className="w-1/2 flex items-start">
              <div className="relative flex-shrink-0">
                <button
                  onClick={() => handleOpenEditModal()}
                  className="hover:opacity-80 transition-opacity cursor-pointer"
                >
                  {avatarUrl ? (
                    <Image
                      src={avatarUrl}
                      alt="프로필"
                      width={60}
                      height={60}
                      className={`rounded-full object-cover w-[60px] h-[60px]${profile.role === "pro" ? " border border-white outline outline-2 outline-[#1D9BF0]" : ""}`}
                      unoptimized
                    />
                  ) : (
                    <UserCircle size={60} className="text-gray-400" />
                  )}
                </button>
                <span
                  onClick={() => handleOpenEditModal()}
                  className="absolute bottom-0 right-0 w-5 h-5 bg-white rounded-full flex items-center justify-center shadow-sm border border-gray-200 cursor-pointer"
                >
                  <Settings size={14} className="text-gray-600" />
                </span>
              </div>
            </div>
            <div className="w-1/2 flex justify-end">
              <div className="grid grid-cols-3 w-full max-w-[250px] text-center">
                <div className="flex flex-col items-center gap-0.5">
                  <HeartHandshake size={25} />
                  <span className="text-[18px] font-bold text-gray-900 leading-tight">{friendsCount}</span>
                </div>
                <button
                  type="button"
                  onClick={() => setStarGiversOpen(true)}
                  className="flex flex-col items-center gap-0.5"
                  aria-label="별을 준 사람들 보기"
                  title="별을 준 사람들 보기"
                >
                  <Star size={25} className="text-yellow-400 fill-yellow-400 drop-shadow-md" />
                  <span className="text-[18px] font-bold text-gray-900 leading-tight">{receivedStarCount}</span>
                </button>
                <div className="flex flex-col items-center gap-0.5">
                  <SmilePlus size={25} className="text-gray-500" />
                  <span className="text-[18px] font-bold text-gray-900 leading-tight">{followingCount}</span>
                </div>
              </div>
            </div>
          </div>
          {/* 2행~: 닉네임, 이메일, 자기소개 */}
          <span className="flex items-center gap-1">
            <span className="text-[17px] font-bold text-[#333333]">{profile.nickname}</span>
            {profile.role === "pro" && <RiVerifiedBadgeFill size={18} color="#1D9BF0" />}
          </span>
          {profile.member_type?.[0] && (
            <span className={`px-2.5 py-0 rounded-full text-[13px] self-start ${profile.role === "pro" ? "bg-[#1D9BF0] text-white" : "bg-gray-800 text-white"}`}>
              {getMemberTypeLabel(profile.member_type[0])}
            </span>
          )}
          <span className="text-[14px] text-gray-400 -mt-1">
            {profile.email ?? ""}
          </span>
          {profile.bio && (
            <span className="text-[16px] w-[80%] mt-2" style={{ color: "#000000cc" }}>{profile.bio}</span>
          )}
        </div>
      </div>

      {/* 하단 클래스 섹션 */}
      <div className="flex-1 bg-white">
        {allClasses.length > 0 && (
          <>
            <div className="px-4 pt-5 pb-2">
              <span className="text-[15px] font-bold text-gray-800">마이클래스</span>
            </div>
            <div className="grid grid-cols-3 gap-[1px]">
              {allClasses.map((item) => (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => setClassDetailId(item.id)}
                  className="aspect-square bg-gray-100 relative overflow-hidden cursor-pointer"
                >
                  {item.images?.[0]?.card_url ? (
                    <Image src={item.images[0].card_url} alt={item.title} fill className="object-cover" unoptimized />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center bg-gray-100">
                      <span className="text-gray-300 text-xs">없음</span>
                    </div>
                  )}
                  {item.isBookmark && (
                    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="white" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="absolute top-1.5 right-1.5">
                      <polygon points="19 21 12 16 5 21 5 3 19 3" />
                    </svg>
                  )}
                </button>
              ))}
            </div>
          </>
        )}

        {regionalClasses.length > 0 && (
          <>
            <div className="px-4 pt-5 pb-2">
              <span className="text-[15px] font-bold text-gray-800">
                {regionalClassRegion ? `${regionalClassRegion} 클래스` : "지역 클래스"}
              </span>
            </div>
            <div className="grid grid-cols-3 gap-[1px]">
              {regionalClasses.map((item) => (
                <button
                  key={item.id + "-regional"}
                  type="button"
                  onClick={() => setClassDetailId(item.id)}
                  className="aspect-square bg-gray-100 relative overflow-hidden cursor-pointer"
                >
                  {item.images?.[0]?.card_url ? (
                    <Image src={item.images[0].card_url} alt={item.title} fill className="object-cover" unoptimized />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center bg-gray-100">
                      <span className="text-gray-300 text-xs">없음</span>
                    </div>
                  )}
                </button>
              ))}
            </div>
          </>
        )}
      </div>

      {/* 고객지원 */}
      <div className="mx-4 mt-4 mb-8 rounded-xl bg-white border border-gray-100 shadow-sm overflow-hidden">
        <div className="px-4 pt-4 pb-2">
          <span className="text-[15px] font-bold text-gray-800">고객지원</span>
        </div>
        <button type="button" onClick={() => { setCsInitialTab("notice"); setCsDrawerOpen(true); }} className="flex w-full items-center gap-3 px-4 py-3 hover:bg-gray-50 transition-colors">
          <Megaphone size={22} className="text-gray-500" />
          <span className="flex-1 text-left text-[16px] text-gray-800">공지사항</span>
          <ChevronRight size={18} className="text-gray-400" />
        </button>
        <button type="button" onClick={() => { setCsInitialTab("support"); setCsDrawerOpen(true); }} className="flex w-full items-center gap-3 px-4 py-3 hover:bg-gray-50 transition-colors">
          <Headphones size={22} className="text-gray-500" />
          <span className="flex-1 text-left text-[16px] text-gray-800">고객문의</span>
          <ChevronRight size={18} className="text-gray-400" />
        </button>
        <button type="button" onClick={() => setTermsOpen(true)} className="flex w-full items-center gap-3 px-4 py-3 hover:bg-gray-50 transition-colors">
          <FileText size={22} className="text-gray-500" />
          <span className="flex-1 text-left text-[16px] text-gray-800">서비스 이용약관</span>
          <ChevronRight size={18} className="text-gray-400" />
        </button>
        <button type="button" onClick={() => setRefundOpen(true)} className="flex w-full items-center gap-3 px-4 py-3 hover:bg-gray-50 transition-colors">
          <ReceiptText size={22} className="text-gray-500" />
          <span className="flex-1 text-left text-[16px] text-gray-800">환불정책</span>
          <ChevronRight size={18} className="text-gray-400" />
        </button>
        <button type="button" onClick={() => setPrivacyOpen(true)} className="flex w-full items-center gap-3 px-4 py-3 hover:bg-gray-50 transition-colors">
          <ShieldCheck size={22} className="text-gray-500" />
          <span className="flex-1 text-left text-[16px] text-gray-800">개인정보처리방침</span>
          <ChevronRight size={18} className="text-gray-400" />
        </button>
      </div>

      {/* 사업자 정보 */}
      <div className="mx-4 mt-1 mb-4">
        <button
          type="button"
          onClick={() => setBusinessInfoOpen((prev) => !prev)}
          className="ml-5 flex w-[90%] items-center justify-between text-left text-[15px] text-gray-500"
          aria-expanded={businessInfoOpen}
          aria-controls="business-info-panel"
        >
          <span>Xlatin 사업자 정보안내</span>
          <ChevronRight
            size={16}
            className={`text-gray-400 transition-transform ${businessInfoOpen ? "rotate-90" : ""}`}
          />
        </button>
        {businessInfoOpen && (
          <div
            id="business-info-panel"
            className="ml-5 mt-3 w-[90%] space-y-1 text-[14px] leading-[19px] text-gray-400"
          >
            <p>서비스명 : Xlatin</p>
            <p>사업자 : 아라오 (ARAO) | 대표 : 한철</p>
            <p>사업자번호 : 334-07-03291</p>
            <p>통신판매업 신고번호 : 2026-제주조천-0058</p>
            <p>호스팅 사업자 : Vercel</p>
            <p>주소 : 제주특별자치도 제주시 조천읍 조함해안로 6</p>
            <p>전화번호 : 064-783-3655</p>
            <p>고객문의 : jejusalsa@gmail.com</p>
          </div>
        )}
      </div>

      <div className="mx-9 mb-10 flex items-center gap-3">
        <div className="flex h-[55px] w-[55px] shrink-0 items-center justify-center">
          <Image
            src="/character/yelly_icon.png"
            alt="Xlatin"
            width={55}
            height={55}
            className="h-auto w-[55px] object-contain"
          />
        </div>
        <div className="min-w-0">
          <p className="text-[14px] font-bold leading-[20px] text-gray-800">
            TINO
          </p>
          <p className="text-[13px] leading-[18px] text-gray-500">
            앱 안내와 이벤트 소식에서 만나는
            <br />
            작고 귀여운 캐릭터입니다.
          </p>
        </div>
      </div>

      {starGiversOpen && (
        <StarGiftersPanel
          starGivers={starGivers}
          starBalance={starBalance}
          onClose={() => setStarGiversOpen(false)}
          onProfileClick={(id) => setStarGiverProfileId(id)}
          onChargeClick={() => setStarChargeOpen(true)}
        />
      )}

      {starGiverProfileId && (
        <UserProfileModal
          userId={starGiverProfileId}
          onClose={() => setStarGiverProfileId(null)}
        />
      )}

      <ProfileEditDrawer
        open={editOpen}
        onClose={() => setEditOpen(false)}
        profile={profile}
        mode={editMode}
      />

      <StarChargeSheet
        open={starChargeOpen}
        onClose={() => setStarChargeOpen(false)}
        onComplete={() => setStarChargeOpen(false)}
      />

      <LegalDrawer open={privacyOpen} onClose={() => setPrivacyOpen(false)} title="개인정보처리방침">
        <PrivacyPolicyContent />
      </LegalDrawer>

      <LegalDrawer open={termsOpen} onClose={() => setTermsOpen(false)} title="서비스 이용약관">
        <TermsOfServiceContent />
      </LegalDrawer>

      <LegalDrawer open={refundOpen} onClose={() => setRefundOpen(false)} title="환불정책">
        <RefundPolicyContent />
      </LegalDrawer>

      {avatarZoomOpen && avatarUrl && (
        <>
          <div className="fixed inset-0 z-[250] bg-black/70" onClick={() => setAvatarZoomOpen(false)} />
          <div className="fixed inset-0 z-[251] flex items-center justify-center pointer-events-none">
            <div
              className="relative rounded-2xl overflow-hidden pointer-events-auto shadow-xl cursor-pointer"
              style={{ width: 250, height: 312 }}
              onClick={() => setAvatarZoomOpen(false)}
            >
              <Image
                src={avatarHdUrl ?? avatarUrl}
                alt="프로필 고화질"
                fill
                className="object-cover"
                unoptimized
                onError={() => setAvatarHdUrl(null)}
              />
            </div>
          </div>
        </>
      )}

      <CustomerServiceDrawer
        open={csDrawerOpen}
        onClose={() => setCsDrawerOpen(false)}
        initialTab={csInitialTab}
      />

      <div
        className={`fixed inset-0 z-[70] bg-white flex flex-col transition-transform duration-300 ease-in-out ${
          classDetailId ? "translate-x-0" : "translate-x-full"
        }`}
      >
        <ClassHeader onBack={() => setClassDetailId(null)} />
        <div className="flex-1 overflow-y-auto">
          {classDetailId && (
            <CachedClassDetailPage
              classIdOverride={classDetailId}
              onClose={() => setClassDetailId(null)}
            />
          )}
        </div>
      </div>

    </div>
  );
}
