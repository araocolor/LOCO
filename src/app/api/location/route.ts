import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

function formatSupabaseError(error: { message: string; code?: string; details?: string; hint?: string }) {
  return {
    message: error.message,
    code: error.code ?? null,
    details: error.details ?? null,
    hint: error.hint ?? null,
  };
}

export async function POST(req: Request) {
  const supabase = await createClient();
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError) {
    return NextResponse.json({ ok: false, error: formatSupabaseError(authError) }, { status: 401 });
  }
  if (!user) return NextResponse.json({ ok: false, error: { message: "로그인이 필요합니다." } }, { status: 401 });

  const { lat, lng } = await req.json() as { lat: number; lng: number };

  const { error } = await supabase.from("user_locations").upsert({
    user_id: user.id,
    lat,
    lng,
    updated_at: new Date().toISOString(),
  }, { onConflict: "user_id" });

  if (error) {
    return NextResponse.json({ ok: false, error: formatSupabaseError(error) }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}

export async function DELETE() {
  const supabase = await createClient();
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError) {
    return NextResponse.json({ ok: false, error: formatSupabaseError(authError) }, { status: 401 });
  }
  if (!user) return NextResponse.json({ ok: false, error: { message: "로그인이 필요합니다." } }, { status: 401 });

  const { error } = await supabase.from("user_locations").delete().eq("user_id", user.id);
  if (error) {
    return NextResponse.json({ ok: false, error: formatSupabaseError(error) }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
