"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import ClassCard, { ClassWithHost } from "@/components/class/ClassCard";

const HOME_RESULTS_CACHE_KEY = "loco_home_results_cache_v3:all";
const HOME_RESULTS_LOCAL_KEY = "loco_home_results_local_v1";

interface CachedHomeResult {
  data: ClassWithHost[];
  count: number;
}

export default function HomeSearchResultsPage() {
  const searchParams = useSearchParams();
  const region = searchParams.get("region") ?? "전체";
  const genres = searchParams.getAll("genre");
  const [loading, setLoading] = useState(true);
  const [isFirstVisit, setIsFirstVisit] = useState(false);
  const [allClasses, setAllClasses] = useState<ClassWithHost[]>([]);
  const warmedImageUrlsRef = useRef<Set<string>>(new Set());
  const orderedTopTen = useMemo(() => {
    let filtered =
      region === "전체" ? allClasses : allClasses.filter((item) => item.region === region);
    if (genres.length > 0) {
      const genreSet = new Set(genres);
      filtered = filtered.filter((item) => item.genres?.some((g) => genreSet.has(g)));
    }
    return filtered.slice(0, 10);
  }, [allClasses, region, genres]);

  useEffect(() => {
    setIsFirstVisit(!localStorage.getItem(HOME_RESULTS_LOCAL_KEY));
  }, []);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      // 1. sessionStorage 우선
      const sessionRaw = sessionStorage.getItem(HOME_RESULTS_CACHE_KEY);
      if (sessionRaw) {
        try {
          const cached = JSON.parse(sessionRaw) as CachedHomeResult;
          const cachedList = cached.data ?? [];
          if (!cancelled) { setAllClasses(cachedList); setLoading(false); }
          warmImages(cachedList);
          // 백그라운드로 최신 데이터 업데이트
          fetchAndUpdate(cancelled);
          return;
        } catch {}
      }

      // 2. localStorage 차선
      const localRaw = localStorage.getItem(HOME_RESULTS_LOCAL_KEY);
      if (localRaw) {
        try {
          const cached = JSON.parse(localRaw) as CachedHomeResult;
          const cachedList = cached.data ?? [];
          if (!cancelled) { setAllClasses(cachedList); setLoading(false); }
          warmImages(cachedList);
          // 백그라운드로 최신 데이터 업데이트
          fetchAndUpdate(cancelled);
          return;
        } catch {}
      }

      // 3. 둘 다 없으면 API 호출
      await fetchAndUpdate(cancelled);
    }

    async function fetchAndUpdate(cancelled: boolean) {
      try {
        const res = await fetch("/api/classes/search?page=0");
        const json = await res.json();
        if (json.error) {
          if (!cancelled) setLoading(false);
          return;
        }
        const incoming = (json.data ?? []) as ClassWithHost[];
        if (!cancelled) { setAllClasses(incoming); setLoading(false); }
        const payload = JSON.stringify({ data: incoming, count: json.count ?? 0 } satisfies CachedHomeResult);
        sessionStorage.setItem(HOME_RESULTS_CACHE_KEY, payload);
        localStorage.setItem(HOME_RESULTS_LOCAL_KEY, payload);
        warmImages(incoming);
        fetchBookmarkIds();
      } catch {
        if (!cancelled) setLoading(false);
      }
    }

    async function fetchBookmarkIds() {
      try {
        const res = await fetch("/api/bookmarks/ids");
        if (!res.ok) return;
        const json = await res.json();
        const ids: string[] = json.ids ?? [];
        localStorage.setItem("loco_bookmark_ids_v1", JSON.stringify(ids));
      } catch {}
    }

    function warmImages(items: ClassWithHost[]) {
      items.forEach((item) => {
        const url = item.images?.[0]?.card_url;
        if (!url) return;
        if (warmedImageUrlsRef.current.has(url)) return;

        warmedImageUrlsRef.current.add(url);
        const img = new window.Image();
        img.decoding = "async";
        img.src = url;
      });
    }

    void load();

    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <div className="max-w-xl mx-auto bg-white relative">
      {loading && isFirstVisit && (
        <div className="fixed inset-0 z-50 bg-white flex flex-col items-center justify-center">
          <div className="w-48 h-2 bg-gray-100 rounded-full overflow-hidden">
            <div className="h-full bg-yellow-400 rounded-full animate-[loading-bar_1.5s_ease-in-out_infinite]" />
          </div>
        </div>
      )}
      <div className="flex flex-col pb-6">
        {orderedTopTen.map((c, idx) => (
          <ClassCard key={`${c.id}-${idx}`} classData={c} />
        ))}
      </div>

      {!loading && orderedTopTen.length === 0 && (
        <div className="text-center py-16 text-gray-400 text-sm px-4">
          <p className="text-3xl mb-3">🔍</p>
          <p>표시할 클래스가 없습니다.</p>
          <a
            href="/"
            className="inline-block mt-4 px-6 py-2 rounded-xl bg-[#fee500] text-gray-900 font-semibold text-sm"
          >
            전체 표시
          </a>
        </div>
      )}

    </div>
  );
}
