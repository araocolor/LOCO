"use client";

import { useState } from "react";
import { Grid3X3, Menu, Search } from "lucide-react";
import { ClassWithHost } from "@/components/class/ClassCard";
import HomeSearchResultsPage from "@/components/features/HomeSearchResultsPage";

type MainTab = "classSearch" | "mySubscriptions" | "friendClasses";

interface MainTabbedHomePageProps {
  initialClasses: ClassWithHost[];
}

export default function MainTabbedHomePage({ initialClasses }: MainTabbedHomePageProps) {
  const [activeTab, setActiveTab] = useState<MainTab>("classSearch");

  return (
    <>
      <header className="sticky top-0 z-50 bg-white border-b border-[#e5e7eb]">
        <div className="relative h-14 px-4 flex items-center">
          <button
            type="button"
            aria-label="찾기"
            className="w-10 h-10 -ml-1 flex items-center justify-center text-gray-700"
          >
            <Search size={20} strokeWidth={2.2} />
          </button>
          <div className="absolute left-1/2 -translate-x-1/2 font-bold text-xl text-[#4d4d4d] leading-none">
            CLASS
          </div>
          <button
            type="button"
            aria-label="햄버거 메뉴"
            className="ml-auto w-10 h-10 -mr-1 flex items-center justify-center text-gray-700"
          >
            <Menu size={22} strokeWidth={2.2} />
          </button>
        </div>
        <div className="flex pl-4 pr-4 gap-5 pb-0 overflow-x-auto scrollbar-hide whitespace-nowrap">
          <button
            onClick={() => setActiveTab("classSearch")}
            className={`pb-2 font-bold transition-colors ${
              activeTab === "classSearch" ? "text-black" : "text-gray-400"
            }`}
            style={{ fontSize: activeTab === "classSearch" ? 18 : 17 }}
          >
            클래스검색
          </button>
          <button
            onClick={() => setActiveTab("mySubscriptions")}
            className={`pb-2 font-bold transition-colors ${
              activeTab === "mySubscriptions" ? "text-black" : "text-gray-400"
            }`}
            style={{ fontSize: activeTab === "mySubscriptions" ? 18 : 17 }}
          >
            내구독
          </button>
          <button
            onClick={() => setActiveTab("friendClasses")}
            className={`pb-2 font-bold transition-colors ${
              activeTab === "friendClasses" ? "text-black" : "text-gray-400"
            }`}
            style={{ fontSize: activeTab === "friendClasses" ? 18 : 17 }}
          >
            친구클래스
          </button>
          <button type="button" aria-label="썸네일 보기" className="ml-auto pb-2 text-gray-400">
            <Grid3X3 size={18} strokeWidth={1.9} />
          </button>
        </div>
      </header>

      {activeTab === "classSearch" && <HomeSearchResultsPage initialClasses={initialClasses} />}
      {activeTab !== "classSearch" && <div className="max-w-xl mx-auto bg-white min-h-[40vh]" />}
    </>
  );
}
