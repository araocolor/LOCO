import { createAdminClient } from "@/lib/supabase/admin";
import { NextRequest, NextResponse } from "next/server";
import { getAuthenticatedUser, type ChatMemberRow, type ChatRoomRow } from "../_lib";

export async function GET(request: NextRequest) {
  try {
    const user = await getAuthenticatedUser();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const admin = createAdminClient();

    const { data: memberships, error: membershipError } = await admin
      .from("chat_room_members")
      .select("room_id, user_id, role, status, last_read_at, joined_at, created_at")
      .eq("user_id", user.id)
      .eq("status", "active")
      .returns<ChatMemberRow[]>();

    if (membershipError) throw membershipError;

    const roomIds = (memberships ?? []).map((m) => m.room_id);
    if (roomIds.length === 0) {
      return NextResponse.json({ count: 0, byType: { direct: 0, group: 0, class: 0 } });
    }

    const { data: rooms, error: roomsError } = await admin
      .from("chat_rooms")
      .select("id, type, status, class_id, owner_id, title, notice, direct_user_low_id, direct_user_high_id, last_message_id, last_message_at, created_at, updated_at")
      .in("id", roomIds)
      .eq("status", "active")
      .returns<ChatRoomRow[]>();

    if (roomsError) throw roomsError;

    const activeRooms = rooms ?? [];
    if (activeRooms.length === 0) {
      return NextResponse.json({ count: 0, byType: { direct: 0, group: 0, class: 0 } });
    }

    const membershipMap = new Map((memberships ?? []).map((m) => [m.room_id, m]));
    const roomTypeMap = new Map(activeRooms.map((r) => [r.id, r.type]));

    const perRoom = await Promise.all(
      activeRooms.map(async (room) => {
        const membership = membershipMap.get(room.id);
        const readBoundary = membership?.last_read_at ?? membership?.joined_at ?? membership?.created_at ?? null;
        let query = admin
          .from("chat_messages")
          .select("id", { count: "exact", head: true })
          .eq("room_id", room.id)
          .neq("sender_id", user.id)
          .is("deleted_at", null);

        if (readBoundary) query = query.gt("created_at", readBoundary);

        const { count, error } = await query;
        if (error) throw error;
        return { roomId: room.id, count: count ?? 0 };
      })
    );

    const byType = { direct: 0, group: 0, class: 0 };
    let total = 0;
    for (const { roomId, count } of perRoom) {
      total += count;
      const type = roomTypeMap.get(roomId);
      if (type === "direct" || type === "self") byType.direct += count;
      else if (type === "group") byType.group += count;
      else if (type === "class") byType.class += count;
    }

    return NextResponse.json({ count: total, byType });
  } catch (error) {
    console.error("[chat-unread-count]", error);
    return NextResponse.json({ error: "서버 오류" }, { status: 500 });
  }
}
