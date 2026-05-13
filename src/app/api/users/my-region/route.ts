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

    const { data: me, error: meError } = await supabase
      .from("profiles")
      .select("country, region")
      .eq("id", user.id)
      .single();

    if (meError) throw meError;

    const myRegion = (me?.region ?? "").trim();
    const myCountry = (me?.country ?? "").trim() || null;
    if (!myRegion) {
      return NextResponse.json({ data: [], region: null, country: myCountry });
    }

    if (metaOnly) {
      return NextResponse.json({ data: [], region: myRegion, country: myCountry });
    }

    const { data, error } = await supabase
      .from("profiles")
      .select("id, nickname, profile_image_url, country, region, member_type, role")
      .eq("region", myRegion)
      .neq("id", user.id)
      .order("nickname", { ascending: true })
      .limit(300);

    if (error) throw error;

    return NextResponse.json({ data: data ?? [], region: myRegion, country: myCountry });
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: "서버 오류" }, { status: 500 });
  }
}
