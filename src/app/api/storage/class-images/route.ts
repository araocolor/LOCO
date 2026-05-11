import { NextRequest, NextResponse } from "next/server";
import { createClient as createServerSupabase } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

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

    // 경로를 사용자 하위로 제한
    const normalizedPath = path.trim().replace(/^\/+/, "");
    if (!normalizedPath.startsWith(`${user.id}/`)) {
      return NextResponse.json({ error: "업로드 경로가 올바르지 않습니다." }, { status: 400 });
    }

    const admin = createAdminClient();
    const buffer = Buffer.from(await file.arrayBuffer());

    const { error } = await admin.storage
      .from("class-images")
      .upload(normalizedPath, buffer, {
        contentType: file.type || "image/jpeg",
        upsert: false,
      });

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    const {
      data: { publicUrl },
    } = admin.storage.from("class-images").getPublicUrl(normalizedPath);

    return NextResponse.json({ path: normalizedPath, publicUrl });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "업로드 중 오류가 발생했습니다." },
      { status: 500 }
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
