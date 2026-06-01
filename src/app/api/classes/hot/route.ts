import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const sort = searchParams.get("sort") ?? "like_count";
  const limit = Math.min(Math.max(Number(searchParams.get("limit") ?? "12"), 1), 50);

  const supabase = await createClient();

  let query = supabase
    .from("classes")
    .select("*, host:profiles!host_id(id, nickname, profile_image_url)");

  if (sort === "view_count") {
    query = query.order("view_count", { ascending: false });
  } else if (sort === "comment_count") {
    query = query.order("comment_count", { ascending: false });
  } else {
    query = query.order("like_count", { ascending: false });
  }

  const { data, error } = await query.limit(limit);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ classes: data ?? [] });
}
