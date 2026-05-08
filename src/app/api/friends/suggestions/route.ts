import { createClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";

export async function GET() {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // 이미 친구인 사람 id 목록
    const { data: friends } = await supabase
      .from("friendships")
      .select("friend_id")
      .eq("user_id", user.id)
      .eq("status", "approved");

    const friendIds = (friends ?? []).map((f) => f.friend_id);
    const excludeIds = [...friendIds, user.id];

    // 친구가 아닌 사람 중 랜덤 10명
    const { data, error } = await supabase
      .from("profiles")
      .select("id, nickname, profile_image_url, region")
      .not("id", "in", `(${excludeIds.join(",")})`)
      .limit(50);

    if (error) throw error;

    // 클라이언트에서 랜덤 10명 추출
    const shuffled = (data ?? []).sort(() => Math.random() - 0.5).slice(0, 10);

    return NextResponse.json({ data: shuffled });
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: "서버 오류" }, { status: 500 });
  }
}
