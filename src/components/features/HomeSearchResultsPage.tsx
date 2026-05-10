"use client";

import { useEffect, useMemo, useRef, useState, useCallback } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import ClassCard, { ClassWithHost } from "@/components/class/ClassCard";
import { createClient } from "@/lib/supabase/client";
import {
  SEARCH_DEFAULTS_STORAGE_KEY,
} from "@/lib/search-defaults";
import { parseBookmarkEntries } from "@/lib/bookmarks/local";

const HOME_RESULTS_LOCAL_KEY = "loco_home_results_local_v1";
const PAGE_SIZE = 10;

interface CachedHomeResult {
  data: ClassWithHost[];
  count: number;
}

function getLastLoadedPage(itemCount: number) {
  return Math.max(0, Math.ceil(itemCount / PAGE_SIZE) - 1);
}

interface Props {
  initialClasses?: ClassWithHost[];
}

export default function HomeSearchResultsPage({ initialClasses = [] }: Props) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const region = searchParams.get("region") ?? "전체";
  const genres = searchParams.getAll("genre");
  const isBookmarkMode = searchParams.get("bookmark") === "true";

  const [loading, setLoading] = useState(initialClasses.length === 0);
  const [classes, setClasses] = useState<ClassWithHost[]>(initialClasses);
  const [page, setPage] = useState(getLastLoadedPage(initialClasses.length));
  const [hasMore, setHasMore] = useState(initialClasses.length >= PAGE_SIZE);
  const [loadingMore, setLoadingMore] = useState(false);
  const [bookmarkVersion, setBookmarkVersion] = useState(0);

  const warmedImageUrlsRef = useRef<Set<string>>(new Set());
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!isBookmarkMode) return;
    const handler = () => setBookmarkVersion((v) => v + 1);
    window.addEventListener("bookmarkChanged", handler);
    return () => window.removeEventListener("bookmarkChanged", handler);
  }, [isBookmarkMode]);

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
    if (genres.length > 0) {
      const genreSet = new Set(genres);
      filtered = filtered.filter((item) => item.genres?.some((g) => genreSet.has(g)));
    }
    return filtered;
  }, [classes, region, genres, isBookmarkMode, bookmarkVersion]);

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
        HOME_RESULTS_LOCAL_KEY,
        JSON.stringify({ data: items, count } satisfies CachedHomeResult)
      );
    } catch {}
  }, []);

  const warmPageImages = useCallback((pageNumber: number) => {
    fetch(`/api/classes/search?page=${pageNumber}&limit=${PAGE_SIZE}`)
      .then((r) => r.json())
      .then((j) => { if (j.data) warmImages(j.data); })
      .catch(() => {});
  }, [warmImages]);

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
  }, [loadingMore, hasMore, page, warmImages, warmPageImages, writeHomeCache]);

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
        const res = await fetch(`/api/classes/search?page=0&limit=${PAGE_SIZE}`);
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
  }, [initialClasses, warmImages, warmPageImages, writeHomeCache]);

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
