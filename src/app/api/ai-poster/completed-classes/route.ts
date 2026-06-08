import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function GET() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { data: classes, error: classesError } = await supabase
    .from("classes")
    .select("id, title, status, deadline, created_at, images, ai_poster_prompt")
    .eq("host_id", user.id)
    .order("created_at", { ascending: false })
    .limit(10);

  if (classesError) {
    return NextResponse.json({ error: classesError.message }, { status: 500 });
  }

  const completedClasses = (classes ?? []).map((item) => ({
    class_id: item.id,
    class_title: item.title,
    class_status: item.status,
    deadline: item.deadline,
    created_at: item.created_at,
    ai_poster_request_id: null,
    ai_poster_title: null,
    generated_image_url: null,
    ai_poster_prompt: item.ai_poster_prompt ?? null,
    images: item.images,
  }));

  return NextResponse.json({ classes: completedClasses });
}
