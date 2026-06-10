import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; commentId: string }> }
) {
  const { commentId } = await params;
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
      .from("board_comment_likes")
      .upsert(
        { comment_id: commentId, user_id: user.id },
        { onConflict: "comment_id,user_id" }
      );
  } else {
    await supabase
      .from("board_comment_likes")
      .delete()
      .eq("comment_id", commentId)
      .eq("user_id", user.id);
  }

  const { count } = await supabase
    .from("board_comment_likes")
    .select("comment_id", { count: "exact", head: true })
    .eq("comment_id", commentId);

  await supabase
    .from("board_comments")
    .update({ like_count: count ?? 0 })
    .eq("id", commentId);

  return NextResponse.json({ like_count: count ?? 0, liked });
}
