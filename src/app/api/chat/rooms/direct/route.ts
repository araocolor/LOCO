import { createAdminClient } from "@/lib/supabase/admin";
import { NextRequest, NextResponse } from "next/server";
import {
  getAuthenticatedUser,
  getDirectPair,
  getRoomSnapshot,
} from "../../_lib";

export async function POST(request: NextRequest) {
  try {
    const user = await getAuthenticatedUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { target_id } = await request.json();

    if (!target_id || typeof target_id !== "string") {
      return NextResponse.json({ error: "Missing target_id" }, { status: 400 });
    }

    if (target_id === user.id) {
      return NextResponse.json({ error: "자기 자신과는 대화방을 만들 수 없습니다." }, { status: 400 });
    }

    const admin = createAdminClient();
    const { data: targetProfile, error: targetError } = await admin
      .from("profiles")
      .select("id")
      .eq("id", target_id)
      .maybeSingle<{ id: string }>();

    if (targetError) throw targetError;
    if (!targetProfile) {
      return NextResponse.json({ error: "사용자를 찾을 수 없습니다." }, { status: 404 });
    }

    const { data: blockedState, error: blockedError } = await admin
      .from("friend_member_states")
      .select("state")
      .eq("owner_id", target_id)
      .eq("target_id", user.id)
      .in("state", ["blocked", "black"])
      .maybeSingle();

    if (blockedError) throw blockedError;
    if (blockedState) {
      return NextResponse.json({ error: "대화방을 만들 수 없습니다." }, { status: 403 });
    }

    const { data: receiverSettings, error: settingsError } = await admin
      .from("user_settings")
      .select("message_from")
      .eq("user_id", target_id)
      .maybeSingle<{ message_from: "anyone" | "friends_only" }>();

    if (settingsError) throw settingsError;

    if (receiverSettings?.message_from === "friends_only") {
      const { data: friendshipRows, error: friendshipError } = await admin
        .from("friendships")
        .select("status")
        .or(`and(user_id.eq.${user.id},friend_id.eq.${target_id}),and(user_id.eq.${target_id},friend_id.eq.${user.id})`)
        .in("status", ["approved", "friend"]);

      if (friendshipError) throw friendshipError;
      if (!friendshipRows || friendshipRows.length === 0) {
        return NextResponse.json({ error: "친구만 메시지를 받을 수 있는 사용자입니다." }, { status: 403 });
      }
    }

    const { lowId, highId } = getDirectPair(user.id, target_id);
    const { data: existingRoom, error: existingError } = await admin
      .from("chat_rooms")
      .select("id")
      .eq("type", "direct")
      .eq("status", "active")
      .eq("direct_user_low_id", lowId)
      .eq("direct_user_high_id", highId)
      .maybeSingle<{ id: string }>();

    if (existingError) throw existingError;

    let roomId = existingRoom?.id;

    if (!roomId) {
      const { data: room, error: roomError } = await admin
        .from("chat_rooms")
        .insert({
          type: "direct",
          owner_id: user.id,
          direct_user_low_id: lowId,
          direct_user_high_id: highId,
        })
        .select("id")
        .single<{ id: string }>();

      if (roomError) throw roomError;
      roomId = room.id;
    }

    const now = new Date().toISOString();
    const { error: memberError } = await admin
      .from("chat_room_members")
      .upsert(
        [
          { room_id: roomId, user_id: user.id, role: "member", status: "active", left_at: null, joined_at: now },
          { room_id: roomId, user_id: target_id, role: "member", status: "active", left_at: null, joined_at: now },
        ],
        { onConflict: "room_id,user_id" }
      );

    if (memberError) throw memberError;

    const room = await getRoomSnapshot(roomId, user.id);
    return NextResponse.json({ data: room });
  } catch (error) {
    console.error("[chat-direct-room]", error);
    return NextResponse.json({ error: "서버 오류" }, { status: 500 });
  }
}
