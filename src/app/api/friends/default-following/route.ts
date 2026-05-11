import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { ensureDefaultFollowing } from "@/lib/friends/default-following";

export async function POST() {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    await ensureDefaultFollowing(user.id);
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: "서버 오류" }, { status: 500 });
  }
}
