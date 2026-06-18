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

  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single();

  if (profile?.role !== "admin") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const admin = createAdminClient();
  const { data, error } = await admin
    .from("poster_payments")
    .select("id, user_id, amount, credit_amount, payment_type, status, partner_order_id, created_at, approved_at")
    .order("created_at", { ascending: false })
    .limit(200);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const userIds = [...new Set((data ?? []).map((p) => p.user_id))];
  const { data: profiles } = await admin
    .from("profiles")
    .select("id, nickname, email")
    .in("id", userIds);

  const profileMap = new Map(
    (profiles ?? []).map((p) => [p.id, { nickname: p.nickname, email: p.email }])
  );

  const payments = (data ?? []).map((p) => ({
    ...p,
    nickname: profileMap.get(p.user_id)?.nickname ?? "알 수 없음",
    email: profileMap.get(p.user_id)?.email ?? null,
  }));

  return NextResponse.json({ payments });
}
