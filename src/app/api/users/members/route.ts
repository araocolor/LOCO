import { createClient } from "@/lib/supabase/server";
import { NextRequest, NextResponse } from "next/server";

export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const requestedLimit = Number.parseInt(searchParams.get("limit") ?? "30", 10);
    const requestedOffset = Number.parseInt(searchParams.get("offset") ?? "0", 10);
    const limit = Number.isFinite(requestedLimit) ? Math.min(Math.max(requestedLimit, 1), 100) : 30;
    const offset = Number.isFinite(requestedOffset) ? Math.max(requestedOffset, 0) : 0;

    const [{ data: stateRows, error: stateError }, { data: regionRows, error: regionError }] =
      await Promise.all([
        supabase
          .from("friend_member_states")
          .select("target_id, state")
          .eq("owner_id", user.id),
        supabase
          .from("profiles")
          .select("region")
          .not("region", "is", null),
      ]);

    if (stateError) throw stateError;
    if (regionError) throw regionError;

    const excludedIds = new Set<string>([user.id]);
    const subscribedIds = new Set<string>();
    (stateRows ?? []).forEach((row) => {
      if (row.state === "hidden" || row.state === "blocked" || row.state === "black") {
        excludedIds.add(row.target_id);
      }
    });

    const { data: subscriptionRows, error: subscriptionError } = await supabase
      .from("user_subscriptions")
      .select("target_id")
      .eq("owner_id", user.id);
    if (subscriptionError) throw subscriptionError;
    (subscriptionRows ?? []).forEach((row) => subscribedIds.add(row.target_id));

    const availableRegions = Array.from(
      new Set(
        (regionRows ?? [])
          .map((row) => (row.region ?? "").trim())
          .filter(Boolean)
      )
    ).sort((a, b) => a.localeCompare(b, "ko"));

    const excludeList = Array.from(excludedIds);
    const { data, error, count } = await supabase
      .from("profiles")
      .select(
        "id, nickname, profile_image_url, country, region, gender, member_type, role, favorite_genre, created_at",
        { count: "exact" }
      )
      .not("id", "in", `(${excludeList.join(",")})`)
      .order("created_at", { ascending: false })
      .range(offset, offset + limit - 1);

    if (error) throw error;

    const members = (data ?? []).map((member) => ({
      ...member,
      member_type: member.member_type ?? [],
      favorite_genre: member.favorite_genre ?? [],
      is_subscribed: subscribedIds.has(member.id),
      is_hidden: false,
    }));

    return NextResponse.json({
      data: members,
      totalCount: count ?? members.length,
      offset,
      limit,
      availableRegions,
    });
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: "서버 오류" }, { status: 500 });
  }
}
