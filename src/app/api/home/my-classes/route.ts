import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

const HOME_CLASS_LIMIT = 50;

type ApplicationClassRow = {
  class_id: string;
};

type ClassIdRow = {
  id: string;
};

export async function GET() {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const [profileResult, myClassesResult, applicationsResult] = await Promise.all([
      supabase
        .from("profiles")
        .select("id, region")
        .eq("id", user.id)
        .maybeSingle(),
      supabase
        .from("classes")
        .select("*, host:profiles!host_id(id, nickname, profile_image_url)")
        .eq("host_id", user.id)
        .order("created_at", { ascending: false })
        .limit(HOME_CLASS_LIMIT),
      supabase
        .from("applications")
        .select("class_id")
        .eq("applicant_id", user.id)
        .eq("status", "approved")
        .order("created_at", { ascending: false })
        .limit(HOME_CLASS_LIMIT),
    ]);

    if (profileResult.error) throw profileResult.error;
    if (myClassesResult.error) throw myClassesResult.error;
    if (applicationsResult.error) throw applicationsResult.error;

    const region = profileResult.data?.region ?? null;
    const participatingClassIds = Array.from(
      new Set(
        ((applicationsResult.data ?? []) as ApplicationClassRow[]).map((item) => item.class_id)
      )
    );

    const [participatingClassesResult, regionalClassesResult] = await Promise.all([
      participatingClassIds.length > 0
        ? supabase
            .from("classes")
            .select("*, host:profiles!host_id(id, nickname, profile_image_url)")
            .in("id", participatingClassIds)
        : Promise.resolve({ data: [], error: null }),
      region
        ? supabase
            .from("classes")
            .select("*, host:profiles!host_id(id, nickname, profile_image_url)")
            .eq("region", region)
            .order("created_at", { ascending: false })
            .limit(HOME_CLASS_LIMIT)
        : Promise.resolve({ data: [], error: null }),
    ]);

    if (participatingClassesResult.error) throw participatingClassesResult.error;
    if (regionalClassesResult.error) throw regionalClassesResult.error;

    const participatingMap = new Map(
      ((participatingClassesResult.data ?? []) as ClassIdRow[]).map((item) => [item.id, item])
    );
    const participatingClasses = participatingClassIds
      .map((classId) => participatingMap.get(classId))
      .filter(Boolean);

    return NextResponse.json(
      {
        profile: {
          id: user.id,
          region,
        },
        myClasses: myClassesResult.data ?? [],
        participatingClasses,
        regionalClasses: regionalClassesResult.data ?? [],
      },
      {
        headers: {
          "Cache-Control": "private, max-age=30",
        },
      }
    );
  } catch (error) {
    console.error("[home-my-classes:get]", error);
    return NextResponse.json({ error: "메인 내클래스를 불러오지 못했습니다." }, { status: 500 });
  }
}
