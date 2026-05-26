import { createAdminClient } from "@/lib/supabase/admin";
import { NextResponse } from "next/server";
import { getAuthenticatedUser, getRoomSnapshot, requireActiveRoomMember } from "../../_lib";

interface ClassImageItem {
  icon_url?: string;
  card_url?: string;
}

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await getAuthenticatedUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id: roomId } = await params;
    const member = await requireActiveRoomMember(roomId, user.id);
    if (!member) {
      return NextResponse.json({ error: "채팅방 멤버가 아닙니다" }, { status: 403 });
    }

    const room = await getRoomSnapshot(roomId, user.id);
    if (!room) {
      return NextResponse.json({ error: "채팅방을 찾을 수 없습니다" }, { status: 404 });
    }

    let classImageUrl: string | null = null;
    let classTitle: string | null = null;
    if (room.type === "class" && room.class_id) {
      const admin = createAdminClient();
      const { data: cls, error: classError } = await admin
        .from("classes")
        .select("title, images")
        .eq("id", room.class_id)
        .maybeSingle<{ title: string; images: ClassImageItem[] | null }>();

      if (classError) throw classError;
      classTitle = cls?.title ?? null;
      classImageUrl = cls?.images?.[0]?.icon_url ?? cls?.images?.[0]?.card_url ?? null;
    }

    return NextResponse.json({
      data: {
        id: room.id,
        type: room.type,
        class_id: room.class_id,
        class_image_url: classImageUrl,
        owner_id: room.owner_id,
        title: room.type === "class" && classTitle && room.title === "클래스 채팅" ? classTitle : room.title,
        notice: room.notice,
        member_count: room.members.length,
        members: room.members,
        updated_at: room.updated_at,
      },
    });
  } catch (error) {
    console.error("[chat-room-get]", error);
    return NextResponse.json({ error: "서버 오류" }, { status: 500 });
  }
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await getAuthenticatedUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id: roomId } = await params;
    const body = await request.json();
    const title = typeof body.title === "string" ? body.title.trim() : null;

    if (!title || title.length > 30) {
      return NextResponse.json({ error: "제목은 1~30자여야 합니다" }, { status: 400 });
    }

    const admin = createAdminClient();

    const { data: room, error: roomError } = await admin
      .from("chat_rooms")
      .select("id, type")
      .eq("id", roomId)
      .eq("status", "active")
      .maybeSingle();

    if (roomError) throw roomError;
    if (!room) {
      return NextResponse.json({ error: "채팅방을 찾을 수 없습니다" }, { status: 404 });
    }
    if (room.type !== "group") {
      return NextResponse.json({ error: "그룹 채팅방만 제목을 변경할 수 있습니다" }, { status: 403 });
    }

    const member = await requireActiveRoomMember(roomId, user.id);
    if (!member) {
      return NextResponse.json({ error: "채팅방 멤버가 아닙니다" }, { status: 403 });
    }

    const { data: members, error: membersError } = await admin
      .from("chat_room_members")
      .select("user_id, role, created_at")
      .eq("room_id", roomId)
      .eq("status", "active")
      .order("created_at", { ascending: true });

    if (membersError) throw membersError;

    const owner = (members ?? []).find((m) => m.role === "owner");
    const nonOwners = (members ?? []).filter((m) => m.role !== "owner");
    const secondMember = nonOwners[0] ?? null;

    const canEdit =
      user.id === owner?.user_id || user.id === secondMember?.user_id;

    if (!canEdit) {
      return NextResponse.json({ error: "제목 변경 권한이 없습니다" }, { status: 403 });
    }

    const { error: updateError } = await admin
      .from("chat_rooms")
      .update({ title })
      .eq("id", roomId);

    if (updateError) throw updateError;

    return NextResponse.json({ data: { id: roomId, title } });
  } catch (error) {
    console.error("[chat-room-patch]", error);
    return NextResponse.json({ error: "서버 오류" }, { status: 500 });
  }
}
