import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

export async function DELETE() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const admin = createAdminClient();
  const [starResult, classRoomResult] = await Promise.all([
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

  const starBalance = starResult.data?.balance ?? 0;
  if (starBalance > 0) {
    return NextResponse.json({ error: "남아 있는 별을 먼저 선물해야 합니다." }, { status: 400 });
  }

  const classRoomCount = classRoomResult.count ?? 0;
  if (classRoomCount > 0) {
    return NextResponse.json({ error: "가입된 클래스 대화방에서 먼저 퇴장해야 합니다." }, { status: 400 });
  }

  const { error } = await admin.auth.admin.deleteUser(user.id);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ deleted: true });
}
