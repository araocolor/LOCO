import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

export async function POST() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const admin = createAdminClient();

  const { data: verification } = await admin
    .from("phone_verifications")
    .select("id")
    .eq("user_id", user.id)
    .eq("verified", true)
    .limit(1)
    .maybeSingle();

  if (!verification) {
    return NextResponse.json({ error: "휴대폰 인증이 필요합니다" }, { status: 403 });
  }

  const { error } = await admin
    .from("profiles")
    .update({ role: "pro" })
    .eq("id", user.id);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
