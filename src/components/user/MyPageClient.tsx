"use client";

import { useState, useRef } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import { UserCircle, X } from "lucide-react";
import { logoutAction } from "@/actions/auth";
import { createClient } from "@/lib/supabase/client";
import AvatarCropModal from "./AvatarCropModal";

interface Profile {
  id: string;
  nickname: string;
  profile_image_url: string | null;
}

interface Props {
  profile: Profile;
}

export default function MyPageClient({ profile }: Props) {
  const router = useRouter();
  const [editOpen, setEditOpen] = useState(false);
  const [selectedImage, setSelectedImage] = useState<string | null>(null);
  const [avatarUrl, setAvatarUrl] = useState<string | null>(profile.profile_image_url);
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  async function handleLogout() {
    try {
      sessionStorage.removeItem("loco_mypage_cache_v1");
      // sessionStorage 캐시 → localStorage로 이전 (다음 로그인 시 즉각 표시용)
      const homeCache = sessionStorage.getItem("loco_home_results_cache_v3:all");
      if (homeCache) localStorage.setItem("loco_home_results_local_v1", homeCache);
    } catch {}
    await logoutAction();
    router.replace("/login");
  }

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

      try {
        sessionStorage.removeItem("loco_mypage_cache_v1");
      } catch {}

      setAvatarUrl(publicUrl);
      router.refresh();
    } catch (err) {
      console.error("아바타 업로드 실패:", err);
      alert("업로드에 실패했어요. 다시 시도해주세요.");
    } finally {
      setUploading(false);
    }
  }

  return (
    <div className="flex flex-col h-full">
      {/* 상단 30% */}
      <div className="h-[30vh] bg-white flex flex-col items-start justify-between px-4 pt-5 pb-5">
        <div className="flex items-center gap-3">
          <button
            onClick={handleAvatarClick}
            className="flex-shrink-0 hover:opacity-80 transition-opacity cursor-pointer"
          >
            {avatarUrl ? (
              <Image
                src={avatarUrl}
                alt="프로필"
                width={40}
                height={40}
                className="rounded-full object-cover w-10 h-10"
                unoptimized
              />
            ) : (
              <UserCircle size={40} className="text-gray-400" />
            )}
          </button>
          <span className="text-[15px] font-semibold text-[#333333]">
            {profile.nickname}
          </span>
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => setEditOpen(true)}
            className="px-4 py-2 bg-yellow-400 text-gray-900 font-medium rounded-lg hover:bg-yellow-500 transition-colors text-[15px]"
          >
            프로필 편집
          </button>
          <button
            onClick={handleLogout}
            className="text-[15px] text-gray-400 font-medium hover:text-gray-600 transition-colors"
          >
            로그아웃
          </button>
        </div>
      </div>

      {/* 하단 70% */}
      <div className="flex-1 bg-gray-50" />

      {/* 프로필 편집 슬라이드 */}
      <div
        className={`fixed inset-0 z-50 bg-black/30 transition-opacity duration-300 ${
          editOpen ? "opacity-100" : "opacity-0 pointer-events-none"
        }`}
        onClick={() => setEditOpen(false)}
      />
      <div
        className={`fixed top-0 left-0 right-0 z-[60] bg-white h-[40vh] transition-transform duration-300 ease-in-out ${
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
                  width={50}
                  height={50}
                  className="rounded-full object-cover w-[50px] h-[50px]"
                  unoptimized
                />
              ) : (
                <UserCircle size={50} className="text-gray-400" />
              )}
              {uploading && (
                <span className="absolute text-[10px] text-white bg-black/60 px-2 py-0.5 rounded mt-1">
                  업로드 중
                </span>
              )}
            </button>
            <span className="text-base font-semibold text-gray-900">{profile.nickname}</span>
          </div>

          {/* 2행: 자기소개 문장 입력창 */}
          <div className="flex-1 mb-4">
            <textarea
              placeholder="자기소개를 입력하세요"
              className="w-full h-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-yellow-400 resize-none"
            />
          </div>

          {/* 3행: 취소, 확인 버튼 */}
          <div className="flex gap-2 justify-end h-fit">
            <button
              onClick={() => setEditOpen(false)}
              className="px-4 py-2 border border-gray-300 text-gray-900 font-medium rounded-lg hover:bg-gray-50 transition-colors text-sm"
            >
              취소
            </button>
            <button
              onClick={() => setEditOpen(false)}
              className="px-4 py-2 bg-yellow-400 text-gray-900 font-medium rounded-lg hover:bg-yellow-500 transition-colors text-sm"
            >
              확인
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
    </div>
  );
}
