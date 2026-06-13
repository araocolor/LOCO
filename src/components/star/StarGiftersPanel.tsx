"use client";

import { useState } from "react";
import { X, UsersRound, Star } from "lucide-react";
import Avatar from "@/components/ui/Avatar";
import type { StarGiver } from "@/types/user";

type StarTab = "gifters" | "manage";

interface StarGiftersPanelProps {
  starGivers: StarGiver[];
  starBalance: number;
  onClose: () => void;
  onProfileClick: (id: string) => void;
  onChargeClick: () => void;
}

export default function StarGiftersPanel({
  starGivers,
  starBalance,
  onClose,
  onProfileClick,
  onChargeClick,
}: StarGiftersPanelProps) {
  const [tab, setTab] = useState<StarTab>("gifters");

  return (
    <>
      <div className="fixed inset-0 z-[70] bg-black/30" />
      <div className="fixed inset-y-0 right-0 z-[71] w-full max-w-[500px] bg-white shadow-xl flex flex-col page-slide-in-from-right" style={{ paddingTop: 'env(safe-area-inset-top)' }}>
        <header className="border-b border-[#e5e7eb]">
          <div className="relative h-14 px-4 flex items-center">
            <div className="font-black text-[22px] text-[#4d4d4d] leading-none">
              별선물
            </div>
            <button
              type="button"
              onClick={onClose}
              className="ml-auto h-12 w-12 -mr-2 flex items-center justify-center text-gray-400 hover:text-gray-600"
              aria-label="닫기"
            >
              <X size={20} />
            </button>
          </div>
          <div className="flex pl-4 pr-4 gap-2 pb-2">
            <button
              type="button"
              onClick={() => setTab("gifters")}
              className={`px-3.5 py-1.5 rounded-full text-[14px] font-semibold transition-colors ${
                tab === "gifters" ? "bg-black text-white" : "bg-gray-100 text-gray-400"
              }`}
            >
              선물한 사람들
            </button>
            <button
              type="button"
              onClick={() => setTab("manage")}
              className={`px-3.5 py-1.5 rounded-full text-[14px] font-semibold transition-colors ${
                tab === "manage" ? "bg-black text-white" : "bg-gray-100 text-gray-400"
              }`}
            >
              별관리
            </button>
          </div>
        </header>

        {tab === "gifters" && (
          <>
            <div className="flex items-center px-4 py-2">
              <div className="flex items-center gap-1 text-gray-900">
                <UsersRound size={20} />
                <span className="font-bold tabular-nums text-[16px]">{starGivers.length}</span>
              </div>
            </div>
            <div className="flex-1 overflow-y-auto scrollbar-hide overscroll-contain px-4 pb-4">
              {starGivers.length ? (
                <div className="grid grid-cols-5 gap-x-3 gap-y-4">
                  {starGivers.map((giver) => (
                    <button
                      key={giver.id}
                      type="button"
                      className="flex items-center justify-center"
                      onClick={() => onProfileClick(giver.id)}
                      aria-label={`${giver.nickname} 프로필`}
                    >
                      <Avatar src={giver.profile_image_url} nickname={giver.nickname} size={48} />
                    </button>
                  ))}
                </div>
              ) : (
                <div className="flex h-full items-center justify-center text-sm text-gray-400">
                  아직 별을 받은 사람이 없어요
                </div>
              )}
            </div>
          </>
        )}

        {tab === "manage" && (
          <div className="flex-1 flex flex-col items-center justify-center gap-6 px-4">
            <div className="flex items-center gap-2">
              <Star size={22} className="text-yellow-400 fill-yellow-400" />
              <span className="text-[16px] text-gray-700">
                현재 선물할 수 있는 별은 <span className="font-extrabold text-gray-900">{starBalance}개</span> 남아 있습니다.
              </span>
            </div>
            <button
              type="button"
              onClick={onChargeClick}
              className="rounded-full bg-[#fee500] px-6 py-3 text-[16px] font-bold text-[#191600] transition active:scale-[0.97]"
            >
              별선물 충전하기
            </button>
          </div>
        )}
      </div>
    </>
  );
}
