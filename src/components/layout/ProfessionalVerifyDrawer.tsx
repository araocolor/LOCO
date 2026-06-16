"use client";

import { useEffect, useState, useRef } from "react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { Search, BarChart3, Megaphone, BadgeCheck, Pencil, ChevronLeft, Award } from "lucide-react";
import { PROFILE_EDIT_OPEN_EVENT, PROFILE_AVATAR_UPDATED_EVENT } from "@/lib/profile-events";
import type { ProfileEditOpenDetail } from "@/lib/profile-events";
import { createClient } from "@/lib/supabase/client";
import AvatarCropModal from "@/components/user/AvatarCropModal";
import PhoneVerifyDrawer from "./PhoneVerifyDrawer";

const MY_PAGE_CACHE_KEY = "loco_mypage_cache_local_v3";

interface ProfessionalVerifyDrawerProps {
  open: boolean;
  onClose: () => void;
  profileImageUrl: string | null;
  profileId: string;
}

const FEATURES = [
  {
    icon: <Search size={24} className="text-[#333]" />,
    title: "검색우선노출",
    description:
      "사람들이 클래스를 검색할때 검색결과에 쉽게 발견할 수 있도록 상위 및 첫 페이지에 노출빈도를 높입니다.",
  },
  {
    icon: <BarChart3 size={24} className="text-[#333]" />,
    title: "활동모니터",
    description:
      "구독자와 팔로윙에 세부상세 집계 데이타를 분석하는 추가 페이지를 제공합니다. 알맞는 광고를 설정할 수 있습니다.",
  },
  {
    icon: <Megaphone size={24} className="text-[#333]" />,
    title: "광고설정기능",
    description:
      "지역에 더 많은 회원들에게 회원님에 클래스 정보를 노출하고 참여할수 있는 도구를 제공합니다.",
  },
  {
    icon: <BadgeCheck size={24} className="text-[#333]" />,
    title: "인증배지",
    description:
      "아바타에 공인인증 배지를 표시하여 더운 신뢰를 받는 느낌으로 회원들과 소통할 수 있는 혜택을 가져가세요.",
  },
];

export default function ProfessionalVerifyDrawer({
  open,
  onClose,
  profileImageUrl,
  profileId,
}: ProfessionalVerifyDrawerProps) {
  const router = useRouter();
  const [phoneVerifyOpen, setPhoneVerifyOpen] = useState(false);
  const [avatarUrl, setAvatarUrl] = useState<string | null>(profileImageUrl);
  const [selectedImage, setSelectedImage] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (open) setAvatarUrl(profileImageUrl);
  }, [open, profileImageUrl]);

  useEffect(() => {
    function handleAvatarUpdated(e: Event) {
      const detail = (e as CustomEvent<{ profile_image_url: string | null }>).detail;
      setAvatarUrl(detail.profile_image_url);
    }
    window.addEventListener(PROFILE_AVATAR_UPDATED_EVENT, handleAvatarUpdated);
    return () => window.removeEventListener(PROFILE_AVATAR_UPDATED_EVENT, handleAvatarUpdated);
  }, []);

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
      let uid = profileId;
      if (!uid) {
        const { data: { user } } = await supabase.auth.getUser();
        uid = user?.id ?? "";
      }
      if (!uid) throw new Error("사용자 ID를 찾을 수 없습니다.");

      const ts = Date.now();
      const path = `${uid}/${ts}.webp`;
      const hdPath = `${uid}/${ts}_hd.webp`;

      const { data: list } = await supabase.storage.from("avatars").list(uid);
      const oldFiles = (list ?? []).map((f) => `${uid}/${f.name}`);

      const [upResult, hdUpResult] = await Promise.all([
        supabase.storage.from("avatars").upload(path, blob, { contentType: "image/webp", upsert: false }),
        supabase.storage.from("avatars").upload(hdPath, hdBlob, { contentType: "image/webp", upsert: false }),
      ]);
      if (upResult.error) throw upResult.error;
      if (hdUpResult.error) throw hdUpResult.error;

      const { data: { publicUrl } } = supabase.storage.from("avatars").getPublicUrl(path);

      const { error: dbErr } = await supabase
        .from("profiles")
        .update({ profile_image_url: publicUrl })
        .eq("id", uid);
      if (dbErr) throw dbErr;

      if (oldFiles.length > 0) {
        await supabase.storage.from("avatars").remove(oldFiles);
      }

      setAvatarUrl(publicUrl);
      try {
        const raw = localStorage.getItem(MY_PAGE_CACHE_KEY);
        if (raw) {
          const parsed = JSON.parse(raw);
          localStorage.setItem(MY_PAGE_CACHE_KEY, JSON.stringify({
            ...parsed,
            profile: { ...parsed.profile, profile_image_url: publicUrl },
          }));
        }
      } catch {}
      window.dispatchEvent(new CustomEvent(PROFILE_AVATAR_UPDATED_EVENT, {
        detail: { profile_image_url: publicUrl },
      }));
      router.refresh();
    } catch (err) {
      console.error("아바타 업로드 실패:", err);
      alert("업로드에 실패했어요. 다시 시도해주세요.");
    } finally {
      setUploading(false);
    }
  }

  useEffect(() => {
    if (!phoneVerifyOpen) {
      document.body.style.overflow = open ? "hidden" : "";
    }
    return () => {
      document.body.style.overflow = "";
    };
  }, [open, phoneVerifyOpen]);

  if (!open) return null;

  return (
    <>
      <div
        className="fixed inset-0 z-[250] bg-black/40 transition-opacity duration-300"
        onClick={onClose}
      />

      <div
        className="fixed inset-0 z-[300] flex flex-col bg-white transition-transform duration-300 ease-in-out translate-x-0"
        style={{ paddingTop: "env(safe-area-inset-top)" }}
      >
        {/* 헤더 */}
        <div className="relative flex-shrink-0 px-4 pt-3 pb-2">
          <button type="button" onClick={onClose} className="flex h-10 w-10 items-center justify-center text-[#333]">
            <ChevronLeft size={25} />
          </button>
          <p className="pointer-events-none absolute left-1/2 top-[32px] -translate-x-1/2 -translate-y-1/2 text-[21px] font-bold text-[#333]">
            공식프로필 인증신청
          </p>
        </div>

        {/* 본문 */}
        <div className="min-h-0 flex-1 overflow-y-auto">
          {/* 아바타 */}
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={handleFileSelect}
          />
          <div className="flex justify-center pt-8 pb-6">
            <button type="button" onClick={handleAvatarClick} className="relative animate-[breathe_3s_ease-in-out_infinite] cursor-pointer hover:opacity-80 transition-opacity">
              <div className="w-[130px] h-[130px] rounded-full overflow-hidden bg-gray-100 border border-white outline outline-2 outline-[#1D9BF0]">
                {avatarUrl ? (
                  <Image
                    src={avatarUrl}
                    alt="프로필"
                    width={130}
                    height={130}
                    className="w-[130px] h-[130px] object-cover"
                    unoptimized
                  />
                ) : (
                  <div className="w-[130px] h-[130px] flex items-center justify-center">
                    <Pencil size={48} className="text-gray-300" />
                  </div>
                )}
              </div>
              <span className="absolute bottom-0 left-0 w-[48px] h-[48px] bg-yellow-400 rounded-full flex items-center justify-center shadow-sm border-4 border-white">
                <Award size={28} className="text-white" />
              </span>
              {uploading && (
                <span className="absolute top-full left-1/2 mt-1 -translate-x-1/2 whitespace-nowrap text-[10px] text-white bg-black/60 px-2 py-0.5 rounded">
                  업로드 중
                </span>
              )}
            </button>
          </div>
          {!avatarUrl && (
            <div className="flex justify-center -mt-3 pb-2">
              <span className="px-4 py-1 rounded-full text-[13px] text-red-500 font-medium">아바타 등록필수</span>
            </div>
          )}

          {/* 제목 */}
          <div className="px-6 pb-8">
            <h2 className="text-[24px] font-bold text-[#333] leading-[1.35] text-center">
              공식프로필을 인증신청하고
              <br />
              더 많은 기능을 누리세요
            </h2>
          </div>

          {/* 기능 목록 */}
          <div className="px-6 space-y-6 pb-10">
            {FEATURES.map((item) => (
              <div key={item.title}>
                <div className="flex items-center gap-3">
                  <div className="flex-shrink-0">{item.icon}</div>
                  <p className="text-[17px] font-bold text-[#333]">{item.title}</p>
                </div>
                <p className="pt-1 text-[15px] leading-[1.5] text-gray-500">
                  {item.description}
                </p>
              </div>
            ))}
          </div>
        </div>

        {/* 하단 버튼 */}
        <div
          className="flex-shrink-0 px-6 pt-3 pb-4 border-t border-gray-100"
          style={{ paddingBottom: "max(16px, env(safe-area-inset-bottom))" }}
        >
          <button
            type="button"
            onClick={() => setPhoneVerifyOpen(true)}
            disabled={!avatarUrl}
            className={`w-full py-4 rounded-full text-[17px] font-bold transition-all ${
              avatarUrl
                ? "bg-[#FACC15] text-[#333] active:brightness-95"
                : "bg-gray-200 text-gray-400 cursor-not-allowed"
            }`}
          >
            다음
          </button>
        </div>
      </div>

      {selectedImage && (
        <AvatarCropModal
          imageSrc={selectedImage}
          onCancel={() => setSelectedImage(null)}
          onConfirm={handleCropConfirm}
        />
      )}

      <PhoneVerifyDrawer
        open={phoneVerifyOpen}
        onClose={() => setPhoneVerifyOpen(false)}
        onVerified={() => {
          setPhoneVerifyOpen(false);
          onClose();
          window.dispatchEvent(new CustomEvent<ProfileEditOpenDetail>(PROFILE_EDIT_OPEN_EVENT, { detail: { mode: "professional" } }));
        }}
      />
    </>
  );
}
