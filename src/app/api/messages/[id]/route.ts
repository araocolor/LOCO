import { createClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";

function extractStoragePath(publicUrl: string): string | null {
  try {
    const url = new URL(publicUrl);
    // /storage/v1/object/public/message/<path> 형태
    const match = url.pathname.match(/\/storage\/v1\/object\/public\/message\/(.+)/);
    return match ? match[1] : null;
  } catch {
    return null;
  }
}

export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { data: msg, error: fetchError } = await supabase
      .from("messages")
      .select("content")
      .eq("id", id)
      .eq("sender_id", user.id)
      .single();

    if (fetchError || !msg) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    // 이미지 메시지면 스토리지에서도 삭제
    try {
      const parsed = JSON.parse(msg.content);
      if (parsed.type === "image") {
        const paths = [parsed.thumb, parsed.full]
          .filter(Boolean)
          .map(extractStoragePath)
          .filter((p): p is string => p !== null);
        if (paths.length > 0) {
          await supabase.storage.from("message").remove(paths);
        }
      }
    } catch {}

    const { error } = await supabase
      .from("messages")
      .delete()
      .eq("id", id)
      .eq("sender_id", user.id);

    if (error) throw error;

    return NextResponse.json({ success: true });
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: "서버 오류" }, { status: 500 });
  }
}
