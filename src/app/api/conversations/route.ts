import { createClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";

export async function GET() {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // messages 테이블에서 사용자가 주고받은 모든 메시지 조회
    const { data: messages, error: msgError } = await supabase
      .from("messages")
      .select("id, sender_id, receiver_id, content, sent_at")
      .or(`sender_id.eq.${user.id},receiver_id.eq.${user.id}`)
      .order("sent_at", { ascending: false });

    if (msgError) {
      return NextResponse.json({ error: msgError.message }, { status: 500 });
    }

    if (!messages || messages.length === 0) {
      return NextResponse.json({ data: [] });
    }

    // 각 사용자별 최신 메시지만 뽑기
    const conversationMap = new Map<string, (typeof messages)[0]>();

    messages.forEach((msg) => {
      const otherUserId = msg.sender_id === user.id ? msg.receiver_id : msg.sender_id;
      if (!conversationMap.has(otherUserId)) {
        conversationMap.set(otherUserId, msg);
      }
    });

    const conversations = Array.from(conversationMap.values());

    if (conversations.length === 0) {
      return NextResponse.json({ data: [] });
    }

    // 상대방 프로필 정보 조회
    const otherUserIds = conversations.map((msg) =>
      msg.sender_id === user.id ? msg.receiver_id : msg.sender_id
    );

    const { data: profiles } = await supabase
      .from("profiles")
      .select("id, nickname, profile_image_url")
      .in("id", otherUserIds);

    const profileMap = new Map(profiles?.map((p) => [p.id, p]) || []);

    // 응답 데이터 구성
    const result = conversations.map((msg) => {
      const otherUserId = msg.sender_id === user.id ? msg.receiver_id : msg.sender_id;
      const otherUser = profileMap.get(otherUserId);

      return {
        id: `${user.id}-${otherUserId}`,
        other_user: otherUser ? {
          id: otherUser.id,
          nickname: otherUser.nickname,
          profile_image_url: otherUser.profile_image_url,
        } : null,
        last_message: {
          content: msg.content,
          sent_at: msg.sent_at,
          is_mine: msg.sender_id === user.id,
        },
        unread_count: 0,
        updated_at: msg.sent_at,
      };
    });

    // 최신 메시지순으로 정렬
    result.sort((a, b) => new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime());

    return NextResponse.json({ data: result });
  } catch (error) {
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
