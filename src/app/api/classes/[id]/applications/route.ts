import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

interface ApplicationRow {
  id: string;
  status: "pending" | "approved" | "cancelled";
  created_at: string;
  applicant: {
    id: string;
    nickname: string;
    profile_image_url: string | null;
  } | null;
}

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: classId } = await params;
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const admin = createAdminClient();
    const { data: cls, error: classError } = await admin
      .from("classes")
      .select("id, host_id")
      .eq("id", classId)
      .maybeSingle<{ id: string; host_id: string }>();

    if (classError) throw classError;
    if (!cls) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }
    if (cls.host_id !== user.id) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const { data, error } = await admin
      .from("applications")
      .select("id, status, created_at, applicant:profiles!applicant_id(id, nickname, profile_image_url)")
      .eq("class_id", classId)
      .neq("status", "cancelled")
      .order("created_at", { ascending: false })
      .returns<ApplicationRow[]>();

    if (error) throw error;

    const rows = data ?? [];
    const pending = rows.filter((item) => item.status === "pending");
    const approved = rows.filter((item) => item.status === "approved");

    return NextResponse.json({ data: { pending, approved } });
  } catch (error) {
    console.error("[class-applications:get]", error);
    return NextResponse.json({ error: "서버 오류" }, { status: 500 });
  }
}
