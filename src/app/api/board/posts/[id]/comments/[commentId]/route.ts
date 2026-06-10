import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; commentId: string }> }
) {
  const { id, commentId } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json().catch(() => ({}));
  const content = typeof body.content === "string" ? body.content.trim() : "";

  if (!content) {
    return NextResponse.json({ error: "댓글을 입력해주세요." }, { status: 400 });
  }

  const { data: comment } = await supabase
    .from("board_comments")
    .select("id, profile_id, post_id")
    .eq("id", commentId)
    .eq("post_id", id)
    .single<{ id: string; profile_id: string; post_id: string }>();

  if (!comment) {
    return NextResponse.json({ error: "댓글을 찾을 수 없습니다." }, { status: 404 });
  }

  if (comment.profile_id !== user.id) {
    return NextResponse.json({ error: "본인 댓글만 수정할 수 있습니다." }, { status: 403 });
  }

  const { error } = await supabase
    .from("board_comments")
    .update({ content })
    .eq("id", commentId);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ success: true, content });
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string; commentId: string }> }
) {
  const { id, commentId } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { data: comment } = await supabase
    .from("board_comments")
    .select("id, profile_id, post_id")
    .eq("id", commentId)
    .eq("post_id", id)
    .single<{ id: string; profile_id: string; post_id: string }>();

  if (!comment) {
    return NextResponse.json({ error: "댓글을 찾을 수 없습니다." }, { status: 404 });
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single<{ role: string }>();

  if (comment.profile_id !== user.id && profile?.role !== "admin") {
    return NextResponse.json({ error: "삭제 권한이 없습니다." }, { status: 403 });
  }

  const { error } = await supabase
    .from("board_comments")
    .update({ is_deleted: true, deleted_at: new Date().toISOString(), content: "" })
    .eq("id", commentId);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const { count } = await supabase
    .from("board_comments")
    .select("id", { count: "exact", head: true })
    .eq("post_id", id)
    .eq("is_deleted", false);

  await supabase.from("board_posts").update({ comment_count: count ?? 0 }).eq("id", id);

  return NextResponse.json({ success: true, comment_count: count ?? 0 });
}
