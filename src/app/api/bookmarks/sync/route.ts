import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

interface SyncPayload {
  bookmarks?: Array<{ id?: string; created_at?: string }> | string[];
}

function normalizeBookmarks(payload: SyncPayload): { id: string; created_at: string }[] {
  const bookmarks = payload.bookmarks;
  if (!Array.isArray(bookmarks)) return [];

  if (bookmarks.every((item) => typeof item === "string")) {
    const now = new Date().toISOString();
    return (bookmarks as string[]).map((id) => ({ id, created_at: now }));
  }

  const safe = bookmarks as Array<{ id?: string; created_at?: string }>;
  return safe.filter((b) => typeof b.id === "string" && typeof b.created_at === "string") as Array<{
    id: string;
    created_at: string;
  }>;
}

export async function POST(req: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });
  }

  let payload: SyncPayload = {};
  try {
    const text = await req.text();
    if (text) payload = JSON.parse(text) as SyncPayload;
  } catch {}

  const bookmarks = normalizeBookmarks(payload);

  // 기존 스냅샷 교체 방식: 로컬 상태를 서버에 그대로 반영
  await supabase.from("class_bookmarks").delete().eq("user_id", user.id);
  if (bookmarks.length > 0) {
    await supabase.from("class_bookmarks").insert(
      bookmarks.map((b) => ({
        user_id: user.id,
        class_id: b.id,
        created_at: b.created_at,
      }))
    );
  }

  return NextResponse.json({ ok: true, count: bookmarks.length });
}
