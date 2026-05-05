import { createClient } from "@/lib/supabase/server";
import { NextRequest, NextResponse } from "next/server";

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { receiver_id, content } = await request.json();

    if (!receiver_id || !content?.trim()) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
    }

    // 수신자 설정 확인
    const { data: receiverSettings } = await supabase
      .from("user_settings")
      .select("message_from")
      .eq("user_id", receiver_id)
      .single();

    // message_from이 'friends_only'인 경우 친구 관계 확인
    if (receiverSettings?.message_from === "friends_only") {
      const { data: friendship } = await supabase
        .from("friendships")
        .select("status")
        .or(`and(user_id.eq.${user.id},friend_id.eq.${receiver_id}),and(user_id.eq.${receiver_id},friend_id.eq.${user.id})`)
        .single();

      if (!friendship || friendship.status !== "approved") {
        return NextResponse.json({ error: "Not friends" }, { status: 403 });
      }
    }

    // 메시지 생성
    const { data: message, error } = await supabase
      .from("messages")
      .insert({
        sender_id: user.id,
        receiver_id,
        content: content.trim(),
      })
      .select()
      .single();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ success: true, message });
  } catch (error) {
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
