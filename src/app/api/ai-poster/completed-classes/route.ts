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
    .select(
      "id, title, created_at, images, ai_poster_requests!classes_ai_poster_request_id_fkey(prompt_text)"
    )
    .eq("host_id", user.id)
    .not("ai_poster_request_id", "is", null)
    .order("created_at", { ascending: false })
    .limit(10);

  if (classesError) {
    return NextResponse.json({ error: classesError.message }, { status: 500 });
  }

  const completedClasses = (classes ?? []).map((item) => {
    const promptSource = Array.isArray(item.ai_poster_requests)
      ? item.ai_poster_requests[0]
      : item.ai_poster_requests;

    return {
      class_id: item.id,
      class_title: item.title,
      created_at: item.created_at,
      images: item.images,
      ai_poster_prompt:
        promptSource &&
        typeof promptSource === "object" &&
        "prompt_text" in promptSource &&
        typeof promptSource.prompt_text === "string"
          ? promptSource.prompt_text
          : null,
    };
  });

  return NextResponse.json({ classes: completedClasses });
}
