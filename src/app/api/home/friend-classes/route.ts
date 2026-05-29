import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

const FRIEND_CLASS_LIMIT = 50;

export async function GET() {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { data: friendships, error: friendshipsError } = await supabase
      .from("friendships")
      .select("friend_id, status")
      .eq("user_id", user.id)
      .in("status", ["approved", "friend"]);

    if (friendshipsError) throw friendshipsError;

    const friendIds = (friendships ?? [])
      .map((row) => row.friend_id)
      .filter((id) => id !== user.id);

    if (friendIds.length === 0) {
      return NextResponse.json(
        { friendClasses: [] },
        { headers: { "Cache-Control": "private, max-age=30" } }
      );
    }

    const { data: classes, error: classesError } = await supabase
      .from("classes")
      .select("*, host:profiles!host_id(id, nickname, profile_image_url)")
      .in("host_id", friendIds)
      .order("created_at", { ascending: false })
      .limit(FRIEND_CLASS_LIMIT);

    if (classesError) throw classesError;

    return NextResponse.json(
      { friendClasses: classes ?? [] },
      { headers: { "Cache-Control": "private, max-age=30" } }
    );
  } catch (error) {
    console.error("[home-friend-classes:get]", error);
    return NextResponse.json(
      { error: "친클래스를 불러오지 못했습니다." },
      { status: 500 }
    );
  }
}
