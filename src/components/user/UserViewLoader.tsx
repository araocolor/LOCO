"use client";

import { useEffect, useState } from "react";
import UserViewClient from "@/components/user/UserViewClient";
import { USER_VIEW_CACHE_PREFIX } from "@/app/(main)/search/_lib/search-utils";
import type { ClassImage } from "@/types/class";

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
  received_star_count?: number;
}

interface UserViewData {
  profile: Profile;
  myClasses: GridClass[];
  bookmarkClasses: GridClass[];
  followerCount?: number;
}

function normalizeViewData(data: UserViewData): UserViewData {
  return {
    profile: normalizeProfile(data.profile),
    myClasses: (data.myClasses ?? []).map((c) => ({ ...c, isBookmark: false })),
    bookmarkClasses: (data.bookmarkClasses ?? []).map((c) => ({ ...c, isBookmark: true })),
    followerCount: data.followerCount ?? 0,
  };
}

function normalizeProfile(profile: Profile): Profile {
  return {
    ...profile,
    country: profile.country ?? null,
    region: profile.region ?? null,
    received_star_count: profile.received_star_count ?? 0,
  };
}

export default function UserViewLoader({ userId }: { userId: string }) {
  const [data, setData] = useState<UserViewData | null>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    try {
      const raw = sessionStorage.getItem(`${USER_VIEW_CACHE_PREFIX}${userId}`);
      if (raw) {
        setData(normalizeViewData(JSON.parse(raw) as UserViewData));
      }
    } catch {}
    finally {
      setReady(true);
    }
  }, [userId]);

  if (data) {
    return (
      <UserViewClient
        profile={data.profile}
        myClasses={data.myClasses}
        bookmarkClasses={data.bookmarkClasses}
        followerCount={data.followerCount ?? 0}
      />
    );
  }

  if (!ready) {
    return null;
  }

  return <div className="px-4 py-6 text-sm text-gray-400">표시할 사용자 정보가 없습니다.</div>;
}
