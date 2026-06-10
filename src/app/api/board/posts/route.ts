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

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const category = searchParams.get("category") ?? "notice";
  const page = Math.max(1, Number(searchParams.get("page") ?? 1));
  const limit = 20;
  const offset = (page - 1) * limit;

  const supabase = await createClient();

  const { data, error, count } = await supabase
    .from("board_posts")
    .select(
      "id, author_id, category, title, content, images, blocks, comment_enabled, is_pinned, view_count, like_count, comment_count, created_at, author:profiles!author_id(id, nickname, profile_image_url)",
      { count: "exact" }
    )
    .eq("category", category)
    .order("is_pinned", { ascending: false })
    .order("created_at", { ascending: false })
    .range(offset, offset + limit - 1)
    .returns<PostRow[]>();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({
    posts: data ?? [],
    total: count ?? 0,
    page,
    hasMore: (count ?? 0) > offset + limit,
  });
}

export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json().catch(() => ({}));
  const category = typeof body.category === "string" ? body.category : "";
  const title = typeof body.title === "string" ? body.title.trim() : "";
  const content = typeof body.content === "string" ? body.content.trim() : "";
  const images = Array.isArray(body.images) ? body.images : [];
  const blocks = Array.isArray(body.blocks) ? body.blocks : [];
  const commentEnabled = body.comment_enabled !== false;

  if (!["notice", "support", "free"].includes(category)) {
    return NextResponse.json({ error: "올바른 카테고리를 선택해주세요." }, { status: 400 });
  }

  if (!title) {
    return NextResponse.json({ error: "제목을 입력해주세요." }, { status: 400 });
  }

  if (category === "notice") {
    const { data: profile } = await supabase
      .from("profiles")
      .select("role")
      .eq("id", user.id)
      .single<{ role: string }>();

    if (profile?.role !== "admin") {
      return NextResponse.json({ error: "관리자만 작성할 수 있습니다." }, { status: 403 });
    }
  }

  const { data, error } = await supabase
    .from("board_posts")
    .insert({
      author_id: user.id,
      category,
      title,
      content,
      images,
      blocks,
      comment_enabled: commentEnabled,
    })
    .select(
      "id, author_id, category, title, content, images, blocks, comment_enabled, is_pinned, view_count, like_count, comment_count, created_at, author:profiles!author_id(id, nickname, profile_image_url)"
    )
    .single<PostRow>();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ post: data }, { status: 201 });
}
