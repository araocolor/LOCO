"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { useRouter } from "next/navigation";
import { Search, X } from "lucide-react";
import Image from "next/image";

const RECENT_KEYWORDS_KEY = "recent_search_keywords";
const RECENT_RESULTS_KEY = "recent_search_results";
const MAX_TOTAL = 5;
const MAX_RESULTS = 2;
const MIN_SEARCH_LENGTH = 2;

export interface RecentSearchResult {
  id: string;
  title: string;
  thumbnail_url: string | null;
}

interface LiveSearchResult {
  id: string;
  title: string;
  images?: { card_url?: string }[];
}

function loadKeywords(): string[] {
  if (typeof window === "undefined") return [];
  try {
    return JSON.parse(localStorage.getItem(RECENT_KEYWORDS_KEY) || "[]");
  } catch {
    return [];
  }
}

function saveKeywords(keywords: string[]) {
  localStorage.setItem(RECENT_KEYWORDS_KEY, JSON.stringify(keywords));
}

function loadResults(): RecentSearchResult[] {
  if (typeof window === "undefined") return [];
  try {
    return JSON.parse(localStorage.getItem(RECENT_RESULTS_KEY) || "[]");
  } catch {
    return [];
  }
}

function saveResults(results: RecentSearchResult[]) {
  localStorage.setItem(RECENT_RESULTS_KEY, JSON.stringify(results));
}

interface SearchKeywordTabProps {
  onClose: () => void;
  onSearch: (keyword: string) => void;
}

export default function SearchKeywordTab({ onClose, onSearch }: SearchKeywordTabProps) {
  const router = useRouter();
  const [keyword, setKeyword] = useState("");
  const [recentKeywords, setRecentKeywords] = useState<string[]>([]);
  const [recentResults, setRecentResults] = useState<RecentSearchResult[]>([]);
  const [liveResults, setLiveResults] = useState<LiveSearchResult[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout>>(null);

  useEffect(() => {
    setRecentKeywords(loadKeywords());
    setRecentResults(loadResults());
    setTimeout(() => inputRef.current?.focus(), 100);
  }, []);

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);

    const trimmed = keyword.trim();
    if (trimmed.length < MIN_SEARCH_LENGTH) {
      setLiveResults([]);
      return;
    }

    debounceRef.current = setTimeout(async () => {
      setIsSearching(true);
      try {
        const res = await fetch(`/api/classes/search?keyword=${encodeURIComponent(trimmed)}&limit=5`);
        if (!res.ok) return;
        const json = await res.json();
        setLiveResults(json.data ?? []);
      } catch {
        setLiveResults([]);
      } finally {
        setIsSearching(false);
      }
    }, 300);

    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [keyword]);

  const handleSearch = useCallback(() => {
    const trimmed = keyword.trim();
    if (!trimmed) return;

    const updated = [trimmed, ...recentKeywords.filter((k) => k !== trimmed)].slice(0, MAX_TOTAL);
    setRecentKeywords(updated);
    saveKeywords(updated);
    onSearch(trimmed);
  }, [keyword, recentKeywords, onSearch]);

  function selectLiveResult(item: LiveSearchResult) {
    const thumbnail = item.images?.[0]?.card_url ?? null;
    const newResult: RecentSearchResult = { id: item.id, title: item.title, thumbnail_url: thumbnail };
    const updated = [newResult, ...recentResults.filter((r) => r.id !== item.id)].slice(0, MAX_RESULTS);
    setRecentResults(updated);
    saveResults(updated);

    const trimmed = keyword.trim();
    if (trimmed) {
      const updatedKw = [trimmed, ...recentKeywords.filter((k) => k !== trimmed)].slice(0, MAX_TOTAL);
      setRecentKeywords(updatedKw);
      saveKeywords(updatedKw);
    }

    onClose();
    if (document.startViewTransition) {
      document.startViewTransition(() => router.push(`/classes/${item.id}`));
    } else {
      router.push(`/classes/${item.id}`);
    }
  }

  function removeKeyword(target: string) {
    const updated = recentKeywords.filter((k) => k !== target);
    setRecentKeywords(updated);
    saveKeywords(updated);
  }

  function removeResult(id: string) {
    const updated = recentResults.filter((r) => r.id !== id);
    setRecentResults(updated);
    saveResults(updated);
  }

  const showLive = keyword.trim().length >= MIN_SEARCH_LENGTH;

  return (
    <div className="px-4">
      {/* 검색폼 */}
      <div className="flex items-center gap-2 mb-5">
        <div className="flex-1 relative">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input
            ref={inputRef}
            type="text"
            value={keyword}
            onChange={(e) => setKeyword(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleSearch()}
            placeholder="클래스명 검색"
            className="w-full h-10 pl-9 pr-3 rounded-lg bg-gray-100 text-[16px] outline-none focus:ring-1 focus:ring-gray-300"
          />
        </div>
        <button
          type="button"
          onClick={onClose}
          className="text-sm text-gray-500 whitespace-nowrap"
        >
          취소
        </button>
      </div>

      {/* 실시간 검색 결과 */}
      {showLive && (
        <div className="mb-5">
          {isSearching ? (
            <p className="text-xs text-gray-400">검색 중...</p>
          ) : liveResults.length > 0 ? (
            <div className="flex flex-col gap-2">
              {liveResults.map((item) => (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => selectLiveResult(item)}
                  className="flex items-center gap-3 w-full text-left"
                >
                  <div className="w-10 h-10 rounded-lg overflow-hidden bg-gray-100 flex-shrink-0">
                    {item.images?.[0]?.card_url ? (
                      <Image
                        src={item.images[0].card_url}
                        alt={item.title}
                        width={40}
                        height={40}
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <div className="w-full h-full bg-gray-200" />
                    )}
                  </div>
                  <span className="flex-1 text-sm text-gray-800 truncate">{item.title}</span>
                </button>
              ))}
            </div>
          ) : (
            <p className="text-xs text-gray-400">검색 결과가 없습니다</p>
          )}
        </div>
      )}

      {/* 검색어 미입력 시: 최근 검색 결과 + 최근 검색어 */}
      {!showLive && (
        <>
          {recentResults.length > 0 && (
            <div className="mb-5">
              <h3 className="text-xs font-semibold text-gray-400 mb-2">최근 검색 결과</h3>
              <div className="flex flex-col gap-2">
                {recentResults.slice(0, MAX_RESULTS).map((result) => (
                  <div key={result.id} className="flex items-center gap-3">
                    <button
                      type="button"
                      onClick={() => {
                        onClose();
                        if (document.startViewTransition) {
                          document.startViewTransition(() => router.push(`/classes/${result.id}`));
                        } else {
                          router.push(`/classes/${result.id}`);
                        }
                      }}
                      className="flex items-center gap-3 flex-1 min-w-0"
                    >
                      <div className="w-10 h-10 rounded-lg overflow-hidden bg-gray-100 flex-shrink-0">
                        {result.thumbnail_url ? (
                          <Image
                            src={result.thumbnail_url}
                            alt={result.title}
                            width={40}
                            height={40}
                            className="w-full h-full object-cover"
                          />
                        ) : (
                          <div className="w-full h-full bg-gray-200" />
                        )}
                      </div>
                      <span className="flex-1 text-sm text-gray-800 truncate text-left">{result.title}</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => removeResult(result.id)}
                      className="p-1 text-gray-300"
                    >
                      <X size={14} />
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}

          {recentKeywords.length > 0 && (
            <div>
              <h3 className="text-xs font-semibold text-gray-400 mb-2">최근 검색어</h3>
              <div className="flex flex-col">
                {recentKeywords.slice(0, MAX_TOTAL - Math.min(recentResults.length, MAX_RESULTS)).map((kw) => (
                  <div key={kw} className="flex items-center justify-between py-2">
                    <button
                      type="button"
                      onClick={() => {
                        setKeyword(kw);
                        onSearch(kw);
                      }}
                      className="flex-1 text-left text-sm text-gray-700"
                    >
                      {kw}
                    </button>
                    <button
                      type="button"
                      onClick={() => removeKeyword(kw)}
                      className="p-1 text-gray-300"
                    >
                      <X size={14} />
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
