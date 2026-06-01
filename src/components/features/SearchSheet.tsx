"use client";
import { useState, useEffect, useRef } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { GENRES } from "@/lib/constants";
import { LockOpen, Lock } from "lucide-react";
import {
  DEFAULT_SEARCH_OPTIONS,
  SEARCH_DEFAULTS_STORAGE_KEY,
  getPeriodOptions,
  CLASS_TYPES,
  type SearchOptions,
} from "@/lib/search-defaults";
import SearchKeywordTab from "@/components/features/SearchKeywordTab";

type SheetTab = "keyword" | "filter";

type StoredSearchOptions = Partial<Omit<SearchOptions, "genre" | "class_type">> & {
  status?: string;
  genre?: string | string[];
  class_type?: string[];
};

function normalizeSearchOptions(
  value: StoredSearchOptions
): SearchOptions {
  return {
    region: value.region === "없음" ? "전체" : value.region ?? "전체",
    period: value.period ?? "전체",
    venue: value.venue ?? "전체",
    genre: Array.isArray(value.genre)
      ? value.genre
      : value.genre && value.genre !== "전체"
      ? [value.genre]
      : [],
    class_type: Array.isArray(value.class_type) ? value.class_type : [],
  };
}

function readLocalSearchOptions(): SearchOptions | null {
  if (typeof window === "undefined") return null;
  const raw = localStorage.getItem(SEARCH_DEFAULTS_STORAGE_KEY);
  if (!raw) return null;
  try {
    return normalizeSearchOptions(JSON.parse(raw) as StoredSearchOptions);
  } catch {
    return null;
  }
}

export default function SearchSheet() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [isOpen, setIsOpen] = useState(false);
  const [sheetTab, setSheetTab] = useState<SheetTab>("filter");
  const [opts, setOpts] = useState<SearchOptions>(DEFAULT_SEARCH_OPTIONS);
  const [isMySetting, setIsMySetting] = useState(false);
  const [dragY, setDragY] = useState(0);
  const touchStartY = useRef(0);
  const periodOptions = getPeriodOptions();

  useEffect(() => {
    function handleOpen() {
      setIsOpen(true);
      const stored = readLocalSearchOptions();
      setOpts(stored ?? DEFAULT_SEARCH_OPTIONS);
      setIsMySetting(false);
      document.body.style.overflow = "hidden";
    }
    window.addEventListener("open-search-sheet", handleOpen);
    return () => window.removeEventListener("open-search-sheet", handleOpen);
  }, []);

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
    setIsOpen(false);
    setSheetTab("filter");
    document.body.style.overflow = "";
    const params = new URLSearchParams(searchParams.toString());
    params.delete("search");
    const next = params.toString();
    window.history.replaceState(window.history.state, "", next ? `${pathname}?${next}` : pathname);
    window.dispatchEvent(new CustomEvent("close-search-sheet"));
  }

  function set(key: "region" | "period" | "venue", value: string) {
    let next: SearchOptions;
    if (key === "region" && value === "전체") {
      next = { ...opts, region: "전체", venue: "전체" };
    } else if (key === "region" && value !== "전체") {
      next = { ...opts, region: value, venue: "전체" };
    } else if (key === "venue" && value !== "전체") {
      next = { ...opts, venue: value, region: "전체" };
    } else {
      next = { ...opts, [key]: value };
    }
    setOpts(next);
    localStorage.setItem(SEARCH_DEFAULTS_STORAGE_KEY, JSON.stringify(next));
    window.dispatchEvent(new Event("search-filter-change"));

    if (key === "region" && pathname === "/") {
      const params = new URLSearchParams(searchParams.toString());
      params.delete("tab");
      if (value === "전체") params.delete("region");
      else params.set("region", value);
      params.delete("venue");
      params.set("search", "open");
      const next = params.toString();
      router.replace(next ? `/?${next}` : "/?search=open");
    }

    if (key === "period" && pathname === "/") {
      const params = new URLSearchParams(searchParams.toString());
      params.delete("tab");
      if (value === "전체") params.delete("period");
      else params.set("period", value);
      params.set("search", "open");
      const next = params.toString();
      router.replace(next ? `/?${next}` : "/?search=open");
    }
  }

  function toggleGenre(value: string) {
    const nextGenres = opts.genre.includes(value) ? [] : [value];
    const next = { ...opts, genre: nextGenres };
    setOpts(next);
    localStorage.setItem(SEARCH_DEFAULTS_STORAGE_KEY, JSON.stringify(next));
    window.dispatchEvent(new Event("search-filter-change"));

    if (pathname === "/") {
      const params = new URLSearchParams(searchParams.toString());
      params.delete("tab");
      params.delete("genre");
      nextGenres.forEach((genre) => params.append("genre", genre));
      params.set("search", "open");
      const next = params.toString();
      router.replace(next ? `/?${next}` : "/?search=open");
    }
  }

  function selectAllGenres() {
    const next = { ...opts, genre: [] as string[] };
    setOpts(next);
    localStorage.setItem(SEARCH_DEFAULTS_STORAGE_KEY, JSON.stringify(next));
    window.dispatchEvent(new Event("search-filter-change"));

    if (pathname === "/") {
      const params = new URLSearchParams(searchParams.toString());
      params.delete("tab");
      params.delete("genre");
      params.set("search", "open");
      const next = params.toString();
      router.replace(next ? `/?${next}` : "/?search=open");
    }
  }

  function toggleClassType(value: string) {
    const nextTypes = opts.class_type.includes(value) ? [] : [value];
    const next = { ...opts, class_type: nextTypes };
    setOpts(next);
    localStorage.setItem(SEARCH_DEFAULTS_STORAGE_KEY, JSON.stringify(next));
    window.dispatchEvent(new Event("search-filter-change"));

    if (pathname === "/") {
      const params = new URLSearchParams(searchParams.toString());
      params.delete("tab");
      params.delete("class_type");
      nextTypes.forEach((t) => params.append("class_type", t));
      params.set("search", "open");
      const qs = params.toString();
      router.replace(qs ? `/?${qs}` : "/?search=open");
    }
  }

  function selectAllClassTypes() {
    const next = { ...opts, class_type: [] as string[] };
    setOpts(next);
    localStorage.setItem(SEARCH_DEFAULTS_STORAGE_KEY, JSON.stringify(next));
    window.dispatchEvent(new Event("search-filter-change"));

    if (pathname === "/") {
      const params = new URLSearchParams(searchParams.toString());
      params.delete("tab");
      params.delete("class_type");
      params.set("search", "open");
      const qs = params.toString();
      router.replace(qs ? `/?${qs}` : "/?search=open");
    }
  }

  function selectAllDisplay() {
    setOpts(DEFAULT_SEARCH_OPTIONS);
    setIsMySetting(false);
  }

  async function selectMyDisplay() {
    setIsMySetting(true);
    localStorage.setItem(SEARCH_DEFAULTS_STORAGE_KEY, JSON.stringify(opts));

    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (user) {
      await supabase.from("profiles").update({ default_search_options: opts }).eq("id", user.id);
    }
  }

  if (!isOpen) return null;

  return (
    <>
      <div className="fixed inset-0 z-[9998]" onClick={close} />
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
        {/* 탭 메뉴 */}
        <div className="flex items-center gap-4 mb-5">
          <button
            type="button"
            onClick={() => setSheetTab("keyword")}
            className={`text-base font-bold pb-1 ${sheetTab === "keyword" ? "text-black border-b-2 border-black" : "text-gray-400"}`}
          >
            검색어
          </button>
          <button
            type="button"
            onClick={() => setSheetTab("filter")}
            className={`text-base font-bold pb-1 ${sheetTab === "filter" ? "text-black border-b-2 border-black" : "text-gray-400"}`}
          >
            클래스찾기
          </button>
          {sheetTab === "filter" && (
            <button
              type="button"
              onClick={() => isMySetting ? selectAllDisplay() : selectMyDisplay()}
              className={`ml-auto ${isMySetting ? "text-black font-bold" : "text-gray-500"}`}
            >
              {isMySetting ? <Lock size={20} strokeWidth={2.5} /> : <LockOpen size={20} />}
            </button>
          )}
        </div>

        {sheetTab === "keyword" && (
          <SearchKeywordTab
            onClose={close}
            onSearch={(kw) => {
              close();
              router.push(`/?keyword=${encodeURIComponent(kw)}`);
            }}
          />
        )}

        {sheetTab === "filter" && <>
        {/* 지역 / 기간 */}
        <div className="mx-auto mb-5 grid w-[80%] grid-cols-2 gap-2 items-end text-center">
          <div>
            <label className="field-label">지역선택</label>
            <div>
              <select
                disabled={isMySetting}
                className={`w-full h-10 rounded-full border px-4 text-sm appearance-auto font-semibold text-center ${isMySetting ? "opacity-50" : ""} ${opts.venue === "전체" ? "bg-[#fee500] border-[#e6cf00] text-[#1d1d1f]" : "bg-white border-[#d2d2d7] text-gray-400"}`}
                value={opts.region}
                onChange={(e) => set("region", e.target.value)}
              >
                <option value="전체">전체</option>
                <option value="경기도">경기도</option>
                <option value="인천">인천</option>
                <option value="서울">서울</option>
                <option value="대전">대전</option>
                <option value="대구">대구</option>
                <option value="광주">광주</option>
                <option value="부산">부산</option>
                <option value="제주">제주</option>
              </select>
            </div>
          </div>
          <div>
            <label className="field-label">기간</label>
            <div>
              <select
                disabled={isMySetting}
                className={`w-full h-10 rounded-full border border-[#d2d2d7] bg-white px-4 text-sm text-center text-[#1d1d1f] appearance-auto ${isMySetting ? "opacity-50" : ""}`}
                value={opts.period}
                onChange={(e) => set("period", e.target.value)}
              >
                {periodOptions.map((p) => <option key={p.value} value={p.value}>{p.label}</option>)}
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
              disabled={isMySetting}
              onClick={selectAllGenres}
              className={`chip ${opts.genre.length === 0 ? "active" : ""} ${isMySetting ? "opacity-50" : ""}`}
            >
              전체
            </button>
            {GENRES.map((g) => (
              <button
                key={g.value}
                type="button"
                disabled={isMySetting}
                onClick={() => toggleGenre(g.value)}
                className={`chip ${opts.genre.includes(g.value) ? "active" : ""} ${isMySetting ? "opacity-50" : ""}`}
              >
                {g.label}
              </button>
            ))}
          </div>
        </div>

        {/* 카테고리 */}
        <div className="mb-5">
          <label className="field-label">카테고리</label>
          <div className="flex gap-2 flex-wrap">
            <button
              type="button"
              disabled={isMySetting}
              onClick={selectAllClassTypes}
              className={`chip ${opts.class_type.length === 0 ? "active" : ""} ${isMySetting ? "opacity-50" : ""}`}
            >
              전체
            </button>
            {CLASS_TYPES.map((t) => (
              <button
                key={t.value}
                type="button"
                disabled={isMySetting}
                onClick={() => toggleClassType(t.value)}
                className={`chip ${opts.class_type.includes(t.value) ? "active" : ""} ${isMySetting ? "opacity-50" : ""}`}
              >
                {t.label}
              </button>
            ))}
          </div>
        </div>

        </>}
      </div>

    </>
  );
}
