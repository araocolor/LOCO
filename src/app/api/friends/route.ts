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

    const now = new Date();

    const [{ data: myRow, error: myRowError }, { data: reverseRow, error: reverseRowError }, { data: cooldown, error: cooldownError }] =
      await Promise.all([
        supabase
          .from("friendships")
          .select("id, status")
          .eq("user_id", user.id)
          .eq("friend_id", target_id)
          .maybeSingle(),
        supabase
          .from("friendships")
          .select("id, status")
          .eq("user_id", target_id)
          .eq("friend_id", user.id)
          .maybeSingle(),
        supabase
          .from("friend_request_cooldowns")
          .select("cancelled_at")
          .eq("requester_id", user.id)
          .eq("target_id", target_id)
          .maybeSingle(),
      ]);
    if (myRowError) throw myRowError;
    if (reverseRowError) throw reverseRowError;
    if (cooldownError) throw cooldownError;

    const shouldAutoFriend = !!reverseRow && ["approved", "friend"].includes(reverseRow.status);

    if (!shouldAutoFriend && cooldown?.cancelled_at) {
      const diff = now.getTime() - new Date(cooldown.cancelled_at).getTime();
      if (diff < 24 * 60 * 60 * 1000) {
        return NextResponse.json({ error: "신청취소 후 1일 뒤 다시 신청할 수 있습니다." }, { status: 429 });
      }
    }

    if (shouldAutoFriend) {
      if (!reverseRow) {
        return NextResponse.json({ error: "상대 신청 정보를 찾을 수 없습니다." }, { status: 400 });
      }

      if (myRow) {
        const { error } = await supabase
          .from("friendships")
          .update({ status: "friend" })
          .eq("id", myRow.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("friendships").insert({
          user_id: user.id,
          friend_id: target_id,
          status: "friend",
        });
        if (error) throw error;
      }

      const { error: reverseUpdateError } = await supabase
        .from("friendships")
        .update({ status: "friend" })
        .eq("id", reverseRow.id);
      if (reverseUpdateError) throw reverseUpdateError;
    } else {
      if (myRow?.status === "friend" || myRow?.status === "approved") {
        return NextResponse.json({ error: "이미 친구 상태입니다." }, { status: 409 });
      }

      if (myRow) {
        const { error } = await supabase
          .from("friendships")
          .update({ status: "approved" })
          .eq("id", myRow.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("friendships").insert({
          user_id: user.id,
          friend_id: target_id,
          status: "approved",
        });
        if (error) throw error;
      }
    }

    const { error: cooldownDeleteError } = await supabase
      .from("friend_request_cooldowns")
      .delete()
      .eq("requester_id", user.id)
      .eq("target_id", target_id);
    if (cooldownDeleteError) throw cooldownDeleteError;

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
        message: shouldAutoFriend ? "누군가 회원님과 친구가 되었습니다." : "누군가 회원님을 친구로 등록했습니다.",
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

// 친구신청 취소 / 친구관계 해제
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

    const { data: row, error: rowError } = await supabase
      .from("friendships")
      .select("id, status")
      .eq("user_id", user.id)
      .eq("friend_id", target_id)
      .maybeSingle();
    if (rowError) throw rowError;

    if (!row) {
      return NextResponse.json({ success: true, alreadyCancelled: true });
    }

    const { error: deleteError } = await supabase
      .from("friendships")
      .delete()
      .eq("id", row.id);
    if (deleteError) throw deleteError;

    const { error: cooldownError } = await supabase
      .from("friend_request_cooldowns")
      .upsert(
        {
          requester_id: user.id,
          target_id,
          cancelled_at: new Date().toISOString(),
        },
        { onConflict: "requester_id,target_id" }
      );
    if (cooldownError) throw cooldownError;

    return NextResponse.json({ success: true });
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: "서버 오류" }, { status: 500 });
  }
}
