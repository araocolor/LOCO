import { createClient } from "@/lib/supabase/server";
import { NextRequest, NextResponse } from "next/server";

type FriendStatus = "none" | "pending" | "approved" | "friend";

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { target_id } = await request.json();
    if (!target_id) {
      return NextResponse.json({ error: "Missing target_id" }, { status: 400 });
    }

    const [{ data: friendship, error: friendshipError }, { data: currentState, error: currentStateError }] =
      await Promise.all([
        supabase
          .from("friendships")
          .select("status")
          .eq("user_id", user.id)
          .eq("friend_id", target_id)
          .maybeSingle(),
        supabase
          .from("friend_member_states")
          .select("state, previous_status")
          .eq("owner_id", user.id)
          .eq("target_id", target_id)
          .maybeSingle(),
      ]);

    if (friendshipError) throw friendshipError;
    if (currentStateError) throw currentStateError;

    if (!friendship || !["pending", "approved", "friend"].includes(friendship.status)) {
      return NextResponse.json({ error: "관계가 있는 회원만 설정할 수 있습니다." }, { status: 400 });
    }

    if (currentState?.state === "grey" || currentState?.state === "hidden") {
      return NextResponse.json({ success: true, alreadyGreyed: true });
    }

    if (currentState?.state === "blocked" || currentState?.state === "black") {
      return NextResponse.json({ error: "차단/블랙 상태에서는 알림끄기를 설정할 수 없습니다." }, { status: 400 });
    }

    const previousStatus = (currentState?.previous_status ??
      (friendship.status as FriendStatus)) as FriendStatus;

    const payload = {
      owner_id: user.id,
      target_id,
      previous_status: previousStatus,
    };

    // Prefer the new "grey" state. If DB constraint is not migrated yet,
    // gracefully fallback to legacy "hidden" to avoid user-facing errors.
    const { error } = await supabase
      .from("friend_member_states")
      .upsert({ ...payload, state: "grey" }, { onConflict: "owner_id,target_id" });
    if (error) {
      const isStateConstraintError = (error as { code?: string }).code === "23514";
      if (!isStateConstraintError) throw error;

      const { error: fallbackError } = await supabase
        .from("friend_member_states")
        .upsert({ ...payload, state: "hidden" }, { onConflict: "owner_id,target_id" });
      if (fallbackError) throw fallbackError;
    }

    return NextResponse.json({ success: true });
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: "서버 오류" }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { target_id } = await request.json();
    if (!target_id) {
      return NextResponse.json({ error: "Missing target_id" }, { status: 400 });
    }

    const { data: currentState, error: currentStateError } = await supabase
      .from("friend_member_states")
      .select("state")
      .eq("owner_id", user.id)
      .eq("target_id", target_id)
      .maybeSingle();
    if (currentStateError) throw currentStateError;

    if (!currentState || (currentState.state !== "grey" && currentState.state !== "hidden")) {
      return NextResponse.json({ success: true, alreadyActive: true });
    }

    const { error: deleteStateError } = await supabase
      .from("friend_member_states")
      .delete()
      .eq("owner_id", user.id)
      .eq("target_id", target_id);
    if (deleteStateError) throw deleteStateError;

    return NextResponse.json({ success: true });
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: "서버 오류" }, { status: 500 });
  }
}
