"use client";

type Tab = "friends" | "members" | "followings" | "pending" | "finder";

interface SearchHeaderProps {
  activeTab: Tab;
  onTabChange: (tab: Tab) => void;
}

export default function SearchHeader({ activeTab, onTabChange }: SearchHeaderProps) {
  return (
    <header className="sticky top-0 z-50 bg-white border-b border-[#e5e7eb]">
      <div className="h-14 px-4 flex items-center justify-center">
        <div className="font-bold text-xl text-[#4d4d4d] leading-none">DANCERS</div>
      </div>
      <div className="flex pl-8 pr-4 gap-5 pb-0 overflow-x-auto scrollbar-hide whitespace-nowrap">
        <button
          onClick={() => onTabChange("finder")}
          className={`pb-2 font-bold transition-colors ${
            activeTab === "finder" ? "text-black" : "text-gray-400"
          }`}
          style={{ fontSize: activeTab === "finder" ? 18 : 17 }}
        >
          이근처
        </button>
        <button
          onClick={() => onTabChange("members")}
          className={`pb-2 font-bold transition-colors ${
            activeTab === "members" ? "text-black" : "text-gray-400"
          }`}
          style={{ fontSize: activeTab === "members" ? 18 : 17 }}
        >
          댄서들
        </button>
        <button
          onClick={() => onTabChange("followings")}
          className={`pb-2 font-bold transition-colors ${
            activeTab === "followings" ? "text-black" : "text-gray-400"
          }`}
          style={{ fontSize: activeTab === "followings" ? 18 : 17 }}
        >
          구독자
        </button>
      </div>
    </header>
  );
}
