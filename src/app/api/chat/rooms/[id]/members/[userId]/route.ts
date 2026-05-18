import { createAdminClient } from "@/lib/supabase/admin";
import { NextResponse } from "next/server";
import { getAuthenticatedUser, getRoomSnapshot, requireActiveRoomMember } from "../../../../_lib";

type RoomType = "direct" | "group" | "class";
type MemberRole = "owner" | "admin" | "member";

function canManageTarget(
  roomType: RoomType,
  actorRole: MemberRole,
  targetRole: MemberRole
) {
  if (roomType === "class") {
    if (actorRole === "owner") return targetRole !== "owner";
    if (actorRole === "admin") return targetRole === "member";
    return false;
  }

  if (actorRole === "owner") return targetRole !== "owner";
  if (actorRole === "admin") return targetRole === "member";
  return false;
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string; userId: string }> }
) {
  try {
    const user = await getAuthenticatedUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id: roomId, userId: targetUserId } = await params;
    const actorMembership = await requireActiveRoomMember(roomId, user.id);
    if (!actorMembership) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    const admin = createAdminClient();
    const [{ data: room, error: roomError }, { data: targetMember, error: targetError }] =
      await Promise.all([
        admin
          .from("chat_rooms")
          .select("id, type, status")
          .eq("id", roomId)
          .eq("status", "active")
          .maybeSingle<{ id: string; type: RoomType; status: "active" | "archived" }>(),
        admin
          .from("chat_room_members")
          .select("user_id, role, status")
          .eq("room_id", roomId)
          .eq("user_id", targetUserId)
          .eq("status", "active")
          .maybeSingle<{ user_id: string; role: MemberRole; status: "active" }>(),
      ]);

    if (roomError) throw roomError;
    if (targetError) throw targetError;
    if (!room || !targetMember) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    const isSelfLeave = targetUserId === user.id;
    if (!isSelfLeave) {
      if (!canManageTarget(room.type, actorMembership.role, targetMember.role)) {
        return NextResponse.json({ error: "권한이 없습니다." }, { status: 403 });
      }
    } else if (targetMember.role === "owner" && room.type === "class") {
      return NextResponse.json({ error: "클래스 방장은 나갈 수 없습니다." }, { status: 400 });
    }

    const nextStatus = !isSelfLeave && room.type === "class" ? "kicked" : "left";
    const { error: updateError } = await admin
      .from("chat_room_members")
      .update({
        status: nextStatus,
        left_at: new Date().toISOString(),
      })
      .eq("room_id", roomId)
      .eq("user_id", targetUserId)
      .eq("status", "active");

    if (updateError) throw updateError;

    const snapshot = await getRoomSnapshot(roomId, user.id);
    return NextResponse.json({ data: snapshot, status: nextStatus });
  } catch (error) {
    console.error("[chat-room-member:delete]", error);
    return NextResponse.json({ error: "서버 오류" }, { status: 500 });
  }
}
