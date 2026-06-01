"use client";

import { useEffect, useState, useCallback, useRef, useMemo } from "react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import ClassMoreMenu from "@/components/class/ClassMoreMenu";
import type { ClassWithHost } from "@/components/class/ClassCard";

type HotSort = "like_count" | "view_count" | "comment_count";

interface HotClassesTabProps {
  cachedClasses?: ClassWithHost[];
  onClassSelect?: (classId: string) => void;
}

const SECTIONS: { sort: HotSort; title: string }[] = [
  { sort: "like_count", title: "좋아요 클래스" },
  { sort: "view_count", title: "조회수 클래스" },
  { sort: "comment_count", title: "댓글뷰 클래스" },
];

const HOT_CACHE_TTL_MS = 3 * 60 * 1000;

interface HotCacheEntry {
  savedAt: number;
  classes: ClassWithHost[];
}

function mergeWithCached(fetched: ClassWithHost[], cachedClasses: ClassWithHost[]): ClassWithHost[] {
  if (cachedClasses.length === 0) return fetched;
  const cachedMap = new Map(cachedClasses.map((c) => [c.id, c]));
  return fetched.map((item) => cachedMap.get(item.id) ?? item);
}

function readHotCache(sort: HotSort): ClassWithHost[] | null {
  try {
    const raw = sessionStorage.getItem(`loco_hot_${sort}`);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as HotCacheEntry;
    if (Date.now() - parsed.savedAt > HOT_CACHE_TTL_MS) {
      sessionStorage.removeItem(`loco_hot_${sort}`);
      return null;
    }
    return parsed.classes;
  } catch {
    return null;
  }
}

function writeHotCache(sort: HotSort, classes: ClassWithHost[]) {
  try {
    sessionStorage.setItem(
      `loco_hot_${sort}`,
      JSON.stringify({ savedAt: Date.now(), classes } satisfies HotCacheEntry)
    );
  } catch {}
}

const GRID_FILL_COLORS = ["#E84040", "#B8D44A", "#F5A623", "#5BB8E8"] as const;

function ClassGrid({ classes, onClassSelect }: { classes: ClassWithHost[]; onClassSelect?: (classId: string) => void }) {
  const router = useRouter();
  const [gridFillSeed] = useState(() => Math.floor(Math.random() * GRID_FILL_COLORS.length));
  const fillerCells = useMemo(() => {
    const remain = classes.length % 3;
    const count = remain === 0 ? 0 : 3 - remain;
    return Array.from({ length: count }, (_, idx) => {
      const color = GRID_FILL_COLORS[(gridFillSeed + classes.length + idx) % GRID_FILL_COLORS.length];
      return { key: `filler-${classes.length}-${idx}`, color };
    });
  }, [classes.length, gridFillSeed]);

  return (
    <div className="grid grid-cols-3 gap-[1px] bg-gray-200">
      {classes.map((classData) => (
        <div
          key={classData.id}
          onClick={() => onClassSelect ? onClassSelect(classData.id) : router.push(`/classes/${classData.id}`)}
          className="aspect-square bg-gray-100 relative overflow-hidden cursor-pointer"
        >
          {classData.images?.[0]?.card_url ? (
            <Image
              src={classData.images[0].card_url}
              alt={classData.title}
              fill
              sizes="(max-width: 640px) 33vw, 213px"
              className={`object-cover ${classData.status !== "recruiting" ? "grayscale" : ""}`}
              unoptimized
            />
          ) : (
            <div className="w-full h-full flex items-center justify-center bg-gray-100">
              <span className="text-gray-300 text-xs">없음</span>
            </div>
          )}
          <div className="absolute top-0 right-0 z-10" onClick={(e) => e.stopPropagation()}>
            <ClassMoreMenu
              classId={classData.id}
              hostId={classData.host_id}
              hostNickname={classData.host?.nickname}
              hostImageUrl={classData.host?.profile_image_url}
              status={classData.status}
              buttonClassName="flex items-center justify-center w-8 h-8 text-white drop-shadow-md"
              onDetailView={() => onClassSelect ? onClassSelect(classData.id) : router.push(`/classes/${classData.id}`)}
            />
          </div>
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
  );
}

export default function HotClassesTab({ cachedClasses = [], onClassSelect }: HotClassesTabProps) {
  const [data, setData] = useState<Record<HotSort, ClassWithHost[]>>({
    like_count: [],
    view_count: [],
    comment_count: [],
  });
  const [loadingMap, setLoadingMap] = useState<Record<HotSort, boolean>>({
    like_count: false,
    view_count: false,
    comment_count: false,
  });
  const fetchedRef = useRef(new Set<HotSort>());

  const fetchSection = useCallback(async (sort: HotSort) => {
    if (fetchedRef.current.has(sort)) return;

    const cached = readHotCache(sort);
    if (cached) {
      setData((prev) => ({ ...prev, [sort]: mergeWithCached(cached, cachedClasses) }));
      fetchedRef.current.add(sort);
      return;
    }

    setLoadingMap((prev) => ({ ...prev, [sort]: true }));
    try {
      const res = await fetch(`/api/classes/hot?sort=${sort}&limit=9`);
      if (!res.ok) return;
      const json = await res.json();
      const fetched = json.classes ?? [];
      const merged = mergeWithCached(fetched, cachedClasses);
      setData((prev) => ({ ...prev, [sort]: merged }));
      writeHotCache(sort, fetched);
      fetchedRef.current.add(sort);
    } catch {} finally {
      setLoadingMap((prev) => ({ ...prev, [sort]: false }));
    }
  }, [cachedClasses]);

  useEffect(() => {
    for (const { sort } of SECTIONS) {
      void fetchSection(sort);
    }
  }, [fetchSection]);

  return (
    <div className="bg-white pb-6">
      {SECTIONS.map(({ sort, title }) => (
        <div key={sort}>
          <div className="px-4 pt-6 pb-1">
            <h2 className="text-[18px] font-bold text-gray-900">{title}</h2>
          </div>
          {loadingMap[sort] ? (
            <div className="flex items-center justify-center h-24 text-gray-400">로딩 중...</div>
          ) : data[sort].length === 0 ? (
            <div className="flex items-center justify-center h-24 text-gray-400">
              <p className="text-sm">클래스가 없습니다</p>
            </div>
          ) : (
            <ClassGrid classes={data[sort]} onClassSelect={onClassSelect} />
          )}
        </div>
      ))}
    </div>
  );
}
