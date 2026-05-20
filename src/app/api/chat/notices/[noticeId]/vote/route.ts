import { createAdminClient } from "@/lib/supabase/admin";
import { NextRequest, NextResponse } from "next/server";
import { getAuthenticatedUser, requireActiveRoomMember } from "../../../_lib";

type NoticeVoteType = "agree" | "disagree" | "abstain";

const VOTE_TYPES = new Set<NoticeVoteType>(["agree", "disagree", "abstain"]);

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ noticeId: string }> }
) {
  try {
    const user = await getAuthenticatedUser();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { noticeId } = await params;
    const body = await request.json().catch(() => ({}));
    const voteType = body.vote_type as NoticeVoteType;
    if (!VOTE_TYPES.has(voteType)) {
      return NextResponse.json({ error: "지원하지 않는 투표입니다." }, { status: 400 });
    }

    const admin = createAdminClient();
    const { data: notice, error: noticeError } = await admin
      .from("chat_room_notices")
      .select("id, room_id, kind")
      .eq("id", noticeId)
      .is("deleted_at", null)
      .maybeSingle<{ id: string; room_id: string; kind: "notice" | "vote" }>();

    if (noticeError) throw noticeError;
    if (!notice) return NextResponse.json({ error: "Not found" }, { status: 404 });
    if (notice.kind !== "vote") {
      return NextResponse.json({ error: "투표 공지가 아닙니다." }, { status: 400 });
    }

    const membership = await requireActiveRoomMember(notice.room_id, user.id);
    if (!membership) return NextResponse.json({ error: "Not found" }, { status: 404 });

    const now = new Date().toISOString();
    const { error } = await admin
      .from("chat_room_notice_votes")
      .upsert(
        { notice_id: noticeId, user_id: user.id, vote_type: voteType, updated_at: now },
        { onConflict: "notice_id,user_id" }
      );

    if (error) throw error;
    return NextResponse.json({ vote_type: voteType });
  } catch (error) {
    console.error("[chat-notice-vote:post]", error);
    return NextResponse.json({ error: "서버 오류" }, { status: 500 });
  }
}
