import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function GET() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ ids: [] });

  const { data } = await supabase
    .from("class_bookmarks")
    .select("class_id, created_at")
    .eq("user_id", user.id);

  const bookmarks = (data ?? []).map((r) => ({ id: r.class_id, created_at: r.created_at }));
  const ids = bookmarks.map((r) => r.id);
  return NextResponse.json({ ids, bookmarks });
}
