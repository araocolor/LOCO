import { createAdminClient } from "@/lib/supabase/admin";
import { NextResponse } from "next/server";
import { getAuthenticatedUser, getRoomSnapshot } from "../../../_lib";

export async function POST(
  _request: Request,
  { params }: { params: Promise<{ classId: string }> }
) {
  try {
    const user = await getAuthenticatedUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { classId } = await params;
    if (!classId) {
      return NextResponse.json({ error: "Missing classId" }, { status: 400 });
    }

    const admin = createAdminClient();

    const { data: classRow, error: classError } = await admin
      .from("classes")
      .select("id, host_id, title, require_approval")
      .eq("id", classId)
      .maybeSingle<{ id: string; host_id: string; title: string; require_approval: boolean }>();

    if (classError) throw classError;
    if (!classRow) {
      return NextResponse.json({ error: "클래스를 찾을 수 없습니다." }, { status: 404 });
    }

    const requireApproval = classRow.require_approval !== false;

    const { data: applicationRow, error: appError } = await admin
      .from("applications")
      .select("id, status")
      .eq("class_id", classId)
      .eq("applicant_id", user.id)
      .neq("status", "cancelled")
      .maybeSingle<{ id: string; status: string }>();

    if (appError) throw appError;

    const canEnter =
      classRow.host_id === user.id ||
      applicationRow?.status === "approved" ||
      (!requireApproval && Boolean(applicationRow));
    if (!canEnter) {
      return NextResponse.json({ error: "클래스 채팅방에 입장할 수 없습니다." }, { status: 403 });
    }

    let roomId: string | null = null;

    const { data: existingRoom, error: existingRoomError } = await admin
      .from("chat_rooms")
      .select("id")
      .eq("type", "class")
      .eq("class_id", classId)
      .eq("status", "active")
      .maybeSingle<{ id: string }>();

    if (existingRoomError) throw existingRoomError;
    roomId = existingRoom?.id ?? null;

    if (!roomId) {
      const { data: insertedRoom, error: insertError } = await admin
        .from("chat_rooms")
        .insert({
          type: "class",
          class_id: classId,
          owner_id: classRow.host_id,
          title: classRow.title,
        })
        .select("id")
        .single<{ id: string }>();

      if (insertError) {
        const { data: racedRoom, error: racedRoomError } = await admin
          .from("chat_rooms")
          .select("id")
          .eq("type", "class")
          .eq("class_id", classId)
          .eq("status", "active")
          .maybeSingle<{ id: string }>();
        if (racedRoomError) throw racedRoomError;
        if (!racedRoom?.id) throw insertError;
        roomId = racedRoom.id;
      } else {
        roomId = insertedRoom.id;
      }
    }

    const role = classRow.host_id === user.id ? "owner" : "member";
    const { error: memberError } = await admin
      .from("chat_room_members")
      .upsert(
        {
          room_id: roomId,
          user_id: user.id,
          role,
          status: "active",
          left_at: null,
        },
        { onConflict: "room_id,user_id" }
      );

    if (memberError) throw memberError;

    const room = await getRoomSnapshot(roomId, user.id);
    return NextResponse.json({ data: room });
  } catch (error) {
    console.error("[chat-class-room:post]", error);
    return NextResponse.json({ error: "서버 오류" }, { status: 500 });
  }
}
