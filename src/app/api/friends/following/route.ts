import { createClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";

export async function GET() {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { data, error } = await supabase
      .from("friendships")
      .select("friend_id, profiles!friendships_friend_id_fkey(id, nickname, profile_image_url, region)")
      .eq("user_id", user.id)
      .eq("status", "approved");

    if (error) throw error;

    const following = (data ?? []).map((row) => {
      const p = Array.isArray(row.profiles) ? row.profiles[0] : row.profiles;
      return {
        id: p?.id ?? row.friend_id,
        nickname: p?.nickname ?? "",
        profile_image_url: p?.profile_image_url ?? null,
        region: p?.region ?? null,
      };
    });

    return NextResponse.json({ data: following });
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: "서버 오류" }, { status: 500 });
  }
}
