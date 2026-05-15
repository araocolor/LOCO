import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { NextResponse } from "next/server";

export async function GET() {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const admin = createAdminClient();

    const [
      { data: followingRows, error: followingError },
      { data: followerRows, error: followerError },
      { data: stateRows, error: stateError },
      { data: subscriptionRows, error: subscriptionError },
      { data: mySubscriberRows, error: mySubscriberError },
    ] = await Promise.all([
      supabase
        .from("friendships")
        .select(
          "friend_id, status, created_at, updated_at, profiles!friendships_friend_id_fkey(id, nickname, profile_image_url, country, region, member_type, role)"
        )
        .eq("user_id", user.id)
        .in("status", ["approved", "friend"]),
      supabase
        .from("friendships")
        .select(
          "user_id, status, created_at, updated_at, profiles!friendships_user_id_fkey(id, nickname, profile_image_url, country, region, member_type, role)"
        )
        .eq("friend_id", user.id)
        .in("status", ["approved", "friend"]),
      supabase
        .from("friend_member_states")
        .select("target_id, state")
        .eq("owner_id", user.id),
      admin
        .from("user_subscriptions")
        .select("target_id")
        .eq("owner_id", user.id),
      admin
        .from("user_subscriptions")
        .select("owner_id, profiles!user_subscriptions_owner_id_fkey(id, nickname, profile_image_url, country, region, member_type, role)")
        .eq("target_id", user.id),
    ]);

    if (followingError) throw followingError;
    if (followerError) throw followerError;
    if (stateError) throw stateError;
    if (subscriptionError) throw subscriptionError;
    if (mySubscriberError) throw mySubscriberError;

    const excludedIds = new Set<string>(
      (stateRows ?? [])
        .filter((row) => row.state === "hidden" || row.state === "blocked" || row.state === "black")
        .map((row) => row.target_id)
    );

    const greyedIds = new Set<string>(
      (stateRows ?? [])
        .filter((row) => row.state === "grey")
        .map((row) => row.target_id)
    );
    const subscribedIds = new Set<string>(
      (subscriptionRows ?? []).map((row) => row.target_id)
    );

    const following = (followingRows ?? [])
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
          is_greyed: greyedIds.has(p?.id ?? row.friend_id),
          is_subscribed: subscribedIds.has(p?.id ?? row.friend_id),
          friend_accepted_at: row.status === "friend" ? row.updated_at : null,
          joined_at: row.created_at ?? null,
          relation_updated_at: row.updated_at ?? null,
        };
      })
      .filter((item) => !excludedIds.has(item.id));

    const followers = (followerRows ?? [])
      .map((row) => {
        const p = Array.isArray(row.profiles) ? row.profiles[0] : row.profiles;
        return {
          id: p?.id ?? row.user_id,
          nickname: p?.nickname ?? "",
          profile_image_url: p?.profile_image_url ?? null,
          country: p?.country ?? null,
          region: p?.region ?? null,
          member_type: p?.member_type ?? [],
          role: p?.role ?? "member",
          status: row.status,
          is_subscribed: subscribedIds.has(p?.id ?? row.user_id),
          friend_accepted_at: row.status === "friend" ? row.updated_at : null,
          joined_at: row.created_at ?? null,
          relation_updated_at: row.updated_at ?? null,
        };
      })
      .filter((item) => !excludedIds.has(item.id))
      .sort((a, b) => (a.nickname ?? "").localeCompare(b.nickname ?? "", "ko"));

    const mySubscribers = (mySubscriberRows ?? [])
      .map((row) => {
        const p = Array.isArray(row.profiles) ? row.profiles[0] : row.profiles;
        return {
          id: p?.id ?? row.owner_id,
          nickname: p?.nickname ?? "",
          profile_image_url: p?.profile_image_url ?? null,
          country: p?.country ?? null,
          region: p?.region ?? null,
          member_type: p?.member_type ?? [],
          role: p?.role ?? "member",
          is_subscribed: subscribedIds.has(p?.id ?? row.owner_id),
        };
      })
      .filter((item) => !excludedIds.has(item.id))
      .sort((a, b) => (a.nickname ?? "").localeCompare(b.nickname ?? "", "ko"));

    return NextResponse.json({ data: { following, followers, subscriptionCount: mySubscribers.length, mySubscribers } });
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: "서버 오류" }, { status: 500 });
  }
}
