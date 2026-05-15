import { createClient } from "@/lib/supabase/server";
import { NextRequest, NextResponse } from "next/server";

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

    if (currentState?.state === "hidden") {
      return NextResponse.json({ success: true, alreadyHidden: true });
    }

    const { error } = await supabase.from("friend_member_states").upsert(
      {
        owner_id: user.id,
        target_id,
        state: "hidden",
        previous_status: currentState?.previous_status ?? friendship?.status ?? "none",
      },
      { onConflict: "owner_id,target_id" }
    );
    if (error) throw error;

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

    if (!currentState || currentState.state !== "hidden") {
      return NextResponse.json({ success: true, alreadyVisible: true });
    }

    const previousStatus = currentState.previous_status as "none" | "pending" | "approved" | "friend";
    if (previousStatus !== "none") {
      const { data: friendship, error: friendshipError } = await supabase
        .from("friendships")
        .select("id")
        .eq("user_id", user.id)
        .eq("friend_id", target_id)
        .maybeSingle();
      if (friendshipError) throw friendshipError;

      if (friendship) {
        const { error: updateError } = await supabase
          .from("friendships")
          .update({ status: previousStatus })
          .eq("id", friendship.id);
        if (updateError) throw updateError;
      } else {
        const { error: insertError } = await supabase.from("friendships").insert({
          user_id: user.id,
          friend_id: target_id,
          status: previousStatus,
        });
        if (insertError) throw insertError;
      }
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
