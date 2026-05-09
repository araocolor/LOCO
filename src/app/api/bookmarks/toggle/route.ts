import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function POST(req: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ ok: false }, { status: 401 });

  const { class_id, bookmarked } = await req.json() as { class_id: string; bookmarked: boolean };

  if (bookmarked) {
    await supabase.from("class_bookmarks").upsert({ user_id: user.id, class_id, created_at: new Date().toISOString() });
  } else {
    await supabase.from("class_bookmarks").delete().eq("user_id", user.id).eq("class_id", class_id);
  }

  return NextResponse.json({ ok: true });
}
