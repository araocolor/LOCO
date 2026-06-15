"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import { Search, BarChart3, Megaphone, BadgeCheck, UserCircle, ChevronLeft, Award } from "lucide-react";
import { PROFILE_EDIT_OPEN_EVENT } from "@/lib/profile-events";
import type { ProfileEditOpenDetail } from "@/lib/profile-events";
import PhoneVerifyDrawer from "./PhoneVerifyDrawer";

interface ProfessionalVerifyDrawerProps {
  open: boolean;
  onClose: () => void;
  profileImageUrl: string | null;
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
}: ProfessionalVerifyDrawerProps) {
  const [phoneVerifyOpen, setPhoneVerifyOpen] = useState(false);

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
          <div className="flex justify-center pt-8 pb-6">
            <div className="relative animate-[breathe_3s_ease-in-out_infinite]">
              <div className="w-[130px] h-[130px] rounded-full overflow-hidden bg-gray-100">
                {profileImageUrl ? (
                  <Image
                    src={profileImageUrl}
                    alt="프로필"
                    width={130}
                    height={130}
                    className="w-[130px] h-[130px] object-cover"
                    unoptimized
                  />
                ) : (
                  <UserCircle size={130} className="text-gray-300" />
                )}
              </div>
              <span className="absolute bottom-0 left-0 w-[48px] h-[48px] bg-yellow-400 rounded-full flex items-center justify-center shadow-sm border-4 border-white">
                <Award size={28} className="text-white" />
              </span>
            </div>
          </div>

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
            className="w-full py-4 rounded-full bg-[#FACC15] text-[17px] font-bold text-[#333] active:brightness-95 transition-all"
          >
            다음
          </button>
        </div>
      </div>

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
