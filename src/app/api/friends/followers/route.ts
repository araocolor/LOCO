import { createClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";

export async function GET() {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const [{ data, error }, { data: admins }] = await Promise.all([
      supabase
        .from("friendships")
        .select("user_id, profiles!friendships_user_id_fkey(id, nickname, profile_image_url)")
        .eq("friend_id", user.id)
        .eq("status", "approved"),
      supabase
        .from("profiles")
        .select("id, nickname, profile_image_url")
        .eq("role", "admin")
        .neq("id", user.id),
    ]);

    if (error) throw error;

    const followers = (data ?? []).map((row) => {
      const p = Array.isArray(row.profiles) ? row.profiles[0] : row.profiles;
      return {
        id: p?.id ?? row.user_id,
        nickname: p?.nickname ?? "",
        profile_image_url: p?.profile_image_url ?? null,
      };
    });

    const followerIds = new Set(followers.map((f) => f.id));
    const adminFollowers = (admins ?? [])
      .filter((a) => !followerIds.has(a.id))
      .map((a) => ({
        id: a.id,
        nickname: a.nickname ?? "",
        profile_image_url: a.profile_image_url ?? null,
      }));

    return NextResponse.json({ data: [...followers, ...adminFollowers] });
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: "서버 오류" }, { status: 500 });
  }
}
