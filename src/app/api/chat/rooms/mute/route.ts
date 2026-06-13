import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getAuthenticatedUser } from "../../_lib";

export async function PATCH(request: NextRequest) {
  const user = await getAuthenticatedUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json();
  const roomId = typeof body.roomId === "string" ? body.roomId : "";
  const muted = body.muted === true;

  if (!roomId) {
    return NextResponse.json({ error: "roomId가 없습니다." }, { status: 400 });
  }

  const admin = createAdminClient();
  const { error } = await admin
    .from("chat_room_members")
    .update({ muted })
    .eq("room_id", roomId)
    .eq("user_id", user.id)
    .eq("status", "active");

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ roomId, muted });
}
