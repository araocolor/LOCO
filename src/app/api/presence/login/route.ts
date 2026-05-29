import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function POST() {
  try {
    const supabase = await createClient();
    const {
      data: { session },
    } = await supabase.auth.getSession();

    if (!session?.user) {
      return NextResponse.json({ error: "unauthorized" }, { status: 401 });
    }

    const { error } = await supabase
      .from("profiles")
      .update({ last_active_at: new Date().toISOString() })
      .eq("id", session.user.id);

    if (error) {
      throw error;
    }

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("[presence-login] update failed", error);
    return NextResponse.json({ error: "update_failed" }, { status: 500 });
  }
}
