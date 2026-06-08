import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

export async function GET() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const admin = createAdminClient();
  const { data, error } = await admin
    .from("poster_payments")
    .select("id")
    .eq("user_id", user.id)
    .eq("payment_type", "pre_charge")
    .maybeSingle();

  if (error) {
    console.error("[poster-credits/pre-charge/check:get]", error);
    return NextResponse.json(
      { error: "외상충전 사용 여부를 확인하지 못했습니다." },
      { status: 500 }
    );
  }

  return NextResponse.json({ used: Boolean(data) });
}
