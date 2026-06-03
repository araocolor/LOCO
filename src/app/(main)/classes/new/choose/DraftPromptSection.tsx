"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { ChevronRight } from "lucide-react";

interface DraftItem {
  id: string;
  title: string;
  created_at: string;
}

const CACHE_KEY = "loco:ai-poster-drafts";
const CACHE_TTL_MS = 5 * 60 * 1000;

interface CacheEntry {
  data: DraftItem[];
  cachedAt: number;
}

function readCache(): DraftItem[] | null {
  try {
    const raw = sessionStorage.getItem(CACHE_KEY);
    if (!raw) return null;
    const entry = JSON.parse(raw) as CacheEntry;
    if (Date.now() - entry.cachedAt > CACHE_TTL_MS) return null;
    return entry.data;
  } catch {
    return null;
  }
}

function writeCache(data: DraftItem[]) {
  try {
    sessionStorage.setItem(CACHE_KEY, JSON.stringify({ data, cachedAt: Date.now() }));
  } catch {}
}

export default function DraftPromptSection() {
  const router = useRouter();
  const [drafts, setDrafts] = useState<DraftItem[]>(() => readCache() ?? []);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    // 페이지 로딩 후 백그라운드 fetch
    const cached = readCache();
    if (cached) {
      setDrafts(cached);
      setLoaded(true);
    }

    fetch("/api/ai-poster/requests")
      .then((res) => res.json())
      .then((json) => {
        const data: DraftItem[] = json.drafts ?? [];
        setDrafts(data);
        writeCache(data);
        setLoaded(true);
      })
      .catch(() => setLoaded(true));
  }, []);

  if (!loaded || drafts.length === 0) return null;

  return (
    <section className="mx-auto w-full max-w-[520px]">
      <div className="flex flex-col gap-2">
        {drafts.map((draft) => (
          <button
            key={draft.id}
            type="button"
            onClick={() => router.push(`/classes/new/ai-poster/review/${draft.id}`)}
            className="flex flex-col rounded-2xl border border-[#e5e7eb] bg-white px-5 py-4 shadow-sm transition active:scale-[0.99] text-left"
          >
            <span className="inline-flex items-center justify-center w-11 h-11 rounded-full bg-[#111111] text-white text-[11px] font-semibold mb-2">임시저장</span>
            <div className="flex items-center justify-between w-full">
              <span className="text-[22px] font-bold text-[#111111] truncate pr-2">
                {draft.title || "제목 없음"}
              </span>
              <ChevronRight size={20} className="shrink-0 text-[#aaaaaa]" />
            </div>
          </button>
        ))}
      </div>
    </section>
  );
}
