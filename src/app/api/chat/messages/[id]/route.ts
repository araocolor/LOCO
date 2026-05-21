import { createAdminClient } from "@/lib/supabase/admin";
import { NextResponse } from "next/server";
import {
  type ChatMessageRow,
  getAuthenticatedUser,
  requireActiveRoomMember,
} from "../../_lib";

const EMPTY_MESSAGE_REACTION_COUNTS = { heart: 0, like: 0, laugh: 0, wow: 0, sad: 0 };

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await getAuthenticatedUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await params;
    const admin = createAdminClient();
    const { data: message, error: messageError } = await admin
      .from("chat_messages")
      .select("id, room_id, sender_id, kind, content, deleted_at, created_at")
      .eq("id", id)
      .is("deleted_at", null)
      .maybeSingle<ChatMessageRow>();

    if (messageError) throw messageError;
    if (!message) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    const membership = await requireActiveRoomMember(message.room_id, user.id);
    if (!membership) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    return NextResponse.json({
      data: {
        ...message,
        is_mine: message.sender_id === user.id,
        my_reaction: null,
        reaction_counts: EMPTY_MESSAGE_REACTION_COUNTS,
      },
    });
  } catch (error) {
    console.error("[chat-message-get]", error);
    return NextResponse.json({ error: "서버 오류" }, { status: 500 });
  }
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await getAuthenticatedUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await params;
    const admin = createAdminClient();
    const { data: message, error: messageError } = await admin
      .from("chat_messages")
      .select("id, room_id, sender_id")
      .eq("id", id)
      .maybeSingle<{ id: string; room_id: string; sender_id: string }>();

    if (messageError) throw messageError;
    if (!message || message.sender_id !== user.id) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    const membership = await requireActiveRoomMember(message.room_id, user.id);
    if (!membership) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    const { error } = await admin
      .from("chat_messages")
      .update({ deleted_at: new Date().toISOString() })
      .eq("id", id)
      .eq("sender_id", user.id);

    if (error) throw error;

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("[chat-message-delete]", error);
    return NextResponse.json({ error: "서버 오류" }, { status: 500 });
  }
}
