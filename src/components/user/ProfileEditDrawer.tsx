"use client";

import { useState, useRef, useEffect } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import { Pencil, UserCircle, X } from "lucide-react";
import { RiVerifiedBadgeFill } from "react-icons/ri";
import { createClient } from "@/lib/supabase/client";
import { fetchWithAuthRetry } from "@/lib/auth/fetch-with-auth-retry";
import { REGIONS, MEMBER_TYPES } from "@/lib/constants";
import { PROFILE_AVATAR_UPDATED_EVENT, PROFESSIONAL_VERIFY_OPEN_EVENT } from "@/lib/profile-events";
import type { ProfileEditMode } from "@/lib/profile-events";
import AvatarCropModal from "./AvatarCropModal";

const MY_PAGE_CACHE_KEY = "loco_mypage_cache_local_v3";

const FAVORITE_GENRE_OPTIONS = [
  { value: "salsa", label: "살사" },
  { value: "bachata", label: "바차타" },
  { value: "kizomba", label: "키좀바" },
  { value: "bachata_zouk", label: "쥬크" },
] as const;

const MAX_FAVORITE_GENRE = 2;
const SOLO_GENRES = ["kizomba", "bachata_zouk"];
const PRO_FIRST_TYPES = ["아카데미대표", "오거나이저", "클럽공식채널", "운영진", "인플루언서", "프로댄서"];
const PRO_MEMBER_TYPES = [...PRO_FIRST_TYPES, ...MEMBER_TYPES.filter((t) => !PRO_FIRST_TYPES.includes(t))];

function getMemberTypeLabel(type: string) {
  if (type === "인스트럭터") return "강사";
  if (type === "활동회원") return "활동회원";
  if (type === "독립군") return "잠수중";
  return type;
}

interface ProfileData {
  id: string;
  email: string | null;
  nickname: string;
  bio: string | null;
  country: string | null;
  region: string | null;
  favorite_genre: string[];
  member_type: string[];
  profile_image_url: string | null;
  org_name: string | null;
}

interface ProfileEditDrawerProps {
  open: boolean;
  onClose: () => void;
  profile: ProfileData;
  mode?: ProfileEditMode;
}

type CacheProfilePatch = Partial<Pick<ProfileData, "bio" | "country" | "region" | "favorite_genre" | "member_type" | "profile_image_url" | "org_name">>;

function readMyPageCachedProfile(): CacheProfilePatch | null {
  try {
    const raw = localStorage.getItem(MY_PAGE_CACHE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as { profile?: CacheProfilePatch };
    return parsed.profile ?? null;
  } catch {
    return null;
  }
}

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

export default function ProfileEditDrawer({ open, onClose, profile, mode = "normal" }: ProfileEditDrawerProps) {
  const router = useRouter();
  const [editMode, setEditMode] = useState<ProfileEditMode>(mode);
  const [slideIn, setSlideIn] = useState(false);
  const [selectedImage, setSelectedImage] = useState<string | null>(null);
  const [avatarUrl, setAvatarUrl] = useState<string | null>(profile.profile_image_url);
  const [uploading, setUploading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [proProfileModalOpen, setProProfileModalOpen] = useState(false);

  const [profileMeta, setProfileMeta] = useState({
    bio: profile.bio,
    country: profile.country,
    region: profile.region,
    favorite_genre: profile.favorite_genre ?? [],
    member_type: profile.member_type ?? [],
    org_name: profile.org_name,
  });
  const [bio, setBio] = useState(profileMeta.bio ?? "");
  const [country, setCountry] = useState(profileMeta.country ?? "대한민국");
  const [region, setRegion] = useState(profileMeta.region ?? "");
  const [favoriteGenres, setFavoriteGenres] = useState<string[]>(profileMeta.favorite_genre ?? []);
  const [memberTypes, setMemberTypes] = useState<string[]>(profileMeta.member_type ?? []);
  const [organizationName, setOrganizationName] = useState(profileMeta.org_name ?? "");
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!open) return;
    const cachedProfile = readMyPageCachedProfile();
    const nextProfileMeta = {
      bio: cachedProfile?.bio ?? profileMeta.bio ?? profile.bio,
      country: cachedProfile?.country ?? profileMeta.country ?? profile.country,
      region: cachedProfile?.region ?? profileMeta.region ?? profile.region,
      favorite_genre: cachedProfile?.favorite_genre ?? profileMeta.favorite_genre ?? profile.favorite_genre ?? [],
      member_type: cachedProfile?.member_type ?? profileMeta.member_type ?? profile.member_type ?? [],
      org_name: cachedProfile?.org_name ?? profileMeta.org_name ?? profile.org_name,
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
    setOrganizationName(nextProfileMeta.org_name ?? "");
    setEditMode(mode);
    if (mode === "professional") {
      setSlideIn(false);
      requestAnimationFrame(() => {
        requestAnimationFrame(() => setSlideIn(true));
      });
    } else {
      setSlideIn(false);
    }
  }, [
    open,
    mode,
    profile.bio,
    profile.country,
    profile.region,
    profile.favorite_genre,
    profile.member_type,
    profile.org_name,
    profile.profile_image_url,
  ]);

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
          org_name: organizationName.trim() || null,
        })
        .eq("id", profile.id);

      if (editMode === "professional") {
        const res = await fetchWithAuthRetry("/api/mypage/upgrade-role", { method: "POST" });
        if (res.ok) {
          try {
            const raw = localStorage.getItem(MY_PAGE_CACHE_KEY);
            if (raw) {
              const parsed = JSON.parse(raw);
              if (parsed.profile) {
                parsed.profile.role = "pro";
                localStorage.setItem(MY_PAGE_CACHE_KEY, JSON.stringify(parsed));
              }
            }
          } catch {}
        }
      }

      if (error) throw error;

      const nextProfileMeta = {
        bio: bio.trim() || null,
        country: country || null,
        region: region || null,
        favorite_genre: favoriteGenres,
        member_type: memberTypes,
        org_name: organizationName.trim() || null,
      };
      setProfileMeta(nextProfileMeta);
      patchMyPageProfileCache(nextProfileMeta);
      onClose();
      router.refresh();
    } catch (err) {
      console.error("프로필 저장 실패:", err);
      alert("저장에 실패했어요. 다시 시도해주세요.");
    } finally {
      setSaving(false);
    }
  }

  const isKoreaSelected = country === "대한민국";

  const hasChange =
    bio.trim() !== (profileMeta.bio ?? "") ||
    country !== (profileMeta.country ?? "대한민국") ||
    region !== (profileMeta.region ?? "") ||
    organizationName.trim() !== (profileMeta.org_name ?? "") ||
    JSON.stringify(favoriteGenres) !== JSON.stringify(profileMeta.favorite_genre ?? []) ||
    JSON.stringify(memberTypes) !== JSON.stringify(profileMeta.member_type ?? []);

  if (!open) return null;

  return (
    <>
      <div
        className={`fixed inset-0 z-[250] bg-black/30 transition-opacity duration-300 ${
          open ? "opacity-100" : "opacity-0 pointer-events-none"
        }`}
        onClick={onClose}
      />
      <div
        className={`fixed top-0 left-0 right-0 z-[260] bg-white h-[100dvh] transition-transform duration-300 ease-in-out ${
          open ? "translate-y-0" : "-translate-y-full"
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
            <button onClick={onClose} className="p-1 hover:bg-gray-100 rounded">
              <X size={20} />
            </button>
          </div>

          <div className={`flex-1 overflow-y-auto pr-1 space-y-3 mb-4 transition-all duration-500 ease-out ${
            editMode === "professional"
              ? slideIn ? "translate-x-0 opacity-100" : "translate-x-full opacity-0"
              : ""
          }`}>
            <div className="flex flex-col items-center mb-6 mt-1">
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={handleFileSelect}
              />
              <button
                onClick={handleAvatarClick}
                className={`relative flex-shrink-0 mb-2 hover:opacity-80 transition-opacity cursor-pointer rounded-full${editMode === "professional" ? " border border-white outline outline-2 outline-[#1D9BF0]" : ""}`}
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
                  <>
                    <UserCircle size={70} className="text-gray-400" />
                    <span className="absolute bottom-0 right-0 flex h-6 w-6 items-center justify-center rounded-full bg-[#fee500] text-[#191600] shadow-sm ring-2 ring-white">
                      <Pencil size={13} strokeWidth={2.4} />
                    </span>
                  </>
                )}
                {uploading && (
                  <span className="absolute top-full left-1/2 mt-1 -translate-x-1/2 whitespace-nowrap text-[10px] text-white bg-black/60 px-2 py-0.5 rounded">
                    업로드 중
                  </span>
                )}
              </button>
              <div className="flex items-center gap-1">
                <span className="text-base font-semibold text-gray-900">{profile.nickname}</span>
                {editMode === "professional" && <RiVerifiedBadgeFill size={18} color="#1D9BF0" />}
              </div>
              {memberTypes[0] && (
                <span className={`px-2.5 py-0 rounded-full text-[13px] ${editMode === "professional" ? "bg-[#1D9BF0] text-white" : "bg-gray-800 text-white/90"}`}>
                  {getMemberTypeLabel(memberTypes[0])}
                </span>
              )}
              <span className="text-[14px] text-gray-500">{profile.email ?? ""}</span>
            </div>
            {(editMode === "professional"
              ? ["memberType", "organization", "bio", "region", "genre"] as const
              : ["bio", "region", "genre", "memberType"] as const
            ).map((section) => {
              if (section === "organization") return (
                <section key="organization" className="rounded-xl px-3 pt-0 pb-3">
                  <h3 className="text-sm font-semibold text-gray-900 mb-2">소속기관 및 단체</h3>
                  <input
                    type="text"
                    value={organizationName}
                    onChange={(e) => setOrganizationName(e.target.value)}
                    placeholder="소속 기관이나 단체명을 입력하세요"
                    className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-yellow-400"
                    style={{ fontSize: "16px", color: "#000000cc" }}
                  />
                </section>
              );
              if (section === "bio") return (
                <section key="bio" className="rounded-xl px-3 pt-0 pb-3">
                  <h3 className="text-sm font-semibold text-gray-900 mb-2">프로필 수정</h3>
                  <textarea
                    value={bio}
                    onChange={(e) => {
                      const lines = e.target.value.split("\n");
                      if (lines.length <= 4) setBio(e.target.value);
                    }}
                    placeholder={"자기소개를 입력하세요\n예: 좋아하는 장르, 활동 지역, 춤을 시작한 계기"}
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
                                ? (editMode === "professional" ? "bg-[#1D9BF0] border-[#1D9BF0] text-white" : "bg-gray-800 border-gray-800 text-white")
                                : active
                                ? (editMode === "professional" ? "bg-[#1D9BF0]/60 border-[#1D9BF0] text-white" : "bg-yellow-400 border-yellow-500 text-gray-900")
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

          <div className="flex gap-2 justify-center h-fit">
            <button
              onClick={onClose}
              className="px-4 py-2 border border-gray-300 text-gray-900 font-medium rounded-lg hover:bg-gray-50 transition-colors text-sm"
            >
              취소
            </button>
            <button
              onClick={() => { if (editMode === "professional" || hasChange) handleSaveProfile(); else onClose(); }}
              disabled={saving}
              className="px-4 py-2 bg-yellow-400 text-gray-900 font-medium rounded-lg hover:bg-yellow-500 transition-colors text-sm disabled:opacity-60"
            >
              {saving ? "저장 중..." : hasChange ? "업데이트" : "확인"}
            </button>
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
        <div className="fixed inset-0 z-[300] flex items-center justify-center">
          <div className="absolute inset-0 bg-black/40" onClick={() => setProProfileModalOpen(false)} />
          <div className="relative bg-white rounded-2xl mx-8 p-6 max-w-sm w-full text-center">
            <p className="text-[16px] font-bold text-[#333] mb-2">공식프로필 등록 후 선택할 수 있습니다.</p>
            <button
              type="button"
              onClick={() => {
                setProProfileModalOpen(false);
                onClose();
                window.dispatchEvent(new Event(PROFESSIONAL_VERIFY_OPEN_EVENT));
              }}
              className="mt-4 w-full py-3 rounded-full bg-[#FACC15] text-[15px] font-bold text-[#333] active:brightness-95 transition-all"
            >
              공식프로필 신청하기
            </button>
          </div>
        </div>
      )}
    </>
  );
}
