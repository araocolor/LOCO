import { createAdminClient } from "@/lib/supabase/admin";
import { NextRequest, NextResponse } from "next/server";
import { getAuthenticatedUser, getRoomSnapshot, requireActiveRoomMember } from "../../../_lib";

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await getAuthenticatedUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id: roomId } = await params;
    const membership = await requireActiveRoomMember(roomId, user.id);
    if (!membership) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    if (!["owner", "admin"].includes(membership.role)) {
      return NextResponse.json({ error: "권한이 없습니다." }, { status: 403 });
    }

    const body = await request.json();
    const rawNotice = typeof body.notice === "string" ? body.notice : "";
    const notice = rawNotice.trim().slice(0, 300);

    const admin = createAdminClient();
    const { data: room, error: roomError } = await admin
      .from("chat_rooms")
      .select("id, type, status")
      .eq("id", roomId)
      .eq("status", "active")
      .maybeSingle<{ id: string; type: "direct" | "group" | "class"; status: "active" | "archived" }>();

    if (roomError) throw roomError;
    if (!room) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }
    if (room.type !== "class") {
      return NextResponse.json({ error: "클래스 채팅방에서만 공지를 설정할 수 있습니다." }, { status: 400 });
    }

    const { error: updateError } = await admin
      .from("chat_rooms")
      .update({ notice: notice.length > 0 ? notice : null, updated_at: new Date().toISOString() })
      .eq("id", roomId);

    if (updateError) throw updateError;

    const snapshot = await getRoomSnapshot(roomId, user.id);
    return NextResponse.json({ data: snapshot });
  } catch (error) {
    console.error("[chat-room-notice:patch]", error);
    return NextResponse.json({ error: "서버 오류" }, { status: 500 });
  }
}
