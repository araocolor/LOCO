import { createClient } from "@/lib/supabase/server";
import { NextRequest, NextResponse } from "next/server";

export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // 이미 관계가 있거나(신청/친구) 상태처리(숨김/차단/블랙)한 사람은 제외
    const [{ data: relations }, { data: states }] = await Promise.all([
      supabase
        .from("friendships")
        .select("friend_id")
        .eq("user_id", user.id)
        .in("status", ["pending", "approved", "friend"]),
      supabase
        .from("friend_member_states")
        .select("target_id")
        .eq("owner_id", user.id),
    ]);

    const relationIds = (relations ?? []).map((f) => f.friend_id);
    const stateIds = (states ?? []).map((s) => s.target_id);
    const excludeIds = [...new Set([...relationIds, ...stateIds, user.id])];
    const { searchParams } = new URL(request.url);
    const region = (searchParams.get("region") ?? "").trim();
    const requestedLimit = Number.parseInt(searchParams.get("limit") ?? "30", 10);
    const limit = Number.isFinite(requestedLimit) ? Math.min(Math.max(requestedLimit, 1), 100) : 30;

    let query = supabase
      .from("profiles")
      .select("id, nickname, profile_image_url, region")
      .not("id", "in", `(${excludeIds.join(",")})`)
      .limit(100);
    if (region) query = query.eq("region", region);

    const { data, error } = await query;

    if (error) throw error;

    const shuffled = (data ?? []).sort(() => Math.random() - 0.5).slice(0, limit);

    return NextResponse.json({ data: shuffled });
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: "서버 오류" }, { status: 500 });
  }
}
