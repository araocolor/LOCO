"use client";

import { useEffect, useState } from "react";
import UserViewClient from "@/components/user/UserViewClient";
import type { ClassImage } from "@/types/class";

const MESSAGE_USER_SESSION_KEY = "message_userid_session";

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
  member_type: string[];
  profile_image_url: string | null;
}

interface UserViewData {
  profile: Profile;
  myClasses: GridClass[];
  bookmarkClasses: GridClass[];
}

interface SessionUserData {
  id: string;
  nickname: string;
  profile_image_url: string | null;
  email?: string | null;
  bio?: string | null;
  member_type?: string[];
  opened_classes?: GridClass[];
  bookmarked_classes?: GridClass[];
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
          if (!cancelled) {
            setData({
              profile: json.profile,
              myClasses: (json.myClasses ?? []).map((c) => ({ ...c, isBookmark: false })),
              bookmarkClasses: (json.bookmarkClasses ?? []).map((c) => ({ ...c, isBookmark: true })),
            });
            setLoading(false);
          }
          return;
        }

        const raw = sessionStorage.getItem(MESSAGE_USER_SESSION_KEY);
        if (raw) {
          const sessionMap = JSON.parse(raw) as Record<string, SessionUserData>;
          const sessionUser = sessionMap[userId];
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
                  member_type: sessionUser.member_type ?? [],
                  profile_image_url: sessionUser.profile_image_url ?? null,
                },
                myClasses: (sessionUser.opened_classes ?? []).map((c) => ({ ...c, isBookmark: false })),
                bookmarkClasses: (sessionUser.bookmarked_classes ?? []).map((c) => ({ ...c, isBookmark: true })),
              });
              setLoading(false);
            }
            if (hasProfileFields && hasUsableEmail) return;
          }
        }

        const res = await fetch(`/api/users/${userId}/view-summary`, { method: "GET" });
        if (!res.ok) {
          if (!cancelled) setLoading(false);
          return;
        }

        const json = (await res.json()) as UserViewData;
        if (cancelled) return;
        setData({
          profile: json.profile,
          myClasses: (json.myClasses ?? []).map((c) => ({ ...c, isBookmark: false })),
          bookmarkClasses: (json.bookmarkClasses ?? []).map((c) => ({ ...c, isBookmark: true })),
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
    />
  );
}
