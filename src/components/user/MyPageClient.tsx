"use client";

import { useState, useRef, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Image from "next/image";
import Link from "next/link";
import { UserCircle, X, Settings, HeartHandshake, Star, SmilePlus } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { fetchWithAuthRetry } from "@/lib/auth/fetch-with-auth-retry";
import { parseBookmarkEntries } from "@/lib/bookmarks/local";
import { REGIONS, MEMBER_TYPES, MAX_MEMBER_TYPE } from "@/lib/constants";
import AvatarCropModal from "./AvatarCropModal";
import { ClassImage } from "@/types/class";
import Avatar from "@/components/ui/Avatar";
import type { StarGiver } from "@/types/user";

type TabType = "all" | "my" | "bookmark";

function getMemberTypeLabel(type: string) {
  if (type === "인스트럭터") return "강사";
  if (type === "일반회원") return "활동회원";
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
  starGivers?: StarGiver[];
  socialCounts?: {
    following: number;
    followers: number;
    friends: number;
    subscriptionCount?: number;
  };
}

type CacheProfilePatch = Partial<Pick<Profile, "bio" | "country" | "region" | "favorite_genre" | "member_type" | "profile_image_url">>;

export default function MyPageClient({
  profile,
  myClasses: initialMyClasses,
  socialCounts,
  starGivers: initialStarGivers = [],
}: Props) {
  const MY_PAGE_CACHE_KEY = "loco_mypage_cache_local_v3";
  const FAVORITE_GENRE_OPTIONS = [
    { value: "salsa", label: "살사" },
    { value: "bachata", label: "바차타" },
    { value: "kizomba", label: "키좀바" },
    { value: "bachata_zouk", label: "바차타쥬크" },
  ] as const;
  const MAX_FAVORITE_GENRE = 2;
  const router = useRouter();
  const searchParams = useSearchParams();
  const [editOpen, setEditOpen] = useState(false);
  const [selectedImage, setSelectedImage] = useState<string | null>(null);
  const [avatarUrl, setAvatarUrl] = useState<string | null>(profile.profile_image_url);
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
  const [starGiversOpen, setStarGiversOpen] = useState(false);

  const activeTab: TabType = (() => {
    const rawTab = searchParams.get("tab");
    if (rawTab === "my" || rawTab === "bookmark" || rawTab === "all") return rawTab;
    return "all";
  })();

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
    async function fetchClasses() {
      const supabase = createClient();

      // 북마크: localStorage 캐시 우선 [{id, created_at}]
      const rawBm = localStorage.getItem("loco_bookmark_ids_v1");
      const bmEntries = parseBookmarkEntries(rawBm);

      if (bmEntries.length > 0) {
        const homeRaw = localStorage.getItem("loco_home_results_local_v1");
        const homeClasses: HomeClassCache[] = homeRaw ? ((JSON.parse(homeRaw).data ?? []) as HomeClassCache[]) : [];
        const homeMap = new Map(homeClasses.map((c) => [c.id, c]));

        const found: GridClass[] = [];
        const missing: { id: string; created_at: string }[] = [];
        bmEntries.forEach(({ id, created_at }) => {
          const c = homeMap.get(id);
          if (c) found.push({ id: c.id, images: c.images, title: c.title, created_at, isBookmark: true });
          else missing.push({ id, created_at });
        });

        if (missing.length > 0) {
          const { data: extra } = await supabase
            .from("classes")
            .select("id, images, title")
            .in("id", missing.map((m) => m.id));
          const extraMapped = (extra ?? []).map((c) => ({
            ...c,
            created_at: missing.find((m) => m.id === c.id)?.created_at,
            isBookmark: true,
          }));
          setBookmarkClasses([...found, ...extraMapped]);
        } else {
          setBookmarkClasses(found);
        }
      } else {
        // 캐시 없으면 전체 DB fetch
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
        localStorage.setItem("loco_bookmark_ids_v1", JSON.stringify(
          bmClasses.map((c) => ({ id: c.id, created_at: c.created_at }))
        ));
      }
    }
    fetchClasses();
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

  async function handleCropConfirm(blob: Blob) {
    setSelectedImage(null);
    setUploading(true);
    try {
      const supabase = createClient();
      const ts = Date.now();
      const path = `${profile.id}/${ts}.webp`;

      const { data: list } = await supabase.storage.from("avatars").list(profile.id);
      const oldFiles = (list ?? []).map((f) => `${profile.id}/${f.name}`);

      const { error: upErr } = await supabase.storage
        .from("avatars")
        .upload(path, blob, { contentType: "image/webp", upsert: false });
      if (upErr) throw upErr;

      const { data: { publicUrl } } = supabase.storage.from("avatars").getPublicUrl(path);

      const { error: dbErr } = await supabase
        .from("profiles")
        .update({ profile_image_url: publicUrl })
        .eq("id", profile.id);
      if (dbErr) throw dbErr;

      if (oldFiles.length > 0) {
        await supabase.storage.from("avatars").remove(oldFiles);
      }

      setAvatarUrl(publicUrl);
      patchMyPageProfileCache({ profile_image_url: publicUrl });
      router.refresh();
    } catch (err) {
      console.error("아바타 업로드 실패:", err);
      alert("업로드에 실패했어요. 다시 시도해주세요.");
    } finally {
      setUploading(false);
    }
  }

  function toggleFavoriteGenre(value: string) {
    setFavoriteGenres((prev) => {
      if (prev.includes(value)) return prev.filter((v) => v !== value);
      if (prev.length >= MAX_FAVORITE_GENRE) return prev;
      return [...prev, value];
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

  function handleOpenEditModal() {
    setBio(profileMeta.bio ?? "");
    setCountry(profileMeta.country ?? "대한민국");
    setRegion(profileMeta.region ?? "");
    setFavoriteGenres(profileMeta.favorite_genre ?? []);
    setMemberTypes(profileMeta.member_type ?? []);
    setEditOpen(true);
  }

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
              <button
                onClick={handleOpenEditModal}
                className="relative flex-shrink-0 hover:opacity-80 transition-opacity cursor-pointer"
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
                <span
                  onClick={(e) => { e.stopPropagation(); handleOpenEditModal(); }}
                  className="absolute bottom-0 right-0 w-5 h-5 bg-white rounded-full flex items-center justify-center shadow-sm border border-gray-200"
                >
                  <Settings size={12} className="text-gray-600" />
                </span>
              </button>
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
                  <Star size={25} className="text-gray-500" />
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
            <span className="inline-flex items-center gap-1 text-[13px] font-semibold text-yellow-700 align-middle">
              <Star size={13} className="text-yellow-500" fill="currentColor" />
              {profile.star_balance ?? 0}개 남음
            </span>
          </span>
          {profile.bio && (
            <span className="text-[16px] w-[80%] mt-2" style={{ color: "#000000cc" }}>{profile.bio}</span>
          )}
        </div>
      </div>

      {/* 하단 클래스 그리드 */}
      <div className="flex-1 bg-white">
        {/* 3x3 그리드 */}
        <div className="grid grid-cols-3 gap-[1px] bg-gray-200">
          {(activeTab === "all"
            ? [...myClasses, ...bookmarkClasses].sort((a, b) =>
                new Date(b.created_at ?? 0).getTime() - new Date(a.created_at ?? 0).getTime()
              )
            : activeTab === "my"
            ? myClasses
            : bookmarkClasses
          ).map((item) => (
            <button
              key={item.id + (item.isBookmark ? "-bm" : "")}
              type="button"
              onClick={() => router.push(`/classes/${item.id}`)}
              className="aspect-square bg-gray-100 relative overflow-hidden cursor-pointer"
            >
              {item.images?.[0]?.card_url ? (
                <Image
                  src={item.images[0].card_url}
                  alt={item.title}
                  fill
                  className="object-cover"
                  unoptimized
                />
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
              {!item.isBookmark && item.status === "recruiting" && (
                <div className="absolute top-1.5 right-1.5 w-3 h-3 rounded-full bg-green-500" />
              )}
            </button>
          ))}
        </div>
      </div>

      {starGiversOpen && (
        <div
          className="fixed inset-0 z-[70] flex items-center justify-center bg-black/30 px-4 overscroll-contain touch-none"
          onClick={() => setStarGiversOpen(false)}
        >
          <div
            className="flex h-[400px] w-[300px] flex-col rounded-2xl bg-white p-3 shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="relative flex items-center justify-center">
              <span className="text-[16px] font-bold text-gray-900">별을 준 사람들</span>
              <button
                type="button"
                onClick={() => setStarGiversOpen(false)}
                className="absolute right-0 rounded-full p-1 text-gray-400 hover:bg-gray-100 hover:text-gray-600"
                aria-label="닫기"
              >
                <X size={16} />
              </button>
            </div>
            <div className="mt-3 flex-1 overflow-y-auto scrollbar-hide overscroll-contain">
              {starGivers.length ? (
                <div className="grid grid-cols-3 gap-x-2 gap-y-3">
                  {starGivers.map((giver) => (
                    <div key={giver.id} className="flex flex-col items-center gap-1">
                      <Avatar src={giver.profile_image_url} nickname={giver.nickname} size={45} />
                      <span className="truncate w-full text-center text-[15px] font-medium text-gray-500">{giver.nickname}</span>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="flex h-full items-center justify-center px-3 text-center text-xs text-gray-400">
                  아직 별을 받은 사람이 없어요
                </div>
              )}
            </div>
            <button
              type="button"
              onClick={() => setStarGiversOpen(false)}
              className="mt-2 w-1/2 mx-auto rounded-full bg-yellow-400 py-2 text-[14px] font-semibold text-gray-900"
            >
              닫기
            </button>
          </div>
        </div>
      )}

      {/* 프로필 편집 슬라이드 */}
      <div
        className={`fixed inset-0 z-50 bg-black/30 transition-opacity duration-300 ${
          editOpen ? "opacity-100" : "opacity-0 pointer-events-none"
        }`}
        onClick={() => setEditOpen(false)}
      />
      <div
        className={`fixed top-0 left-0 right-0 z-[60] bg-white h-screen transition-transform duration-300 ease-in-out ${
          editOpen ? "translate-y-0" : "-translate-y-full"
        }`}
      >
        <div className="h-full flex flex-col p-4">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-lg font-bold">프로필 편집</h2>
            <button onClick={() => setEditOpen(false)} className="p-1 hover:bg-gray-100 rounded">
              <X size={20} />
            </button>
          </div>

          {/* 1행: 아바타 + 아이디 (가운데 정렬) */}
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
              className="flex-shrink-0 mb-2 hover:opacity-80 transition-opacity cursor-pointer"
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

          <div className="flex-1 overflow-y-auto pr-1 space-y-3 mb-4">
            <section className="rounded-xl px-3 pt-0 pb-3">
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

            <section className="rounded-xl px-3 pt-0 pb-3">
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

            <section className="rounded-xl p-3">
              <div className="flex items-center justify-between mb-2">
                <h3 className="text-sm font-semibold text-gray-900">관심분야</h3>
                <span className="text-xs text-gray-500">{favoriteGenres.length}/2</span>
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

            <section>
              <div className="flex items-center justify-between mb-2">
                <h3 className="text-sm font-semibold text-gray-900">회원구분</h3>
                <span className="text-xs text-gray-500">{memberTypes.length}/{MAX_MEMBER_TYPE}</span>
              </div>
              <div className="flex flex-wrap gap-2">
                {MEMBER_TYPES.map((type) => {
                  const active = memberTypes.includes(type);
                  const isMain = memberTypes[0] === type;
                  const limitReached = !active && memberTypes.length >= MAX_MEMBER_TYPE;
                  return (
                    <button
                      key={type}
                      type="button"
                      onClick={() => {
                        if (active) setMemberTypes((prev) => prev.filter((v) => v !== type));
                        else if (!limitReached) setMemberTypes((prev) => [...prev, type]);
                      }}
                      disabled={limitReached}
                      className={`px-3 py-1.5 rounded-full text-sm border transition-colors ${
                        isMain
                          ? "bg-gray-800 border-gray-800 text-white"
                          : active
                          ? "bg-yellow-400 border-yellow-500 text-gray-900"
                          : "bg-white border-gray-300 text-gray-700"
                      } ${limitReached ? "opacity-40 cursor-not-allowed" : "hover:border-gray-400"}`}
                    >
                      {getMemberTypeLabel(type)}
                    </button>
                  );
                })}
              </div>
            </section>
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

    </div>
  );
}
