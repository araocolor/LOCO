import { createAdminClient } from "@/lib/supabase/admin";
import { NextRequest, NextResponse } from "next/server";
import {
  type ChatMessageRow,
  getAuthenticatedUser,
  requireActiveRoomMember,
} from "../../../../_lib";

const ORIGINAL_VIDEO_BUCKET = "message-video-originals";
const EMPTY_MESSAGE_REACTION_COUNTS = { heart: 0, like: 0, laugh: 0, wow: 0, sad: 0 };

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

async function markVideoFailed(messageId: string, originalPath: string, errorMessage: string) {
  const admin = createAdminClient();
  await Promise.allSettled([
    admin.storage.from(ORIGINAL_VIDEO_BUCKET).remove([originalPath]),
    admin
      .from("chat_messages")
      .update({
        kind: "file",
        content: JSON.stringify({
          type: "video",
          status: "failed",
          error: errorMessage,
        }),
      })
      .eq("id", messageId),
  ]);
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

    const rawBody: unknown = await request.json().catch(() => ({}));
    const body = isRecord(rawBody) ? rawBody : {};
    const originalPath = typeof body.path === "string" ? body.path.replace(/^\/+/, "") : "";

    if (!originalPath.startsWith(`${user.id}/`)) {
      return NextResponse.json({ error: "영상 경로가 올바르지 않습니다." }, { status: 400 });
    }

    const admin = createAdminClient();
    const processingContent = {
      type: "video",
      status: "processing",
      original_bucket: ORIGINAL_VIDEO_BUCKET,
      original_path: originalPath,
    };

    const { data: message, error } = await admin
      .from("chat_messages")
      .insert({
        room_id: roomId,
        sender_id: user.id,
        kind: "file",
        content: JSON.stringify(processingContent),
      })
      .select("id, room_id, sender_id, kind, content, deleted_at, created_at")
      .single<ChatMessageRow>();

    if (error) throw error;

    await admin
      .from("chat_room_members")
      .update({ last_read_at: message.created_at })
      .eq("room_id", roomId)
      .eq("user_id", user.id);

    const workerUrl = process.env.VIDEO_WORKER_URL;
    const workerSecret = process.env.VIDEO_WORKER_SECRET;

    if (!workerUrl || !workerSecret) {
      await markVideoFailed(message.id, originalPath, "영상 worker 환경 변수가 설정되지 않았습니다.");
    } else {
      const workerRes = await fetch(`${workerUrl.replace(/\/+$/, "")}/process-video`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-worker-secret": workerSecret,
        },
        body: JSON.stringify({
          messageId: message.id,
          originalBucket: ORIGINAL_VIDEO_BUCKET,
          originalPath,
        }),
        signal: AbortSignal.timeout(10000),
      });

      if (!workerRes.ok) {
        await markVideoFailed(message.id, originalPath, "영상 변환 요청에 실패했습니다.");
      }
    }

    return NextResponse.json({
      data: {
        ...message,
        is_mine: true,
        my_reaction: null,
        reaction_counts: EMPTY_MESSAGE_REACTION_COUNTS,
      },
    }, { status: 201 });
  } catch (error) {
    console.error("[chat-video-process]", error);
    return NextResponse.json({ error: "영상 처리 요청 중 오류가 발생했습니다." }, { status: 500 });
  }
}
