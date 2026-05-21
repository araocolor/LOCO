import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

interface SearchProfileRow {
  id: string;
  nickname: string;
  profile_image_url: string | null;
  region: string | null;
  created_at: string;
}

export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const rawQuery = (request.nextUrl.searchParams.get("q") ?? "").trim();
    const safeQuery = rawQuery.replace(/[^\p{L}\p{N}_\-\s]/gu, "").trim();
    const queryPattern = safeQuery.replace(/\s+/g, "%");
    const requestedLimit = Number.parseInt(request.nextUrl.searchParams.get("limit") ?? "20", 10);
    const limit = Number.isFinite(requestedLimit) ? Math.min(Math.max(requestedLimit, 1), 50) : 20;

    if (!queryPattern) {
      return NextResponse.json({ data: [] });
    }

    const isUuidQuery =
      /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(safeQuery);
    const searchFilters = [`nickname.ilike.%${queryPattern}%`];
    if (isUuidQuery) {
      searchFilters.push(`id.eq.${safeQuery}`);
    }

    const admin = createAdminClient();
    const { data: rows, error: rowsError } = await admin
      .from("profiles")
      .select("id, nickname, profile_image_url, region, created_at")
      .or(searchFilters.join(","))
      .neq("id", user.id)
      .order("created_at", { ascending: false })
      .limit(limit)
      .returns<SearchProfileRow[]>();

    if (rowsError) throw rowsError;

    const candidateIds = (rows ?? []).map((row) => row.id);
    if (candidateIds.length === 0) {
      return NextResponse.json({ data: [] });
    }

    const { data: stateRows, error: stateError } = await admin
      .from("friend_member_states")
      .select("owner_id, target_id, state")
      .or(
        `and(owner_id.eq.${user.id},target_id.in.(${candidateIds.join(",")})),and(owner_id.in.(${candidateIds.join(",")}),target_id.eq.${user.id})`
      )
      .in("state", ["hidden", "blocked", "black"]);

    if (stateError) throw stateError;

    const blockedIds = new Set<string>();
    (stateRows ?? []).forEach((row) => {
      if (row.owner_id === user.id) {
        blockedIds.add(row.target_id);
      } else if (row.target_id === user.id) {
        blockedIds.add(row.owner_id);
      }
    });

    const data = (rows ?? [])
      .filter((row) => !blockedIds.has(row.id))
      .map((row) => ({
        id: row.id,
        nickname: row.nickname,
        profile_image_url: row.profile_image_url,
        region: row.region,
      }));

    return NextResponse.json({ data });
  } catch (error) {
    console.error("[users-search:get]", error);
    return NextResponse.json({ error: "서버 오류" }, { status: 500 });
  }
}
