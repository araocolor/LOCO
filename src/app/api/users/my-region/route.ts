import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function GET(req: Request) {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const metaOnly = searchParams.get("metaOnly") === "1";
    const requestedRegion = (searchParams.get("region") ?? "").trim();

    const { data: me, error: meError } = await supabase
      .from("profiles")
      .select("country, region")
      .eq("id", user.id)
      .single();

    if (meError) throw meError;

    const myRegion = (me?.region ?? "").trim();
    const myCountry = (me?.country ?? "").trim() || null;
    const targetRegion = requestedRegion || myRegion;

    const { data: regionRows, error: regionRowsError } = await supabase
      .from("profiles")
      .select("region")
      .not("region", "is", null);
    if (regionRowsError) throw regionRowsError;

    const availableRegions = Array.from(
      new Set(
        (regionRows ?? [])
          .map((row) => (row.region ?? "").trim())
          .filter(Boolean)
      )
    ).sort((a, b) => a.localeCompare(b, "ko"));

    if (!targetRegion) {
      return NextResponse.json({ data: [], region: null, country: myCountry, availableRegions });
    }

    if (metaOnly) {
      return NextResponse.json({ data: [], region: targetRegion, country: myCountry, availableRegions });
    }

    const { data, error } = await supabase
      .from("profiles")
      .select("id, nickname, profile_image_url, country, region, member_type, role")
      .eq("region", targetRegion)
      .neq("id", user.id)
      .order("nickname", { ascending: true })
      .limit(300);

    if (error) throw error;

    return NextResponse.json({ data: data ?? [], region: targetRegion, country: myCountry, availableRegions });
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: "서버 오류" }, { status: 500 });
  }
}
