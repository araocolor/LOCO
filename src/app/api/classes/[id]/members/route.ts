import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

interface MemberRow {
  applicant_id: string;
  applicant: {
    id: string;
    nickname: string;
    profile_image_url: string | null;
    bio: string | null;
  } | null;
}

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: classId } = await params;
    const supabase = await createClient();

    const { data, error } = await supabase
      .from("applications")
      .select("applicant_id, applicant:profiles!applicant_id(id, nickname, profile_image_url, bio)")
      .eq("class_id", classId)
      .eq("status", "approved")
      .returns<MemberRow[]>();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    const members = (data ?? [])
      .filter((row) => row.applicant)
      .map((row) => row.applicant!);

    return NextResponse.json({ members });
  } catch {
    return NextResponse.json({ error: "서버 오류" }, { status: 500 });
  }
}
