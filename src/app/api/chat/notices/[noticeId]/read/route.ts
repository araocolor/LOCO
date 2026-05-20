import { createAdminClient } from "@/lib/supabase/admin";
import { NextResponse } from "next/server";
import { getAuthenticatedUser, requireActiveRoomMember } from "../../../_lib";

export async function POST(
  _request: Request,
  { params }: { params: Promise<{ noticeId: string }> }
) {
  try {
    const user = await getAuthenticatedUser();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { noticeId } = await params;
    const admin = createAdminClient();
    const { data: notice, error: noticeError } = await admin
      .from("chat_room_notices")
      .select("id, room_id")
      .eq("id", noticeId)
      .is("deleted_at", null)
      .maybeSingle<{ id: string; room_id: string }>();

    if (noticeError) throw noticeError;
    if (!notice) return NextResponse.json({ error: "Not found" }, { status: 404 });

    const membership = await requireActiveRoomMember(notice.room_id, user.id);
    if (!membership) return NextResponse.json({ error: "Not found" }, { status: 404 });

    const readAt = new Date().toISOString();
    const { error } = await admin
      .from("chat_room_notice_reads")
      .upsert(
        { notice_id: noticeId, user_id: user.id, read_at: readAt },
        { onConflict: "notice_id,user_id" }
      );

    if (error) throw error;
    return NextResponse.json({ ok: true, read_at: readAt });
  } catch (error) {
    console.error("[chat-notice-read:post]", error);
    return NextResponse.json({ error: "서버 오류" }, { status: 500 });
  }
}
