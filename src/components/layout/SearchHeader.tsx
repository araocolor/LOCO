"use client";

import { Shell } from "lucide-react";

type Tab = "friends" | "members" | "followings" | "pending";

interface SearchHeaderProps {
  activeTab: Tab;
  onTabChange: (tab: Tab) => void;
  myRegionLabel?: string;
}

export default function SearchHeader({ activeTab, onTabChange, myRegionLabel = "내지역" }: SearchHeaderProps) {
  return (
    <header className="sticky top-0 z-50 bg-white border-b border-[#e5e7eb]">
      <div className="h-14 px-4 flex items-center justify-center">
        <Shell size={31} className="text-[#808080]" />
      </div>
      <div className="flex px-4 gap-5 pb-0 overflow-x-auto scrollbar-hide whitespace-nowrap">
        <button
          onClick={() => onTabChange("friends")}
          style={{ fontSize: 17 }}
          className={`pb-2 font-bold border-b-2 transition-colors ${
            activeTab === "friends"
              ? "border-black text-black"
              : "border-transparent text-gray-400"
          }`}
        >
          {myRegionLabel}
        </button>
        <button
          onClick={() => onTabChange("members")}
          style={{ fontSize: 17 }}
          className={`pb-2 font-bold border-b-2 transition-colors ${
            activeTab === "members"
              ? "border-black text-black"
              : "border-transparent text-gray-400"
          }`}
        >
          댄서찾기
        </button>
        <button
          onClick={() => onTabChange("followings")}
          style={{ fontSize: 17 }}
          className={`pb-2 font-bold border-b-2 transition-colors ${
            activeTab === "followings"
              ? "border-black text-black"
              : "border-transparent text-gray-400"
          }`}
        >
          구독자
        </button>
        <button
          onClick={() => onTabChange("pending")}
          style={{ fontSize: 17 }}
          className={`pb-2 font-bold border-b-2 transition-colors ${
            activeTab === "pending"
              ? "border-black text-black"
              : "border-transparent text-gray-400"
          }`}
        >
          회원관리
        </button>
      </div>
    </header>
  );
}
