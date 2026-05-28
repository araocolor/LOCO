"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, Heart, LayoutGrid, Presentation, Search } from "lucide-react";
import NotificationDrawer from "@/components/features/NotificationDrawer";
import { ClassWithHost } from "@/components/class/ClassCard";
import CachedClassDetailPage from "@/components/class/CachedClassDetailPage";
import HomeSearchResultsPage from "@/components/features/HomeSearchResultsPage";
import MyClassesTab from "@/components/features/MyClassesTab";
import { useScrollChromeVisibility } from "@/hooks/useScrollChromeVisibility";
import { useAuth } from "@/lib/auth-context";
import { SEARCH_DEFAULTS_STORAGE_KEY, type SearchOptions } from "@/lib/search-defaults";

const HOME_MY_CLASSES_CACHE_KEY = "loco_home_my_classes_v1";

type MainTab = "allClasses" | "mySubscriptions";

interface MainTabbedHomePageProps {
  initialClasses: ClassWithHost[];
}

interface HomeMyClassesPayload {
  profile: {
    id: string;
    region: string | null;
  };
  myClasses: ClassWithHost[];
  participatingClasses: ClassWithHost[];
  regionalClasses: ClassWithHost[];
}

function getHomeMyClassesCacheKey(userId: string) {
  return `${HOME_MY_CLASSES_CACHE_KEY}:${userId}`;
}

export default function MainTabbedHomePage({ initialClasses }: MainTabbedHomePageProps) {
  const [activeTab, setActiveTab] = useState<MainTab>("mySubscriptions");
  const [userRegion, setUserRegion] = useState<string | null>(null);
  const { user } = useAuth();
  const userId = user?.id ?? null;
  const [myClasses, setMyClasses] = useState<ClassWithHost[]>([]);
  const [myClassesLoading, setMyClassesLoading] = useState(false);
  const [participatingClasses, setParticipatingClasses] = useState<ClassWithHost[]>([]);
  const [participatingClassesLoading, setParticipatingClassesLoading] = useState(false);
  const [regionalClasses, setRegionalClasses] = useState<ClassWithHost[]>([]);
  const [regionalClassesLoading, setRegionalClassesLoading] = useState(false);
  const [searchRegion, setSearchRegion] = useState<string | null>(null);
  const [classDetailId, setClassDetailId] = useState<string | null>(null);
  const [notificationOpen, setNotificationOpen] = useState(false);
  const [viewMode, setViewMode] = useState<"grid" | "card">("card");
  const isChromeVisible = useScrollChromeVisibility(true);
  const router = useRouter();

  const applyHomeMyClassesPayload = useCallback((payload: HomeMyClassesPayload) => {
    setUserRegion(payload.profile?.region ?? null);
    setMyClasses(payload.myClasses ?? []);
    setParticipatingClasses(payload.participatingClasses ?? []);
    setRegionalClasses(payload.regionalClasses ?? []);
  }, []);

  useEffect(() => {
    try {
      let nextSearchRegion: string | null = null;
      const raw = localStorage.getItem(SEARCH_DEFAULTS_STORAGE_KEY);
      if (raw) {
        const opts = JSON.parse(raw) as SearchOptions;
        nextSearchRegion = opts.region && opts.region !== "전체" ? opts.region : null;
      }
      queueMicrotask(() => setSearchRegion(nextSearchRegion));
    } catch {}
  }, []);

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

  const fetchHomeMyClasses = useCallback(async (uid: string, silent?: boolean) => {
    if (!silent) {
      setMyClassesLoading(true);
      setParticipatingClassesLoading(true);
      setRegionalClassesLoading(true);
    }
    try {
      const res = await fetch("/api/home/my-classes");
      if (!res.ok) return;
      const json = await res.json() as HomeMyClassesPayload;
      applyHomeMyClassesPayload(json);
      try {
        localStorage.setItem(getHomeMyClassesCacheKey(uid), JSON.stringify(json));
      } catch {}
    } catch {
    } finally {
      setMyClassesLoading(false);
      setParticipatingClassesLoading(false);
      setRegionalClassesLoading(false);
    }
  }, [applyHomeMyClassesPayload]);

  useEffect(() => {
    if (!userId) {
      queueMicrotask(() => setMyClasses([]));
      queueMicrotask(() => setParticipatingClasses([]));
      queueMicrotask(() => setRegionalClasses([]));
      queueMicrotask(() => setUserRegion(null));
      return;
    }

    let cachedPayload: HomeMyClassesPayload | null = null;
    try {
      const raw = localStorage.getItem(getHomeMyClassesCacheKey(userId));
      cachedPayload = raw ? JSON.parse(raw) as HomeMyClassesPayload : null;
    } catch {
      cachedPayload = null;
    }

    const hasCached = cachedPayload?.profile?.id === userId;
    queueMicrotask(() => {
      if (hasCached && cachedPayload) {
        applyHomeMyClassesPayload(cachedPayload);
      }
      void fetchHomeMyClasses(userId, hasCached);
    });
  }, [userId, fetchHomeMyClasses, applyHomeMyClassesPayload]);

  useEffect(() => {
    const handler = (e: Event) => {
      const deletedId = (e as CustomEvent<string>).detail;
      if (!deletedId) return;
      const remove = (list: ClassWithHost[]) => list.filter((c) => c.id !== deletedId);
      setMyClasses(remove);
      setParticipatingClasses(remove);
      setRegionalClasses(remove);
    };
    window.addEventListener("class-deleted", handler);
    return () => window.removeEventListener("class-deleted", handler);
  }, []);

  return (
    <>
      <NotificationDrawer open={notificationOpen} onClose={() => setNotificationOpen(false)} />
      <header
        className={`sticky top-0 z-50 bg-white border-b border-[#e5e7eb] transition-transform duration-200 ease-out motion-reduce:transition-none ${
          isChromeVisible ? "translate-y-0" : "-translate-y-full"
        }`}
      >
        <div className="relative h-14 px-4 flex items-center">
          {activeTab !== "mySubscriptions" ? (
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
            aria-label="알림"
            className="ml-auto w-10 h-10 -mr-1 flex items-center justify-center text-gray-700"
            onClick={() => setNotificationOpen(true)}
          >
            <Heart size={22} strokeWidth={2.2} />
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
            onClick={() => setActiveTab("allClasses")}
            className={`pb-2 font-bold transition-colors ${
              activeTab === "allClasses" ? "text-black" : "text-gray-400"
            }`}
            style={{ fontSize: activeTab === "allClasses" ? 18 : 17 }}
          >
            올클래스
          </button>
          {activeTab === "allClasses" && (
            <button
              type="button"
              aria-label={viewMode === "grid" ? "카드 보기" : "격자 보기"}
              className="ml-auto pb-2 text-gray-400"
              onClick={() => setViewMode(viewMode === "grid" ? "card" : "grid")}
            >
              {viewMode === "grid" ? (
                <Presentation size={20} strokeWidth={1.9} />
              ) : (
                <LayoutGrid size={20} strokeWidth={1.9} />
              )}
            </button>
          )}
        </div>
      </header>

      {activeTab === "allClasses" && (
        <HomeSearchResultsPage initialClasses={initialClasses} onClassSelect={(id) => setClassDetailId(id)} viewMode={viewMode} />
      )}
      {activeTab === "mySubscriptions" && (
        <MyClassesTab
          classes={myClasses}
          loading={myClassesLoading}
          participatingClasses={participatingClasses}
          participatingLoading={participatingClassesLoading}
          regionalClasses={regionalClasses}
          regionalLoading={regionalClassesLoading}
          regionalLabel={userRegion}
          onRetry={() => userId && fetchHomeMyClasses(userId)}
          onClassSelect={(id) => setClassDetailId(id)}
        />
      )}

      <div
        className={`fixed inset-0 z-[70] bg-white flex flex-col transition-transform duration-300 ease-in-out ${
          classDetailId ? "translate-x-0" : "-translate-x-full"
        }`}
      >
        <header className="sticky top-0 z-50 bg-white h-14 px-4 relative">
          <button
            onClick={() => setClassDetailId(null)}
            className="absolute left-4 top-1/2 -translate-y-1/2 w-[37px] h-[37px] flex items-center justify-center text-gray-600 hover:text-gray-900"
          >
            <ArrowLeft size={20} />
          </button>
          <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2">
            <span className="font-bold text-[#4d4d4d]" style={{ fontSize: 18 }}>
              클래스 정보
            </span>
          </div>
        </header>
        <div className="flex-1 overflow-y-auto">
          {classDetailId && <CachedClassDetailPage classIdOverride={classDetailId} onClose={() => setClassDetailId(null)} />}
        </div>
      </div>
    </>
  );
}
