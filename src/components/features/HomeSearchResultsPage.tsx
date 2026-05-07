"use client";

import { useEffect, useMemo, useRef, useState, useCallback } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import ClassCard, { ClassWithHost } from "@/components/class/ClassCard";
import { createClient } from "@/lib/supabase/client";
import {
  DEFAULT_SEARCH_OPTIONS,
  SEARCH_DEFAULTS_STORAGE_KEY,
  buildSearchQuery,
  type SearchOptions,
} from "@/lib/search-defaults";
import { parseBookmarkEntries } from "@/lib/bookmarks/local";

const HOME_RESULTS_LOCAL_KEY = "loco_home_results_local_v1";
const PAGE_SIZE = 10;

interface CachedHomeResult {
  data: ClassWithHost[];
  count: number;
}

function normalizeSearchOptions(
  value: SearchOptions | (Omit<SearchOptions, "genre"> & { genre: string })
): SearchOptions {
  return {
    ...value,
    genre: Array.isArray(value.genre)
      ? value.genre
      : value.genre && value.genre !== "전체"
      ? [value.genre]
      : [],
  };
}

function isDefaultOptions(opts: SearchOptions) {
  return (
    opts.region === DEFAULT_SEARCH_OPTIONS.region &&
    opts.status === DEFAULT_SEARCH_OPTIONS.status &&
    opts.venue === DEFAULT_SEARCH_OPTIONS.venue &&
    opts.genre.length === 0
  );
}

interface Props {
  initialClasses?: ClassWithHost[];
}

export default function HomeSearchResultsPage({ initialClasses = [] }: Props) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const region = searchParams.get("region") ?? "전체";
  const genres = searchParams.getAll("genre");

  const [loading, setLoading] = useState(initialClasses.length === 0);
  const [classes, setClasses] = useState<ClassWithHost[]>(initialClasses);
  const [page, setPage] = useState(0);
  const [hasMore, setHasMore] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);

  const warmedImageUrlsRef = useRef<Set<string>>(new Set());
  const bottomRef = useRef<HTMLDivElement>(null);

  const filteredClasses = useMemo(() => {
    let filtered = region === "전체" ? classes : classes.filter((item) => item.region === region);
    if (genres.length > 0) {
      const genreSet = new Set(genres);
      filtered = filtered.filter((item) => item.genres?.some((g) => genreSet.has(g)));
    }
    return filtered;
  }, [classes, region, genres]);

  function warmImages(items: ClassWithHost[]) {
    items.forEach((item) => {
      const url = item.images?.[0]?.card_url;
      if (!url || warmedImageUrlsRef.current.has(url)) return;
      warmedImageUrlsRef.current.add(url);
      const img = new window.Image();
      img.decoding = "async";
      img.src = url;
    });
  }

  async function handleGoHome() {
    try {
      localStorage.removeItem(SEARCH_DEFAULTS_STORAGE_KEY);
      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        await supabase.from("profiles").update({ default_search_options: null }).eq("id", user.id);
      }
    } catch {}
    router.push("/");
    router.refresh();
  }

  // 다음 페이지 로드
  const loadMore = useCallback(async () => {
    if (loadingMore || !hasMore) return;
    setLoadingMore(true);
    try {
      const nextPage = page + 1;
      const res = await fetch(`/api/classes/search?page=${nextPage}&limit=${PAGE_SIZE}`);
      const json = await res.json();
      if (json.error) return;
      const incoming = (json.data ?? []) as ClassWithHost[];
      setClasses((prev) => [...prev, ...incoming]);
      setPage(nextPage);
      setHasMore(json.hasMore ?? false);
      warmImages(incoming);
    } catch {}
    finally {
      setLoadingMore(false);
    }
  }, [loadingMore, hasMore, page]);

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
      // 1. 서버에서 받은 initialClasses가 있으면 즉시 표시
      if (initialClasses.length > 0) {
        warmImages(initialClasses);
        void fetchAndUpdate(cancelled);
        void fetchBookmarkIds();
        return;
      }

      // 2. localStorage 우선
      const localRaw = localStorage.getItem(HOME_RESULTS_LOCAL_KEY);
      if (localRaw) {
        try {
          const cached = JSON.parse(localRaw) as CachedHomeResult;
          const cachedList = cached.data ?? [];
          if (!cancelled) { setClasses(cachedList); setLoading(false); }
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
        const res = await fetch(`/api/classes/search?page=0&limit=${PAGE_SIZE}`);
        const json = await res.json();
        if (json.error) { if (!cancelled) setLoading(false); return; }
        const incoming = (json.data ?? []) as ClassWithHost[];
        if (!cancelled) { setClasses(incoming); setLoading(false); setPage(0); setHasMore(json.hasMore ?? false); }
        localStorage.setItem(HOME_RESULTS_LOCAL_KEY, JSON.stringify({ data: incoming, count: json.count ?? 0 } satisfies CachedHomeResult));
        warmImages(incoming);

        // 다음 페이지 이미지 미리 다운로드
        if (json.hasMore) {
          fetch(`/api/classes/search?page=1&limit=${PAGE_SIZE}`)
            .then((r) => r.json())
            .then((j) => { if (j.data) warmImages(j.data); })
            .catch(() => {});
        }
      } catch {
        if (!cancelled) setLoading(false);
      }
    }

    async function fetchBookmarkIds() {
      try {
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
        const now = new Date().toISOString();
        localStorage.setItem("loco_bookmark_ids_v1", JSON.stringify(ids.map((id) => ({ id, created_at: now }))));
      } catch {}
    }

    void load();
    return () => { cancelled = true; };
  }, []);

  return (
    <div className="max-w-xl mx-auto bg-white relative">
      {loading && (
        <div className="fixed inset-0 z-40 flex items-center justify-center">
          <div className="w-10 h-10 border-4 border-[#FEE500] border-t-transparent rounded-full animate-spin" />
        </div>
      )}

      <div className="flex flex-col pb-6">
        {filteredClasses.map((c, idx) => (
          <ClassCard key={`${c.id}-${idx}`} classData={c} />
        ))}
      </div>

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
