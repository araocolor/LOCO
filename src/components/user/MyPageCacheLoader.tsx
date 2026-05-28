"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import MyPageClient from "@/components/user/MyPageClient";
import type { ClassStatus, ClassImage } from "@/types/class";
import type { ApplicationStatus } from "@/types/application";
import type { StarGiver, UserRole } from "@/types/user";

const MY_PAGE_CACHE_KEY = "loco_mypage_cache_local_v3";

interface CachedProfile {
  id: string;
  email: string | null;
  nickname: string;
  bio: string | null;
  country: string | null;
  region: string | null;
  favorite_genre: string[];
  member_type: string[];
  role: UserRole;
  profile_image_url: string | null;
  kakao_notification_enabled: boolean;
  received_star_count: number;
  star_balance: number;
}

interface CachedAppliedClassInfo {
  id: string;
  title: string;
  datetime: string;
  region: string;
  status: ClassStatus;
}

interface CachedAppliedClass {
  id: string;
  status: ApplicationStatus;
  created_at: string;
  class: CachedAppliedClassInfo | null;
}

interface CachedMyClass {
  id: string;
  title: string;
  status: string;
  created_at: string;
  images: ClassImage[] | null;
}

interface MyPageSummaryCache {
  profile: CachedProfile;
  appliedClasses: CachedAppliedClass[];
  myClasses: CachedMyClass[];
  hasPendingProRequest: boolean;
  socialCounts?: {
    following: number;
    followers: number;
    friends: number;
    subscriptionCount?: number;
  };
  starGivers?: StarGiver[];
}

export default function MyPageCacheLoader() {
  const router = useRouter();
  const [data, setData] = useState<MyPageSummaryCache | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    const cacheKey = MY_PAGE_CACHE_KEY;

    let cancelled = false;

    async function fetchAndUpdate() {
      const res = await fetch("/api/mypage/summary", { method: "GET", cache: "no-store" });
      if (res.status === 401) { router.replace("/login"); return true; }
      const json = await res.json();
      if (json?.needsOnboarding) { router.replace("/onboarding"); return true; }
      if (!res.ok) return false;
      if (!cancelled) {
        const nextData = json as MyPageSummaryCache;
        setData(nextData);
        try { localStorage.setItem(cacheKey, JSON.stringify(nextData)); } catch {}
      }
      return true;
    }

    async function load() {
      let hasCachedData = false;

      try {
        // 하이드레이션 불일치 방지를 위해 마운트 이후에만 로컬 캐시를 읽는다.
        await Promise.resolve();
        const raw = localStorage.getItem(cacheKey);
        if (raw) {
          const cachedData = JSON.parse(raw) as MyPageSummaryCache;
          hasCachedData = true;
          if (!cancelled) setData(cachedData);
        }

        const loaded = await fetchAndUpdate();
        if (!loaded && !hasCachedData && !cancelled) setError("마이페이지를 불러오지 못했습니다.");
      } catch {
        if (!hasCachedData && !cancelled) setError("마이페이지를 불러오지 못했습니다.");
      }
    }

    void load();

    return () => {
      cancelled = true;
    };
  }, [router]);

  if (error) {
    return <div className="max-w-3xl mx-auto px-4 py-10 text-sm text-red-500">{error}</div>;
  }

  if (!data) {
    return <div className="max-w-3xl mx-auto px-4 py-10 text-sm text-gray-500">로딩 중...</div>;
  }

  return (
    <MyPageClient
      profile={data.profile}
      myClasses={data.myClasses ?? []}
      socialCounts={data.socialCounts}
      starGivers={data.starGivers ?? []}
    />
  );
}
