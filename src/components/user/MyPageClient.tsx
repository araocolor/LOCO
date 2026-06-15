"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import { UserCircle, X, Settings, HeartHandshake, Star, SmilePlus, UsersRound, CreditCard, Megaphone, Headphones, FileText, ShieldCheck, ChevronRight, ReceiptText, Award } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { fetchWithAuthRetry } from "@/lib/auth/fetch-with-auth-retry";
import { prefetchBoardPostsCache } from "@/lib/board-session-cache";
import { parseBookmarkEntries } from "@/lib/bookmarks/local";
import { PROFILE_EDIT_OPEN_EVENT } from "@/lib/profile-events";
import type { ProfileEditMode, ProfileEditOpenDetail } from "@/lib/profile-events";
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
}

interface AppliedClass {
  id: string;
  status: string;
  created_at: string;
  class: {
    id: string;
    title: string;
    datetime: string;
    region: string;
    status: string;
    images: ClassImage[] | null;
  } | null;
}

interface HomeClassCache {
  id: string;
  images: ClassImage[] | null;
  title: string;
}

interface BookmarkClassRow {
  created_at: string;
  classes:
    | {
        id: string;
        images: ClassImage[] | null;
        title: string;
      }
    | {
        id: string;
        images: ClassImage[] | null;
        title: string;
      }[]
    | null;
}

interface BookmarkClassInfo {
  id: string;
  images: ClassImage[] | null;
  title: string;
}

function getBookmarkClassInfo(row: BookmarkClassRow): BookmarkClassInfo | null {
  if (!row.classes) return null;
  if (Array.isArray(row.classes)) return row.classes[0] ?? null;
  return row.classes;
}

function hasBookmarkClass(row: BookmarkClassRow): row is BookmarkClassRow & {
  classes: BookmarkClassInfo | BookmarkClassInfo[];
} {
  return getBookmarkClassInfo(row) !== null;
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
  myClasses: GridClass[];
  appliedClasses?: AppliedClass[];
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
  myClasses: initialMyClasses,
  appliedClasses: initialAppliedClasses = [],
  socialCounts,
  starGivers: initialStarGivers = [],
}: Props) {
  const MY_PAGE_CACHE_KEY = "loco_mypage_cache_local_v3";
  const router = useRouter();
  const [editOpen, setEditOpen] = useState(false);
  const [editMode, setEditMode] = useState<ProfileEditMode>("normal");
  const [avatarUrl, setAvatarUrl] = useState<string | null>(() => {
    if (profile.profile_image_url) return profile.profile_image_url;
    if (typeof window === "undefined") return null;
    try {
      const raw = localStorage.getItem(MY_PAGE_CACHE_KEY);
      if (raw) return JSON.parse(raw)?.profile?.profile_image_url ?? null;
    } catch {}
    return null;
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
  const [myClasses] = useState<GridClass[]>(initialMyClasses);
  const [bookmarkClasses, setBookmarkClasses] = useState<GridClass[]>([]);
  const [friendsCount, setFriendsCount] = useState<number>(socialCounts?.friends ?? 0);
  const [followingCount, setFollowingCount] = useState<number>(socialCounts?.following ?? 0);
  const [starBalanceOverride, setStarBalanceOverride] = useState<number | null>(null);
  const starBalance = starBalanceOverride ?? profile.star_balance ?? 0;

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
    const BOOKMARK_CLASSES_CACHE_KEY = "loco_bookmark_classes_v1";

    function readBookmarkClassesCache(): GridClass[] | null {
      try {
        const raw = localStorage.getItem(BOOKMARK_CLASSES_CACHE_KEY);
        if (!raw) return null;
        const parsed = JSON.parse(raw) as GridClass[];
        return Array.isArray(parsed) ? parsed : null;
      } catch {
        return null;
      }
    }

    function writeBookmarkClassesCache(classes: GridClass[]) {
      try {
        localStorage.setItem(BOOKMARK_CLASSES_CACHE_KEY, JSON.stringify(classes));
      } catch {}
    }

    const cached = readBookmarkClassesCache();
    if (cached) {
      setBookmarkClasses(cached);
    }

    async function fetchAndRefresh() {
      const supabase = createClient();
      const { data: bm } = await supabase
        .from("class_bookmarks")
        .select("class_id, created_at, classes(id, images, title)")
        .eq("user_id", profile.id)
        .order("created_at", { ascending: false });
      const bmRows = (bm ?? []) as BookmarkClassRow[];
      const bmClasses: GridClass[] = bmRows.flatMap((b) => {
        if (!hasBookmarkClass(b)) return [];
        const cls = getBookmarkClassInfo(b);
        if (!cls) return [];
        return [{
          id: cls.id,
          images: cls.images,
          title: cls.title,
          created_at: b.created_at,
          isBookmark: true,
        }];
      });
      setBookmarkClasses(bmClasses);
      writeBookmarkClassesCache(bmClasses);
      localStorage.setItem("loco_bookmark_ids_v1", JSON.stringify(
        bmClasses.map((c) => ({ id: c.id, created_at: c.created_at }))
      ));
    }

    fetchAndRefresh().catch(() => {});
  }, [profile.id]);

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
                      className="rounded-full object-cover w-[60px] h-[60px]"
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
                  <HeartHandshake size={25} className="text-gray-500" />
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
            <span className="px-2.5 py-0 rounded-full bg-gray-800 text-white text-[13px] self-start">
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
        {myClasses.length > 0 && (
          <>
            <div className="px-4 pt-5 pb-2">
              <span className="text-[15px] font-bold text-gray-800">내가 만든 클래스</span>
            </div>
            <div className="grid grid-cols-3 gap-[1px]">
              {myClasses.map((item) => (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => router.push(`/classes/${item.id}`)}
                  className="aspect-square bg-gray-100 relative overflow-hidden cursor-pointer"
                >
                  {item.images?.[0]?.card_url ? (
                    <Image src={item.images[0].card_url} alt={item.title} fill className="object-cover" unoptimized />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center bg-gray-100">
                      <span className="text-gray-300 text-xs">없음</span>
                    </div>
                  )}
                  {item.status === "recruiting" && (
                    <div className="absolute top-1.5 right-1.5 w-3 h-3 rounded-full bg-green-500" />
                  )}
                </button>
              ))}
            </div>
          </>
        )}

        {initialAppliedClasses.length > 0 && (
          <>
            <div className="px-4 pt-5 pb-2">
              <span className="text-[15px] font-bold text-gray-800">참여중인 클래스</span>
            </div>
            <div className="grid grid-cols-3 gap-[1px]">
              {initialAppliedClasses
                .filter((app) => app.class)
                .map((app) => (
                  <button
                    key={app.id}
                    type="button"
                    onClick={() => router.push(`/classes/${app.class!.id}`)}
                    className="aspect-square bg-gray-100 relative overflow-hidden cursor-pointer"
                  >
                    {app.class!.images?.[0]?.card_url ? (
                      <Image src={app.class!.images[0].card_url} alt={app.class!.title} fill className="object-cover" unoptimized />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center bg-gray-100">
                        <span className="text-gray-300 text-xs">없음</span>
                      </div>
                    )}
                    {app.status === "pending" && (
                      <div className="absolute top-1.5 right-1.5 rounded-full bg-yellow-400 px-1.5 py-0.5 text-[10px] font-semibold text-gray-900">대기</div>
                    )}
                  </button>
                ))}
            </div>
          </>
        )}

        {bookmarkClasses.length > 0 && (
          <>
            <div className="px-4 pt-5 pb-2">
              <span className="text-[15px] font-bold text-gray-800">북마크 클래스</span>
            </div>
            <div className="grid grid-cols-3 gap-[1px]">
              {bookmarkClasses.map((item) => (
                <button
                  key={item.id + "-bm"}
                  type="button"
                  onClick={() => router.push(`/classes/${item.id}`)}
                  className="aspect-square bg-gray-100 relative overflow-hidden cursor-pointer"
                >
                  {item.images?.[0]?.card_url ? (
                    <Image src={item.images[0].card_url} alt={item.title} fill className="object-cover" unoptimized />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center bg-gray-100">
                      <span className="text-gray-300 text-xs">없음</span>
                    </div>
                  )}
                  <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="white" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="absolute top-1.5 right-1.5">
                    <polygon points="19 21 12 16 5 21 5 3 19 3" />
                  </svg>
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

    </div>
  );
}
