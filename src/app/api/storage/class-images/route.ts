import { NextRequest, NextResponse } from "next/server";
import { createClient as createServerSupabase } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import sharp from "sharp";

const ALLOWED_TYPES = ["image/jpeg", "image/png", "image/gif", "image/webp"];

async function processAndUpload(
  admin: ReturnType<typeof createAdminClient>,
  buffer: Buffer,
  basePath: string,
  width: number,
  quality: number,
) {
  const webpBuffer = await sharp(buffer)
    .resize({ width, withoutEnlargement: true })
    .webp({ quality })
    .toBuffer();

  const uploadPath = `${basePath}.webp`;
  const { error } = await admin.storage
    .from("class-images")
    .upload(uploadPath, webpBuffer, { contentType: "image/webp", upsert: false });

  if (error) throw error;

  const { data: { publicUrl } } = admin.storage.from("class-images").getPublicUrl(uploadPath);
  return publicUrl;
}

export async function POST(request: NextRequest) {
  const supabase = await createServerSupabase();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const formData = await request.formData();
    const file = formData.get("file");
    const path = formData.get("path");

    if (!(file instanceof Blob) || typeof path !== "string" || !path.trim()) {
      return NextResponse.json({ error: "file/path가 필요합니다." }, { status: 400 });
    }

    if (!ALLOWED_TYPES.includes(file.type)) {
      return NextResponse.json(
        { error: "jpg, png, gif, webp 형식만 업로드할 수 있습니다." },
        { status: 400 },
      );
    }

    const normalizedPath = path.trim().replace(/^\/+/, "");
    if (!normalizedPath.startsWith(`${user.id}/`)) {
      return NextResponse.json({ error: "업로드 경로가 올바르지 않습니다." }, { status: 400 });
    }

    const basePath = normalizedPath.replace(/\.[^.]+$/, "");
    const admin = createAdminClient();
    const buffer = Buffer.from(await file.arrayBuffer());

    const [thumbnail, full] = await Promise.all([
      processAndUpload(admin, buffer, `${basePath}_thumb`, 250, 90),
      processAndUpload(admin, buffer, `${basePath}_full`, 800, 70),
    ]);

    return NextResponse.json({
      path: `${basePath}_full.webp`,
      publicUrl: full,
      thumbnail,
      full,
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "업로드 중 오류가 발생했습니다." },
      { status: 500 },
    );
  }
}

export async function DELETE(request: NextRequest) {
  const supabase = await createServerSupabase();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const { paths } = await request.json();
    if (!Array.isArray(paths) || paths.length === 0) {
      return NextResponse.json({ error: "paths가 필요합니다." }, { status: 400 });
    }

    // 본인 경로만 삭제 가능
    const invalid = paths.some((p: string) => !p.startsWith(`${user.id}/`));
    if (invalid) {
      return NextResponse.json({ error: "삭제 권한이 없습니다." }, { status: 403 });
    }

    const admin = createAdminClient();
    const { error } = await admin.storage.from("class-images").remove(paths);

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "삭제 중 오류가 발생했습니다." },
      { status: 500 }
    );
  }
}
