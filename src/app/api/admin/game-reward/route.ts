import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

// 주간 게임방 점수 리셋(정산): 각 방 1등에게 별 +1 + 알림.
// 관리자만 호출 가능. DB 함수 grant_weekly_game_rewards를 실행한다.
export async function POST() {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { data: adminProfile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single();

  if (adminProfile?.role !== "admin") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { data, error } = await supabase.rpc("grant_weekly_game_rewards");

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ rewarded: data ?? 0 });
}
