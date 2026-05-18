import { createAdminClient } from "@/lib/supabase/admin";
import { NextResponse } from "next/server";
import {
  type ChatMemberRow,
  type ChatMessageRow,
  type ChatRoomRow,
  getAuthenticatedUser,
  getProfiles,
  getRoomDisplayTitle,
} from "../_lib";

async function ensureOwnerClassRoomMemberships(userId: string) {
  const admin = createAdminClient();
  const { data: hostedClasses, error: hostedError } = await admin
    .from("classes")
    .select("id, title")
    .eq("host_id", userId)
    .returns<Array<{ id: string; title: string }>>();

  if (hostedError) throw hostedError;
  const classRows = hostedClasses ?? [];
  if (classRows.length === 0) return;

  const classIds = classRows.map((cls) => cls.id);
  const { data: existingRooms, error: existingError } = await admin
    .from("chat_rooms")
    .select("id, class_id")
    .eq("type", "class")
    .eq("status", "active")
    .in("class_id", classIds)
    .returns<Array<{ id: string; class_id: string }>>();

  if (existingError) throw existingError;
  const existingClassIds = new Set((existingRooms ?? []).map((room) => room.class_id));
  const missingClasses = classRows.filter((cls) => !existingClassIds.has(cls.id));

  for (const cls of missingClasses) {
    const { error: insertError } = await admin
      .from("chat_rooms")
      .insert({
        type: "class",
        status: "active",
        class_id: cls.id,
        owner_id: userId,
        title: cls.title,
      });

    // 중복 생성 경합은 무시하고 다음 단계에서 다시 조회합니다.
    if (insertError && insertError.code !== "23505") {
      throw insertError;
    }
  }

  const { data: refreshedRooms, error: refreshedError } = await admin
    .from("chat_rooms")
    .select("id, class_id")
    .eq("type", "class")
    .eq("status", "active")
    .in("class_id", classIds)
    .returns<Array<{ id: string; class_id: string }>>();

  if (refreshedError) throw refreshedError;
  const roomRows = refreshedRooms ?? [];
  if (roomRows.length === 0) return;

  const { error: upsertMemberError } = await admin
    .from("chat_room_members")
    .upsert(
      roomRows.map((room) => ({
        room_id: room.id,
        user_id: userId,
        role: "owner" as const,
        status: "active" as const,
        left_at: null,
      })),
      { onConflict: "room_id,user_id" }
    );

  if (upsertMemberError) throw upsertMemberError;
}

export async function GET() {
  try {
    const user = await getAuthenticatedUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    await ensureOwnerClassRoomMemberships(user.id);

    const admin = createAdminClient();
    const { data: myMemberships, error: membershipError } = await admin
      .from("chat_room_members")
      .select("room_id, user_id, role, status, last_read_at")
      .eq("user_id", user.id)
      .eq("status", "active")
      .returns<ChatMemberRow[]>();

    if (membershipError) throw membershipError;

    const roomIds = (myMemberships ?? []).map((membership) => membership.room_id);
    if (roomIds.length === 0) {
      return NextResponse.json({ data: [] });
    }

    const [{ data: rooms, error: roomsError }, { data: members, error: membersError }] =
      await Promise.all([
        admin
          .from("chat_rooms")
          .select("id, type, status, class_id, owner_id, title, notice, direct_user_low_id, direct_user_high_id, last_message_id, last_message_at, created_at, updated_at")
          .in("id", roomIds)
          .eq("status", "active")
          .returns<ChatRoomRow[]>(),
        admin
          .from("chat_room_members")
          .select("room_id, user_id, role, status, last_read_at")
          .in("room_id", roomIds)
          .eq("status", "active")
          .returns<ChatMemberRow[]>(),
      ]);

    if (roomsError) throw roomsError;
    if (membersError) throw membersError;

    const activeRooms = rooms ?? [];
    const activeRoomIds = activeRooms.map((room) => room.id);
    const lastMessageIds = activeRooms
      .map((room) => room.last_message_id)
      .filter((id): id is string => Boolean(id));

    const [{ data: lastMessages, error: lastMessagesError }, profiles] = await Promise.all([
      lastMessageIds.length > 0
        ? admin
            .from("chat_messages")
            .select("id, room_id, sender_id, kind, content, deleted_at, created_at")
            .in("id", lastMessageIds)
            .returns<ChatMessageRow[]>()
        : Promise.resolve({ data: [], error: null }),
      getProfiles((members ?? []).map((member) => member.user_id)),
    ]);

    if (lastMessagesError) throw lastMessagesError;

    const profileMap = new Map(profiles.map((profile) => [profile.id, profile]));
    const membershipMap = new Map((myMemberships ?? []).map((membership) => [membership.room_id, membership]));
    const memberMap = new Map<string, ChatMemberRow[]>();
    (members ?? []).forEach((member) => {
      memberMap.set(member.room_id, [...(memberMap.get(member.room_id) ?? []), member]);
    });
    const messageMap = new Map((lastMessages ?? []).map((message) => [message.id, message]));

    const unreadCounts = await Promise.all(
      activeRoomIds.map(async (roomId) => {
        const lastReadAt = membershipMap.get(roomId)?.last_read_at;
        let query = admin
          .from("chat_messages")
          .select("id", { count: "exact", head: true })
          .eq("room_id", roomId)
          .neq("sender_id", user.id)
          .is("deleted_at", null);

        if (lastReadAt) query = query.gt("created_at", lastReadAt);

        const { count, error } = await query;
        if (error) throw error;
        return [roomId, count ?? 0] as const;
      })
    );
    const unreadCountMap = new Map(unreadCounts);

    const result = activeRooms
      .map((room) => {
        const roomMembers = memberMap.get(room.id) ?? [];
        const lastMessage = room.last_message_id ? messageMap.get(room.last_message_id) ?? null : null;

        return {
          id: room.id,
          type: room.type,
          class_id: room.class_id,
          owner_id: room.owner_id,
          title: getRoomDisplayTitle(room, roomMembers, profileMap, user.id),
          notice: room.notice,
          member_count: roomMembers.length,
          members: roomMembers.map((member) => ({
            user_id: member.user_id,
            role: member.role,
            profile: profileMap.get(member.user_id) ?? null,
          })),
          last_message: lastMessage
            ? {
                id: lastMessage.id,
                kind: lastMessage.kind,
                content: lastMessage.content,
                sender_id: lastMessage.sender_id,
                is_mine: lastMessage.sender_id === user.id,
                created_at: lastMessage.created_at,
              }
            : null,
          unread_count: unreadCountMap.get(room.id) ?? 0,
          updated_at: room.last_message_at ?? room.updated_at,
          created_at: room.created_at,
        };
      })
      .sort((a, b) => new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime());

    return NextResponse.json({ data: result });
  } catch (error) {
    console.error("[chat-rooms]", error);
    return NextResponse.json({ error: "서버 오류" }, { status: 500 });
  }
}
