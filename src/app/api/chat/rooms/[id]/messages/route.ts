import { createAdminClient } from "@/lib/supabase/admin";
import { NextRequest, NextResponse } from "next/server";
import {
  type ChatMemberRow,
  type ChatMessageKind,
  type ChatMessageRow,
  type ChatRoomRow,
  getAuthenticatedUser,
  getProfiles,
  normalizeMessageContent,
  requireActiveRoomMember,
} from "../../../_lib";

const MESSAGE_KINDS = new Set<ChatMessageKind>(["text", "image", "file", "system", "emoji"]);
const MESSAGE_REACTION_TYPES = ["heart", "like", "laugh", "wow", "sad"] as const;
type MessageReactionType = (typeof MESSAGE_REACTION_TYPES)[number];

interface MessageReactionRow {
  message_id: string;
  user_id: string;
  reaction_type: MessageReactionType;
}

function emptyMessageReactionCounts(): Record<MessageReactionType, number> {
  return { heart: 0, like: 0, laugh: 0, wow: 0, sad: 0 };
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await getAuthenticatedUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id: roomId } = await params;
    const membership = await requireActiveRoomMember(roomId, user.id);
    if (!membership) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    // 읽음만 처리하는 가벼운 호출(readOnly=1): 메시지를 받지 않고 읽은 시각만 갱신합니다.
    // 방을 보는 중에 새 메시지가 와도 읽음으로 표시하기 위한 용도입니다.
    if (request.nextUrl.searchParams.get("readOnly") === "1") {
      const admin = createAdminClient();
      await admin
        .from("chat_room_members")
        .update({ last_read_at: new Date().toISOString() })
        .eq("room_id", roomId)
        .eq("user_id", user.id);
      return NextResponse.json({ data: [] });
    }

    const limitParam = Number(request.nextUrl.searchParams.get("limit") ?? "50");
    const limit = Number.isFinite(limitParam) ? Math.min(Math.max(limitParam, 1), 100) : 50;
    const before = request.nextUrl.searchParams.get("before");

    const admin = createAdminClient();
    let query = admin
      .from("chat_messages")
      .select("id, room_id, sender_id, kind, content, deleted_at, created_at")
      .eq("room_id", roomId)
      .is("deleted_at", null)
      .order("created_at", { ascending: false })
      .limit(limit);

    if (before) query = query.lt("created_at", before);

    const { data: rows, error } = await query.returns<ChatMessageRow[]>();
    if (error) throw error;

    const messages = (rows ?? []).slice().reverse();
    const profiles = await getProfiles(messages.map((message) => message.sender_id));
    const profileMap = new Map(profiles.map((profile) => [profile.id, profile]));
    const messageIds = messages.map((message) => message.id);
    const { data: reactions, error: reactionsError } = messageIds.length > 0
      ? await admin
          .from("chat_message_reactions")
          .select("message_id, user_id, reaction_type")
          .in("message_id", messageIds)
          .returns<MessageReactionRow[]>()
      : { data: [], error: null };

    if (reactionsError) throw reactionsError;

    // 1:1 대화일 때만 상대방이 읽은 시각을 가져와 내 메시지의 읽음 여부를 계산합니다.
    let otherLastReadAt: string | null = null;
    const { data: room } = await admin
      .from("chat_rooms")
      .select("type")
      .eq("id", roomId)
      .maybeSingle<Pick<ChatRoomRow, "type">>();
    const isDirectRoom = room?.type === "direct";

    if (isDirectRoom) {
      const { data: otherMember } = await admin
        .from("chat_room_members")
        .select("last_read_at")
        .eq("room_id", roomId)
        .eq("status", "active")
        .neq("user_id", user.id)
        .maybeSingle<Pick<ChatMemberRow, "last_read_at">>();
      otherLastReadAt = otherMember?.last_read_at ?? null;
    }

    // 그룹/클래스: 나를 제외한 활성 멤버들의 읽은 시각·입장 시각을 가져옵니다.
    const isGroupRoom = room?.type === "group" || room?.type === "class";
    let groupMembers: Array<{ last_read_at: string | null; joined_at: string | null }> = [];
    if (isGroupRoom) {
      const { data: otherMembers } = await admin
        .from("chat_room_members")
        .select("last_read_at, joined_at")
        .eq("room_id", roomId)
        .eq("status", "active")
        .neq("user_id", user.id)
        .returns<Array<{ last_read_at: string | null; joined_at: string | null }>>();
      groupMembers = otherMembers ?? [];
    }

    const reactionCountMap = new Map<string, Record<MessageReactionType, number>>();
    const myReactionMap = new Map<string, MessageReactionType>();
    (reactions ?? []).forEach((reaction) => {
      const counts = reactionCountMap.get(reaction.message_id) ?? emptyMessageReactionCounts();
      if (MESSAGE_REACTION_TYPES.includes(reaction.reaction_type)) counts[reaction.reaction_type] += 1;
      reactionCountMap.set(reaction.message_id, counts);
      if (reaction.user_id === user.id) myReactionMap.set(reaction.message_id, reaction.reaction_type);
    });

    // 방을 실제로 열 때(markRead=1)만 읽음 처리합니다.
    // 미리보기·알림 등 백그라운드 자동 호출에서는 읽음으로 처리하지 않습니다.
    const markRead = request.nextUrl.searchParams.get("markRead") === "1";
    if (markRead) {
      const readAt = new Date().toISOString();
      await admin
        .from("chat_room_members")
        .update({ last_read_at: readAt })
        .eq("room_id", roomId)
        .eq("user_id", user.id);
    }

    return NextResponse.json({
      data: messages.map((message) => {
        const isMine = message.sender_id === user.id;
        // 1:1: 상대가 읽은 시각이 메시지 시각 이상이면 읽음 처리합니다.
        const readAtValue = isMine && otherLastReadAt && otherLastReadAt >= message.created_at
          ? otherLastReadAt
          : null;
        // 그룹/클래스: 내가 보낸 메시지를 아직 안 읽은 멤버 수를 계산합니다.
        // (입장 시각 이후의 메시지만 대상, 읽은 시각이 메시지보다 이르면 안읽음)
        const unreadCountValue = isMine
          ? groupMembers.filter((m) => {
              if (m.joined_at && m.joined_at > message.created_at) return false;
              return !m.last_read_at || m.last_read_at < message.created_at;
            }).length
          : 0;
        return {
          ...message,
          sender: profileMap.get(message.sender_id) ?? null,
          is_mine: isMine,
          // 읽음 표시는 1:1 대화에서만 노출합니다. (그룹/클래스는 키 자체를 제외)
          ...(isDirectRoom ? { read_at: readAtValue } : {}),
          // 그룹/클래스는 안 읽은 사람 수를 노출합니다.
          ...(isGroupRoom ? { unread_count: unreadCountValue } : {}),
          my_reaction: myReactionMap.get(message.id) ?? null,
          reaction_counts: reactionCountMap.get(message.id) ?? emptyMessageReactionCounts(),
        };
      }),
    });
  } catch (error) {
    console.error("[chat-room-messages:get]", error);
    return NextResponse.json({ error: "서버 오류" }, { status: 500 });
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await getAuthenticatedUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id: roomId } = await params;
    const membership = await requireActiveRoomMember(roomId, user.id);
    if (!membership) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    const body = await request.json();
    const kind = (body.kind ?? "text") as ChatMessageKind;
    if (!MESSAGE_KINDS.has(kind) || kind === "system") {
      return NextResponse.json({ error: "지원하지 않는 메시지 형식입니다." }, { status: 400 });
    }

    const content = normalizeMessageContent(kind, body.content);
    if (!content) {
      return NextResponse.json({ error: "메시지 내용이 없습니다." }, { status: 400 });
    }

    const admin = createAdminClient();
    const { data: message, error } = await admin
      .from("chat_messages")
      .insert({
        room_id: roomId,
        sender_id: user.id,
        kind,
        content,
      })
      .select("id, room_id, sender_id, kind, content, deleted_at, created_at")
      .single<ChatMessageRow>();

    if (error) throw error;

    // 읽음 기준: 방을 실제로 열 때(GET)만 last_read_at을 갱신합니다.
    // 메시지를 보낼 때는 갱신하지 않아, 상대가 방을 안 보고 답장만 해도
    // 읽음으로 잘못 표시되지 않습니다.

    return NextResponse.json({
      data: {
        ...message,
        is_mine: true,
        my_reaction: null,
        reaction_counts: emptyMessageReactionCounts(),
      },
    });
  } catch (error) {
    console.error("[chat-room-messages:post]", error);
    return NextResponse.json({ error: "서버 오류" }, { status: 500 });
  }
}
