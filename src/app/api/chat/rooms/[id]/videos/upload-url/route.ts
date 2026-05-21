import { createAdminClient } from "@/lib/supabase/admin";
import { NextRequest, NextResponse } from "next/server";
import { getAuthenticatedUser, requireActiveRoomMember } from "../../../../_lib";
import { randomUUID } from "node:crypto";

const ORIGINAL_VIDEO_BUCKET = "message-video-originals";
const MAX_VIDEO_BYTES = 50 * 1024 * 1024;
const ALLOWED_VIDEO_TYPES = new Set(["video/mp4", "video/quicktime", "video/webm"]);

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function getVideoExtension(contentType: string, fileName: string) {
  const lowerName = fileName.toLowerCase();
  if (contentType === "video/quicktime" || lowerName.endsWith(".mov")) return "mov";
  if (contentType === "video/webm" || lowerName.endsWith(".webm")) return "webm";
  return "mp4";
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
    const fileName = typeof body.fileName === "string" ? body.fileName : "video.mp4";
    const contentType = typeof body.contentType === "string" ? body.contentType : "";
    const size = typeof body.size === "number" ? body.size : Number(body.size);

    if (!ALLOWED_VIDEO_TYPES.has(contentType)) {
      return NextResponse.json({ error: "mp4, mov, webm 영상만 업로드할 수 있습니다." }, { status: 400 });
    }

    if (!Number.isFinite(size) || size <= 0 || size > MAX_VIDEO_BYTES) {
      return NextResponse.json({ error: "영상은 최대 50MB까지 업로드할 수 있습니다." }, { status: 400 });
    }

    const extension = getVideoExtension(contentType, fileName);
    const objectPath = `${user.id}/${Date.now()}_${randomUUID()}.${extension}`;
    const admin = createAdminClient();
    const { data, error } = await admin.storage
      .from(ORIGINAL_VIDEO_BUCKET)
      .createSignedUploadUrl(objectPath);

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({
      bucket: ORIGINAL_VIDEO_BUCKET,
      path: objectPath,
      signedUrl: data.signedUrl,
      token: data.token,
    });
  } catch (error) {
    console.error("[chat-video-upload-url]", error);
    return NextResponse.json({ error: "영상 업로드 준비 중 오류가 발생했습니다." }, { status: 500 });
  }
}
