"use client";

type Tab = "friends" | "members" | "followings" | "pending" | "finder";

interface SearchHeaderProps {
  activeTab: Tab;
  onTabChange: (tab: Tab) => void;
}

export default function SearchHeader({ activeTab, onTabChange }: SearchHeaderProps) {
  return (
    <header className="sticky top-0 z-50 bg-white border-b border-[#e5e7eb]">
      <div className="relative h-14 px-4 flex items-center">
        <div className="font-black text-[22px] text-[#4d4d4d] leading-none">
          회원찾기
        </div>
      </div>
      <div className="flex pl-4 pr-4 gap-2 pb-2 overflow-x-auto scrollbar-hide whitespace-nowrap">
        <button
          onClick={() => onTabChange("finder")}
          className={`px-3.5 py-1.5 rounded-full text-[15px] font-semibold transition-colors ${
            activeTab === "finder" ? "bg-black text-white" : "bg-gray-100 text-gray-400"
          }`}
        >
          이근처
        </button>
        <button
          onClick={() => onTabChange("members")}
          className={`px-3.5 py-1.5 rounded-full text-[15px] font-semibold transition-colors ${
            activeTab === "members" ? "bg-black text-white" : "bg-gray-100 text-gray-400"
          }`}
        >
          회원찾기
        </button>
        <button
          onClick={() => onTabChange("followings")}
          className={`px-3.5 py-1.5 rounded-full text-[15px] font-semibold transition-colors ${
            activeTab === "followings" ? "bg-black text-white" : "bg-gray-100 text-gray-400"
          }`}
        >
          친구현황
        </button>
      </div>
    </header>
  );
}
