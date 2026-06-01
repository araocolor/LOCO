"use client";

import { useEffect, useMemo, useRef, useState, useCallback } from "react";
import Image from "next/image";
import { useRouter, useSearchParams } from "next/navigation";
import ClassCard, { type ClassWithHost } from "@/components/class/ClassCard";
import ClassMoreMenu from "@/components/class/ClassMoreMenu";
import { createClient } from "@/lib/supabase/client";
import {
  PREVIOUS_YEAR_PERIOD_VALUE,
  SEARCH_DEFAULTS_STORAGE_KEY,
  getSearchYear,
} from "@/lib/search-defaults";
import { parseBookmarkEntries } from "@/lib/bookmarks/local";

const HOME_RESULTS_LOCAL_KEY = "loco_home_results_local_v1";
const PAGE_SIZE = 12;
const GRID_FILL_COLORS = ["#E84040", "#B8D44A", "#F5A623", "#5BB8E8"] as const;

interface CachedHomeResult {
  data: ClassWithHost[];
  count: number;
}

function getLastLoadedPage(itemCount: number) {
  return Math.max(0, Math.ceil(itemCount / PAGE_SIZE) - 1);
}

function expandCategory(value: string) {
  if (value === "party") return ["party", "event"];
  if (value === "level_class") return ["level_class", "regular"];
  if (value === "private_training") return ["private_training", "training"];
  if (value === "choreo_class") return ["choreo_class", "choreography"];
  if (value === "etc") return ["etc", "other"];
  return [value];
}

function isInPeriod(datetime: string, period: string, year = getSearchYear()) {
  if (period === "전체") return true;
  const date = new Date(datetime);
  if (period === PREVIOUS_YEAR_PERIOD_VALUE) return date.getFullYear() === year - 1;
  const month = Number(period);
  if (!Number.isInteger(month) || month < 1 || month > 12) return true;
  return date.getFullYear() === year && date.getMonth() + 1 === month;
}

interface Props {
  initialClasses?: ClassWithHost[];
  regionOverride?: string | null;
  periodOverride?: string | null;
  genreOverride?: string[];
  classTypeOverride?: string[];
  onClassSelect?: (classId: string) => void;
  onResetFilters?: () => void;
  viewMode?: "grid" | "card";
}

const EMPTY_CLASSES: ClassWithHost[] = [];

export default function HomeSearchResultsPage({
  initialClasses,
  regionOverride,
  periodOverride,
  genreOverride,
  classTypeOverride,
  onClassSelect,
  onResetFilters,
  viewMode = "grid",
}: Props) {
  const stableInitial = initialClasses ?? EMPTY_CLASSES;
  const router = useRouter();
  const searchParams = useSearchParams();
  const region = regionOverride ?? searchParams.get("region") ?? "전체";
  const period = periodOverride ?? searchParams.get("period") ?? "전체";
  const genres = genreOverride ?? searchParams.getAll("genre");
  const classTypes = classTypeOverride ?? searchParams.getAll("class_type");
  const isBookmarkMode = searchParams.get("bookmark") === "true";

  const [loading, setLoading] = useState(stableInitial.length === 0);
  const [classes, setClasses] = useState<ClassWithHost[]>(stableInitial);
  const [page, setPage] = useState(getLastLoadedPage(stableInitial.length));
  const [hasMore, setHasMore] = useState(stableInitial.length >= PAGE_SIZE);
  const [loadingMore, setLoadingMore] = useState(false);
  const [bookmarkVersion, setBookmarkVersion] = useState(0);
  const [gridFillSeed] = useState(() => Math.floor(Math.random() * GRID_FILL_COLORS.length));

  const filterParam = useMemo(() => {
    const params = new URLSearchParams();
    if (region && region !== "전체") params.set("region", region);
    if (period && period !== "전체") params.set("period", period);
    genres.forEach((genre) => params.append("genre", genre));
    classTypes.forEach((classType) => params.append("class_type", classType));
    const qs = params.toString();
    return qs ? `&${qs}` : "";
  }, [region, period, genres, classTypes]);
  const homeCacheKey = `${HOME_RESULTS_LOCAL_KEY}:${filterParam || "all"}`;

  const warmedImageUrlsRef = useRef<Set<string>>(new Set());
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!isBookmarkMode) return;
    const handler = () => setBookmarkVersion((v) => v + 1);
    window.addEventListener("bookmarkChanged", handler);
    return () => window.removeEventListener("bookmarkChanged", handler);
  }, [isBookmarkMode]);

  useEffect(() => {
    const handler = (e: Event) => {
      const deletedId = (e as CustomEvent<string>).detail;
      if (deletedId) setClasses((prev) => prev.filter((c) => c.id !== deletedId));
    };
    window.addEventListener("class-deleted", handler);
    return () => window.removeEventListener("class-deleted", handler);
  }, []);

  const filteredClasses = useMemo(() => {
    if (isBookmarkMode) {
      void bookmarkVersion;
      try {
        const raw = localStorage.getItem("loco_bookmark_ids_v1");
        const bookmarkIds = new Set<string>(raw ? JSON.parse(raw).map((e: { id: string }) => e.id) : []);
        return classes.filter((item) => bookmarkIds.has(item.id));
      } catch {
        return [];
      }
    }
    let filtered = region === "전체" ? classes : classes.filter((item) => item.region === region);
    if (period !== "전체") {
      filtered = filtered.filter((item) => isInPeriod(item.datetime, period));
    }
    if (genres.length > 0) {
      const genreSet = new Set(genres);
      filtered = filtered.filter((item) => item.genres?.some((g) => genreSet.has(g)));
    }
    if (classTypes.length > 0) {
      const typeSet = new Set(classTypes.flatMap(expandCategory));
      filtered = filtered.filter((item) => item.category && typeSet.has(item.category));
    }
    return filtered;
  }, [classes, region, period, genres, classTypes, isBookmarkMode, bookmarkVersion]);

  const fillerCells = useMemo(() => {
    const remain = filteredClasses.length % 3;
    const count = remain === 0 ? 0 : 3 - remain;
    return Array.from({ length: count }, (_, idx) => {
      const color = GRID_FILL_COLORS[(gridFillSeed + filteredClasses.length + idx) % GRID_FILL_COLORS.length];
      return { key: `filler-${filteredClasses.length}-${idx}`, color };
    });
  }, [filteredClasses.length, gridFillSeed]);

  const warmImages = useCallback((items: ClassWithHost[]) => {
    items.forEach((item) => {
      const url = item.images?.[0]?.card_url;
      if (!url || warmedImageUrlsRef.current.has(url)) return;
      warmedImageUrlsRef.current.add(url);
      const img = new window.Image();
      img.decoding = "async";
      img.src = url;
    });
  }, []);

  const writeHomeCache = useCallback((items: ClassWithHost[], count: number) => {
    try {
      localStorage.setItem(
        homeCacheKey,
        JSON.stringify({ data: items, count } satisfies CachedHomeResult)
      );
    } catch {}
  }, [homeCacheKey]);

  const warmPageImages = useCallback((pageNumber: number) => {
    fetch(`/api/classes/search?page=${pageNumber}&limit=${PAGE_SIZE}${filterParam}`)
      .then((r) => r.json())
      .then((j) => { if (j.data) warmImages(j.data); })
      .catch(() => {});
  }, [filterParam, warmImages]);

  async function handleGoHome() {
    try {
      localStorage.removeItem(SEARCH_DEFAULTS_STORAGE_KEY);
      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        await supabase.from("profiles").update({ default_search_options: null }).eq("id", user.id);
      }
    } catch {}
    onResetFilters?.();
    window.history.replaceState(window.history.state, "", "/");
  }

  // 다음 페이지 로드
  const loadMore = useCallback(async () => {
    if (loadingMore || !hasMore) return;
    setLoadingMore(true);
    try {
      const nextPage = page + 1;
      const res = await fetch(`/api/classes/search?page=${nextPage}&limit=${PAGE_SIZE}${filterParam}`);
      const json = await res.json();
      if (json.error) return;
      const incoming = (json.data ?? []) as ClassWithHost[];
      if (incoming.length === 0) {
        setHasMore(false);
        return;
      }
      setClasses((prev) => {
        const seen = new Set(prev.map((item) => item.id));
        const merged = [...prev, ...incoming.filter((item) => !seen.has(item.id))];
        writeHomeCache(merged, json.count ?? merged.length);
        return merged;
      });
      setPage(nextPage);
      setHasMore(json.hasMore ?? false);
      warmImages(incoming);
      if (json.hasMore) warmPageImages(nextPage + 1);
    } catch {}
    finally {
      setLoadingMore(false);
    }
  }, [loadingMore, hasMore, page, filterParam, warmImages, warmPageImages, writeHomeCache]);

  // 스크롤 끝 감지
  useEffect(() => {
    const el = bottomRef.current;
    if (!el) return;
    const observer = new IntersectionObserver(
      (entries) => { if (entries[0].isIntersecting) loadMore(); },
      { threshold: 0.1 }
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, [loadMore]);

  // 초기 로드
  useEffect(() => {
    let cancelled = false;

    async function load() {
      // 1. 서버에서 받은 stableInitial가 있으면 즉시 표시
      if (stableInitial.length > 0) {
        warmImages(stableInitial);
        void fetchAndUpdate(cancelled);
        void fetchBookmarkIds();
        return;
      }

      // 2. localStorage 우선
      const localRaw = localStorage.getItem(homeCacheKey);
      if (localRaw) {
        try {
          const cached = JSON.parse(localRaw) as CachedHomeResult;
          const cachedList = cached.data ?? [];
          if (!cancelled) {
            setClasses(cachedList);
            setPage(getLastLoadedPage(cachedList.length));
            setHasMore((cached.count ?? cachedList.length) > cachedList.length);
            setLoading(false);
          }
          warmImages(cachedList);
          void fetchAndUpdate(cancelled);
          void fetchBookmarkIds();
          return;
        } catch {}
      }

      // 3. 캐시 없으면 API 호출
      await fetchAndUpdate(cancelled);
      void fetchBookmarkIds();
    }

    async function fetchAndUpdate(cancelled: boolean) {
      try {
        const res = await fetch(`/api/classes/search?page=0&limit=${PAGE_SIZE}${filterParam}`);
        const json = await res.json();
        if (json.error) { if (!cancelled) setLoading(false); return; }
        const incoming = (json.data ?? []) as ClassWithHost[];
        if (!cancelled) {
          setClasses((prev) => {
            const seen = new Set(incoming.map((item) => item.id));
            const merged = [...incoming, ...prev.filter((item) => !seen.has(item.id))];
            const count = json.count ?? merged.length;
            writeHomeCache(merged, count);
            setPage(getLastLoadedPage(merged.length));
            setHasMore(count > merged.length);
            return merged;
          });
          setLoading(false);
        } else {
          writeHomeCache(incoming, json.count ?? incoming.length);
        }
        warmImages(incoming);

        // 다음 페이지 이미지 미리 다운로드
        if (json.hasMore) {
          warmPageImages(1);
        }
      } catch {
        if (!cancelled) setLoading(false);
      }
    }

    async function fetchBookmarkIds() {
      try {
        if (localStorage.getItem("loco_bookmark_ids_v1")) return;
        const res = await fetch("/api/bookmarks/ids");
        if (!res.ok) return;
        const json = await res.json();
        const bookmarks = Array.isArray(json.bookmarks)
          ? parseBookmarkEntries(JSON.stringify(json.bookmarks))
          : [];
        if (bookmarks.length > 0) {
          localStorage.setItem("loco_bookmark_ids_v1", JSON.stringify(bookmarks));
          return;
        }
        const ids: string[] = json.ids ?? [];
        if (ids.length === 0) return;
        const now = new Date().toISOString();
        localStorage.setItem("loco_bookmark_ids_v1", JSON.stringify(ids.map((id) => ({ id, created_at: now }))));
      } catch {}
    }

    void load();
    return () => { cancelled = true; };
  }, [filterParam, homeCacheKey, stableInitial, warmImages, warmPageImages, writeHomeCache]);

  return (
    <div className="bg-white relative">
      {loading && (
        <div className="fixed inset-0 z-40 flex items-center justify-center">
          <div className="w-10 h-10 border-4 border-[#FEE500] border-t-transparent rounded-full animate-spin" />
        </div>
      )}

      {viewMode === "card" ? (
        <div className="space-y-0">
          {filteredClasses.map((c, idx) => (
            <ClassCard key={`${c.id}-${idx}`} classData={c} priorityImage={idx < 2} onClassSelect={onClassSelect} />
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-3 gap-[1px] bg-gray-200">
          {filteredClasses.map((c, idx) => (
            <div
              key={`${c.id}-${idx}`}
              onClick={() => onClassSelect ? onClassSelect(c.id) : router.push(`/classes/${c.id}`)}
              className="aspect-square bg-gray-100 relative overflow-hidden cursor-pointer"
            >
              {c.images?.[0]?.card_url ? (
                <Image
                  src={c.images[0].card_url}
                  alt={c.title}
                  fill
                  sizes="(max-width: 640px) 33vw, 213px"
                  className="object-cover"
                  priority={idx < 6}
                  unoptimized
                />
              ) : (
                <div className="w-full h-full flex items-center justify-center bg-gray-100">
                  <span className="text-gray-300 text-xs">없음</span>
                </div>
              )}
              {c.status !== "recruiting" && (
                <div className="absolute top-1.5 left-1.5 w-3 h-3 rounded-full bg-black" />
              )}
              <div className="absolute top-0 right-0 z-10" onClick={(e) => e.stopPropagation()}>
                <ClassMoreMenu
                  classId={c.id}
                  hostId={c.host_id}
                  hostNickname={c.host?.nickname}
                  hostImageUrl={c.host?.profile_image_url}
                  status={c.status}
                  buttonClassName="flex items-center justify-center w-8 h-8 text-white drop-shadow-md"
                  onDetailView={() => onClassSelect ? onClassSelect(c.id) : router.push(`/classes/${c.id}`)}
                />
              </div>
              {isBookmarkMode && (
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  width="16"
                  height="16"
                  viewBox="0 0 24 24"
                  fill="white"
                  stroke="white"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  className="absolute top-1.5 right-1.5"
                >
                  <polygon points="19 21 12 16 5 21 5 3 19 3" />
                </svg>
              )}
            </div>
          ))}
          {fillerCells.map((cell) => (
            <div
              key={cell.key}
              aria-hidden="true"
              className="aspect-square"
              style={{ backgroundColor: cell.color }}
            />
          ))}
        </div>
      )}

      {/* 스크롤 끝 감지 영역 */}
      <div ref={bottomRef} className="h-10" />

      {loadingMore && (
        <div className="flex justify-center py-4">
          <div className="w-6 h-6 border-2 border-[#FEE500] border-t-transparent rounded-full animate-spin" />
        </div>
      )}

      {!loading && filteredClasses.length === 0 && (
        <div className="text-center py-16 text-gray-400 text-sm px-4">
          <p className="text-3xl mb-3">🔍</p>
          <p>표시할 클래스가 없습니다.</p>
          <button
            type="button"
            onClick={handleGoHome}
            className="inline-block mt-4 px-6 py-2 rounded-xl bg-[#fee500] text-gray-900 font-semibold text-sm"
          >
            홈으로
          </button>
        </div>
      )}
    </div>
  );
}
