import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

const SEOUL_RADIUS_KM = 30;
const STALE_MINUTES = 10;

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
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ data: [] }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const lat = parseFloat(searchParams.get("lat") ?? "");
  const lng = parseFloat(searchParams.get("lng") ?? "");
  if (isNaN(lat) || isNaN(lng)) return NextResponse.json({ data: [] });

  const staleThreshold = new Date(Date.now() - STALE_MINUTES * 60 * 1000).toISOString();

  const { data: locations } = await supabase
    .from("user_locations")
    .select("user_id, lat, lng, updated_at, profiles(id, nickname, profile_image_url)")
    .neq("user_id", user.id)
    .gte("updated_at", staleThreshold);

  const nearby = (locations ?? [])
    .filter((l) => distanceKm(lat, lng, l.lat, l.lng) <= SEOUL_RADIUS_KM)
    .map((l) => {
      const profile = l.profiles as unknown as { nickname: string; profile_image_url: string | null } | null;
      return {
        id: l.user_id,
        lat: l.lat,
        lng: l.lng,
        nickname: profile?.nickname ?? "",
        profile_image_url: profile?.profile_image_url ?? null,
      };
    });

  return NextResponse.json({ data: nearby });
}
