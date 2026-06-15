"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { ArrowLeft, LayoutGrid, Plus, Presentation, Search, X } from "lucide-react";
import {
  SEARCH_DEFAULTS_STORAGE_KEY,
  type SearchOptions,
  DEFAULT_SEARCH_OPTIONS,
  getPeriodOptions,
  CLASS_TYPES,
} from "@/lib/search-defaults";
import { GENRES, REGIONS_WITH_ALL } from "@/lib/constants";
import { ClassWithHost } from "@/components/class/ClassCard";
import CachedClassDetailPage from "@/components/class/CachedClassDetailPage";
import CreateClassDrawer from "@/components/class/CreateClassDrawer";
import HomeSearchResultsPage from "@/components/features/HomeSearchResultsPage";
import MyClassesTab from "@/components/features/MyClassesTab";
import { useScrollChromeVisibility } from "@/hooks/useScrollChromeVisibility";
import { useAuth } from "@/lib/auth-context";

const HOME_MY_CLASSES_CACHE_KEY = "loco_home_my_classes_v1";
const HOME_FRIEND_CLASSES_CACHE_KEY = "loco_home_friend_classes_v1";
const HOME_SUBTAB_CHANGE_EVENT = "loco-home-subtab-change";

type MainTab = "allClasses" | "mySubscriptions" | "friendClasses";

interface MainTabbedHomePageProps {
  initialClasses: ClassWithHost[];
}

interface HomeMyClassesPayload {
  profile: {
    id: string;
    region: string | null;
    nickname: string | null;
    profile_image_url: string | null;
  };
  myClasses: ClassWithHost[];
  participatingClasses: ClassWithHost[];
  regionalClasses: ClassWithHost[];
}

function getHomeMyClassesCacheKey(userId: string) {
  return `${HOME_MY_CLASSES_CACHE_KEY}:${userId}`;
}

function getHomeFriendClassesCacheKey(userId: string) {
  return `${HOME_FRIEND_CLASSES_CACHE_KEY}:${userId}`;
}

export default function MainTabbedHomePage({ initialClasses }: MainTabbedHomePageProps) {
  const [activeTab, setActiveTab] = useState<MainTab>("allClasses");
  const { user } = useAuth();
  const userId = user?.id ?? null;
  const [myClasses, setMyClasses] = useState<ClassWithHost[]>([]);
  const [myClassesLoading, setMyClassesLoading] = useState(false);
  const [participatingClasses, setParticipatingClasses] = useState<ClassWithHost[]>([]);
  const [participatingClassesLoading, setParticipatingClassesLoading] = useState(false);
  const [friendClasses, setFriendClasses] = useState<ClassWithHost[]>([]);
  const [friendClassesLoading, setFriendClassesLoading] = useState(false);
  const [classDetailId, setClassDetailId] = useState<string | null>(null);
  const [createDrawerOpen, setCreateDrawerOpen] = useState(false);
  const [allViewMode, setAllViewMode] = useState<"grid" | "card">("grid");
  const [filterOpts, setFilterOpts] = useState<SearchOptions>(DEFAULT_SEARCH_OPTIONS);
  const [openMenu, setOpenMenu] = useState<"region" | "period" | "genre" | "class_type" | null>(
    null
  );
  const [isMySetting, setIsMySetting] = useState(false);
  const isChromeVisible = useScrollChromeVisibility(activeTab === "allClasses");
  const router = useRouter();
  const searchParams = useSearchParams();

  useEffect(() => {
    if (searchParams.get("payment") === "success") {
      setCreateDrawerOpen(true);
      router.replace("/", { scroll: false });
    }
  }, [searchParams, router]);
  const periodOptions = getPeriodOptions();

  useEffect(() => {
    function readOpts(): SearchOptions {
      try {
        const raw = localStorage.getItem(SEARCH_DEFAULTS_STORAGE_KEY);
        if (!raw) return DEFAULT_SEARCH_OPTIONS;
        const parsed = JSON.parse(raw) as Partial<Omit<SearchOptions, "genre" | "class_type">> & {
          genre?: string | string[];
          class_type?: string[];
          status?: string;
        };
        return {
          ...DEFAULT_SEARCH_OPTIONS,
          region: parsed.region === "없음" ? "전체" : (parsed.region ?? "전체"),
          period: parsed.period ?? "전체",
          venue: parsed.venue ?? "전체",
          genre: Array.isArray(parsed.genre) ? parsed.genre : parsed.genre ? [parsed.genre] : [],
          class_type: Array.isArray(parsed.class_type) ? parsed.class_type : [],
        };
      } catch {
        return DEFAULT_SEARCH_OPTIONS;
      }
    }
    queueMicrotask(() => setFilterOpts(readOpts()));
    function handleChange() {
      setFilterOpts(readOpts());
    }
    window.addEventListener("close-search-sheet", handleChange);
    window.addEventListener("search-filter-change", handleChange);
    return () => {
      window.removeEventListener("close-search-sheet", handleChange);
      window.removeEventListener("search-filter-change", handleChange);
    };
  }, []);

  const updateFilter = useCallback((next: SearchOptions) => {
    setFilterOpts(next);
    localStorage.setItem(SEARCH_DEFAULTS_STORAGE_KEY, JSON.stringify(next));
    window.dispatchEvent(new Event("search-filter-change"));
  }, []);

  const resetFilters = useCallback(() => {
    updateFilter(DEFAULT_SEARCH_OPTIONS);
    setOpenMenu(null);
    setIsMySetting(false);
  }, [updateFilter]);

  useEffect(() => {
    if (!openMenu) return;
    function handleClick() {
      setOpenMenu(null);
    }
    document.addEventListener("click", handleClick);
    return () => document.removeEventListener("click", handleClick);
  }, [openMenu]);

  const applyHomeMyClassesPayload = useCallback((payload: HomeMyClassesPayload) => {
    setMyClasses(payload.myClasses ?? []);
    setParticipatingClasses(payload.participatingClasses ?? []);
  }, []);

  const fetchFriendClasses = useCallback(async (uid: string, silent?: boolean) => {
    if (!silent) setFriendClassesLoading(true);
    try {
      const res = await fetch("/api/home/friend-classes");
      if (!res.ok) return;
      const json = await res.json();
      setFriendClasses(json.friendClasses ?? []);
      try {
        localStorage.setItem(getHomeFriendClassesCacheKey(uid), JSON.stringify(json));
      } catch {}
    } catch {
    } finally {
      setFriendClassesLoading(false);
    }
  }, []);

  const fetchHomeMyClasses = useCallback(
    async (uid: string, silent?: boolean) => {
      if (!silent) {
        setMyClassesLoading(true);
        setParticipatingClassesLoading(true);
      }
      try {
        const res = await fetch("/api/home/my-classes");
        if (!res.ok) return;
        const json = (await res.json()) as HomeMyClassesPayload;
        applyHomeMyClassesPayload(json);
        try {
          localStorage.setItem(getHomeMyClassesCacheKey(uid), JSON.stringify(json));
        } catch {}
        if (json.profile) {
          try {
            const cacheKey = "loco_mypage_cache_local_v3";
            const raw = localStorage.getItem(cacheKey);
            const existing = raw ? JSON.parse(raw) : {};
            localStorage.setItem(cacheKey, JSON.stringify({
              ...existing,
              profile: { ...existing?.profile, ...json.profile },
            }));
            window.dispatchEvent(new Event("loco:profile-cache-updated"));
          } catch {}
        }
        void fetchFriendClasses(uid, silent);
      } catch {
      } finally {
        setMyClassesLoading(false);
        setParticipatingClassesLoading(false);
      }
    },
    [applyHomeMyClassesPayload, fetchFriendClasses]
  );

  useEffect(() => {
    if (!userId) {
      queueMicrotask(() => setMyClasses([]));
      queueMicrotask(() => setParticipatingClasses([]));
      queueMicrotask(() => setFriendClasses([]));
      return;
    }

    let cachedPayload: HomeMyClassesPayload | null = null;
    try {
      const raw = localStorage.getItem(getHomeMyClassesCacheKey(userId));
      cachedPayload = raw ? (JSON.parse(raw) as HomeMyClassesPayload) : null;
    } catch {
      cachedPayload = null;
    }

    let cachedFriendClasses: ClassWithHost[] | null = null;
    try {
      const raw = localStorage.getItem(getHomeFriendClassesCacheKey(userId));
      if (raw) {
        const parsed = JSON.parse(raw);
        cachedFriendClasses = parsed.friendClasses ?? null;
      }
    } catch {
      cachedFriendClasses = null;
    }

    const hasCached = cachedPayload?.profile?.id === userId;
    const hasFriendCached = Array.isArray(cachedFriendClasses) && cachedFriendClasses.length > 0;
    queueMicrotask(() => {
      if (hasCached && cachedPayload) {
        applyHomeMyClassesPayload(cachedPayload);
      }
      if (hasFriendCached && cachedFriendClasses) {
        setFriendClasses(cachedFriendClasses);
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
      setFriendClasses(remove);
    };
    window.addEventListener("class-deleted", handler);
    return () => window.removeEventListener("class-deleted", handler);
  }, []);

  useEffect(() => {
    window.dispatchEvent(new CustomEvent<MainTab>(HOME_SUBTAB_CHANGE_EVENT, { detail: activeTab }));
  }, [activeTab]);

  return (
    <>
      <header
        className={`sticky top-0 z-50 bg-white border-b border-[#e5e7eb] transition-transform duration-200 ease-out motion-reduce:transition-none ${
          isChromeVisible ? "translate-y-0" : "-translate-y-full"
        }`}
      >
        <div className="relative h-14 px-4 flex items-center">
          <div className="font-black text-[22px] text-[#4d4d4d] leading-none">클래스</div>
          <button
            type="button"
            aria-label="클래스 만들기"
            className="ml-auto h-12 w-12 -mr-2 flex items-center justify-center text-gray-700"
            onClick={() => setCreateDrawerOpen(true)}
          >
            <Plus size={22} strokeWidth={2.2} />
          </button>
        </div>
        <div className="flex pl-4 pr-4 gap-2 pb-2 overflow-x-auto scrollbar-hide whitespace-nowrap">
          <button
            onClick={() => setActiveTab("mySubscriptions")}
            className={`px-3.5 py-1.5 rounded-full text-[15px] font-semibold transition-colors ${
              activeTab === "mySubscriptions" ? "bg-black text-white" : "bg-gray-100 text-black/[0.65]"
            }`}
          >
            내클래스
          </button>
          <button
            onClick={() => setActiveTab("friendClasses")}
            className={`px-3.5 py-1.5 rounded-full text-[15px] font-semibold transition-colors ${
              activeTab === "friendClasses" ? "bg-black text-white" : "bg-gray-100 text-black/[0.65]"
            }`}
          >
            이벤트/파티
          </button>
          <button
            onClick={() => setActiveTab("allClasses")}
            className={`px-3.5 py-1.5 rounded-full text-[15px] font-semibold transition-colors ${
              activeTab === "allClasses" ? "bg-black text-white" : "bg-gray-100 text-black/[0.65]"
            }`}
          >
            올클
          </button>
          {activeTab === "allClasses" && (
            <button
              type="button"
              aria-label="검색"
              className="mt-1 ml-2 text-gray-400"
              onClick={() => window.dispatchEvent(new CustomEvent("open-search-sheet"))}
            >
              <Search size={20} strokeWidth={2.8} />
            </button>
          )}
          {activeTab === "allClasses" && (
            <button
              type="button"
              aria-label={allViewMode === "grid" ? "카드 보기" : "격자 보기"}
              className="mt-1 ml-auto mr-[4px] text-gray-400"
              onClick={() => setAllViewMode((v) => (v === "grid" ? "card" : "grid"))}
            >
              {allViewMode === "grid" ? (
                <Presentation size={20} strokeWidth={1.9} />
              ) : (
                <LayoutGrid size={20} strokeWidth={1.9} />
              )}
            </button>
          )}
        </div>
      </header>

      {activeTab === "allClasses" && (
        <>
          {(filterOpts.region !== "전체" ||
            filterOpts.period !== "전체" ||
            filterOpts.genre.length > 0 ||
            filterOpts.class_type.length > 0) && (
            <div className="px-4 py-2 flex items-center gap-3">
              <div className="relative" onClick={(e) => e.stopPropagation()}>
                <button
                  type="button"
                  disabled={isMySetting}
                  className={`text-[13px] px-2.5 py-1 rounded-full ${isMySetting ? "opacity-50" : ""} ${filterOpts.region !== "전체" ? "bg-black text-white font-bold" : "bg-gray-100 text-gray-400"}`}
                  onClick={() => setOpenMenu(openMenu === "region" ? null : "region")}
                >
                  {filterOpts.region !== "전체" ? filterOpts.region : "전지역"}
                </button>
                {openMenu === "region" && !isMySetting && (
                  <div className="absolute top-full left-0 mt-1 bg-white border border-gray-200 rounded-lg shadow-lg z-50 max-h-60 overflow-y-auto min-w-[80px]">
                    {REGIONS_WITH_ALL.map((r) => (
                      <button
                        key={r}
                        type="button"
                        className={`block w-full text-left px-3 py-2 text-sm whitespace-nowrap ${filterOpts.region === r ? "text-black font-bold bg-gray-50" : "text-gray-600"}`}
                        onClick={() => {
                          updateFilter({ ...filterOpts, region: r, venue: "전체" });
                          setOpenMenu(null);
                        }}
                      >
                        {r}
                      </button>
                    ))}
                  </div>
                )}
              </div>

              <div className="relative" onClick={(e) => e.stopPropagation()}>
                <button
                  type="button"
                  disabled={isMySetting}
                  className={`text-[13px] px-2.5 py-1 rounded-full ${isMySetting ? "opacity-50" : ""} ${filterOpts.period !== "전체" ? "bg-black text-white font-bold" : "bg-gray-100 text-gray-400"}`}
                  onClick={() => setOpenMenu(openMenu === "period" ? null : "period")}
                >
                  {periodOptions.find((p) => p.value === filterOpts.period)?.label ?? "전체"}
                </button>
                {openMenu === "period" && !isMySetting && (
                  <div className="absolute top-full left-0 mt-1 bg-white border border-gray-200 rounded-lg shadow-lg z-50 max-h-60 overflow-y-auto min-w-[80px]">
                    {periodOptions.map((p) => (
                      <button
                        key={p.value}
                        type="button"
                        className={`block w-full text-left px-3 py-2 text-sm whitespace-nowrap ${filterOpts.period === p.value ? "text-black font-bold bg-gray-50" : "text-gray-600"}`}
                        onClick={() => {
                          updateFilter({ ...filterOpts, period: p.value });
                          setOpenMenu(null);
                        }}
                      >
                        {p.label}
                      </button>
                    ))}
                  </div>
                )}
              </div>

              <div className="relative" onClick={(e) => e.stopPropagation()}>
                <button
                  type="button"
                  disabled={isMySetting}
                  className={`text-[13px] px-2.5 py-1 rounded-full ${isMySetting ? "opacity-50" : ""} ${filterOpts.genre.length > 0 ? "bg-black text-white font-bold" : "bg-gray-100 text-gray-400"}`}
                  onClick={() => setOpenMenu(openMenu === "genre" ? null : "genre")}
                >
                  {filterOpts.genre.length > 0
                    ? (GENRES.find((g) => g.value === filterOpts.genre[0])?.label ??
                      filterOpts.genre[0])
                    : "모든장르"}
                </button>
                {openMenu === "genre" && !isMySetting && (
                  <div className="absolute top-full left-0 mt-1 bg-white border border-gray-200 rounded-lg shadow-lg z-50 min-w-[80px]">
                    <button
                      type="button"
                      className={`block w-full text-left px-3 py-2 text-sm whitespace-nowrap ${filterOpts.genre.length === 0 ? "text-black font-bold bg-gray-50" : "text-gray-600"}`}
                      onClick={() => {
                        updateFilter({ ...filterOpts, genre: [] });
                        setOpenMenu(null);
                      }}
                    >
                      전체
                    </button>
                    {GENRES.map((g) => (
                      <button
                        key={g.value}
                        type="button"
                        className={`block w-full text-left px-3 py-2 text-sm whitespace-nowrap ${filterOpts.genre.includes(g.value) ? "text-black font-bold bg-gray-50" : "text-gray-600"}`}
                        onClick={() => {
                          updateFilter({
                            ...filterOpts,
                            genre: filterOpts.genre.includes(g.value) ? [] : [g.value],
                          });
                          setOpenMenu(null);
                        }}
                      >
                        {g.label}
                      </button>
                    ))}
                  </div>
                )}
              </div>

              <div className="relative" onClick={(e) => e.stopPropagation()}>
                <button
                  type="button"
                  disabled={isMySetting}
                  className={`text-[13px] px-2.5 py-1 rounded-full ${isMySetting ? "opacity-50" : ""} ${filterOpts.class_type.length > 0 ? "bg-black text-white font-bold" : "bg-gray-100 text-gray-400"}`}
                  onClick={() => setOpenMenu(openMenu === "class_type" ? null : "class_type")}
                >
                  {filterOpts.class_type.length > 0
                    ? (CLASS_TYPES.find((t) => t.value === filterOpts.class_type[0])?.label ??
                      filterOpts.class_type[0])
                    : "행사/수업들"}
                </button>
                {openMenu === "class_type" && !isMySetting && (
                  <div className="absolute top-full left-0 mt-1 bg-white border border-gray-200 rounded-lg shadow-lg z-50 min-w-[80px]">
                    <button
                      type="button"
                      className={`block w-full text-left px-3 py-2 text-sm whitespace-nowrap ${filterOpts.class_type.length === 0 ? "text-black font-bold bg-gray-50" : "text-gray-600"}`}
                      onClick={() => {
                        updateFilter({ ...filterOpts, class_type: [] });
                        setOpenMenu(null);
                      }}
                    >
                      전체
                    </button>
                    {CLASS_TYPES.map((t) => (
                      <button
                        key={t.value}
                        type="button"
                        className={`block w-full text-left px-3 py-2 text-sm whitespace-nowrap ${filterOpts.class_type.includes(t.value) ? "text-black font-bold bg-gray-50" : "text-gray-600"}`}
                        onClick={() => {
                          updateFilter({
                            ...filterOpts,
                            class_type: filterOpts.class_type.includes(t.value) ? [] : [t.value],
                          });
                          setOpenMenu(null);
                        }}
                      >
                        {t.label}
                      </button>
                    ))}
                  </div>
                )}
              </div>
              <button
                type="button"
                aria-label="검색조건 초기화"
                className="-mr-1 ml-auto flex h-5 w-5 flex-shrink-0 items-center justify-center rounded-full bg-gray-100 text-gray-500"
                onClick={resetFilters}
              >
                <X size={14} strokeWidth={2.4} />
              </button>
            </div>
          )}
          <HomeSearchResultsPage
            initialClasses={initialClasses}
            onClassSelect={(id) => setClassDetailId(id)}
            onResetFilters={resetFilters}
            viewMode={allViewMode}
            regionOverride={filterOpts.region}
            periodOverride={filterOpts.period}
            genreOverride={filterOpts.genre}
            classTypeOverride={filterOpts.class_type}
          />
        </>
      )}
      {activeTab === "friendClasses" && (
        <HomeSearchResultsPage
          regionOverride="전체"
          periodOverride="전체"
          yearOverride={2026}
          genreOverride={[]}
          classTypeOverride={["party"]}
          onClassSelect={(id) => setClassDetailId(id)}
          viewMode="card"
        />
      )}
      {activeTab === "mySubscriptions" && (
        <MyClassesTab
          classes={myClasses}
          loading={myClassesLoading}
          participatingClasses={participatingClasses}
          participatingLoading={participatingClassesLoading}
          friendClasses={friendClasses}
          friendClassesLoading={friendClassesLoading}
          onRetry={() => userId && fetchHomeMyClasses(userId)}
          onClassSelect={(id) => setClassDetailId(id)}
          viewMode="grid"
        />
      )}

      {!classDetailId && (
        <div className="fixed bottom-24 left-1/2 z-[60] w-full max-w-[500px] -translate-x-1/2 pointer-events-none">
          <button
            type="button"
            aria-label="클래스 만들기"
            className="absolute bottom-0 right-5 flex h-14 w-14 items-center justify-center rounded-full bg-[#fee500] text-[#191600] shadow-lg active:scale-95 transition-transform pointer-events-auto"
            onClick={() => setCreateDrawerOpen(true)}
          >
            <Plus size={26} strokeWidth={2.4} />
          </button>
        </div>
      )}

      <CreateClassDrawer
        open={createDrawerOpen}
        onClose={() => setCreateDrawerOpen(false)}
      />

      <div
        className={`fixed inset-0 z-[70] bg-white flex flex-col transition-transform duration-300 ease-in-out ${
          classDetailId ? "translate-x-0" : "translate-x-full"
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
          {classDetailId && (
            <CachedClassDetailPage
              classIdOverride={classDetailId}
              onClose={() => setClassDetailId(null)}
            />
          )}
        </div>
      </div>
    </>
  );
}
