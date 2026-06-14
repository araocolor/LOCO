"use client";

import { useState, useRef, useEffect } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import Link from "next/link";
import { UserCircle, X, Settings, HeartHandshake, Star, SmilePlus, UsersRound, CreditCard, Megaphone, Headphones, FileText, ShieldCheck, ChevronRight, ReceiptText, Award } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { fetchWithAuthRetry } from "@/lib/auth/fetch-with-auth-retry";
import { prefetchBoardPostsCache } from "@/lib/board-session-cache";
import { parseBookmarkEntries } from "@/lib/bookmarks/local";
import { REGIONS, MEMBER_TYPES } from "@/lib/constants";
import { PROFILE_AVATAR_UPDATED_EVENT, PROFILE_EDIT_OPEN_EVENT, PROFESSIONAL_VERIFY_OPEN_EVENT } from "@/lib/profile-events";
import type { ProfileEditMode, ProfileEditOpenDetail } from "@/lib/profile-events";
import AvatarCropModal from "./AvatarCropModal";
import { ClassImage } from "@/types/class";
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
  bio: string | null;
  country: string | null;
  region: string | null;
  favorite_genre: string[];
  member_type: string[];
  profile_image_url: string | null;
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

type CacheProfilePatch = Partial<Pick<Profile, "bio" | "country" | "region" | "favorite_genre" | "member_type" | "profile_image_url">>;
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
  const FAVORITE_GENRE_OPTIONS = [
    { value: "salsa", label: "살사" },
    { value: "bachata", label: "바차타" },
    { value: "kizomba", label: "키좀바" },
    { value: "bachata_zouk", label: "쥬크" },
  ] as const;
  const MAX_FAVORITE_GENRE = 2;
  const PRO_FIRST_TYPES = ["아카데미대표", "오거나이저", "클럽공식채널", "운영진", "인플루언서", "프로댄서"];
  const PRO_MEMBER_TYPES = [...PRO_FIRST_TYPES, ...MEMBER_TYPES.filter((t) => !PRO_FIRST_TYPES.includes(t))];
  const router = useRouter();
  const [editOpen, setEditOpen] = useState(false);
  const [editMode, setEditMode] = useState<ProfileEditMode>("normal");
  const [selectedImage, setSelectedImage] = useState<string | null>(null);
  const [avatarUrl, setAvatarUrl] = useState<string | null>(profile.profile_image_url);
  const [avatarHdUrl, setAvatarHdUrl] = useState<string | null>(
    profile.profile_image_url ? profile.profile_image_url.replace(/\.webp$/, "_hd.webp") : null
  );
  const [uploading, setUploading] = useState(false);
  const [profileMeta, setProfileMeta] = useState<Pick<Profile, "bio" | "country" | "region" | "favorite_genre" | "member_type">>({
    bio: profile.bio,
    country: profile.country,
    region: profile.region,
    favorite_genre: profile.favorite_genre ?? [],
    member_type: profile.member_type ?? [],
  });
  const [saving, setSaving] = useState(false);
  const [bio, setBio] = useState(profileMeta.bio ?? "");
  const [country, setCountry] = useState(profileMeta.country ?? "대한민국");
  const [region, setRegion] = useState(profileMeta.region ?? "");
  const [favoriteGenres, setFavoriteGenres] = useState<string[]>(profileMeta.favorite_genre ?? []);
  const [memberTypes, setMemberTypes] = useState<string[]>(profileMeta.member_type ?? []);
  const fileInputRef = useRef<HTMLInputElement>(null);
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

  function handleAvatarClick() {
    fileInputRef.current?.click();
  }

  function handleFileSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => setSelectedImage(reader.result as string);
    reader.readAsDataURL(file);
    e.target.value = "";
  }

  async function handleCropConfirm(blob: Blob, hdBlob: Blob) {
    setSelectedImage(null);
    setUploading(true);
    try {
      const supabase = createClient();
      const ts = Date.now();
      const path = `${profile.id}/${ts}.webp`;
      const hdPath = `${profile.id}/${ts}_hd.webp`;

      const { data: list } = await supabase.storage.from("avatars").list(profile.id);
      const oldFiles = (list ?? []).map((f) => `${profile.id}/${f.name}`);

      const [upResult, hdUpResult] = await Promise.all([
        supabase.storage.from("avatars").upload(path, blob, { contentType: "image/webp", upsert: false }),
        supabase.storage.from("avatars").upload(hdPath, hdBlob, { contentType: "image/webp", upsert: false }),
      ]);
      if (upResult.error) throw upResult.error;
      if (hdUpResult.error) throw hdUpResult.error;

      const { data: { publicUrl } } = supabase.storage.from("avatars").getPublicUrl(path);
      const { data: { publicUrl: hdPublicUrl } } = supabase.storage.from("avatars").getPublicUrl(hdPath);

      const { error: dbErr } = await supabase
        .from("profiles")
        .update({ profile_image_url: publicUrl })
        .eq("id", profile.id);
      if (dbErr) throw dbErr;

      if (oldFiles.length > 0) {
        await supabase.storage.from("avatars").remove(oldFiles);
      }

      setAvatarUrl(publicUrl);
      setAvatarHdUrl(hdPublicUrl);
      patchMyPageProfileCache({ profile_image_url: publicUrl });
      window.dispatchEvent(new CustomEvent(PROFILE_AVATAR_UPDATED_EVENT, {
        detail: {
          nickname: profile.nickname,
          profile_image_url: publicUrl,
        },
      }));
      router.refresh();
    } catch (err) {
      console.error("아바타 업로드 실패:", err);
      alert("업로드에 실패했어요. 다시 시도해주세요.");
    } finally {
      setUploading(false);
    }
  }

  const SOLO_GENRES = ["kizomba", "bachata_zouk"];

  function toggleFavoriteGenre(value: string) {
    setFavoriteGenres((prev) => {
      if (prev.includes(value)) return prev.filter((v) => v !== value);
      if (SOLO_GENRES.includes(value)) return [value];
      const filtered = prev.filter((v) => !SOLO_GENRES.includes(v));
      if (filtered.length >= MAX_FAVORITE_GENRE) return filtered;
      return [...filtered, value];
    });
  }

  async function handleSaveProfile() {
    setSaving(true);
    try {
      const supabase = createClient();
      const { error } = await supabase
        .from("profiles")
        .update({
          bio: bio.trim() || null,
          country: country || null,
          region: region || null,
          favorite_genre: favoriteGenres,
          member_type: memberTypes,
        })
        .eq("id", profile.id);

      if (error) throw error;

      const nextProfileMeta = {
        bio: bio.trim() || null,
        country: country || null,
        region: region || null,
        favorite_genre: favoriteGenres,
        member_type: memberTypes,
      };
      setProfileMeta(nextProfileMeta);
      patchMyPageProfileCache(nextProfileMeta);
      setEditOpen(false);
      router.refresh();
    } catch (err) {
      console.error("프로필 저장 실패:", err);
      alert("저장에 실패했어요. 다시 시도해주세요.");
    } finally {
      setSaving(false);
    }
  }

  function handleOpenEditModal(mode: ProfileEditMode = "normal") {
    const cachedProfile = readMyPageCachedProfile(MY_PAGE_CACHE_KEY);
    const nextProfileMeta = {
      bio: cachedProfile?.bio ?? profileMeta.bio ?? profile.bio,
      country: cachedProfile?.country ?? profileMeta.country ?? profile.country,
      region: cachedProfile?.region ?? profileMeta.region ?? profile.region,
      favorite_genre: cachedProfile?.favorite_genre ?? profileMeta.favorite_genre ?? profile.favorite_genre ?? [],
      member_type: cachedProfile?.member_type ?? profileMeta.member_type ?? profile.member_type ?? [],
    };

    if (cachedProfile?.profile_image_url !== undefined) {
      setAvatarUrl(cachedProfile.profile_image_url ?? null);
    }

    setProfileMeta(nextProfileMeta);
    setBio(nextProfileMeta.bio ?? "");
    setCountry(nextProfileMeta.country ?? "대한민국");
    setRegion(nextProfileMeta.region ?? "");
    setFavoriteGenres(nextProfileMeta.favorite_genre ?? []);
    setMemberTypes(nextProfileMeta.member_type ?? []);
    setEditMode(mode);
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

  const isKoreaSelected = country === "대한민국";
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
                <Link
                  href="/?tab=search&section=friends"
                  className="flex flex-col items-center gap-0.5"
                >
                  <HeartHandshake size={25} className="text-gray-500" />
                  <span className="text-[18px] font-bold text-gray-900 leading-tight">{friendsCount}</span>
                </Link>
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
                <Link
                  href="/?tab=search&section=followings"
                  className="flex flex-col items-center gap-0.5"
                >
                  <SmilePlus size={25} className="text-gray-500" />
                  <span className="text-[18px] font-bold text-gray-900 leading-tight">{followingCount}</span>
                </Link>
              </div>
            </div>
          </div>
          {/* 2행~: 닉네임, 이메일, 자기소개 */}
          <span className="text-[17px] font-bold text-[#333333]">{profile.nickname}</span>
          {profileMeta.member_type?.[0] && (
            <span className="px-2.5 py-0 rounded-full bg-gray-800 text-white text-[13px] self-start">
              {getMemberTypeLabel(profileMeta.member_type[0])}
            </span>
          )}
          <span className="text-[14px] text-gray-400 -mt-1">
            {profile.email ?? ""}
            {" "}
            <span className="inline-flex items-center gap-1 text-[13px] text-gray-400 align-middle">
              <Star size={13} className="text-yellow-500" fill="currentColor" />
              {starBalance}개 남음
            </span>
          </span>
          {profileMeta.bio && (
            <span className="text-[16px] w-[80%] mt-2" style={{ color: "#000000cc" }}>{profileMeta.bio}</span>
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
            alt="Loco로꼬"
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

      {/* 프로필 편집 슬라이드 */}
      <div
        className={`fixed inset-0 z-50 bg-black/30 transition-opacity duration-300 ${
          editOpen ? "opacity-100" : "opacity-0 pointer-events-none"
        }`}
        onClick={() => setEditOpen(false)}
      />
      <div
        className={`fixed top-0 left-0 right-0 z-[60] bg-white h-[100dvh] transition-transform duration-300 ease-in-out ${
          editOpen ? "translate-y-0" : "-translate-y-full"
        }`}
      >
        <div
          className="h-full flex flex-col px-4"
          style={{
            paddingTop: "calc(env(safe-area-inset-top) + 16px)",
            paddingBottom: "calc(env(safe-area-inset-bottom) + 16px)",
          }}
        >
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-lg font-bold">{editMode === "professional" ? "공식프로필 편집" : "프로필 편집"}</h2>
            <button onClick={() => setEditOpen(false)} className="p-1 hover:bg-gray-100 rounded">
              <X size={20} />
            </button>
          </div>

          <div className="flex-1 overflow-y-auto pr-1 space-y-3 mb-4">
            {/* 아바타 + 아이디 */}
            <div className="flex flex-col items-center mb-6">
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={handleFileSelect}
              />
              <button
                onClick={handleAvatarClick}
                className="relative flex-shrink-0 mb-2 hover:opacity-80 transition-opacity cursor-pointer"
              >
                {avatarUrl ? (
                  <Image
                    src={avatarUrl}
                    alt="프로필"
                    width={70}
                    height={70}
                    className="rounded-full object-cover w-[70px] h-[70px]"
                    unoptimized
                  />
                ) : (
                  <UserCircle size={70} className="text-gray-400" />
                )}
                {editMode === "professional" && (
                  <span className="absolute bottom-0 left-0 w-[26px] h-[26px] bg-yellow-400 rounded-full flex items-center justify-center shadow-sm border-2 border-white">
                    <Award size={15} className="text-white" />
                  </span>
                )}
                {uploading && (
                  <span className="absolute text-[10px] text-white bg-black/60 px-2 py-0.5 rounded mt-1">
                    업로드 중
                  </span>
                )}
              </button>
              <div className="flex items-center gap-2">
                <span className="text-base font-semibold text-gray-900">{profile.nickname}</span>
              </div>
              {memberTypes[0] && (
                <span className="px-2.5 py-0 rounded-full bg-gray-800 text-[13px]" style={{ color: "rgba(255,255,255,0.9)" }}>
                  {getMemberTypeLabel(memberTypes[0])}
                </span>
              )}
              <span className="text-[14px] text-gray-500">{profile.email ?? ""}</span>
            </div>
            {(editMode === "professional"
              ? ["memberType", "bio", "region", "genre"] as const
              : ["bio", "region", "genre", "memberType"] as const
            ).map((section) => {
              if (section === "bio") return (
                <section key="bio" className="rounded-xl px-3 pt-0 pb-3">
                  <h3 className="text-sm font-semibold text-gray-900 mb-2">프로필 수정</h3>
                  <textarea
                    value={bio}
                    onChange={(e) => {
                      const lines = e.target.value.split("\n");
                      if (lines.length <= 4) setBio(e.target.value);
                    }}
                    placeholder="자기소개를 입력하세요 (최대 4줄)"
                    rows={4}
                    className="w-full overflow-hidden px-3 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-yellow-400 resize-none" style={{ fontSize: "16px", color: "#000000cc" }}
                  />
                </section>
              );
              if (section === "region") return (
                <section key="region" className="rounded-xl px-3 pt-0 pb-3">
                  <h3 className="text-sm font-semibold text-gray-900 mb-2">활동지역</h3>
                  <div className="grid grid-cols-2 gap-2">
                    <select
                      value={country}
                      onChange={(e) => {
                        setCountry(e.target.value);
                        if (e.target.value !== "대한민국") setRegion("");
                      }}
                      className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-yellow-400 bg-white"
                    >
                      <option value="">국가 선택</option>
                      <option value="스페인">España</option>
                      <option value="중국">中国</option>
                      <option value="베트남">Việt Nam</option>
                      <option value="일본">日本</option>
                      <option value="대한민국">대한민국</option>
                      <option value="미국">United States</option>
                      <option value="러시아">Russia</option>
                      <option value="기타">Other</option>
                    </select>
                    <select
                      value={region}
                      onChange={(e) => setRegion(e.target.value)}
                      disabled={!isKoreaSelected}
                      className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-yellow-400 bg-white disabled:bg-gray-100 disabled:text-gray-400"
                    >
                      <option value="">도시 선택</option>
                      {REGIONS.map((city) => (
                        <option key={city} value={city}>
                          {city}
                        </option>
                      ))}
                    </select>
                  </div>
                </section>
              );
              if (section === "genre") return (
                <section key="genre" className="rounded-xl p-3">
                  <div className="mb-2">
                    <h3 className="text-sm font-semibold text-gray-900">활동분야</h3>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {FAVORITE_GENRE_OPTIONS.map((genre) => {
                      const active = favoriteGenres.includes(genre.value);
                      const limitReached = !active && favoriteGenres.length >= MAX_FAVORITE_GENRE;
                      return (
                        <button
                          key={genre.value}
                          type="button"
                          onClick={() => toggleFavoriteGenre(genre.value)}
                          disabled={limitReached}
                          className={`px-3 py-1.5 rounded-full text-sm border transition-colors ${
                            active
                              ? "bg-yellow-400 border-yellow-500 text-gray-900"
                              : "bg-white border-gray-300 text-gray-700"
                          } ${limitReached ? "opacity-40 cursor-not-allowed" : "hover:border-gray-400"}`}
                        >
                          {genre.label}
                        </button>
                      );
                    })}
                  </div>
                </section>
              );
              if (section === "memberType") {
                const isPro = editMode === "professional";
                const typeList = isPro ? PRO_MEMBER_TYPES : MEMBER_TYPES;
                return (
                  <section key="memberType" className="rounded-xl px-3 pt-0 pb-3">
                    <div className="mb-2">
                      <h3 className="text-sm font-semibold text-gray-900">회원구분</h3>
                    </div>
                    <div className="flex flex-wrap gap-2 justify-center">
                      {typeList.map((type) => {
                        const restricted = !isPro && ["아카데미대표", "오거나이저", "클럽공식채널", "운영진"].includes(type);
                        const active = memberTypes.includes(type);
                        const isMain = memberTypes[0] === type;
                        return (
                          <button
                            key={type}
                            type="button"
                            onClick={() => {
                              if (restricted) {
                                setProProfileModalOpen(true);
                                return;
                              }
                              setMemberTypes(active ? [] : [type]);
                            }}
                            className={`px-3 py-1.5 rounded-full text-sm border transition-colors ${
                              isMain
                                ? "bg-gray-800 border-gray-800 text-white"
                                : active
                                ? "bg-yellow-400 border-yellow-500 text-gray-900"
                                : "bg-white border-gray-300 text-gray-700"
                            } ${restricted ? "opacity-40" : "hover:border-gray-400"}`}
                          >
                            {getMemberTypeLabel(type)}
                          </button>
                        );
                      })}
                    </div>
                  </section>
                );
              }
              return null;
            })}
            <div className="h-24" />
          </div>

          {/* 3행: 취소, 확인 버튼 */}
          <div className="flex gap-2 justify-center h-fit">
            <button
              onClick={() => setEditOpen(false)}
              className="px-4 py-2 border border-gray-300 text-gray-900 font-medium rounded-lg hover:bg-gray-50 transition-colors text-sm"
            >
              취소
            </button>
            {(() => {
              const hasChange =
                bio.trim() !== (profileMeta.bio ?? "") ||
                country !== (profileMeta.country ?? "대한민국") ||
                region !== (profileMeta.region ?? "") ||
                JSON.stringify(favoriteGenres) !== JSON.stringify(profileMeta.favorite_genre ?? []) ||
                JSON.stringify(memberTypes) !== JSON.stringify(profileMeta.member_type ?? []);
              return (
                <button
                  onClick={() => { if (hasChange) handleSaveProfile(); else setEditOpen(false); }}
                  disabled={saving}
                  className="px-4 py-2 bg-yellow-400 text-gray-900 font-medium rounded-lg hover:bg-yellow-500 transition-colors text-sm disabled:opacity-60"
                >
                  {saving ? "저장 중..." : hasChange ? "업데이트" : "확인"}
                </button>
              );
            })()}
          </div>
        </div>
      </div>

      {selectedImage && (
        <AvatarCropModal
          imageSrc={selectedImage}
          onCancel={() => setSelectedImage(null)}
          onConfirm={handleCropConfirm}
        />
      )}

      {proProfileModalOpen && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center">
          <div className="absolute inset-0 bg-black/40" onClick={() => setProProfileModalOpen(false)} />
          <div className="relative bg-white rounded-2xl mx-8 p-6 max-w-sm w-full text-center">
            <p className="text-[16px] font-bold text-[#333] mb-2">공식프로필 등록 후 선택할 수 있습니다.</p>
            <button
              type="button"
              onClick={() => {
                setProProfileModalOpen(false);
                setEditOpen(false);
                window.dispatchEvent(new Event(PROFESSIONAL_VERIFY_OPEN_EVENT));
              }}
              className="mt-4 w-full py-3 rounded-full bg-[#FACC15] text-[15px] font-bold text-[#333] active:brightness-95 transition-all"
            >
              공식프로필 신청하기
            </button>
          </div>
        </div>
      )}

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
