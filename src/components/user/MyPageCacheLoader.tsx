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
  org_name: string | null;
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
  images: ClassImage[] | null;
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
        try {
          localStorage.setItem(cacheKey, JSON.stringify(nextData));
          window.dispatchEvent(new Event("loco:profile-cache-updated"));
        } catch {}
      }
      return true;
    }

    async function load() {
      let hasCachedData = false;

      try {
        await Promise.resolve();
        const raw = localStorage.getItem(cacheKey);
        if (raw) {
          const cachedData = JSON.parse(raw) as MyPageSummaryCache;
          hasCachedData = true;
          if (!cancelled) setData(cachedData);
        } else if (!cancelled) {
          const homeKeys = Object.keys(localStorage).filter((k) => k.startsWith("loco_home_my_classes_v1:"));
          for (const hk of homeKeys) {
            const hRaw = localStorage.getItem(hk);
            if (!hRaw) continue;
            const hCache = JSON.parse(hRaw);
            const p = hCache?.profile;
            if (p?.nickname) {
              const homeMyClasses = Array.isArray(hCache.myClasses)
                ? (hCache.myClasses as CachedMyClass[]).map((c) => ({
                    id: c.id,
                    title: c.title,
                    status: c.status ?? "open",
                    created_at: c.created_at ?? "",
                    images: c.images ?? null,
                  }))
                : [];
              setData({
                profile: {
                  id: p.id ?? "",
                  email: null,
                  nickname: p.nickname,
                  bio: null,
                  country: null,
                  region: p.region ?? null,
                  favorite_genre: [],
                  member_type: [],
                  role: "member" as const,
                  profile_image_url: p.profile_image_url ?? null,
                  org_name: null,
                  kakao_notification_enabled: false,
                  received_star_count: 0,
                  star_balance: 0,
                },
                appliedClasses: [],
                myClasses: homeMyClasses,
                hasPendingProRequest: false,
              });
              hasCachedData = true;
              break;
            }
          }
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
      appliedClasses={data.appliedClasses ?? []}
      socialCounts={data.socialCounts}
      starGivers={data.starGivers ?? []}
    />
  );
}
