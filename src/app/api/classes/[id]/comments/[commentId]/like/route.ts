import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { NextRequest, NextResponse } from "next/server";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; commentId: string }> }
) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id, commentId } = await params;
  const body = await request.json().catch(() => ({}));
  const liked = body.liked === true;
  const admin = createAdminClient();

  const { data: comment, error: commentError } = await admin
    .from("class_comments")
    .select("id, class_id")
    .eq("id", commentId)
    .eq("class_id", id)
    .maybeSingle<{ id: string; class_id: string }>();

  if (commentError) return NextResponse.json({ error: commentError.message }, { status: 500 });
  if (!comment) return NextResponse.json({ error: "댓글을 찾을 수 없습니다." }, { status: 404 });

  if (liked) {
    const { error } = await admin
      .from("class_comment_likes")
      .upsert(
        { comment_id: commentId, user_id: user.id, created_at: new Date().toISOString() },
        { onConflict: "comment_id,user_id" }
      );
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  } else {
    const { error } = await admin
      .from("class_comment_likes")
      .delete()
      .eq("comment_id", commentId)
      .eq("user_id", user.id);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const { count, error: countError } = await admin
    .from("class_comment_likes")
    .select("comment_id", { count: "exact", head: true })
    .eq("comment_id", commentId);

  if (countError) return NextResponse.json({ error: countError.message }, { status: 500 });

  await admin.from("class_comments").update({ like_count: count ?? 0 }).eq("id", commentId);

  return NextResponse.json({ liked, like_count: count ?? 0 });
}
