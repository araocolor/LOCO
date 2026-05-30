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

  const [receivedStarResult, giftedStarResult, myStarWalletResult] = await Promise.all([
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

  return NextResponse.json({
    received_star_count: receivedStarResult.error
      ? 0
      : (receivedStarResult.data ?? []).reduce((total, row) => total + Number(row.count ?? 0), 0),
    gifted_star_count_by_me: giftedStarResult?.data?.count ?? 0,
    my_star_balance: myStarWalletResult?.data?.balance ?? 0,
  });
}
