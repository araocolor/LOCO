import { createClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";

type PendingState = "hidden" | "blocked" | "black";

interface PendingMember {
  id: string;
  nickname: string;
  profile_image_url: string | null;
  country: string | null;
  region: string | null;
  state: PendingState;
  updated_at: string;
}

export async function GET() {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { data: stateRows, error: stateError } = await supabase
      .from("friend_member_states")
      .select("state, updated_at, target_id")
      .in("state", ["hidden", "blocked", "black"])
      .eq("owner_id", user.id);
    if (stateError) throw stateError;

    const targetIds = (stateRows ?? []).map((row) => row.target_id);
    let profileMap = new Map<string, { nickname: string; profile_image_url: string | null; country: string | null; region: string | null }>();

    if (targetIds.length > 0) {
      const { data: profiles, error: profileError } = await supabase
        .from("profiles")
        .select("id, nickname, profile_image_url, country, region")
        .in("id", targetIds);
      if (profileError) throw profileError;

      profileMap = new Map(
        (profiles ?? []).map((p) => [
          p.id,
          {
            nickname: p.nickname ?? "",
            profile_image_url: p.profile_image_url ?? null,
            country: p.country ?? null,
            region: p.region ?? null,
          },
        ])
      );
    }

    const orderMap: Record<PendingState, number> = {
      hidden: 0,
      blocked: 1,
      black: 2,
    };

    const data: PendingMember[] = (stateRows ?? [])
      .map((row) => {
        const p = profileMap.get(row.target_id);
        return {
          id: row.target_id,
          nickname: p?.nickname ?? "",
          profile_image_url: p?.profile_image_url ?? null,
          country: p?.country ?? null,
          region: p?.region ?? null,
          state: row.state as PendingState,
          updated_at: row.updated_at ?? new Date(0).toISOString(),
        };
      })
      .sort((a, b) => {
        const stateDiff = orderMap[a.state] - orderMap[b.state];
        if (stateDiff !== 0) return stateDiff;
        return new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime();
      });

    return NextResponse.json({ data });
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: "서버 오류" }, { status: 500 });
  }
}
