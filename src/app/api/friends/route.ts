import { createClient } from "@/lib/supabase/server";
import { NextRequest, NextResponse } from "next/server";

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { target_id } = await request.json();

    if (!target_id) {
      return NextResponse.json({ error: "Missing target_id" }, { status: 400 });
    }

    if (target_id === user.id) {
      return NextResponse.json({ error: "자기 자신은 등록할 수 없습니다" }, { status: 400 });
    }

    // 기존 친구등록 기록 확인
    const { data: existing } = await supabase
      .from("friendships")
      .select("id, status, register_count, last_registered_at")
      .eq("user_id", user.id)
      .eq("friend_id", target_id)
      .maybeSingle();

    const now = new Date();

    if (existing) {
      // 이미 등록된 상태
      if (existing.status === "approved") {
        return NextResponse.json({ error: "이미 친구등록된 상태입니다" }, { status: 409 });
      }

      const lastRegistered = existing.last_registered_at ? new Date(existing.last_registered_at) : null;
      const hoursSinceLast = lastRegistered
        ? (now.getTime() - lastRegistered.getTime()) / (1000 * 60 * 60)
        : 999;

      // 1일 이내 재등록 차단
      if (hoursSinceLast < 24) {
        return NextResponse.json({ error: "1일 후 다시 등록할 수 있습니다" }, { status: 429 });
      }

      // 3회째 등록 차단 (1일 지난 경우 횟수 초기화)
      const count = existing.register_count ?? 0;
      if (count >= 2) {
        return NextResponse.json({ error: "등록 횟수를 초과했습니다. 1일 후 다시 시도해주세요" }, { status: 429 });
      }

      // 재등록 (취소 후 재등록)
      const { error } = await supabase
        .from("friendships")
        .update({
          status: "approved",
          register_count: count + 1,
          last_registered_at: now.toISOString(),
        })
        .eq("id", existing.id);

      if (error) throw error;
    } else {
      // 최초 등록
      const { error } = await supabase
        .from("friendships")
        .insert({
          user_id: user.id,
          friend_id: target_id,
          status: "approved",
          register_count: 0,
          last_registered_at: now.toISOString(),
        });

      if (error) throw error;
    }

    // 대상자에게 알림 전송 (하루에 1번만)
    const todayStart = new Date(now);
    todayStart.setHours(0, 0, 0, 0);

    const { data: recentNotif } = await supabase
      .from("notifications")
      .select("id")
      .eq("user_id", target_id)
      .eq("type", "friend")
      .eq("related_id", user.id)
      .gte("created_at", todayStart.toISOString())
      .maybeSingle();

    if (!recentNotif) {
      await supabase.from("notifications").insert({
        user_id: target_id,
        type: "friend",
        message: "누군가 회원님을 친구로 등록했습니다.",
        related_id: user.id,
        is_read: false,
      });
    }

    return NextResponse.json({ success: true });
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: "서버 오류" }, { status: 500 });
  }
}

// 친구등록 취소
export async function DELETE(request: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { target_id } = await request.json();

    if (!target_id) {
      return NextResponse.json({ error: "Missing target_id" }, { status: 400 });
    }

    const { error } = await supabase
      .from("friendships")
      .update({ status: "pending" })
      .eq("user_id", user.id)
      .eq("friend_id", target_id);

    if (error) throw error;

    return NextResponse.json({ success: true });
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: "서버 오류" }, { status: 500 });
  }
}
