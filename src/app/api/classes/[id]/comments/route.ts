import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

interface CommentProfile {
  id: string;
  nickname: string;
  profile_image_url: string | null;
}

interface CommentRow {
  id: string;
  class_id: string;
  profile_id: string;
  parent_id: string | null;
  content: string;
  like_count: number;
  is_deleted: boolean;
  deleted_at: string | null;
  created_at: string;
  profile: CommentProfile | null;
  my_liked?: boolean;
}

function normalizeComment(row: CommentRow, likedCommentIds = new Set<string>()) {
  return {
    id: row.id,
    class_id: row.class_id,
    profile_id: row.profile_id,
    parent_id: row.parent_id,
    content: row.is_deleted ? "" : row.content,
    like_count: row.like_count,
    my_liked: likedCommentIds.has(row.id),
    is_deleted: row.is_deleted,
    deleted_at: row.deleted_at,
    created_at: row.created_at,
    profile: row.profile,
  };
}

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { data, error } = await supabase
    .from("class_comments")
    .select("id, class_id, profile_id, parent_id, content, like_count, is_deleted, deleted_at, created_at, profile:profiles!profile_id(id, nickname, profile_image_url)")
    .eq("class_id", id)
    .order("created_at", { ascending: true })
    .returns<CommentRow[]>();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  let likedCommentIds = new Set<string>();
  const commentIds = (data ?? []).map((comment) => comment.id);
  if (user && commentIds.length > 0) {
    const { data: likedRows } = await supabase
      .from("class_comment_likes")
      .select("comment_id")
      .eq("user_id", user.id)
      .in("comment_id", commentIds)
      .returns<Array<{ comment_id: string }>>();

    likedCommentIds = new Set((likedRows ?? []).map((row) => row.comment_id));
  }

  return NextResponse.json({ comments: (data ?? []).map((comment) => normalizeComment(comment, likedCommentIds)) });
}

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
  const content = typeof body.content === "string" ? body.content.trim() : "";
  const parentId = typeof body.parent_id === "string" && body.parent_id ? body.parent_id : null;

  if (!content) {
    return NextResponse.json({ error: "댓글을 입력해주세요." }, { status: 400 });
  }

  if (content.length > 1000) {
    return NextResponse.json({ error: "댓글은 1000자까지 입력할 수 있습니다." }, { status: 400 });
  }

  if (parentId) {
    const { data: parent, error: parentError } = await supabase
      .from("class_comments")
      .select("id, class_id")
      .eq("id", parentId)
      .eq("class_id", id)
      .maybeSingle<{ id: string; class_id: string }>();

    if (parentError) {
      return NextResponse.json({ error: parentError.message }, { status: 500 });
    }
    if (!parent) {
      return NextResponse.json({ error: "원댓글을 찾을 수 없습니다." }, { status: 404 });
    }
  }

  const { data, error } = await supabase
    .from("class_comments")
    .insert({
      class_id: id,
      profile_id: user.id,
      parent_id: parentId,
      content,
    })
    .select("id, class_id, profile_id, parent_id, content, like_count, is_deleted, deleted_at, created_at, profile:profiles!profile_id(id, nickname, profile_image_url)")
    .single<CommentRow>();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const { count } = await supabase
    .from("class_comments")
    .select("id", { count: "exact", head: true })
    .eq("class_id", id);

  await supabase.from("classes").update({ comment_count: count ?? 0 }).eq("id", id);

  return NextResponse.json({ comment: normalizeComment(data), comment_count: count ?? 0 }, { status: 201 });
}
