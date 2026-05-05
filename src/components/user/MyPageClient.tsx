"use client";

import { useRouter } from "next/navigation";
import Image from "next/image";
import { UserCircle } from "lucide-react";
import { logoutAction } from "@/actions/auth";

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

  async function handleLogout() {
    try {
      sessionStorage.removeItem("loco_mypage_cache_v1");
    } catch {}
    await logoutAction();
    router.replace("/login");
  }

  return (
    <div className="flex flex-col h-full">
      {/* 상단 30% */}
      <div className="h-[30vh] bg-white flex flex-col items-start justify-between px-4 pt-5 pb-5">
        <div className="flex items-center gap-3">
          {profile.profile_image_url ? (
            <Image
              src={profile.profile_image_url}
              alt="프로필"
              width={40}
              height={40}
              className="rounded-full object-cover"
            />
          ) : (
            <UserCircle size={40} className="text-gray-400" />
          )}
          <span className="text-[15px] font-semibold text-[#333333]">
            {profile.nickname}
          </span>
        </div>
        <button
          onClick={handleLogout}
          className="text-[15px] text-gray-400 font-medium hover:text-gray-600 transition-colors"
        >
          로그아웃
        </button>
      </div>

      {/* 하단 70% */}
      <div className="flex-1 bg-gray-50" />
    </div>
  );
}
