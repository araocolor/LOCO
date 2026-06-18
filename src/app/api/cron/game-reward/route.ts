import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

// 매주 금요일 09:00 UTC(=18시 KST) Vercel Cron이 호출.
// 각 방 1등에게 별 +1 + 알림을 지급한다. 중복 방지는 DB 함수가 처리한다.
export async function GET(request: Request) {
  const authHeader = request.headers.get("authorization");
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("grant_weekly_game_rewards");

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ rewarded: data ?? 0 });
}
