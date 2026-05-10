"use client";

type Tab = "friends" | "follower" | "pending";

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
          onClick={() => onTabChange("friends")}
          style={{ fontSize: 17 }}
          className={`pb-2 font-bold border-b-2 transition-colors ${
            activeTab === "friends"
              ? "border-black text-black"
              : "border-transparent text-gray-400"
          }`}
        >
          친구들
        </button>
        <button
          onClick={() => onTabChange("follower")}
          style={{ fontSize: 17 }}
          className={`pb-2 font-bold border-b-2 transition-colors ${
            activeTab === "follower"
              ? "border-black text-black"
              : "border-transparent text-gray-400"
          }`}
        >
          팔로워
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
          대기중
        </button>
      </div>
    </header>
  );
}
