import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";

interface MentionProfileRow {
  id: string;
  nickname: string;
}

export async function GET(request: NextRequest) {
  try {
    const rawHandles = request.nextUrl.searchParams.get("handles") ?? "";
    const handles = Array.from(
      new Set(
        rawHandles
          .split(",")
          .map((item) => item.trim().replace(/[^\p{L}\p{N}_-]/gu, ""))
          .filter(Boolean)
      )
    ).slice(0, 20);

    if (handles.length === 0) {
      return NextResponse.json({ data: [] });
    }

    const admin = createAdminClient();
    const { data, error } = await admin
      .from("profiles")
      .select("id, nickname")
      .in("nickname", handles)
      .returns<MentionProfileRow[]>();

    if (error) throw error;

    return NextResponse.json({
      data: (data ?? []).map((row) => ({
        id: row.id,
        nickname: row.nickname,
      })),
    });
  } catch (error) {
    console.error("[users-mentions:get]", error);
    return NextResponse.json({ error: "서버 오류" }, { status: 500 });
  }
}
