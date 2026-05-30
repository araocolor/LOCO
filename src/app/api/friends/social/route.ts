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
          "friend_id, status, created_at, updated_at, profiles!friendships_friend_id_fkey(id, nickname, profile_image_url, bio, country, region, last_active_at, member_type, role)"
        )
        .eq("user_id", user.id)
        .in("status", ["approved", "friend"]),
      supabase
        .from("friendships")
        .select(
          "user_id, status, created_at, updated_at, profiles!friendships_user_id_fkey(id, nickname, profile_image_url, bio, country, region, last_active_at, member_type, role)"
        )
        .eq("friend_id", user.id)
        .in("status", ["approved", "friend"]),
      supabase
        .from("friend_member_states")
        .select("target_id, state")
        .eq("owner_id", user.id),
      supabase
        .from("user_subscriptions")
        .select("target_id")
        .eq("owner_id", user.id),
      supabase
        .from("user_subscriptions")
        .select("owner_id, profiles!user_subscriptions_owner_id_fkey(id, nickname, profile_image_url, bio, country, region, last_active_at, member_type, role)")
        .eq("target_id", user.id),
    ]);

    if (followingError) throw followingError;
    if (followerError) throw followerError;
    if (stateError) throw stateError;
    if (subscriptionError) console.error("[friends-social] subscriptions failed", subscriptionError);
    if (mySubscriberError) console.error("[friends-social] my subscribers failed", mySubscriberError);

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
      (subscriptionError ? [] : subscriptionRows ?? []).map((row) => row.target_id)
    );

    const allMemberIds = new Set<string>();

    (followingRows ?? []).forEach((row) => {
      const p = Array.isArray(row.profiles) ? row.profiles[0] : row.profiles;
      const id = p?.id ?? row.friend_id;
      if (!excludedIds.has(id)) allMemberIds.add(id);
    });
    (followerRows ?? []).forEach((row) => {
      const p = Array.isArray(row.profiles) ? row.profiles[0] : row.profiles;
      const id = p?.id ?? row.user_id;
      if (!excludedIds.has(id)) allMemberIds.add(id);
    });
    (mySubscriberError ? [] : mySubscriberRows ?? []).forEach((row) => {
      const p = Array.isArray(row.profiles) ? row.profiles[0] : row.profiles;
      const id = p?.id ?? row.owner_id;
      if (!excludedIds.has(id)) allMemberIds.add(id);
    });

    const admin = createAdminClient();
    const memberIdList = [...allMemberIds];
    const starCountMap = new Map<string, number>();

    if (memberIdList.length > 0) {
      const { data: starRows } = await admin
        .from("star_gifts")
        .select("receiver_id, count")
        .in("receiver_id", memberIdList);

      for (const row of starRows ?? []) {
        const prev = starCountMap.get(row.receiver_id) ?? 0;
        starCountMap.set(row.receiver_id, prev + Number(row.count ?? 0));
      }
    }

    const following = (followingRows ?? [])
      .map((row) => {
        const p = Array.isArray(row.profiles) ? row.profiles[0] : row.profiles;
        const id = p?.id ?? row.friend_id;
        return {
          id,
          nickname: p?.nickname ?? "",
          profile_image_url: p?.profile_image_url ?? null,
          bio: p?.bio ?? null,
          country: p?.country ?? null,
          region: p?.region ?? null,
          last_active_at: p?.last_active_at ?? null,
          member_type: p?.member_type ?? [],
          role: p?.role ?? "member",
          status: row.status,
          is_greyed: greyedIds.has(id),
          is_subscribed: subscribedIds.has(id),
          friend_accepted_at: row.status === "friend" ? row.updated_at : null,
          joined_at: row.created_at ?? null,
          relation_updated_at: row.updated_at ?? null,
          received_star_count: starCountMap.get(id) ?? 0,
        };
      })
      .filter((item) => !excludedIds.has(item.id));

    const followers = (followerRows ?? [])
      .map((row) => {
        const p = Array.isArray(row.profiles) ? row.profiles[0] : row.profiles;
        const id = p?.id ?? row.user_id;
        return {
          id,
          nickname: p?.nickname ?? "",
          profile_image_url: p?.profile_image_url ?? null,
          bio: p?.bio ?? null,
          country: p?.country ?? null,
          region: p?.region ?? null,
          last_active_at: p?.last_active_at ?? null,
          member_type: p?.member_type ?? [],
          role: p?.role ?? "member",
          status: row.status,
          is_subscribed: subscribedIds.has(id),
          friend_accepted_at: row.status === "friend" ? row.updated_at : null,
          joined_at: row.created_at ?? null,
          relation_updated_at: row.updated_at ?? null,
          received_star_count: starCountMap.get(id) ?? 0,
        };
      })
      .filter((item) => !excludedIds.has(item.id))
      .sort((a, b) => (a.nickname ?? "").localeCompare(b.nickname ?? "", "ko"));

    const mySubscribers = (mySubscriberError ? [] : mySubscriberRows ?? [])
      .map((row) => {
        const p = Array.isArray(row.profiles) ? row.profiles[0] : row.profiles;
        const id = p?.id ?? row.owner_id;
        return {
          id,
          nickname: p?.nickname ?? "",
          profile_image_url: p?.profile_image_url ?? null,
          bio: p?.bio ?? null,
          country: p?.country ?? null,
          region: p?.region ?? null,
          last_active_at: p?.last_active_at ?? null,
          member_type: p?.member_type ?? [],
          role: p?.role ?? "member",
          is_subscribed: subscribedIds.has(id),
          received_star_count: starCountMap.get(id) ?? 0,
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
