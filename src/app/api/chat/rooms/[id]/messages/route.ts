import { createAdminClient } from "@/lib/supabase/admin";
import { NextRequest, NextResponse } from "next/server";
import {
  type ChatMessageKind,
  type ChatMessageRow,
  getAuthenticatedUser,
  getProfiles,
  normalizeMessageContent,
  requireActiveRoomMember,
} from "../../../_lib";

const MESSAGE_KINDS = new Set<ChatMessageKind>(["text", "image", "file", "system"]);

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

    const readAt = new Date().toISOString();
    await admin
      .from("chat_room_members")
      .update({ last_read_at: readAt })
      .eq("room_id", roomId)
      .eq("user_id", user.id);

    return NextResponse.json({
      data: messages.map((message) => ({
        ...message,
        sender: profileMap.get(message.sender_id) ?? null,
        is_mine: message.sender_id === user.id,
      })),
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

    await admin
      .from("chat_room_members")
      .update({ last_read_at: message.created_at })
      .eq("room_id", roomId)
      .eq("user_id", user.id);

    return NextResponse.json({ data: { ...message, is_mine: true } });
  } catch (error) {
    console.error("[chat-room-messages:post]", error);
    return NextResponse.json({ error: "서버 오류" }, { status: 500 });
  }
}
