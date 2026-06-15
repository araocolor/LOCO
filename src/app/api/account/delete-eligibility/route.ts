import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

export async function GET() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const admin = createAdminClient();
  const [profileResult, starResult, classRoomResult] = await Promise.all([
    admin
      .from("profiles")
      .select("nickname")
      .eq("id", user.id)
      .maybeSingle(),
    admin
      .from("star_wallets")
      .select("balance")
      .eq("user_id", user.id)
      .maybeSingle(),
    admin
      .from("chat_room_members")
      .select("room:chat_rooms!inner(id)", { count: "exact", head: true })
      .eq("user_id", user.id)
      .eq("status", "active")
      .eq("room.type", "class")
      .eq("room.status", "active"),
  ]);

  if (profileResult.error) {
    return NextResponse.json({ error: profileResult.error.message }, { status: 500 });
  }

  const starBalance = starResult.data?.balance ?? 0;
  const classRoomCount = classRoomResult.count ?? 0;

  return NextResponse.json({
    nickname: profileResult.data?.nickname ?? "회원",
    starBalance,
    classRoomCount,
    canDelete: starBalance === 0 && classRoomCount === 0,
  });
}
