import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

interface CommentRow {
  id: string;
  post_id: string;
  profile_id: string;
  parent_id: string | null;
  content: string;
  like_count: number;
  is_deleted: boolean;
  deleted_at: string | null;
  created_at: string;
  profile: { id: string; nickname: string; profile_image_url: string | null } | null;
}

function normalizeComment(row: CommentRow, likedIds = new Set<string>()) {
  return {
    id: row.id,
    post_id: row.post_id,
    profile_id: row.profile_id,
    parent_id: row.parent_id,
    content: row.is_deleted ? "" : row.content,
    like_count: row.like_count,
    my_liked: likedIds.has(row.id),
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
    .from("board_comments")
    .select(
      "id, post_id, profile_id, parent_id, content, like_count, is_deleted, deleted_at, created_at, profile:profiles!profile_id(id, nickname, profile_image_url)"
    )
    .eq("post_id", id)
    .order("created_at", { ascending: true })
    .returns<CommentRow[]>();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  let likedIds = new Set<string>();
  const commentIds = (data ?? []).map((c) => c.id);
  if (user && commentIds.length > 0) {
    const { data: likedRows } = await supabase
      .from("board_comment_likes")
      .select("comment_id")
      .eq("user_id", user.id)
      .in("comment_id", commentIds)
      .returns<Array<{ comment_id: string }>>();

    likedIds = new Set((likedRows ?? []).map((r) => r.comment_id));
  }

  return NextResponse.json({
    comments: (data ?? []).map((c) => normalizeComment(c, likedIds)),
  });
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

  const { data: post } = await supabase
    .from("board_posts")
    .select("comment_enabled")
    .eq("id", id)
    .single<{ comment_enabled: boolean }>();

  if (!post?.comment_enabled) {
    return NextResponse.json({ error: "댓글이 비활성화된 게시글입니다." }, { status: 403 });
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
    const { data: parent } = await supabase
      .from("board_comments")
      .select("id, post_id")
      .eq("id", parentId)
      .eq("post_id", id)
      .maybeSingle<{ id: string; post_id: string }>();

    if (!parent) {
      return NextResponse.json({ error: "원댓글을 찾을 수 없습니다." }, { status: 404 });
    }
  }

  const { data, error } = await supabase
    .from("board_comments")
    .insert({ post_id: id, profile_id: user.id, parent_id: parentId, content })
    .select(
      "id, post_id, profile_id, parent_id, content, like_count, is_deleted, deleted_at, created_at, profile:profiles!profile_id(id, nickname, profile_image_url)"
    )
    .single<CommentRow>();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const { count } = await supabase
    .from("board_comments")
    .select("id", { count: "exact", head: true })
    .eq("post_id", id);

  await supabase.from("board_posts").update({ comment_count: count ?? 0 }).eq("id", id);

  return NextResponse.json(
    { comment: normalizeComment(data), comment_count: count ?? 0 },
    { status: 201 }
  );
}
