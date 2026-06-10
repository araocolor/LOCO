import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json().catch(() => ({}));
  const liked = body.liked === true;

  if (liked) {
    await supabase
      .from("board_post_likes")
      .upsert({ post_id: id, user_id: user.id }, { onConflict: "post_id,user_id" });
  } else {
    await supabase
      .from("board_post_likes")
      .delete()
      .eq("post_id", id)
      .eq("user_id", user.id);
  }

  const { count } = await supabase
    .from("board_post_likes")
    .select("post_id", { count: "exact", head: true })
    .eq("post_id", id);

  await supabase.from("board_posts").update({ like_count: count ?? 0 }).eq("id", id);

  return NextResponse.json({ like_count: count ?? 0, liked });
}
