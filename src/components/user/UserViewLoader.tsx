"use client";

import { useEffect, useState } from "react";
import UserViewClient from "@/components/user/UserViewClient";
import type { ClassImage } from "@/types/class";

const LEGACY_MESSAGE_USER_SESSION_KEY = "message_userid_session";
const MESSAGE_USER_SESSION_PREFIX = "message_userid_session:";

interface GridClass {
  id: string;
  images: ClassImage[] | null;
  title: string;
  status?: string;
  created_at?: string;
  isBookmark?: boolean;
}

interface Profile {
  id: string;
  email: string | null;
  nickname: string;
  bio: string | null;
  country: string | null;
  member_type: string[];
  profile_image_url: string | null;
  region: string | null;
}

interface UserViewData {
  profile: Profile;
  myClasses: GridClass[];
  bookmarkClasses: GridClass[];
  followerCount?: number;
}

interface SessionUserData {
  id: string;
  nickname: string;
  profile_image_url: string | null;
  email?: string | null;
  bio?: string | null;
  country?: string | null;
  member_type?: string[];
  region?: string | null;
  opened_classes?: GridClass[];
  bookmarked_classes?: GridClass[];
}

function normalizeProfile(profile: Profile): Profile {
  return {
    ...profile,
    country: profile.country ?? null,
    region: profile.region ?? null,
  };
}

function readMessageUserSession(userId: string) {
  const keys = [
    LEGACY_MESSAGE_USER_SESSION_KEY,
    ...Object.keys(sessionStorage).filter((key) => key.startsWith(MESSAGE_USER_SESSION_PREFIX)),
  ];

  for (const key of keys) {
    try {
      const raw = sessionStorage.getItem(key);
      if (!raw) continue;
      const sessionMap = JSON.parse(raw) as Record<string, SessionUserData>;
      if (sessionMap[userId]) return sessionMap[userId];
    } catch {}
  }

  return null;
}

export default function UserViewLoader({ userId }: { userId: string }) {
  const [data, setData] = useState<UserViewData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      try {
        const prefetched = sessionStorage.getItem(`user_view_${userId}`);
        if (prefetched) {
          const json = JSON.parse(prefetched) as UserViewData;
          const hasFollowerCount = typeof json.followerCount === "number";
          if (!cancelled) {
            setData({
              profile: normalizeProfile(json.profile),
              myClasses: (json.myClasses ?? []).map((c) => ({ ...c, isBookmark: false })),
              bookmarkClasses: (json.bookmarkClasses ?? []).map((c) => ({ ...c, isBookmark: true })),
              followerCount: json.followerCount ?? 0,
            });
            setLoading(false);
          }
          if (hasFollowerCount) return;
          // 구버전 캐시: followerCount가 없으면 API로 보강 후 캐시 업데이트
          const res = await fetch(`/api/users/${userId}/view-summary`, { method: "GET" });
          if (!res.ok) return;
          const fresh = (await res.json()) as UserViewData;
          if (cancelled) return;
          sessionStorage.setItem(`user_view_${userId}`, JSON.stringify(fresh));
          setData({
            profile: normalizeProfile(fresh.profile),
            myClasses: (fresh.myClasses ?? []).map((c) => ({ ...c, isBookmark: false })),
            bookmarkClasses: (fresh.bookmarkClasses ?? []).map((c) => ({ ...c, isBookmark: true })),
            followerCount: fresh.followerCount ?? 0,
          });
          return;
        }

        const sessionUser = readMessageUserSession(userId);
        if (sessionUser) {
          const hasProfileFields =
            "bio" in sessionUser || "member_type" in sessionUser || "email" in sessionUser;
          const hasUsableEmail = typeof sessionUser.email === "string" && sessionUser.email.length > 0;
          // 구버전 세션이거나 이메일이 비어 있으면 API로 보강한다.
          if (hasProfileFields && hasUsableEmail && !cancelled) {
            setData({
              profile: {
                id: sessionUser.id,
                email: sessionUser.email ?? null,
                nickname: sessionUser.nickname,
                bio: sessionUser.bio ?? null,
                country: sessionUser.country ?? null,
                member_type: sessionUser.member_type ?? [],
                profile_image_url: sessionUser.profile_image_url ?? null,
                region: sessionUser.region ?? null,
              },
              myClasses: (sessionUser.opened_classes ?? []).map((c) => ({ ...c, isBookmark: false })),
              bookmarkClasses: (sessionUser.bookmarked_classes ?? []).map((c) => ({ ...c, isBookmark: true })),
              followerCount: 0,
            });
            setLoading(false);
          }
          if (hasProfileFields && hasUsableEmail) return;
        }

        const res = await fetch(`/api/users/${userId}/view-summary`, { method: "GET" });
        if (!res.ok) {
          if (!cancelled) setLoading(false);
          return;
        }

        const json = (await res.json()) as UserViewData;
        if (cancelled) return;
        setData({
          profile: normalizeProfile(json.profile),
          myClasses: (json.myClasses ?? []).map((c) => ({ ...c, isBookmark: false })),
          bookmarkClasses: (json.bookmarkClasses ?? []).map((c) => ({ ...c, isBookmark: true })),
          followerCount: json.followerCount ?? 0,
        });
        setLoading(false);
      } catch {
        if (!cancelled) setLoading(false);
      }
    }

    void load();
    return () => {
      cancelled = true;
    };
  }, [userId]);

  if (loading) {
    return <div className="px-4 py-6 text-sm text-gray-400">불러오는 중...</div>;
  }

  if (!data) {
    return <div className="px-4 py-6 text-sm text-gray-400">표시할 사용자 정보가 없습니다.</div>;
  }

  return (
    <UserViewClient
      profile={data.profile}
      myClasses={data.myClasses}
      bookmarkClasses={data.bookmarkClasses}
      followerCount={data.followerCount ?? 0}
    />
  );
}
