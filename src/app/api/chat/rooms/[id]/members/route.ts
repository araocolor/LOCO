import { createAdminClient } from "@/lib/supabase/admin";
import { NextRequest, NextResponse } from "next/server";
import {
  getAuthenticatedUser,
  getRoomSnapshot,
  requireActiveRoomMember,
} from "../../../_lib";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await getAuthenticatedUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id: roomId } = await params;
    const { target_id } = await request.json();

    if (!target_id || typeof target_id !== "string") {
      return NextResponse.json({ error: "Missing target_id" }, { status: 400 });
    }

    if (target_id === user.id) {
      return NextResponse.json({ error: "자기 자신은 추가할 수 없습니다." }, { status: 400 });
    }

    const membership = await requireActiveRoomMember(roomId, user.id);
    if (!membership) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    const admin = createAdminClient();
    const [{ data: room, error: roomError }, { data: targetProfile, error: targetError }] =
      await Promise.all([
        admin
          .from("chat_rooms")
          .select("id, type, status")
          .eq("id", roomId)
          .eq("status", "active")
          .maybeSingle<{ id: string; type: "direct" | "group" | "class"; status: "active" | "archived" }>(),
        admin
          .from("profiles")
          .select("id")
          .eq("id", target_id)
          .maybeSingle<{ id: string }>(),
      ]);

    if (roomError) throw roomError;
    if (targetError) throw targetError;
    if (!room) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }
    if (!targetProfile) {
      return NextResponse.json({ error: "사용자를 찾을 수 없습니다." }, { status: 404 });
    }

    if (room.type === "class" && !["owner", "admin"].includes(membership.role)) {
      return NextResponse.json({ error: "클래스 채팅방은 방장만 멤버를 추가할 수 있습니다." }, { status: 403 });
    }

    const { data: blockedStates, error: blockedError } = await admin
      .from("friend_member_states")
      .select("owner_id, target_id, state")
      .or(
        `and(owner_id.eq.${user.id},target_id.eq.${target_id}),and(owner_id.eq.${target_id},target_id.eq.${user.id})`
      )
      .in("state", ["blocked", "black"]);

    if (blockedError) throw blockedError;
    if ((blockedStates ?? []).length > 0) {
      return NextResponse.json({ error: "차단 또는 블랙 관계의 사용자는 추가할 수 없습니다." }, { status: 403 });
    }

    const { data: existingMember, error: existingError } = await admin
      .from("chat_room_members")
      .select("status")
      .eq("room_id", roomId)
      .eq("user_id", target_id)
      .maybeSingle<{ status: "active" | "left" | "kicked" }>();

    if (existingError) throw existingError;
    if (existingMember?.status === "active") {
      const snapshot = await getRoomSnapshot(roomId, user.id);
      return NextResponse.json({ data: snapshot, alreadyMember: true });
    }

    if (room.type === "direct") {
      const { error: roomUpdateError } = await admin
        .from("chat_rooms")
        .update({
          type: "group",
          direct_user_low_id: null,
          direct_user_high_id: null,
        })
        .eq("id", roomId);

      if (roomUpdateError) throw roomUpdateError;
    }

    const { error: memberError } = await admin
      .from("chat_room_members")
      .upsert(
        {
          room_id: roomId,
          user_id: target_id,
          role: "member",
          status: "active",
          left_at: null,
        },
        { onConflict: "room_id,user_id" }
      );

    if (memberError) throw memberError;

    const snapshot = await getRoomSnapshot(roomId, user.id);
    return NextResponse.json({ data: snapshot });
  } catch (error) {
    console.error("[chat-room-members:post]", error);
    return NextResponse.json({ error: "서버 오류" }, { status: 500 });
  }
}
