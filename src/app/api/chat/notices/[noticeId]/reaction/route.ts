import { createAdminClient } from "@/lib/supabase/admin";
import { NextRequest, NextResponse } from "next/server";
import { getAuthenticatedUser, requireActiveRoomMember } from "../../../_lib";

type NoticeReactionType = "heart" | "like" | "dislike";

const REACTION_TYPES = new Set<NoticeReactionType>(["heart", "like", "dislike"]);

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ noticeId: string }> }
) {
  try {
    const user = await getAuthenticatedUser();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { noticeId } = await params;
    const body = await request.json().catch(() => ({}));
    const reactionType = body.reaction_type as NoticeReactionType;
    if (!REACTION_TYPES.has(reactionType)) {
      return NextResponse.json({ error: "지원하지 않는 반응입니다." }, { status: 400 });
    }

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

    const { data: existing, error: existingError } = await admin
      .from("chat_room_notice_reactions")
      .select("reaction_type")
      .eq("notice_id", noticeId)
      .eq("user_id", user.id)
      .maybeSingle<{ reaction_type: NoticeReactionType }>();

    if (existingError) throw existingError;

    if (existing?.reaction_type === reactionType) {
      const { error } = await admin
        .from("chat_room_notice_reactions")
        .delete()
        .eq("notice_id", noticeId)
        .eq("user_id", user.id);
      if (error) throw error;
      return NextResponse.json({ reaction_type: null });
    }

    const { error } = await admin
      .from("chat_room_notice_reactions")
      .upsert(
        { notice_id: noticeId, user_id: user.id, reaction_type: reactionType, created_at: new Date().toISOString() },
        { onConflict: "notice_id,user_id" }
      );

    if (error) throw error;
    return NextResponse.json({ reaction_type: reactionType });
  } catch (error) {
    console.error("[chat-notice-reaction:post]", error);
    return NextResponse.json({ error: "서버 오류" }, { status: 500 });
  }
}
