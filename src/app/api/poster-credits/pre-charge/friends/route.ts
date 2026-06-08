import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

interface FriendRow {
  status: string;
  friend_id?: string;
  user_id?: string;
  profiles:
    | {
        id: string;
        nickname: string | null;
        profile_image_url: string | null;
      }
    | Array<{
        id: string;
        nickname: string | null;
        profile_image_url: string | null;
      }>
    | null;
}

function getProfile(row: FriendRow) {
  return Array.isArray(row.profiles) ? row.profiles[0] : row.profiles;
}

export async function GET() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const [{ data: followingRows, error: followingError }, { data: followerRows, error: followerError }] =
    await Promise.all([
      supabase
        .from("friendships")
        .select("friend_id, status, profiles!friendships_friend_id_fkey(id, nickname, profile_image_url)")
        .eq("user_id", user.id)
        .in("status", ["friend", "approved"])
        .limit(10),
      supabase
        .from("friendships")
        .select("user_id, status, profiles!friendships_user_id_fkey(id, nickname, profile_image_url)")
        .eq("friend_id", user.id)
        .in("status", ["friend", "approved"])
        .limit(10),
    ]);

  if (followingError || followerError) {
    console.error("[poster-credits/pre-charge/friends:get]", followingError ?? followerError);
    return NextResponse.json({ error: "친구 아바타를 불러오지 못했습니다." }, { status: 500 });
  }

  const seen = new Set<string>();
  const rows = [...((followingRows ?? []) as FriendRow[]), ...((followerRows ?? []) as FriendRow[])]
    .sort((a, b) => Number(b.status === "friend") - Number(a.status === "friend"));

  const friends = rows.flatMap((row) => {
    const profile = getProfile(row);
    const id = profile?.id ?? row.friend_id ?? row.user_id;
    if (!id || seen.has(id)) return [];
    seen.add(id);
    return [
      {
        id,
        nickname: profile?.nickname ?? "회원",
        profile_image_url: profile?.profile_image_url ?? null,
      },
    ];
  }).slice(0, 5);

  return NextResponse.json({ friends });
}
