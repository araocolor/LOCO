import { createAdminClient } from "@/lib/supabase/admin";
import { NextRequest, NextResponse } from "next/server";
import { getAuthenticatedUser, getRoomSnapshot } from "../../_lib";

export async function POST(request: NextRequest) {
  try {
    const user = await getAuthenticatedUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { member_ids } = await request.json();

    if (!Array.isArray(member_ids) || member_ids.length === 0) {
      return NextResponse.json({ error: "member_ids가 필요합니다." }, { status: 400 });
    }

    if (member_ids.length > 50) {
      return NextResponse.json({ error: "최대 50명까지 초대할 수 있습니다." }, { status: 400 });
    }

    const uniqueIds = Array.from(new Set(member_ids.filter((id: unknown) => typeof id === "string" && id !== user.id)));

    if (uniqueIds.length === 0) {
      return NextResponse.json({ error: "초대할 사용자가 없습니다." }, { status: 400 });
    }

    const admin = createAdminClient();

    const { data: profiles, error: profileError } = await admin
      .from("profiles")
      .select("id")
      .in("id", uniqueIds);

    if (profileError) throw profileError;

    const validIds = (profiles ?? []).map((p) => p.id);
    if (validIds.length === 0) {
      return NextResponse.json({ error: "유효한 사용자가 없습니다." }, { status: 400 });
    }

    const { data: room, error: roomError } = await admin
      .from("chat_rooms")
      .insert({ type: "group", owner_id: user.id })
      .select("id")
      .single<{ id: string }>();

    if (roomError) throw roomError;

    const now = new Date().toISOString();
    const memberRows = [
      { room_id: room.id, user_id: user.id, role: "owner" as const, status: "active" as const, left_at: null, joined_at: now },
      ...validIds.map((id) => ({
        room_id: room.id,
        user_id: id,
        role: "member" as const,
        status: "active" as const,
        left_at: null,
        joined_at: now,
      })),
    ];

    const { error: memberError } = await admin
      .from("chat_room_members")
      .insert(memberRows);

    if (memberError) throw memberError;

    const snapshot = await getRoomSnapshot(room.id, user.id);
    return NextResponse.json({ data: snapshot });
  } catch (error) {
    console.error("[chat-group-room]", error);
    return NextResponse.json({ error: "서버 오류" }, { status: 500 });
  }
}
