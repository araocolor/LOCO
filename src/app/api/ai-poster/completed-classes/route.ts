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
    .select("id, title, status, deadline, created_at, images, ai_poster_request_id")
    .eq("host_id", user.id)
    .not("ai_poster_request_id", "is", null)
    .order("created_at", { ascending: false })
    .limit(10);

  if (classesError) {
    return NextResponse.json({ error: classesError.message }, { status: 500 });
  }

  const requestIds = (classes ?? [])
    .map((item) => item.ai_poster_request_id)
    .filter((id): id is string => typeof id === "string" && id.length > 0);

  if (requestIds.length === 0) {
    return NextResponse.json({ classes: [] });
  }

  const { data: requests, error: requestsError } = await supabase
    .from("ai_poster_requests")
    .select("id, title, generated_image_url, created_at")
    .eq("user_id", user.id)
    .in("id", requestIds);

  if (requestsError) {
    return NextResponse.json({ error: requestsError.message }, { status: 500 });
  }

  const requestsById = new Map((requests ?? []).map((item) => [item.id, item]));
  const completedClasses = (classes ?? []).map((item) => {
    const request = requestsById.get(item.ai_poster_request_id);
    return {
      class_id: item.id,
      class_title: item.title,
      class_status: item.status,
      deadline: item.deadline,
      created_at: item.created_at,
      ai_poster_request_id: item.ai_poster_request_id,
      ai_poster_title: request?.title ?? null,
      generated_image_url: request?.generated_image_url ?? null,
      images: item.images,
    };
  });

  return NextResponse.json({ classes: completedClasses });
}
