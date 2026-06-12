import { createAdminClient } from "@/lib/supabase/admin";
import { NextRequest, NextResponse } from "next/server";
import { getAuthenticatedUser, type ChatMemberRow, type ChatRoomRow } from "../_lib";

type UnreadType = "direct" | "all";

function parseUnreadType(value: string | null): UnreadType {
  return value === "direct" ? "direct" : "all";
}

export async function GET(request: NextRequest) {
  try {
    const user = await getAuthenticatedUser();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const unreadType = parseUnreadType(request.nextUrl.searchParams.get("type"));
    const admin = createAdminClient();

    const { data: memberships, error: membershipError } = await admin
      .from("chat_room_members")
      .select("room_id, user_id, role, status, last_read_at, joined_at, created_at")
      .eq("user_id", user.id)
      .eq("status", "active")
      .returns<ChatMemberRow[]>();

    if (membershipError) throw membershipError;

    const roomIds = (memberships ?? []).map((membership) => membership.room_id);
    if (roomIds.length === 0) {
      return NextResponse.json({ count: 0 });
    }

    let roomsQuery = admin
      .from("chat_rooms")
      .select("id, type, status, class_id, owner_id, title, notice, direct_user_low_id, direct_user_high_id, last_message_id, last_message_at, created_at, updated_at")
      .in("id", roomIds)
      .eq("status", "active");

    if (unreadType === "direct") {
      roomsQuery = roomsQuery.in("type", ["direct", "self"]);
    }

    const { data: rooms, error: roomsError } = await roomsQuery.returns<ChatRoomRow[]>();
    if (roomsError) throw roomsError;

    const activeRoomIds = (rooms ?? []).map((room) => room.id);
    if (activeRoomIds.length === 0) {
      return NextResponse.json({ count: 0 });
    }

    const membershipMap = new Map((memberships ?? []).map((membership) => [membership.room_id, membership]));
    const unreadCounts = await Promise.all(
      activeRoomIds.map(async (roomId) => {
        const membership = membershipMap.get(roomId);
        const readBoundary = membership?.last_read_at ?? membership?.joined_at ?? membership?.created_at ?? null;
        let query = admin
          .from("chat_messages")
          .select("id", { count: "exact", head: true })
          .eq("room_id", roomId)
          .neq("sender_id", user.id)
          .is("deleted_at", null);

        if (readBoundary) query = query.gt("created_at", readBoundary);

        const { count, error } = await query;
        if (error) throw error;
        return count ?? 0;
      })
    );

    return NextResponse.json({ count: unreadCounts.reduce((total, count) => total + count, 0) });
  } catch (error) {
    console.error("[chat-unread-count]", error);
    return NextResponse.json({ error: "서버 오류" }, { status: 500 });
  }
}
