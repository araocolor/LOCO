import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

export type ChatMessageKind = "text" | "image" | "file" | "system";

export interface ChatRoomRow {
  id: string;
  type: "direct" | "group" | "class";
  status: "active" | "archived";
  class_id: string | null;
  owner_id: string | null;
  title: string | null;
  notice: string | null;
  direct_user_low_id: string | null;
  direct_user_high_id: string | null;
  last_message_id: string | null;
  last_message_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface ChatMemberRow {
  room_id: string;
  user_id: string;
  role: "owner" | "admin" | "member";
  status: "active" | "left" | "kicked";
  last_read_at: string | null;
}

export interface ChatProfileRow {
  id: string;
  nickname: string;
  profile_image_url: string | null;
}

export interface ChatMessageRow {
  id: string;
  room_id: string;
  sender_id: string;
  kind: ChatMessageKind;
  content: string;
  deleted_at: string | null;
  created_at: string;
}

export async function getAuthenticatedUser() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  return user;
}

export function getDirectPair(userA: string, userB: string) {
  return userA < userB
    ? { lowId: userA, highId: userB }
    : { lowId: userB, highId: userA };
}

export async function requireActiveRoomMember(roomId: string, userId: string) {
  const admin = createAdminClient();
  const { data, error } = await admin
    .from("chat_room_members")
    .select("room_id, user_id, role, status, last_read_at")
    .eq("room_id", roomId)
    .eq("user_id", userId)
    .eq("status", "active")
    .maybeSingle<ChatMemberRow>();

  if (error) throw error;
  return data;
}

export async function getRoomSnapshot(roomId: string, userId: string) {
  const admin = createAdminClient();
  const [{ data: room, error: roomError }, { data: members, error: membersError }] =
    await Promise.all([
      admin
        .from("chat_rooms")
        .select("id, type, status, class_id, owner_id, title, notice, direct_user_low_id, direct_user_high_id, last_message_id, last_message_at, created_at, updated_at")
        .eq("id", roomId)
        .maybeSingle<ChatRoomRow>(),
      admin
        .from("chat_room_members")
        .select("room_id, user_id, role, status, last_read_at")
        .eq("room_id", roomId)
        .eq("status", "active")
        .returns<ChatMemberRow[]>(),
    ]);

  if (roomError) throw roomError;
  if (membersError) throw membersError;
  if (!room) return null;

  const profiles = await getProfiles(members?.map((member) => member.user_id) ?? []);
  const profileMap = new Map(profiles.map((profile) => [profile.id, profile]));
  const displayTitle = getRoomDisplayTitle(room, members ?? [], profileMap, userId);

  return {
    ...room,
    title: displayTitle,
    members: (members ?? []).map((member) => ({
      ...member,
      profile: profileMap.get(member.user_id) ?? null,
    })),
  };
}

export async function getProfiles(userIds: string[]) {
  const ids = Array.from(new Set(userIds)).filter(Boolean);
  if (ids.length === 0) return [];

  const admin = createAdminClient();
  const { data, error } = await admin
    .from("profiles")
    .select("id, nickname, profile_image_url")
    .in("id", ids)
    .returns<ChatProfileRow[]>();

  if (error) throw error;
  return data ?? [];
}

export function getRoomDisplayTitle(
  room: ChatRoomRow,
  members: ChatMemberRow[],
  profileMap: Map<string, ChatProfileRow>,
  currentUserId: string
) {
  if (room.title?.trim()) return room.title;

  if (room.type === "direct") {
    const otherMember = members.find((member) => member.user_id !== currentUserId);
    return otherMember ? profileMap.get(otherMember.user_id)?.nickname ?? "알 수 없음" : "대화";
  }

  const names = members
    .filter((member) => member.user_id !== currentUserId)
    .map((member) => profileMap.get(member.user_id)?.nickname)
    .filter((name): name is string => Boolean(name));

  if (names.length > 0) return names.slice(0, 3).join(", ");
  return room.type === "class" ? "클래스 채팅" : "그룹 채팅";
}

export function normalizeMessageContent(kind: ChatMessageKind, content: unknown) {
  if (typeof content === "string") {
    const trimmed = content.trim();
    if (!trimmed) return null;
    return kind === "text" ? trimmed : trimmed;
  }

  if ((kind === "image" || kind === "file") && content && typeof content === "object") {
    return JSON.stringify(content);
  }

  return null;
}
