import { createAdminClient } from "@/lib/supabase/admin";
import { NextRequest, NextResponse } from "next/server";
import { getAuthenticatedUser, requireActiveRoomMember } from "../../../_lib";

type MessageReactionType = "heart" | "like" | "laugh" | "wow" | "sad";

const REACTION_TYPES = new Set<MessageReactionType>(["heart", "like", "laugh", "wow", "sad"]);

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await getAuthenticatedUser();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { id: messageId } = await params;
    const body = await request.json().catch(() => ({}));
    const reactionType = body.reaction_type as MessageReactionType;
    if (!REACTION_TYPES.has(reactionType)) {
      return NextResponse.json({ error: "지원하지 않는 반응입니다." }, { status: 400 });
    }

    const admin = createAdminClient();
    const { data: message, error: messageError } = await admin
      .from("chat_messages")
      .select("id, room_id")
      .eq("id", messageId)
      .is("deleted_at", null)
      .maybeSingle<{ id: string; room_id: string }>();

    if (messageError) throw messageError;
    if (!message) return NextResponse.json({ error: "Not found" }, { status: 404 });

    const membership = await requireActiveRoomMember(message.room_id, user.id);
    if (!membership) return NextResponse.json({ error: "Not found" }, { status: 404 });

    const { data: existing, error: existingError } = await admin
      .from("chat_message_reactions")
      .select("reaction_type")
      .eq("message_id", messageId)
      .eq("user_id", user.id)
      .maybeSingle<{ reaction_type: MessageReactionType }>();

    if (existingError) throw existingError;

    if (existing?.reaction_type === reactionType) {
      const { error } = await admin
        .from("chat_message_reactions")
        .delete()
        .eq("message_id", messageId)
        .eq("user_id", user.id);
      if (error) throw error;
      return NextResponse.json({ reaction_type: null });
    }

    const { error } = await admin
      .from("chat_message_reactions")
      .upsert(
        { message_id: messageId, user_id: user.id, reaction_type: reactionType, created_at: new Date().toISOString() },
        { onConflict: "message_id,user_id" }
      );

    if (error) throw error;
    return NextResponse.json({ reaction_type: reactionType });
  } catch (error) {
    console.error("[chat-message-reaction:post]", error);
    return NextResponse.json({ error: "서버 오류" }, { status: 500 });
  }
}
