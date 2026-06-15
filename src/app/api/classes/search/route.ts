import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { PREVIOUS_YEAR_PERIOD_VALUE, getSearchYear } from "@/lib/search-defaults";

function expandCategory(value: string) {
  if (value === "party") return ["party", "event"];
  if (value === "level_class") return ["level_class", "regular"];
  if (value === "private_training") return ["private_training", "training"];
  if (value === "choreo_class") return ["choreo_class", "choreography"];
  if (value === "etc") return ["etc", "other"];
  return [value];
}

function getPeriodRange(period: string | null, year = getSearchYear(), fullYear = false) {
  if (!period || period === "전체") {
    if (!fullYear) return null;
    return {
      start: `${year}-01-01T00:00:00`,
      end: `${year + 1}-01-01T00:00:00`,
    };
  }
  if (period === PREVIOUS_YEAR_PERIOD_VALUE) {
    return {
      start: `${year - 1}-01-01T00:00:00`,
      end: `${year}-01-01T00:00:00`,
    };
  }
  const month = Number(period);
  if (!Number.isInteger(month) || month < 1 || month > 12) return null;
  const start = `${year}-${String(month).padStart(2, "0")}-01T00:00:00`;
  const endMonth = month === 12 ? 1 : month + 1;
  const endYear = month === 12 ? year + 1 : year;
  const end = `${endYear}-${String(endMonth).padStart(2, "0")}-01T00:00:00`;
  return { start, end };
}

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);

  const region = searchParams.get("region");
  const period = searchParams.get("period");
  const categoryFilters = searchParams.getAll("class_type");
  const genres = searchParams.getAll("genre");
  const host_id = searchParams.get("host_id");
  const keyword = searchParams.get("keyword");
  const sort = searchParams.get("sort") ?? "latest";
  const requestedYear = Number.parseInt(searchParams.get("year") ?? "", 10);
  const year = Number.isInteger(requestedYear) ? requestedYear : undefined;
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
  const periodRange = getPeriodRange(period, year ?? getSearchYear(), Boolean(year));
  if (periodRange) query = query.gte("datetime", periodRange.start).lt("datetime", periodRange.end);
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

  return NextResponse.json({
    data,
    count,
    hasMore: (count ?? 0) > to + 1,
  });
}
