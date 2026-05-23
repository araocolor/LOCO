"use client";

import { useState, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Grid3X3, Menu, Search } from "lucide-react";
import { ClassWithHost } from "@/components/class/ClassCard";
import HomeSearchResultsPage from "@/components/features/HomeSearchResultsPage";
import { useScrollChromeVisibility } from "@/hooks/useScrollChromeVisibility";

type MainTab = "classSearch" | "mySubscriptions" | "friendClasses";

interface MainTabbedHomePageProps {
  initialClasses: ClassWithHost[];
}

export default function MainTabbedHomePage({ initialClasses }: MainTabbedHomePageProps) {
  const [activeTab, setActiveTab] = useState<MainTab>("classSearch");
  const [userRegion, setUserRegion] = useState<string | null>(null);
  const isChromeVisible = useScrollChromeVisibility(true);
  const router = useRouter();
  const searchParams = useSearchParams();

  useEffect(() => {
    async function loadRegion() {
      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      const { data } = await supabase
        .from("profiles")
        .select("region")
        .eq("id", user.id)
        .maybeSingle();
      if (data?.region) setUserRegion(data.region);
    }
    loadRegion();
  }, []);

  return (
    <>
      <header
        className={`sticky top-0 z-50 bg-white border-b border-[#e5e7eb] transition-transform duration-200 ease-out motion-reduce:transition-none ${
          isChromeVisible ? "translate-y-0" : "-translate-y-full"
        }`}
      >
        <div className="relative h-14 px-4 flex items-center">
          <button
            type="button"
            aria-label="찾기"
            className="w-10 h-10 -ml-1 flex items-center justify-center text-gray-700"
            onClick={() => {
              window.dispatchEvent(new CustomEvent("open-search-sheet"));
            }}
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
            올클래스
          </button>
          <button
            onClick={() => setActiveTab("mySubscriptions")}
            className={`pb-2 font-bold transition-colors ${
              activeTab === "mySubscriptions" ? "text-black" : "text-gray-400"
            }`}
            style={{ fontSize: activeTab === "mySubscriptions" ? 18 : 17 }}
          >
            내클래스
          </button>
          <button
            onClick={() => setActiveTab("friendClasses")}
            className={`pb-2 font-bold transition-colors ${
              activeTab === "friendClasses" ? "text-black" : "text-gray-400"
            }`}
            style={{ fontSize: activeTab === "friendClasses" ? 18 : 17 }}
          >
            친클래스
          </button>
          <button type="button" aria-label="썸네일 보기" className="ml-auto pb-2 text-gray-400">
            <Grid3X3 size={18} strokeWidth={1.9} />
          </button>
        </div>
      </header>

      {activeTab === "classSearch" && <HomeSearchResultsPage initialClasses={initialClasses} />}
      {activeTab === "friendClasses" && <HomeSearchResultsPage regionOverride={userRegion} />}
      {activeTab === "mySubscriptions" && <div className="max-w-xl mx-auto bg-white min-h-[40vh]" />}
    </>
  );
}
