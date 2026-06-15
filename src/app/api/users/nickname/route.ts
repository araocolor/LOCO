import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

export async function PATCH(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const body = await request.json();
  const newNickname = (body.nickname ?? "").trim();

  if (!newNickname || newNickname.length < 2 || newNickname.length > 20) {
    return NextResponse.json(
      { error: "invalid_nickname", message: "아이디는 2~20자여야 합니다." },
      { status: 400 }
    );
  }

  const admin = createAdminClient();

  const { data: profile } = await admin
    .from("profiles")
    .select("nickname, nickname_changed_at")
    .eq("id", user.id)
    .single();

  if (!profile) {
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  }

  if (profile.nickname === newNickname) {
    return NextResponse.json(
      { error: "same_nickname", message: "현재 아이디와 동일합니다." },
      { status: 400 }
    );
  }

  if (profile.nickname_changed_at) {
    const lastChanged = new Date(profile.nickname_changed_at);
    const nextAvailable = new Date(lastChanged.getTime() + 30 * 24 * 60 * 60 * 1000);

    if (nextAvailable > new Date()) {
      return NextResponse.json(
        {
          error: "too_soon",
          message: `아이디는 30일에 한 번만 변경할 수 있습니다. ${nextAvailable.toLocaleDateString("ko-KR")} 이후에 변경 가능합니다.`,
        },
        { status: 429 }
      );
    }
  }

  const { data: existing } = await admin
    .from("profiles")
    .select("id")
    .eq("nickname", newNickname)
    .neq("id", user.id)
    .maybeSingle();

  if (existing) {
    return NextResponse.json(
      { error: "duplicate", message: "이미 사용 중인 아이디입니다." },
      { status: 409 }
    );
  }

  const oldNickname = profile.nickname;
  const nicknameChangedAt = new Date().toISOString();

  const { data: updatedProfile, error } = await admin
    .from("profiles")
    .update({
      nickname: newNickname,
      nickname_changed_at: nicknameChangedAt,
    })
    .eq("id", user.id)
    .select("nickname_changed_at")
    .single();

  if (error || !updatedProfile?.nickname_changed_at) {
    return NextResponse.json(
      { error: "update_failed", message: "변경에 실패했습니다." },
      { status: 500 }
    );
  }

  const systemMessage = `${oldNickname}님이 아이디를 ${newNickname}로 변경하였습니다.`;

  try {
    const { data: rooms } = await admin
      .from("chat_room_members")
      .select("room_id")
      .eq("user_id", user.id)
      .eq("status", "active");

    const roomIds = (rooms ?? []).map((r) => r.room_id);

    if (roomIds.length > 0) {
      const now = new Date().toISOString();
      await admin.from("chat_messages").insert(
        roomIds.map((room_id) => ({
          room_id,
          sender_id: user.id,
          kind: "system" as const,
          content: systemMessage,
        }))
      );
      await admin
        .from("chat_rooms")
        .update({ updated_at: now })
        .in("id", roomIds);
    }

    const { data: friends } = await admin
      .from("friendships")
      .select("user_id, friend_id")
      .or(`user_id.eq.${user.id},friend_id.eq.${user.id}`)
      .eq("status", "accepted");

    const friendIds = (friends ?? []).map((f) =>
      f.user_id === user.id ? f.friend_id : f.user_id
    );

    if (friendIds.length > 0) {
      await admin.from("notifications").insert(
        friendIds.map((friendId) => ({
          user_id: friendId,
          actor_id: user.id,
          type: "nickname_changed",
          ref_id: null,
          meta: { old_nickname: oldNickname, new_nickname: newNickname },
        }))
      );
    }
  } catch (e) {
    console.error("[nickname-change] 알림/시스템메시지 실패:", e);
  }

  return NextResponse.json({
    success: true,
    oldNickname,
    newNickname,
    nicknameChangedAt: updatedProfile.nickname_changed_at,
  });
}
