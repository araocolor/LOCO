import { createAdminClient } from "@/lib/supabase/admin";
import { NextRequest, NextResponse } from "next/server";
import { getAuthenticatedUser, requireActiveRoomMember } from "../../_lib";

type NoticeKind = "notice" | "vote";

const NOTICE_KINDS = new Set<NoticeKind>(["notice", "vote"]);

async function getNoticeRoom(noticeId: string) {
  const admin = createAdminClient();
  const { data, error } = await admin
    .from("chat_room_notices")
    .select("id, room_id, kind")
    .eq("id", noticeId)
    .is("deleted_at", null)
    .maybeSingle<{ id: string; room_id: string; kind: NoticeKind }>();

  if (error) throw error;
  return data;
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ noticeId: string }> }
) {
  try {
    const user = await getAuthenticatedUser();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { noticeId } = await params;
    const notice = await getNoticeRoom(noticeId);
    if (!notice) return NextResponse.json({ error: "Not found" }, { status: 404 });

    const membership = await requireActiveRoomMember(notice.room_id, user.id);
    if (!membership) return NextResponse.json({ error: "Not found" }, { status: 404 });
    if (!["owner", "admin"].includes(membership.role)) {
      return NextResponse.json({ error: "권한이 없습니다." }, { status: 403 });
    }

    const body = await request.json().catch(() => ({}));
    const content = typeof body.content === "string" ? body.content.trim().slice(0, 1000) : "";
    const kind = (body.kind ?? notice.kind) as NoticeKind;

    if (!NOTICE_KINDS.has(kind)) {
      return NextResponse.json({ error: "지원하지 않는 공지 형식입니다." }, { status: 400 });
    }
    if (!content) {
      return NextResponse.json({ error: "내용을 입력해주세요." }, { status: 400 });
    }

    const admin = createAdminClient();
    const { error } = await admin
      .from("chat_room_notices")
      .update({ content, kind, updated_at: new Date().toISOString() })
      .eq("id", noticeId);

    if (error) throw error;
    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("[chat-notice:patch]", error);
    return NextResponse.json({ error: "서버 오류" }, { status: 500 });
  }
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ noticeId: string }> }
) {
  try {
    const user = await getAuthenticatedUser();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { noticeId } = await params;
    const notice = await getNoticeRoom(noticeId);
    if (!notice) return NextResponse.json({ error: "Not found" }, { status: 404 });

    const membership = await requireActiveRoomMember(notice.room_id, user.id);
    if (!membership) return NextResponse.json({ error: "Not found" }, { status: 404 });
    if (!["owner", "admin"].includes(membership.role)) {
      return NextResponse.json({ error: "권한이 없습니다." }, { status: 403 });
    }

    const admin = createAdminClient();
    const { error } = await admin
      .from("chat_room_notices")
      .update({ deleted_at: new Date().toISOString(), updated_at: new Date().toISOString() })
      .eq("id", noticeId);

    if (error) throw error;
    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("[chat-notice:delete]", error);
    return NextResponse.json({ error: "서버 오류" }, { status: 500 });
  }
}
