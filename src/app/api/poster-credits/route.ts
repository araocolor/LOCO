import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

const DEFAULT_FREE_CREDITS = 3;

export async function GET() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const admin = createAdminClient();

  const { data } = await admin
    .from("poster_credits")
    .select("balance")
    .eq("user_id", user.id)
    .single();

  if (data) {
    return NextResponse.json({ balance: data.balance });
  }

  const { data: created } = await admin
    .from("poster_credits")
    .insert({ user_id: user.id, balance: DEFAULT_FREE_CREDITS })
    .select("balance")
    .single();

  return NextResponse.json({ balance: created?.balance ?? DEFAULT_FREE_CREDITS });
}
