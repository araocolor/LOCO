import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

interface PostRow {
  id: string;
  author_id: string;
  category: string;
  title: string;
  content: string;
  images: unknown[];
  blocks: unknown[];
  comment_enabled: boolean;
  is_pinned: boolean;
  view_count: number;
  like_count: number;
  comment_count: number;
  created_at: string;
  author: { id: string; nickname: string; profile_image_url: string | null } | null;
}

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("board_posts")
    .select(
      "id, author_id, category, title, content, images, blocks, comment_enabled, is_pinned, view_count, like_count, comment_count, created_at, author:profiles!author_id(id, nickname, profile_image_url)"
    )
    .eq("id", id)
    .single<PostRow>();

  if (error) {
    return NextResponse.json({ error: "게시글을 찾을 수 없습니다." }, { status: 404 });
  }

  await supabase
    .from("board_posts")
    .update({ view_count: (data.view_count ?? 0) + 1 })
    .eq("id", id);

  const {
    data: { user },
  } = await supabase.auth.getUser();

  let myLiked = false;
  if (user) {
    const { data: likeRow } = await supabase
      .from("board_post_likes")
      .select("post_id")
      .eq("post_id", id)
      .eq("user_id", user.id)
      .maybeSingle();

    myLiked = !!likeRow;
  }

  return NextResponse.json({
    post: { ...data, view_count: (data.view_count ?? 0) + 1, my_liked: myLiked },
  });
}

export async function PATCH(
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
  const updates: Record<string, unknown> = {};
  if (typeof body.title === "string") updates.title = body.title.trim();
  if (typeof body.content === "string") updates.content = body.content.trim();
  if (Array.isArray(body.images)) updates.images = body.images;
  if (Array.isArray(body.blocks)) updates.blocks = body.blocks;
  if (typeof body.comment_enabled === "boolean") updates.comment_enabled = body.comment_enabled;

  if (Object.keys(updates).length === 0) {
    return NextResponse.json({ error: "수정할 내용이 없습니다." }, { status: 400 });
  }

  const { data: post } = await supabase
    .from("board_posts")
    .select("author_id")
    .eq("id", id)
    .single<{ author_id: string }>();

  if (!post) {
    return NextResponse.json({ error: "게시글을 찾을 수 없습니다." }, { status: 404 });
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single<{ role: string }>();

  if (post.author_id !== user.id && profile?.role !== "admin") {
    return NextResponse.json({ error: "수정 권한이 없습니다." }, { status: 403 });
  }

  const { error } = await supabase.from("board_posts").update(updates).eq("id", id);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}

export async function DELETE(
  _request: NextRequest,
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
    .select("author_id")
    .eq("id", id)
    .single<{ author_id: string }>();

  if (!post) {
    return NextResponse.json({ error: "게시글을 찾을 수 없습니다." }, { status: 404 });
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single<{ role: string }>();

  if (post.author_id !== user.id && profile?.role !== "admin") {
    return NextResponse.json({ error: "삭제 권한이 없습니다." }, { status: 403 });
  }

  const { error } = await supabase.from("board_posts").delete().eq("id", id);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}
