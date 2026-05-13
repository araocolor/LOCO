"use client";

type Tab = "friends" | "my-region" | "follower" | "pending";

interface SearchHeaderProps {
  activeTab: Tab;
  onTabChange: (tab: Tab) => void;
  myRegionLabel?: string;
}

export default function SearchHeader({ activeTab, onTabChange, myRegionLabel = "내지역" }: SearchHeaderProps) {
  return (
    <header className="sticky top-0 z-50 bg-white border-b border-[#e5e7eb]">
      <div className="h-14 px-4 flex items-center justify-center">
        <span className="font-bold text-xl text-[#FEE500] leading-none">LOCO</span>
      </div>
      <div className="flex px-4 gap-6 pb-0">
        <button
          onClick={() => onTabChange("my-region")}
          style={{ fontSize: 17 }}
          className={`pb-2 font-bold border-b-2 transition-colors ${
            activeTab === "my-region"
              ? "border-black text-black"
              : "border-transparent text-gray-400"
          }`}
        >
          {myRegionLabel}
        </button>
        <button
          onClick={() => onTabChange("friends")}
          style={{ fontSize: 17 }}
          className={`pb-2 font-bold border-b-2 transition-colors ${
            activeTab === "friends"
              ? "border-black text-black"
              : "border-transparent text-gray-400"
          }`}
        >
          구독중
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
          구독멤버
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
