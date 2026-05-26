import { createAdminClient } from "@/lib/supabase/admin";
import { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import {
  type ChatMemberRow,
  type ChatMessageRow,
  type ChatRoomRow,
  getAuthenticatedUser,
  getProfiles,
} from "../../_lib";

interface ClassPreviewRow {
  id: string;
  title: string;
  images: Array<{ icon_url?: string; card_url?: string }> | null;
}

type PreviewRoomType = "direct" | "group" | "class";

function parsePreviewRoomType(value: string | null): PreviewRoomType | null {
  if (value === "direct" || value === "group" || value === "class") return value;
  return null;
}

function getRoomTitle(
  room: ChatRoomRow,
  members: ChatMemberRow[],
  profileMap: Map<string, { nickname: string }>,
  currentUserId: string,
  classMap: Map<string, ClassPreviewRow>
) {
  if (room.title?.trim()) return room.title;
  if (room.type === "self") return "나와의 채팅";
  if (room.type === "class" && room.class_id) {
    return classMap.get(room.class_id)?.title ?? "클래스 채팅";
  }
  if (room.type === "direct") {
    const otherMember = members.find((member) => member.user_id !== currentUserId);
    return otherMember ? profileMap.get(otherMember.user_id)?.nickname ?? "대화" : "대화";
  }

  const names = members
    .filter((member) => member.user_id !== currentUserId)
    .map((member) => profileMap.get(member.user_id)?.nickname)
    .filter((name): name is string => Boolean(name));

  return names.length > 0 ? names.slice(0, 3).join(", ") : "그룹 채팅";
}

function getDisplayMembers(room: ChatRoomRow, members: ChatMemberRow[], currentUserId: string) {
  if (room.type === "direct") {
    return members.filter((member) => member.user_id !== currentUserId).slice(0, 1);
  }
  if (room.type === "self") {
    return members.filter((member) => member.user_id === currentUserId).slice(0, 1);
  }
  if (room.type === "group") {
    const owner = members.find((member) => member.role === "owner");
    const others = members.filter((member) => member.user_id !== owner?.user_id);
    return [others[0], others[1], owner ?? others[2]].filter(
      (member): member is ChatMemberRow => Boolean(member)
    );
  }
  return [];
}

export async function GET(request: NextRequest) {
  try {
    const user = await getAuthenticatedUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const admin = createAdminClient();
    const { data: myMemberships, error: membershipError } = await admin
      .from("chat_room_members")
      .select("room_id, user_id, role, status, last_read_at, created_at")
      .eq("user_id", user.id)
      .eq("status", "active")
      .returns<ChatMemberRow[]>();

    if (membershipError) throw membershipError;

    const roomIds = (myMemberships ?? []).map((membership) => membership.room_id);
    if (roomIds.length === 0) {
      return NextResponse.json({ data: [] });
    }

    const previewType = parsePreviewRoomType(request.nextUrl.searchParams.get("type"));

    let roomsQuery = admin
      .from("chat_rooms")
      .select("id, type, status, class_id, owner_id, title, notice, direct_user_low_id, direct_user_high_id, last_message_id, last_message_at, created_at, updated_at")
      .in("id", roomIds)
      .eq("status", "active");

    if (previewType === "direct") {
      // direct 탭은 기존 동작을 유지하기 위해 self 채팅을 함께 포함합니다.
      roomsQuery = roomsQuery.in("type", ["direct", "self"]);
    } else if (previewType) {
      roomsQuery = roomsQuery.eq("type", previewType);
    }

    const [{ data: rooms, error: roomsError }, { data: members, error: membersError }] =
      await Promise.all([
        roomsQuery.returns<ChatRoomRow[]>(),
        admin
          .from("chat_room_members")
          .select("room_id, user_id, role, status, last_read_at, created_at")
          .in("room_id", roomIds)
          .eq("status", "active")
          .order("created_at", { ascending: true })
          .returns<ChatMemberRow[]>(),
      ]);

    if (roomsError) throw roomsError;
    if (membersError) throw membersError;

    const activeRooms = rooms ?? [];
    const memberMap = new Map<string, ChatMemberRow[]>();
    (members ?? []).forEach((member) => {
      memberMap.set(member.room_id, [...(memberMap.get(member.room_id) ?? []), member]);
    });

    const displayMembersByRoom = new Map<string, ChatMemberRow[]>();
    activeRooms.forEach((room) => {
      displayMembersByRoom.set(room.id, getDisplayMembers(room, memberMap.get(room.id) ?? [], user.id));
    });

    const profileIds = Array.from(
      new Set(
        Array.from(displayMembersByRoom.values())
          .flat()
          .map((member) => member.user_id)
      )
    );
    const classIds = activeRooms
      .map((room) => room.class_id)
      .filter((id): id is string => Boolean(id));
    const lastMessageIds = activeRooms
      .map((room) => room.last_message_id)
      .filter((id): id is string => Boolean(id));

    const [
      profiles,
      { data: classRows, error: classRowsError },
      { data: lastMessages, error: lastMessagesError },
    ] = await Promise.all([
      getProfiles(profileIds),
      classIds.length > 0
        ? admin
            .from("classes")
            .select("id, title, images")
            .in("id", classIds)
            .returns<ClassPreviewRow[]>()
        : Promise.resolve({ data: [], error: null }),
      lastMessageIds.length > 0
        ? admin
            .from("chat_messages")
            .select("id, room_id, sender_id, kind, content, deleted_at, created_at")
            .in("id", lastMessageIds)
            .returns<ChatMessageRow[]>()
        : Promise.resolve({ data: [], error: null }),
    ]);

    if (classRowsError) throw classRowsError;
    if (lastMessagesError) throw lastMessagesError;

    const profileMap = new Map(profiles.map((profile) => [profile.id, profile]));
    const classMap = new Map((classRows ?? []).map((row) => [row.id, row]));
    const messageMap = new Map((lastMessages ?? []).map((message) => [message.id, message]));

    const result = activeRooms
      .map((room) => {
        const roomMembers = memberMap.get(room.id) ?? [];
        const displayMembers = displayMembersByRoom.get(room.id) ?? [];
        const lastMessage = room.last_message_id ? messageMap.get(room.last_message_id) ?? null : null;
        const classPreview = room.class_id ? classMap.get(room.class_id) ?? null : null;
        const classImageUrl =
          classPreview?.images?.[0]?.icon_url ?? classPreview?.images?.[0]?.card_url ?? null;

        return {
          id: room.id,
          type: room.type,
          class_id: room.class_id,
          class_image_url: room.type === "class" ? classImageUrl : null,
          owner_id: room.owner_id,
          title: getRoomTitle(room, roomMembers, profileMap, user.id, classMap),
          notice: null,
          member_count: roomMembers.length,
          members: displayMembers.map((member) => ({
            user_id: member.user_id,
            role: member.role,
            created_at: member.created_at,
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
          unread_count: 0,
          updated_at: room.last_message_at ?? room.updated_at,
          created_at: room.created_at,
        };
      })
      .sort((a, b) => new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime());

    return NextResponse.json({ data: result });
  } catch (error) {
    console.error("[chat-rooms-preview]", error);
    return NextResponse.json({ error: "서버 오류" }, { status: 500 });
  }
}
