import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { NextRequest, NextResponse } from "next/server";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;
  const body = await request.json().catch(() => ({}));
  const liked = body.liked === true;
  const admin = createAdminClient();

  if (liked) {
    const { error } = await admin
      .from("class_likes")
      .upsert(
        { class_id: id, user_id: user.id, created_at: new Date().toISOString() },
        { onConflict: "class_id,user_id" }
      );
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  } else {
    const { error } = await admin
      .from("class_likes")
      .delete()
      .eq("class_id", id)
      .eq("user_id", user.id);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const { count, error: countError } = await admin
    .from("class_likes")
    .select("class_id", { count: "exact", head: true })
    .eq("class_id", id);

  if (countError) return NextResponse.json({ error: countError.message }, { status: 500 });

  await admin.from("classes").update({ like_count: count ?? 0 }).eq("id", id);

  return NextResponse.json({ liked, like_count: count ?? 0 });
}
