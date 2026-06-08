import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

const FREE_CHARGE_CREDITS = 10;

export async function POST() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const admin = createAdminClient();

  const { data: profile } = await admin
    .from("profiles")
    .select("kakao_id")
    .eq("id", user.id)
    .single();

  if (profile?.kakao_id === "1") {
    return NextResponse.json(
      { error: "이미 외상충전을 사용하셨습니다." },
      { status: 409 }
    );
  }

  const { data: credit } = await admin
    .from("poster_credits")
    .select("balance")
    .eq("user_id", user.id)
    .single();

  if (credit) {
    await admin
      .from("poster_credits")
      .update({ balance: credit.balance + FREE_CHARGE_CREDITS })
      .eq("user_id", user.id);
  } else {
    await admin
      .from("poster_credits")
      .insert({ user_id: user.id, balance: FREE_CHARGE_CREDITS });
  }

  await admin
    .from("profiles")
    .update({ kakao_id: "1" })
    .eq("id", user.id);

  return NextResponse.json({ success: true, charged: FREE_CHARGE_CREDITS });
}
