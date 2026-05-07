"use client";

import Link from "next/link";
import Image from "next/image";
import { useEffect, useRef, useState } from "react";
import { useParams, useSearchParams } from "next/navigation";
import { DANCE_GENRE_LABELS, CLASS_LEVEL_LABELS } from "@/types/class";
import type { ClassWithHost } from "@/components/class/ClassCard";
import ClassDetailImageGallery from "@/components/class/ClassDetailImageGallery";

const HOME_RESULTS_LOCAL_KEY = "loco_home_results_local_v1";

interface CachedHomeResult {
  data: ClassWithHost[];
  count: number;
}

const GENRE_CHIP: Record<string, string> = {
  salsa: "bg-red-50 text-red-600",
  bachata: "bg-purple-50 text-purple-600",
  festival: "bg-yellow-50 text-yellow-700",
  event: "bg-blue-50 text-blue-600",
  other: "bg-gray-100 text-gray-600",
};

function formatDateTime(dateStr: string) {
  const d = new Date(dateStr);
  const days = ["일", "월", "화", "수", "목", "금", "토"];
  return `${d.getFullYear()}년 ${d.getMonth() + 1}월 ${d.getDate()}일 (${days[d.getDay()]}) ${d.getHours().toString().padStart(2, "0")}:${d.getMinutes().toString().padStart(2, "0")}`;
}

function formatDate(dateStr: string) {
  const d = new Date(dateStr);
  return `${d.getFullYear()}.${String(d.getMonth() + 1).padStart(2, "0")}.${String(d.getDate()).padStart(2, "0")}`;
}

function InfoRow({ icon, label, value }: { icon: string; label: string; value: string }) {
  return (
    <div className="flex gap-3 text-sm">
      <span className="w-5 text-center flex-shrink-0">{icon}</span>
      <span className="text-gray-500 w-16 flex-shrink-0">{label}</span>
      <span className="text-gray-900 flex-1">{value}</span>
    </div>
  );
}

export default function CachedClassDetailPage() {
  const params = useParams<{ id: string }>();
  const searchParams = useSearchParams();
  const classId = params?.id;
  const animateFromHome = searchParams.get("from") === "home";
  const [loaded, setLoaded] = useState(false);
  const [displayClass, setDisplayClass] = useState<ClassWithHost | null>(null);
  const requestedRef = useRef(false);

  useEffect(() => {
    if (!classId) {
      setLoaded(true);
      return;
    }

    const raw = localStorage.getItem(HOME_RESULTS_LOCAL_KEY);
    if (!raw) {
      setLoaded(true);
      return;
    }

    try {
      const parsed = JSON.parse(raw) as CachedHomeResult;
      const found = (parsed.data ?? []).find((item) => item.id === classId) ?? null;
      setDisplayClass(found);
    } catch {
      setDisplayClass(null);
    } finally {
      setLoaded(true);
    }
  }, [classId]);

  useEffect(() => {
    if (!loaded || !classId) return;
    if (requestedRef.current) return;

    const run = async () => {
      requestedRef.current = true;
      try {
        const res = await fetch(`/api/classes/${classId}`, { method: "GET" });
        if (!res.ok) return;
        const latest = (await res.json()) as ClassWithHost;
        setDisplayClass((prev) => (prev ? { ...prev, ...latest } : prev));
      } catch {
        // 백그라운드 동기화 실패는 화면 유지
      }
    };

    if (document.readyState === "complete") {
      void run();
      return;
    }

    const onLoad = () => {
      void run();
    };
    window.addEventListener("load", onLoad, { once: true });
    return () => window.removeEventListener("load", onLoad);
  }, [loaded, classId, displayClass]);

  if (!loaded) {
    return <div className="max-w-xl mx-auto px-4 py-6 text-sm text-gray-400">불러오는 중...</div>;
  }

  if (!displayClass) {
    return <div className="max-w-xl mx-auto px-4 py-6 text-sm text-gray-500">null</div>;
  }

  const host = displayClass.host ?? null;
  const images: { card_url?: string; full_url?: string }[] = displayClass.images ?? [];
  const primaryGenre = displayClass.genres?.[0] ?? "other";
  const genreLabel = (displayClass.genres ?? [])
    .map((g) => DANCE_GENRE_LABELS[g as keyof typeof DANCE_GENRE_LABELS] ?? g)
    .join(" · ");
  const levelLabel =
    CLASS_LEVEL_LABELS[displayClass.level as keyof typeof CLASS_LEVEL_LABELS] ?? displayClass.level;
  const chipCls = GENRE_CHIP[primaryGenre] ?? GENRE_CHIP.other;

  return (
    <div
      className={`relative max-w-xl mx-auto pb-32 ${animateFromHome ? "page-slide-in-from-left" : ""}`}
    >
      {images.length > 0 ? (
        <ClassDetailImageGallery images={images} />
      ) : (
        <div className="w-full h-[160px] bg-gray-100 flex items-center justify-center text-5xl opacity-30">
          🎵
        </div>
      )}

      <div className="px-4 pt-4">
        <div className="flex items-center gap-2 flex-wrap mb-2">
          <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${chipCls}`}>
            {genreLabel}
          </span>
          {displayClass.status === "recruiting" && (
            <span className="text-xs font-medium px-2 py-0.5 rounded-full bg-green-50 text-green-600">
              모집중
            </span>
          )}
          {displayClass.status === "closed" && (
            <span className="text-xs font-medium px-2 py-0.5 rounded-full bg-gray-100 text-gray-500">
              마감
            </span>
          )}
          {displayClass.status === "cancelled" && (
            <span className="text-xs font-medium px-2 py-0.5 rounded-full bg-red-50 text-red-500">
              취소됨
            </span>
          )}
          {displayClass.is_modified && (
            <span className="text-xs font-medium text-orange-500">수정됨</span>
          )}
        </div>

        <h1 className="text-xl font-bold text-gray-900 mb-3">{displayClass.title}</h1>

        {host && (
          <Link href={`/users/${host.id}`} className="flex items-center gap-2 mb-4">
            {host.profile_image_url ? (
              <Image
                src={host.profile_image_url}
                alt={host.nickname}
                width={36}
                height={36}
                className="rounded-full object-cover"
              />
            ) : (
              <div className="w-9 h-9 rounded-full bg-gray-100 flex items-center justify-center text-sm font-medium text-gray-500">
                {host.nickname[0]}
              </div>
            )}
            <span className="text-sm font-medium text-gray-700">{host.nickname}</span>
          </Link>
        )}

        <div className="card p-4 space-y-3 mb-4">
          <InfoRow icon="📅" label="일시" value={formatDateTime(displayClass.datetime)} />
          <InfoRow icon="⏰" label="신청 마감" value={formatDate(displayClass.deadline)} />
          <InfoRow icon="📍" label="장소" value={displayClass.location_address} />
          <InfoRow icon="🎯" label="레벨" value={levelLabel} />
          <InfoRow icon="👥" label="정원" value={`${displayClass.capacity}명`} />
          <InfoRow
            icon="💰"
            label="수강료"
            value={displayClass.price === 0 ? "무료" : `${displayClass.price.toLocaleString()}원`}
          />
          <InfoRow icon="📞" label="연락처" value={displayClass.contact} />
        </div>

        {displayClass.description && (
          <div className="mb-5">
            <h2 className="font-semibold text-sm text-gray-700 mb-2">클래스 소개</h2>
            <p className="text-sm text-gray-700 whitespace-pre-wrap leading-relaxed">
              {displayClass.description}
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
