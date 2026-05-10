import { createClient } from "@/lib/supabase/server";
import { NextRequest, NextResponse } from "next/server";

type FriendStatus = "none" | "pending" | "approved" | "friend";

async function restoreFriendship(
  supabase: Awaited<ReturnType<typeof createClient>>,
  userId: string,
  targetId: string,
  previousStatus: FriendStatus
) {
  if (previousStatus === "none") {
    const { error } = await supabase
      .from("friendships")
      .delete()
      .eq("user_id", userId)
      .eq("friend_id", targetId)
      .in("status", ["pending", "approved", "friend"]);
    if (error) throw error;
    return;
  }

  const { data: existing, error: existingError } = await supabase
    .from("friendships")
    .select("id")
    .eq("user_id", userId)
    .eq("friend_id", targetId)
    .maybeSingle();
  if (existingError) throw existingError;

  if (existing) {
    const { error } = await supabase
      .from("friendships")
      .update({ status: previousStatus })
      .eq("id", existing.id);
    if (error) throw error;
    return;
  }

  const { error } = await supabase.from("friendships").insert({
    user_id: userId,
    friend_id: targetId,
    status: previousStatus,
  });
  if (error) throw error;
}

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

    if (target_id === user.id) {
      return NextResponse.json({ error: "본인은 신고할 수 없습니다" }, { status: 400 });
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

    const previousStatus = (currentState?.previous_status ??
      (friendship?.status as FriendStatus | undefined) ??
      "none") as FriendStatus;

    const { error: stateError } = await supabase.from("friend_member_states").upsert(
      {
        owner_id: user.id,
        target_id,
        state: "black",
        previous_status: previousStatus,
      },
      { onConflict: "owner_id,target_id" }
    );
    if (stateError) throw stateError;

    const { error } = await supabase.from("black_reports").upsert({
      reporter_id: user.id,
      target_id,
    }, { onConflict: "reporter_id,target_id" });

    if (error) {
      throw error;
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
      .select("state, previous_status")
      .eq("owner_id", user.id)
      .eq("target_id", target_id)
      .maybeSingle();
    if (currentStateError) throw currentStateError;

    if (!currentState || currentState.state !== "black") {
      return NextResponse.json({ success: true, alreadyUnreported: true });
    }

    await restoreFriendship(
      supabase,
      user.id,
      target_id,
      (currentState.previous_status as FriendStatus | null) ?? "none"
    );

    const { error: deleteStateError } = await supabase
      .from("friend_member_states")
      .delete()
      .eq("owner_id", user.id)
      .eq("target_id", target_id);
    if (deleteStateError) throw deleteStateError;

    const { error } = await supabase
      .from("black_reports")
      .delete()
      .eq("reporter_id", user.id)
      .eq("target_id", target_id);

    if (error) throw error;

    return NextResponse.json({ success: true });
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: "서버 오류" }, { status: 500 });
  }
}
