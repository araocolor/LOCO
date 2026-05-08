"use client";

type Tab = "followers" | "online";

interface SearchHeaderProps {
  activeTab: Tab;
  onTabChange: (tab: Tab) => void;
}

export default function SearchHeader({ activeTab, onTabChange }: SearchHeaderProps) {
  return (
    <header className="sticky top-0 z-50 bg-white border-b border-[#e5e7eb]">
      <div className="h-14 px-4 flex items-center justify-center">
        <span className="font-bold text-xl text-[#FEE500] leading-none">LOCO</span>
      </div>
      <div className="flex px-4 gap-6 pb-0">
        <button
          onClick={() => onTabChange("followers")}
          className={`pb-2 text-sm font-semibold border-b-2 transition-colors ${
            activeTab === "followers"
              ? "border-black text-black"
              : "border-transparent text-gray-400"
          }`}
        >
          친구들
        </button>
        <button
          onClick={() => onTabChange("online")}
          className={`pb-2 text-sm font-semibold border-b-2 transition-colors ${
            activeTab === "online"
              ? "border-black text-black"
              : "border-transparent text-gray-400"
          }`}
        >
          팔로워
        </button>
      </div>
    </header>
  );
}
