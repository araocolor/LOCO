import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function POST(req: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ ok: false }, { status: 401 });

  const { lat, lng } = await req.json() as { lat: number; lng: number };

  await supabase.from("user_locations").upsert({
    user_id: user.id,
    lat,
    lng,
    updated_at: new Date().toISOString(),
  });

  return NextResponse.json({ ok: true });
}

export async function DELETE() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ ok: false }, { status: 401 });

  await supabase.from("user_locations").delete().eq("user_id", user.id);
  return NextResponse.json({ ok: true });
}
