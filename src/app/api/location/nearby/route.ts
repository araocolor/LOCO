import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

const SEOUL_RADIUS_KM = 30;
const STALE_MINUTES = 10;

function formatSupabaseError(error: { message: string; code?: string; details?: string; hint?: string }) {
  return {
    message: error.message,
    code: error.code ?? null,
    details: error.details ?? null,
    hint: error.hint ?? null,
  };
}

function formatKst(date: Date) {
  return new Intl.DateTimeFormat("ko-KR", {
    timeZone: "Asia/Seoul",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  }).format(date);
}

function distanceKm(lat1: number, lng1: number, lat2: number, lng2: number) {
  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLng = ((lng2 - lng1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) * Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

export async function GET(req: Request) {
  const supabase = await createClient();
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError) {
    return NextResponse.json({ data: [], error: formatSupabaseError(authError) }, { status: 401 });
  }
  if (!user) return NextResponse.json({ data: [], error: { message: "로그인이 필요합니다." } }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const lat = parseFloat(searchParams.get("lat") ?? "");
  const lng = parseFloat(searchParams.get("lng") ?? "");
  if (isNaN(lat) || isNaN(lng)) return NextResponse.json({ data: [] });

  const now = new Date();
  const staleThresholdDate = new Date(now.getTime() - STALE_MINUTES * 60 * 1000);
  const staleThreshold = staleThresholdDate.toISOString();

  const { data: locations, error } = await supabase
    .from("user_locations")
    .select("user_id, lat, lng, updated_at")
    .neq("user_id", user.id);

  if (error) {
    return NextResponse.json({
      data: [],
      error: formatSupabaseError(error),
      debug: {
        stage: "user_locations_select",
        serverNowUtc: now.toISOString(),
        serverNowKst: formatKst(now),
        staleThresholdUtc: staleThreshold,
        staleThresholdKst: formatKst(staleThresholdDate),
      },
    }, { status: 500 });
  }

  const userIds = Array.from(new Set((locations ?? []).map((location) => location.user_id)));
  const { data: profiles, error: profilesError } = userIds.length > 0
    ? await supabase
      .from("profiles")
      .select("id, nickname, profile_image_url, bio, country, region, member_type")
      .in("id", userIds)
    : { data: [], error: null };

  if (profilesError) {
    return NextResponse.json({
      data: [],
      error: formatSupabaseError(profilesError),
      debug: {
        stage: "profiles_select",
        serverNowUtc: now.toISOString(),
        serverNowKst: formatKst(now),
        staleThresholdUtc: staleThreshold,
        staleThresholdKst: formatKst(staleThresholdDate),
      },
    }, { status: 500 });
  }

  const profileById = new Map(
    (profiles ?? []).map((profile) => [profile.id, profile])
  );

  const analyzed = (locations ?? []).map((location) => ({
    location,
    isFresh: new Date(location.updated_at).getTime() >= staleThresholdDate.getTime(),
    distanceKm: distanceKm(lat, lng, location.lat, location.lng),
  }));

  const fresh = analyzed.filter((item) => item.isFresh);
  const nearbyItems = fresh.filter((item) => item.distanceKm <= SEOUL_RADIUS_KM);

  const nearby = nearbyItems
    .map((l) => {
      const profile = profileById.get(l.location.user_id);
      return {
        id: l.location.user_id,
        lat: l.location.lat,
        lng: l.location.lng,
        nickname: profile?.nickname ?? "",
        profile_image_url: profile?.profile_image_url ?? null,
        bio: profile?.bio ?? null,
        country: profile?.country ?? null,
        region: profile?.region ?? null,
        member_type: profile?.member_type ?? [],
        updated_at: l.location.updated_at,
      };
    });

  const candidateCount = analyzed.length;
  const freshCount = fresh.length;
  const nearbyCount = nearby.length;
  const staleCount = candidateCount - freshCount;
  const outsideRadiusCount = freshCount - nearbyCount;

  return NextResponse.json({
    data: nearby,
    debug: {
      serverNowUtc: now.toISOString(),
      serverNowKst: formatKst(now),
      staleThresholdUtc: staleThreshold,
      staleThresholdKst: formatKst(staleThresholdDate),
      staleMinutes: STALE_MINUTES,
      radiusKm: SEOUL_RADIUS_KM,
      candidateCount,
      freshCount,
      nearbyCount,
      staleCount,
      outsideRadiusCount,
      likelyReason:
        nearbyCount > 0
          ? "nearby_users_found"
          : candidateCount === 0
          ? "본인을 제외한 위치 행이 없거나 RLS SELECT 정책 때문에 다른 회원 위치를 읽지 못했습니다."
          : freshCount === 0
          ? `${STALE_MINUTES}분 이내에 갱신된 다른 회원 위치가 없습니다.`
          : "최근 위치는 있지만 반경 밖입니다.",
    },
  });
}
