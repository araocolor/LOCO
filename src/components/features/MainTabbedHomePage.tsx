"use client";

import { useState } from "react";
import { Shell } from "lucide-react";
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
        <div className="h-14 px-4 flex items-center justify-center">
          <Shell size={31} className="mt-2 text-[#808080]" />
        </div>
        <div className="flex pl-8 pr-4 gap-5 pb-0 overflow-x-auto scrollbar-hide whitespace-nowrap">
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
        </div>
      </header>

      {activeTab === "classSearch" && <HomeSearchResultsPage initialClasses={initialClasses} />}
      {activeTab !== "classSearch" && <div className="max-w-xl mx-auto bg-white min-h-[40vh]" />}
    </>
  );
}
