import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { NextRequest, NextResponse } from "next/server";

function getDirectPair(userA: string, userB: string) {
  return userA < userB
    ? { lowId: userA, highId: userB }
    : { lowId: userB, highId: userA };
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;
  const body = await request.json().catch(() => ({}));
  const targetIds = Array.isArray(body.target_ids)
    ? Array.from(new Set(body.target_ids.filter((targetId: unknown): targetId is string => typeof targetId === "string" && targetId !== user.id)))
    : [];
  const message = typeof body.message === "string" ? body.message.trim().slice(0, 500) : "";

  if (targetIds.length === 0) {
    return NextResponse.json({ error: "공유할 친구를 선택해주세요." }, { status: 400 });
  }

  const admin = createAdminClient();
  const { data: classRow, error: classError } = await admin
    .from("classes")
    .select("id, title, images, datetime, region")
    .eq("id", id)
    .maybeSingle<{ id: string; title: string; images: Array<{ card_url?: string }> | null; datetime: string; region: string }>();

  if (classError) return NextResponse.json({ error: classError.message }, { status: 500 });
  if (!classRow) return NextResponse.json({ error: "클래스를 찾을 수 없습니다." }, { status: 404 });

  const [
    { data: followingFriendships, error: followingError },
    { data: followerFriendships, error: followerError },
  ] = await Promise.all([
    admin
      .from("friendships")
      .select("user_id, friend_id, status")
      .eq("user_id", user.id)
      .in("friend_id", targetIds)
      .eq("status", "friend"),
    admin
      .from("friendships")
      .select("user_id, friend_id, status")
      .eq("friend_id", user.id)
      .in("user_id", targetIds)
      .eq("status", "friend"),
  ]);

  if (followingError) return NextResponse.json({ error: followingError.message }, { status: 500 });
  if (followerError) return NextResponse.json({ error: followerError.message }, { status: 500 });

  const mutualFriendIds = new Set<string>();
  [...(followingFriendships ?? []), ...(followerFriendships ?? [])].forEach((row) => {
    const otherId = row.user_id === user.id ? row.friend_id : row.user_id;
    if (targetIds.includes(otherId)) mutualFriendIds.add(otherId);
  });

  const recipients = targetIds.filter((targetId) => mutualFriendIds.has(targetId));
  if (recipients.length === 0) {
    return NextResponse.json({ error: "맞팔 친구에게만 공유할 수 있습니다." }, { status: 403 });
  }

  const content = JSON.stringify({
    type: "class_share",
    message,
    class: {
      id: classRow.id,
      title: classRow.title,
      image_url: classRow.images?.[0]?.card_url ?? null,
      datetime: classRow.datetime,
      region: classRow.region,
    },
  });

  const now = new Date().toISOString();
  let sentCount = 0;

  for (const targetId of recipients) {
    const { lowId, highId } = getDirectPair(user.id, targetId);
    const { data: existingRoom, error: existingError } = await admin
      .from("chat_rooms")
      .select("id")
      .eq("type", "direct")
      .eq("status", "active")
      .eq("direct_user_low_id", lowId)
      .eq("direct_user_high_id", highId)
      .maybeSingle<{ id: string }>();

    if (existingError) return NextResponse.json({ error: existingError.message }, { status: 500 });

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

      if (roomError) return NextResponse.json({ error: roomError.message }, { status: 500 });
      roomId = room.id;
    }

    const { error: memberError } = await admin
      .from("chat_room_members")
      .upsert(
        [
          { room_id: roomId, user_id: user.id, role: "member", status: "active", left_at: null, joined_at: now },
          { room_id: roomId, user_id: targetId, role: "member", status: "active", left_at: null, joined_at: now },
        ],
        { onConflict: "room_id,user_id" }
      );

    if (memberError) return NextResponse.json({ error: memberError.message }, { status: 500 });

    const { error: messageError } = await admin
      .from("chat_messages")
      .insert({ room_id: roomId, sender_id: user.id, kind: "text", content });

    if (messageError) return NextResponse.json({ error: messageError.message }, { status: 500 });

    const { error: shareError } = await admin
      .from("class_shares")
      .insert({ class_id: id, sender_id: user.id, receiver_id: targetId, created_at: now });

    if (shareError) return NextResponse.json({ error: shareError.message }, { status: 500 });

    sentCount += 1;
  }

  const { count } = await admin
    .from("class_shares")
    .select("class_id", { count: "exact", head: true })
    .eq("class_id", id);

  await admin.from("classes").update({ share_count: count ?? sentCount }).eq("id", id);

  return NextResponse.json({ sent_count: sentCount, share_count: count ?? sentCount });
}
