import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { NextRequest, NextResponse } from "next/server";

const DEFAULT_LIMIT = 20;
const MAX_LIMIT = 20;
const MAX_TOTAL = 40;
const CANDIDATE_LIMIT = 500;

interface CandidateProfile {
  id: string;
  nickname: string;
  profile_image_url: string | null;
  region: string | null;
  favorite_genre?: unknown;
  last_active_at?: string | null;
}

function toStringArray(value: unknown): string[] {
  return Array.isArray(value) ? value.filter((item): item is string => typeof item === "string") : [];
}

function hasGenreOverlap(a: string[], b: string[]) {
  if (a.length === 0 || b.length === 0) return false;
  const set = new Set(a);
  return b.some((item) => set.has(item));
}

export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // 이미 관계가 있거나(신청/친구), 숨김/차단/블랙 처리한 사람은 제외합니다.
    const [{ data: myProfile }, { data: relations }, { data: followerRelations }, { data: states }] = await Promise.all([
      supabase
        .from("profiles")
        .select("region, favorite_genre")
        .eq("id", user.id)
        .maybeSingle(),
      supabase
        .from("friendships")
        .select("friend_id")
        .eq("user_id", user.id)
        .in("status", ["pending", "approved", "friend"]),
      supabase
        .from("friendships")
        .select("user_id")
        .eq("friend_id", user.id)
        .in("status", ["approved", "friend"]),
      supabase
        .from("friend_member_states")
        .select("owner_id, target_id, state")
        .or(`owner_id.eq.${user.id},target_id.eq.${user.id}`)
        .in("state", ["hidden", "blocked", "black"]),
    ]);

    const relationIds = (relations ?? []).map((f) => f.friend_id);
    const stateIds = (states ?? []).map((s) => s.owner_id === user.id ? s.target_id : s.owner_id);
    const excludeIds = [...new Set([...relationIds, ...stateIds, user.id])];
    const { searchParams } = new URL(request.url);
    const requestedLimit = Number.parseInt(searchParams.get("limit") ?? String(DEFAULT_LIMIT), 10);
    const requestedOffset = Number.parseInt(searchParams.get("offset") ?? "0", 10);
    const limit = Number.isFinite(requestedLimit) ? Math.min(Math.max(requestedLimit, 1), MAX_LIMIT) : DEFAULT_LIMIT;
    const offset = Number.isFinite(requestedOffset) ? Math.min(Math.max(requestedOffset, 0), MAX_TOTAL) : 0;
    const pageLimit = Math.max(0, Math.min(limit, MAX_TOTAL - offset));

    if (pageLimit === 0) {
      return NextResponse.json({ data: [], meta: { limit, offset, nextOffset: offset, hasMore: false } });
    }

    const { data, error } = await supabase
      .from("profiles")
      .select("id, nickname, profile_image_url, region, favorite_genre, last_active_at")
      .not("id", "in", `(${excludeIds.join(",")})`)
      .limit(CANDIDATE_LIMIT);

    if (error) throw error;

    const candidateIds = (data ?? []).map((profile) => profile.id);
    const followerIds = new Set((followerRelations ?? []).map((row) => row.user_id));
    const starCountMap = new Map<string, number>();

    if (candidateIds.length > 0) {
      const admin = createAdminClient();
      const { data: starRows } = await admin
        .from("star_gifts")
        .select("receiver_id, count")
        .in("receiver_id", candidateIds);

      for (const row of starRows ?? []) {
        starCountMap.set(row.receiver_id, (starCountMap.get(row.receiver_id) ?? 0) + Number(row.count ?? 0));
      }
    }

    const myRegion = myProfile?.region ?? null;
    const myGenres = toStringArray(myProfile?.favorite_genre);

    const scored = ((data ?? []) as CandidateProfile[])
      .map((profile) => {
        const sameRegion = !!myRegion && profile.region === myRegion;
        const sameGenre = hasGenreOverlap(myGenres, toStringArray(profile.favorite_genre));
        const followsMe = followerIds.has(profile.id);
        const priority = followsMe ? 4 : sameRegion && sameGenre ? 3 : sameRegion ? 2 : 1;
        const receivedStars = starCountMap.get(profile.id) ?? 0;
        const lastActiveTime = profile.last_active_at ? new Date(profile.last_active_at).getTime() : 0;

        return {
          id: profile.id,
          nickname: profile.nickname,
          profile_image_url: profile.profile_image_url ?? null,
          priority,
          receivedStars,
          lastActiveTime,
        };
      })
      .sort((a, b) => {
        if (b.priority !== a.priority) return b.priority - a.priority;
        if (b.receivedStars !== a.receivedStars) return b.receivedStars - a.receivedStars;
        if (b.lastActiveTime !== a.lastActiveTime) return b.lastActiveTime - a.lastActiveTime;
        return a.nickname.localeCompare(b.nickname, "ko");
      });

    const page = scored.slice(offset, offset + pageLimit).map(({ id, nickname, profile_image_url }) => ({
      id,
      nickname,
      profile_image_url,
    }));
    const nextOffset = offset + page.length;

    return NextResponse.json({
      data: page,
      meta: {
        limit: pageLimit,
        offset,
        nextOffset,
        hasMore: nextOffset < Math.min(scored.length, MAX_TOTAL),
      },
    });
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: "서버 오류" }, { status: 500 });
  }
}
