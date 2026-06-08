import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

const PRE_CHARGE_AMOUNT = 11000;
const PRE_CHARGE_CREDITS = 10;

export async function POST() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const admin = createAdminClient();
  const { data, error } = await admin.rpc("claim_poster_credit_pre_charge", {
    p_user_id: user.id,
    p_amount: PRE_CHARGE_AMOUNT,
    p_credit_amount: PRE_CHARGE_CREDITS,
  });

  if (error) {
    if (error.message.includes("pre_charge_already_used")) {
      return NextResponse.json(
        { error: "이미 외상충전을 사용하셨습니다." },
        { status: 409 }
      );
    }

    console.error("[poster-credits/pre-charge:post]", error);
    return NextResponse.json(
      { error: "외상충전에 실패했습니다." },
      { status: 500 }
    );
  }

  const result = Array.isArray(data) ? data[0] : null;

  return NextResponse.json({
    success: true,
    charged: result?.charged ?? PRE_CHARGE_CREDITS,
    balance: result?.balance ?? null,
  });
}
