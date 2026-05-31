import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

function expandCategory(value: string) {
  if (value === "party") return ["party", "event"];
  if (value === "level_class") return ["level_class", "regular"];
  if (value === "private_training") return ["private_training", "training"];
  if (value === "etc") return ["etc", "other"];
  return [value];
}

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);

  const region = searchParams.get("region");
  const status = searchParams.get("status");
  const categoryFilters = searchParams.getAll("class_type");
  const genres = searchParams.getAll("genre");
  const host_id = searchParams.get("host_id");
  const keyword = searchParams.get("keyword");
  const sort = searchParams.get("sort") ?? "latest";
  const requestedPage = Number.parseInt(searchParams.get("page") ?? "0", 10);
  const requestedLimit = Number.parseInt(searchParams.get("limit") ?? "10", 10);

  const page = Number.isFinite(requestedPage) && requestedPage > 0 ? requestedPage : 0;
  const limit = Number.isFinite(requestedLimit)
    ? Math.min(Math.max(requestedLimit, 1), 50)
    : 10;
  const from = page * limit;
  const to = from + limit - 1;

  const supabase = await createClient();

  let query = supabase
    .from("classes")
    .select("*, host:profiles!host_id(id, nickname, profile_image_url)", {
      count: "exact",
    });

  if (host_id) query = query.eq("host_id", host_id);
  if (region && region !== "전체") query = query.eq("region", region);
  if (status && status !== "전체") query = query.eq("status", status);
  const filteredCategories = Array.from(
    new Set(categoryFilters.filter((t) => t && t !== "전체").flatMap(expandCategory))
  );
  if (filteredCategories.length === 1) {
    query = query.eq("category", filteredCategories[0]);
  } else if (filteredCategories.length > 1) {
    query = query.in("category", filteredCategories);
  }
  if (genres.length > 0) {
    const filteredGenres = genres.filter((g) => g && g !== "전체");
    if (filteredGenres.length > 0) query = query.overlaps("genres", filteredGenres);
  }
  if (keyword) {
    query = query.or(`title.ilike.%${keyword}%,description.ilike.%${keyword}%`);
  }

  if (sort === "deadline") {
    query = query.order("deadline", { ascending: true });
  } else if (sort === "popular") {
    query = query.order("view_count", { ascending: false });
  } else {
    query = query.order("created_at", { ascending: false });
  }

  const { data, error, count } = await query.range(from, to);

  if (error?.code === "PGRST103" || error?.message === "Requested range not satisfiable") {
    return NextResponse.json({
      data: [],
      count: count ?? 0,
      hasMore: false,
    });
  }

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const classIds = (data ?? []).map((c: { id: string }) => c.id);
  let bookmarkCounts: Record<string, number> = {};
  if (classIds.length > 0) {
    const { data: bcData } = await supabase
      .rpc("get_bookmark_counts", { class_ids: classIds });
    if (bcData) {
      bookmarkCounts = Object.fromEntries(
        (bcData as { class_id: string; count: number }[]).map((r) => [r.class_id, r.count])
      );
    }
  }

  const enriched = (data ?? []).map((c: { id: string }) => ({
    ...c,
    bookmark_count: bookmarkCounts[c.id] ?? 0,
  }));

  return NextResponse.json({
    data: enriched,
    count,
    hasMore: (count ?? 0) > to + 1,
  });
}
