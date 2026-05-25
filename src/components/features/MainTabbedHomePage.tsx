"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { Grid3X3, Plus, Search } from "lucide-react";
import { ClassWithHost } from "@/components/class/ClassCard";
import HomeSearchResultsPage from "@/components/features/HomeSearchResultsPage";
import MyClassesTab from "@/components/features/MyClassesTab";
import { useScrollChromeVisibility } from "@/hooks/useScrollChromeVisibility";
import { useAuth } from "@/lib/auth-context";
import { SEARCH_DEFAULTS_STORAGE_KEY, type SearchOptions } from "@/lib/search-defaults";

const MY_CLASSES_CACHE_KEY = "loco_my_classes_v1";

type MainTab = "classSearch" | "mySubscriptions" | "friendClasses";

interface MainTabbedHomePageProps {
  initialClasses: ClassWithHost[];
}

function getMyClassesCacheKey(userId: string) {
  return `${MY_CLASSES_CACHE_KEY}:${userId}`;
}

export default function MainTabbedHomePage({ initialClasses }: MainTabbedHomePageProps) {
  const [activeTab, setActiveTab] = useState<MainTab>("classSearch");
  const [userRegion, setUserRegion] = useState<string | null>(null);
  const { user } = useAuth();
  const userId = user?.id ?? null;
  const [myClasses, setMyClasses] = useState<ClassWithHost[]>([]);
  const [myClassesLoading, setMyClassesLoading] = useState(false);
  const [searchRegion, setSearchRegion] = useState<string | null>(null);
  const isChromeVisible = useScrollChromeVisibility(true);
  const router = useRouter();

  useEffect(() => {
    let cancelled = false;

    async function fetchUserRegionFromProfile(uid: string) {
      try {
        const res = await fetch("/api/mypage/summary", { method: "GET", cache: "no-store" });
        if (!res.ok || cancelled) return;

        const json = await res.json() as {
          profile?: { id?: string; region?: string | null };
        };
        if (json.profile?.id && json.profile.id !== uid) return;

        const nextRegion = json.profile?.region ?? null;
        setUserRegion(nextRegion);

        try {
          const raw = localStorage.getItem("loco_mypage_cache_local_v2");
          const current = raw ? JSON.parse(raw) : {};
          localStorage.setItem(
            "loco_mypage_cache_local_v2",
            JSON.stringify({
              ...current,
              ...json,
              profile: {
                ...(current.profile ?? {}),
                ...(json.profile ?? {}),
              },
            })
          );
        } catch {}
      } catch {}
    }

    try {
      let nextUserRegion: string | null = null;
      let nextSearchRegion: string | null = null;

      const mypageRaw = localStorage.getItem("loco_mypage_cache_local_v2");
      if (mypageRaw) {
        const cached = JSON.parse(mypageRaw) as {
          profile?: { id?: string; region?: string | null };
        };
        if (!userId || !cached.profile?.id || cached.profile.id === userId) {
          nextUserRegion = cached.profile?.region ?? null;
        }
      }

      const raw = localStorage.getItem(SEARCH_DEFAULTS_STORAGE_KEY);
      if (raw) {
        const opts = JSON.parse(raw) as SearchOptions;
        nextSearchRegion = opts.region && opts.region !== "전체" ? opts.region : null;
      }

      queueMicrotask(() => {
        setUserRegion(nextUserRegion);
        setSearchRegion(nextSearchRegion);
      });

      if (userId && !nextUserRegion) {
        void fetchUserRegionFromProfile(userId);
      }
    } catch {}
    return () => {
      cancelled = true;
    };
  }, [userId]);

  useEffect(() => {
    function handleSearchClose() {
      try {
        const raw = localStorage.getItem(SEARCH_DEFAULTS_STORAGE_KEY);
        if (raw) {
          const opts = JSON.parse(raw) as SearchOptions;
          setSearchRegion(opts.region && opts.region !== "전체" ? opts.region : null);
        } else {
          setSearchRegion(null);
        }
      } catch {}
    }
    window.addEventListener("close-search-sheet", handleSearchClose);
    return () => window.removeEventListener("close-search-sheet", handleSearchClose);
  }, []);

  const fetchMyClasses = useCallback(async (uid: string) => {
    setMyClassesLoading(true);
    try {
      const res = await fetch(`/api/classes/search?host_id=${uid}&limit=50`);
      const json = await res.json();
      const items = (json.data ?? []) as ClassWithHost[];
      setMyClasses(items);
      try {
        localStorage.setItem(getMyClassesCacheKey(uid), JSON.stringify(items));
      } catch {}
    } catch {
    } finally {
      setMyClassesLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!userId) {
      queueMicrotask(() => setMyClasses([]));
      return;
    }

    let nextMyClasses: ClassWithHost[] = [];
    try {
      const raw = localStorage.getItem(getMyClassesCacheKey(userId));
      nextMyClasses = raw ? JSON.parse(raw) : [];
    } catch {
      nextMyClasses = [];
    }

    queueMicrotask(() => {
      setMyClasses(nextMyClasses);
      void fetchMyClasses(userId);
    });
  }, [userId, fetchMyClasses]);

  return (
    <>
      <header
        className={`sticky top-0 z-50 bg-white border-b border-[#e5e7eb] transition-transform duration-200 ease-out motion-reduce:transition-none ${
          isChromeVisible ? "translate-y-0" : "-translate-y-full"
        }`}
      >
        <div className="relative h-14 px-4 flex items-center">
          {activeTab === "classSearch" ? (
            <button
              type="button"
              aria-label="찾기"
              className="h-10 -ml-1 flex items-center gap-1 text-gray-700"
              onClick={() => {
                window.dispatchEvent(new CustomEvent("open-search-sheet"));
              }}
            >
              <Search size={20} strokeWidth={2.2} />
              {searchRegion && (
                <span className="text-xs font-semibold text-gray-500">{searchRegion}</span>
              )}
            </button>
          ) : (
            <div className="w-10 h-10 -ml-1" />
          )}
          <div className="absolute left-1/2 -translate-x-1/2 font-bold text-xl text-[#4d4d4d] leading-none">
            CLASS
          </div>
          <button
            type="button"
            aria-label="클래스 만들기"
            className="ml-auto w-10 h-10 -mr-1 flex items-center justify-center text-gray-700"
            onClick={() => router.push("/classes/new")}
          >
            <Plus size={22} strokeWidth={2.2} />
          </button>
        </div>
        <div className="flex pl-4 pr-4 gap-5 pb-0 overflow-x-auto scrollbar-hide whitespace-nowrap">
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
            {userRegion}클래스
          </button>
          <button
            onClick={() => setActiveTab("classSearch")}
            className={`pb-2 font-bold transition-colors ${
              activeTab === "classSearch" ? "text-black" : "text-gray-400"
            }`}
            style={{ fontSize: activeTab === "classSearch" ? 18 : 17 }}
          >
            올클래스
          </button>
          <button type="button" aria-label="썸네일 보기" className="ml-auto pb-2 text-gray-400">
            <Grid3X3 size={18} strokeWidth={1.9} />
          </button>
        </div>
      </header>

      {activeTab === "classSearch" && <HomeSearchResultsPage initialClasses={initialClasses} />}
      {activeTab === "friendClasses" && <HomeSearchResultsPage regionOverride={userRegion} />}
      {activeTab === "mySubscriptions" && (
        <MyClassesTab
          classes={myClasses}
          loading={myClassesLoading}
          onRetry={() => userId && fetchMyClasses(userId)}
        />
      )}
    </>
  );
}
