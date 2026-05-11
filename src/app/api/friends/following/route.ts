import { createClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";

export async function GET() {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const pendingCutoff = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
    const [
      { data, error },
      { data: stateRows, error: stateError },
    ] = await Promise.all([
      supabase
        .from("friendships")
        .select("friend_id, status, created_at, updated_at, profiles!friendships_friend_id_fkey(id, nickname, profile_image_url, country, region, member_type, role)")
        .eq("user_id", user.id)
        .in("status", ["pending", "approved", "friend"]),
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
          role: p?.role ?? "member",
          status: row.status,
          friend_accepted_at: row.status === "friend" ? row.updated_at : null,
          joined_at: row.created_at ?? null,
          relation_updated_at: row.updated_at ?? null,
        };
      })
      .filter((item) => !excludedIds.has(item.id))
      .filter((item) => item.status !== "pending" || (item.relation_updated_at ?? "") >= pendingCutoff);

    return NextResponse.json({ data: following });
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: "서버 오류" }, { status: 500 });
  }
}
