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
}

export async function GET() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const [profileResult, appliedResult, myClassesResult, proRequestResult] = await Promise.all([
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
  ]);

  if (!profileResult.data) {
    return NextResponse.json({ needsOnboarding: true }, { status: 200 });
  }

  const appliedClasses: AppliedClassRow[] = (appliedResult.data ?? []).map((row) => {
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

  if (myClassesResult.error) {
    return NextResponse.json({ error: myClassesResult.error.message }, { status: 500 });
  }

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
    myClasses: (myClassesResult.data ?? []) as MyClassRow[],
    hasPendingProRequest: !!proRequestResult.data,
  };

  return NextResponse.json(payload);
}
