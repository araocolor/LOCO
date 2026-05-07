"use client";

import { useEffect, useMemo, useRef, useState } from "react";
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
const HOME_RESULTS_USER_LOCAL_KEY = "loco_home_results_local_v1:user-default";

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
  const [allClasses, setAllClasses] = useState<ClassWithHost[]>(initialClasses);
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

  async function handleGoHome() {
    try {
      localStorage.removeItem(SEARCH_DEFAULTS_STORAGE_KEY);
      localStorage.removeItem(HOME_RESULTS_USER_LOCAL_KEY);
      const supabase = createClient();
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (user) {
        await supabase
          .from("profiles")
          .update({ default_search_options: null })
          .eq("id", user.id);
      }
    } catch {}
    router.push("/");
    router.refresh();
  }

  useEffect(() => {
    let cancelled = false;

    async function load() {
      // 1. 서버에서 받은 initialClasses가 있으면 즉시 표시, 백그라운드 갱신만
      if (initialClasses.length > 0) {
        warmImages(initialClasses);
        void fetchAndUpdate(cancelled);
        void fetchAndApplyUserDefaults(cancelled);
        return;
      }

      // 2. localStorage 우선
      const localRaw = localStorage.getItem(HOME_RESULTS_LOCAL_KEY);
      if (localRaw) {
        try {
          const cached = JSON.parse(localRaw) as CachedHomeResult;
          const cachedList = cached.data ?? [];
          if (!cancelled) { setAllClasses(cachedList); setLoading(false); }
          warmImages(cachedList);
          void fetchAndUpdate(cancelled);
          void fetchAndApplyUserDefaults(cancelled);
          return;
        } catch {}
      }

      // 3. 캐시 없으면 API 호출
      await fetchAndUpdate(cancelled);
      void fetchAndApplyUserDefaults(cancelled);
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
        const bookmarks =
          Array.isArray(json.bookmarks)
            ? parseBookmarkEntries(JSON.stringify(json.bookmarks))
            : [];
        if (bookmarks.length > 0) {
          localStorage.setItem("loco_bookmark_ids_v1", JSON.stringify(bookmarks));
          return;
        }
        const ids: string[] = json.ids ?? [];
        const now = new Date().toISOString();
        localStorage.setItem(
          "loco_bookmark_ids_v1",
          JSON.stringify(ids.map((id) => ({ id, created_at: now })))
        );
      } catch {}
    }

    async function fetchAndApplyUserDefaults(cancelled: boolean) {
      try {
        const raw = localStorage.getItem(SEARCH_DEFAULTS_STORAGE_KEY);
        if (!raw) return;

        const opts = normalizeSearchOptions(
          JSON.parse(raw) as SearchOptions | (Omit<SearchOptions, "genre"> & { genre: string })
        );
        if (isDefaultOptions(opts)) return;

        const qs = buildSearchQuery(opts);
        const res = await fetch(`/api/classes/search?page=0${qs ? `&${qs}` : ""}`);
        if (!res.ok) return;

        const json = await res.json();
        if (json.error) return;

        const filteredTopTen = ((json.data ?? []) as ClassWithHost[]).slice(0, 10);
        if (filteredTopTen.length === 0) return;

        localStorage.setItem(
          HOME_RESULTS_USER_LOCAL_KEY,
          JSON.stringify({ data: filteredTopTen, count: filteredTopTen.length } satisfies CachedHomeResult)
        );

        if (!cancelled) {
          setAllClasses(filteredTopTen);
          setLoading(false);
        }
        warmImages(filteredTopTen);
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
      {loading && (
        <div className="fixed inset-0 z-40 flex items-center justify-center">
          <div className="w-10 h-10 border-4 border-[#FEE500] border-t-transparent rounded-full animate-spin" />
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
