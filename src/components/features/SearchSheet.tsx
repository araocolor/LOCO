"use client";
import { useState, useEffect, useRef } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { GENRES, VENUES } from "@/lib/constants";
import { Globe2, SlidersHorizontal } from "lucide-react";
import {
  DEFAULT_SEARCH_OPTIONS,
  SEARCH_DEFAULTS_STORAGE_KEY,
  buildSearchQuery,
  type SearchOptions,
} from "@/lib/search-defaults";

const STATUS_OPTIONS = [
  { value: "전체", label: "전체" },
  { value: "recruiting", label: "모집중" },
  { value: "closed", label: "마감" },
];

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

function readLocalSearchOptions(): SearchOptions | null {
  if (typeof window === "undefined") return null;
  const raw = localStorage.getItem(SEARCH_DEFAULTS_STORAGE_KEY);
  if (!raw) return null;
  try {
    return normalizeSearchOptions(
      JSON.parse(raw) as SearchOptions | (Omit<SearchOptions, "genre"> & { genre: string })
    );
  } catch {
    return null;
  }
}

function isDefaultOptions(opts: SearchOptions) {
  return (
    opts.region === DEFAULT_SEARCH_OPTIONS.region &&
    opts.status === DEFAULT_SEARCH_OPTIONS.status &&
    opts.venue === DEFAULT_SEARCH_OPTIONS.venue &&
    opts.genre.length === 0
  );
}

export default function SearchSheet() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const isOpen = searchParams.get("search") === "open";

  const [opts, setOpts] = useState<SearchOptions>(DEFAULT_SEARCH_OPTIONS);
  const [isMySetting, setIsMySetting] = useState(false);
  const [dragY, setDragY] = useState(0);
  const touchStartY = useRef(0);

  useEffect(() => {
    async function syncDefaultFromProfileToLocal() {
      const local = readLocalSearchOptions();
      if (local) return;

      const supabase = createClient();
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) return;

      const { data } = await supabase
        .from("profiles")
        .select("default_search_options")
        .eq("id", user.id)
        .maybeSingle();

      const profileOptions = data?.default_search_options;
      if (!profileOptions) return;

      try {
        const normalized = normalizeSearchOptions(profileOptions as SearchOptions);
        localStorage.setItem(SEARCH_DEFAULTS_STORAGE_KEY, JSON.stringify(normalized));
      } catch {}
    }

    void syncDefaultFromProfileToLocal();
  }, []);

  useEffect(() => {
    if (!isOpen) return;
    const stored = readLocalSearchOptions();
    const next = stored ?? DEFAULT_SEARCH_OPTIONS;
    setOpts(next);
    setIsMySetting(!isDefaultOptions(next));
    document.body.style.overflow = "hidden";
    return () => { document.body.style.overflow = ""; };
  }, [isOpen]);

  function onTouchStart(e: React.TouchEvent) {
    touchStartY.current = e.touches[0].clientY;
  }

  function onTouchMove(e: React.TouchEvent) {
    const dy = e.touches[0].clientY - touchStartY.current;
    if (dy > 0) setDragY(dy);
  }

  function onTouchEnd() {
    setDragY(0);
  }

  function close() {
    const params = new URLSearchParams(searchParams.toString());
    params.delete("search");
    const next = params.toString();
    router.replace(next ? `${pathname}?${next}` : pathname);
  }

  async function handleSearch() {
    localStorage.setItem(SEARCH_DEFAULTS_STORAGE_KEY, JSON.stringify(opts));

    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (user) {
      await supabase.from("profiles").update({ default_search_options: opts }).eq("id", user.id);
    }

    const qs = buildSearchQuery(opts);
    close();
    router.push(`/?${qs}`);
  }

  function set(key: "region" | "status" | "venue", value: string) {
    setIsMySetting(true);

    if (key === "region" && value === "전체") {
      setOpts((prev) => ({ ...prev, region: "전체", venue: "전체" }));
    } else if (key === "region" && value !== "전체") {
      setOpts((prev) => ({ ...prev, region: value, venue: "전체" }));
    } else if (key === "venue" && value !== "전체") {
      setOpts((prev) => ({ ...prev, venue: value, region: "없음" }));
    } else {
      setOpts((prev) => ({ ...prev, [key]: value }));
    }

    if (key === "region" && pathname === "/") {
      const params = new URLSearchParams(searchParams.toString());
      if (value === "전체") params.delete("region");
      else params.set("region", value);
      params.delete("venue");
      params.set("search", "open");
      const next = params.toString();
      router.replace(next ? `/?${next}` : "/?search=open");
    }
  }

  function toggleGenre(value: string) {
    setIsMySetting(true);
    const exists = opts.genre.includes(value);
    const nextGenres = exists
      ? opts.genre.filter((g) => g !== value)
      : opts.genre.length >= 3
      ? [...opts.genre.slice(1), value]
      : [...opts.genre, value];

    setOpts((prev) => ({ ...prev, genre: nextGenres }));

    if (pathname === "/") {
      const params = new URLSearchParams(searchParams.toString());
      params.delete("genre");
      nextGenres.forEach((genre) => params.append("genre", genre));
      params.set("search", "open");
      const next = params.toString();
      router.replace(next ? `/?${next}` : "/?search=open");
    }
  }

  function selectAllGenres() {
    setIsMySetting(true);
    setOpts((prev) => ({ ...prev, genre: [] }));

    if (pathname === "/") {
      const params = new URLSearchParams(searchParams.toString());
      params.delete("genre");
      params.set("search", "open");
      const next = params.toString();
      router.replace(next ? `/?${next}` : "/?search=open");
    }
  }

  function selectAllDisplay() {
    setOpts(DEFAULT_SEARCH_OPTIONS);
    setIsMySetting(false);
  }

  function selectMyDisplay() {
    setIsMySetting(true);
  }

  if (!isOpen) return null;

  return (
    <>
      <div className="fixed inset-0 z-[9998]" />
      <div
        className="search-slide-in search-half-panel px-4 pb-36"
        style={{ transform: dragY > 0 ? `translateY(${dragY}px)` : undefined, transition: dragY > 0 ? "none" : "transform 0.2s ease" }}
      >
        <div
          className="flex justify-center pt-3 pb-4"
          onTouchStart={onTouchStart}
          onTouchMove={onTouchMove}
          onTouchEnd={onTouchEnd}
        >
          <div className="w-10 h-1 rounded-full bg-[#d2d2d7]" />
        </div>
        <h1 className="text-lg font-bold mb-6">클래스 찾기</h1>

        {/* 지역 / 클래스구분 / 상태 */}
        <div className="mb-5 grid grid-cols-3 gap-2 items-end text-center">
          <div>
            <label className="field-label">지역선택</label>
            <div>
              <select
                className={`w-full h-11 rounded-xl border px-3 text-sm appearance-auto font-semibold ${opts.venue === "전체" ? "bg-[#fee500] border-[#e6cf00] text-[#1d1d1f]" : "bg-white border-[#d2d2d7] text-gray-400"}`}
                value={opts.region}
                onChange={(e) => set("region", e.target.value)}
              >
                <option value="경기도">경기도</option>
                <option value="인천">인천</option>
                <option value="서울">서울</option>
                <option value="전체">전체</option>
                <option value="대전">대전</option>
                <option value="대구">대구</option>
                <option value="광주">광주</option>
                <option value="부산">부산</option>
                <option value="제주">제주</option>
                <option value="없음">없음</option>
              </select>
            </div>
          </div>
          <div>
            <label className="field-label">라틴바</label>
            <div>
              <select
                className={`w-full h-11 rounded-xl border px-3 text-sm appearance-auto ${opts.venue !== "전체" ? "bg-[#fee500] border-[#e6cf00] text-[#1d1d1f] font-semibold" : "bg-white border-[#d2d2d7] text-[#1d1d1f]"}`}
                value={opts.venue}
                onChange={(e) => set("venue", e.target.value)}
              >
                {VENUES.map((v) => <option key={v.value} value={v.value}>{v.label}</option>)}
              </select>
            </div>
          </div>
          <div>
            <label className="field-label">상태</label>
            <div>
              <select
                className="w-full h-11 rounded-xl border border-[#d2d2d7] bg-white px-3 text-sm text-[#1d1d1f] appearance-auto"
                value={opts.status}
                onChange={(e) => set("status", e.target.value)}
              >
                {STATUS_OPTIONS.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}
              </select>
            </div>
          </div>
        </div>

        {/* 장르 */}
        <div className="mb-5">
          <label className="field-label">장르</label>
          <div className="flex gap-2 flex-wrap">
            <button
              type="button"
              onClick={selectAllGenres}
              className={`chip ${opts.genre.length === 0 ? "active" : ""}`}
            >
              전체
            </button>
            {GENRES.map((g) => (
              <button
                key={g.value}
                type="button"
                onClick={() => toggleGenre(g.value)}
                className={`chip ${opts.genre.includes(g.value) ? "active" : ""}`}
              >
                {g.label}
              </button>
            ))}
          </div>
        </div>

        {/* 표시 방식 */}
        <div className="mb-1">
          <label className="field-label">표시 방식</label>
          <div className="flex gap-2 flex-wrap">
            <button
              type="button"
              onClick={selectAllDisplay}
              className={`chip ${!isMySetting ? "active" : ""}`}
            >
              <span className="inline-flex items-center gap-1.5">
                <Globe2 size={14} />
                전체표시
              </span>
            </button>
            <button
              type="button"
              onClick={selectMyDisplay}
              className={`chip ${isMySetting ? "active" : ""}`}
            >
              <span className="inline-flex items-center gap-1.5">
                <SlidersHorizontal size={14} />
                내설정표시
              </span>
            </button>
          </div>
        </div>
      </div>

      {/* 하단 고정 영역 */}
      <div className="fixed bottom-0 left-0 right-0 z-[10000] bg-white border-t border-[#e5e7eb] px-4 pt-3 pb-4">
        {/* 검색하기 */}
        <div className="flex gap-2 mb-2">
          <button
            type="button"
            onClick={() => { router.push("/classes/new"); }}
            className="flex-1 h-11 rounded-xl border border-gray-300 text-gray-700 font-semibold text-sm"
          >
            클래스등록
          </button>
          <button
            type="button"
            onClick={close}
            className="flex-1 h-11 rounded-xl border border-gray-300 text-gray-700 font-semibold text-sm"
          >
            닫기
          </button>
          <button
            type="button"
            onClick={handleSearch}
            className="flex-1 h-11 rounded-xl bg-[#FEE500] text-gray-900 font-semibold text-sm"
          >
            확인
          </button>
        </div>
      </div>
    </>
  );
}
