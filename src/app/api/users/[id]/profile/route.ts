import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const admin = createAdminClient();

  const [profileResult, receivedStarResult, giftedStarResult, myStarWalletResult] = await Promise.all([
    supabase
      .from("profiles")
      .select("id, email, nickname, profile_image_url, bio, member_type, country, region, last_active_at")
      .eq("id", id)
      .single(),
    admin
      .from("star_gifts")
      .select("count")
      .eq("receiver_id", id),
    user
      ? admin
          .from("star_gifts")
          .select("count")
          .eq("giver_id", user.id)
          .eq("receiver_id", id)
          .maybeSingle()
      : Promise.resolve({ data: null, error: null }),
    user
      ? admin
          .from("star_wallets")
          .select("balance")
          .eq("user_id", user.id)
          .maybeSingle()
      : Promise.resolve({ data: null, error: null }),
  ]);

  const profile = profileResult.data;
  if (!profile) {
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  }

  return NextResponse.json({
    profile: {
      id: profile.id,
      email: profile.email ?? (user?.id === id ? user.email ?? null : null),
      nickname: profile.nickname,
      bio: profile.bio,
      country: profile.country ?? null,
      last_active_at: profile.last_active_at ?? null,
      member_type: profile.member_type ?? [],
      profile_image_url: profile.profile_image_url,
      region: profile.region ?? null,
      received_star_count: receivedStarResult.error
        ? 0
        : (receivedStarResult.data ?? []).reduce((total, row) => total + Number(row.count ?? 0), 0),
    },
    starSummary: {
      gifted_star_count_by_me: giftedStarResult?.data?.count ?? 0,
      my_star_balance: myStarWalletResult?.data?.balance ?? 0,
    },
  });
}
