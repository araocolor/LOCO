import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import type { ClassStatus } from "@/types/class";
import type { ApplicationStatus } from "@/types/application";
import type { UserRole } from "@/types/user";

interface AppliedClassInfo {
  id: string;
  title: string;
  datetime: string;
  region: string;
  status: ClassStatus;
}

interface AppliedClassRow {
  id: string;
  status: ApplicationStatus;
  created_at: string;
  class: AppliedClassInfo | null;
}

interface MyClassRow {
  id: string;
  title: string;
  status: ClassStatus;
  created_at: string;
  images: { card_url: string }[] | null;
}

interface MyPageSummary {
  profile: {
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
  };
  appliedClasses: AppliedClassRow[];
  myClasses: MyClassRow[];
  hasPendingProRequest: boolean;
  socialCounts: {
    following: number;
    followers: number;
    friends: number;
    subscriptionCount: number;
  };
}

export async function GET() {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const [profileResult, appliedResult, myClassesResult, proRequestResult, followingResult, followersResult, friendsResult, subscriptionResult] = await Promise.all([
      supabase
        .from("profiles")
        .select("id, email, nickname, bio, country, region, favorite_genre, member_type, role, profile_image_url, kakao_notification_enabled")
        .eq("id", user.id)
        .single(),
      supabase
        .from("applications")
        .select("id, status, created_at, class:classes(id, title, datetime, region, status)")
        .eq("applicant_id", user.id)
        .order("created_at", { ascending: false }),
      supabase
        .from("classes")
        .select("id, title, status, created_at, images")
        .eq("host_id", user.id)
        .order("created_at", { ascending: false }),
      supabase
        .from("pro_requests")
        .select("id")
        .eq("user_id", user.id)
        .eq("status", "pending")
        .maybeSingle(),
      supabase
        .from("friendships")
        .select("id", { count: "exact", head: true })
        .eq("user_id", user.id)
        .in("status", ["pending", "approved"]),
      supabase
        .from("friendships")
        .select("id", { count: "exact", head: true })
        .eq("friend_id", user.id)
        .eq("status", "approved"),
      supabase
        .from("friendships")
        .select("id", { count: "exact", head: true })
        .eq("user_id", user.id)
        .eq("status", "friend"),
      supabase
        .from("user_subscriptions")
        .select("owner_id", { count: "exact", head: true })
        .eq("target_id", user.id),
    ]);

    if (profileResult.error && profileResult.error.code !== "PGRST116") {
      console.error("[mypage-summary] profile failed", profileResult.error);
      return NextResponse.json({ error: "프로필을 불러오지 못했습니다." }, { status: 500 });
    }

    if (!profileResult.data) {
      return NextResponse.json({ needsOnboarding: true }, { status: 200 });
    }

    if (appliedResult.error) console.error("[mypage-summary] applied classes failed", appliedResult.error);
    if (myClassesResult.error) console.error("[mypage-summary] my classes failed", myClassesResult.error);
    if (proRequestResult.error) console.error("[mypage-summary] pro request failed", proRequestResult.error);
    if (followingResult.error) console.error("[mypage-summary] following count failed", followingResult.error);
    if (followersResult.error) console.error("[mypage-summary] followers count failed", followersResult.error);
    if (friendsResult.error) console.error("[mypage-summary] friends count failed", friendsResult.error);
    if (subscriptionResult.error) console.error("[mypage-summary] subscription count failed", subscriptionResult.error);

    const appliedClasses: AppliedClassRow[] = (appliedResult.error ? [] : appliedResult.data ?? []).map((row) => {
      const cls = row.class as unknown as AppliedClassInfo | null;

      return {
        id: row.id,
        status: row.status as ApplicationStatus,
        created_at: row.created_at,
        class: cls
          ? {
              id: cls.id,
              title: cls.title,
              datetime: cls.datetime,
              region: cls.region,
              status: cls.status as ClassStatus,
            }
          : null,
      };
    });

    const profile = profileResult.data;

    const payload: MyPageSummary = {
      profile: {
        id: profile.id,
        email: profile.email,
        nickname: profile.nickname,
        bio: profile.bio,
        country: profile.country,
        region: profile.region,
        favorite_genre: profile.favorite_genre ?? [],
        member_type: profile.member_type ?? [],
        role: profile.role as UserRole,
        profile_image_url: profile.profile_image_url,
        kakao_notification_enabled: profile.kakao_notification_enabled,
      },
      appliedClasses,
      myClasses: (myClassesResult.error ? [] : myClassesResult.data ?? []) as MyClassRow[],
      hasPendingProRequest: proRequestResult.error ? false : !!proRequestResult.data,
      socialCounts: {
        following: followingResult.error ? 0 : followingResult.count ?? 0,
        followers: followersResult.error ? 0 : followersResult.count ?? 0,
        friends: friendsResult.error ? 0 : friendsResult.count ?? 0,
        subscriptionCount: subscriptionResult.error ? 0 : subscriptionResult.count ?? 0,
      },
    };

    return NextResponse.json(payload);
  } catch (error) {
    console.error("[mypage-summary] unexpected failed", error);
    return NextResponse.json({ error: "마이페이지를 불러오지 못했습니다." }, { status: 500 });
  }
}
