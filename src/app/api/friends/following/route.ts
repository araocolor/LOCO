import { createClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";

export async function GET() {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const [
      { data, error },
      { data: stateRows, error: stateError },
    ] = await Promise.all([
      supabase
        .from("friendships")
        .select("friend_id, status, updated_at, profiles!friendships_friend_id_fkey(id, nickname, profile_image_url, country, region, member_type)")
        .eq("user_id", user.id)
        .in("status", ["approved", "friend"]),
      supabase
        .from("friend_member_states")
        .select("target_id")
        .eq("owner_id", user.id),
    ]);

    if (error) throw error;
    if (stateError) throw stateError;

    const excludedIds = new Set<string>([
      ...(stateRows ?? []).map((row) => row.target_id),
    ]);

    const following = (data ?? [])
      .map((row) => {
        const p = Array.isArray(row.profiles) ? row.profiles[0] : row.profiles;
        return {
          id: p?.id ?? row.friend_id,
          nickname: p?.nickname ?? "",
          profile_image_url: p?.profile_image_url ?? null,
          country: p?.country ?? null,
          region: p?.region ?? null,
          member_type: p?.member_type ?? [],
          status: row.status,
          friend_accepted_at: row.status === "friend" ? row.updated_at : null,
        };
      })
      .filter((item) => !excludedIds.has(item.id));

    return NextResponse.json({ data: following });
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: "서버 오류" }, { status: 500 });
  }
}
