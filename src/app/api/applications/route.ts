import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { sendKakaoAlimtalk } from "@/lib/kakao/notify";

export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { class_id } = await request.json();

  // 중복 신청 확인
  const { data: existing } = await supabase
    .from("applications")
    .select("id, status")
    .eq("class_id", class_id)
    .eq("applicant_id", user.id)
    .neq("status", "cancelled")
    .maybeSingle();

  if (existing) {
    return NextResponse.json({ error: "이미 신청한 클래스입니다." }, { status: 409 });
  }

  const { data: cls } = await supabase
    .from("classes")
    .select("host_id, title, require_approval")
    .eq("id", class_id)
    .single();

  if (!cls) {
    return NextResponse.json({ error: "클래스를 찾을 수 없습니다." }, { status: 404 });
  }

  const needsApproval = cls.require_approval !== false;
  const initialStatus = needsApproval ? "pending" : "approved";

  const { data, error } = await supabase
    .from("applications")
    .insert({ class_id, applicant_id: user.id, status: initialStatus })
    .select()
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  if (needsApproval) {
    const { data: applicantProfile } = await supabase
      .from("profiles")
      .select("nickname")
      .eq("id", user.id)
      .single();

    const message = `${applicantProfile?.nickname ?? "누군가"}님이 "${cls.title}" 클래스에 신청했습니다.`;
    const linkUrl = `/classes/${class_id}`;

    await supabase.from("notifications").insert({
      user_id: cls.host_id,
      type: "application",
      message,
      link_url: linkUrl,
      related_id: data.id,
    });

    await sendKakaoAlimtalk({
      event: "application",
      recipients: [cls.host_id],
      message,
      linkUrl,
    });
  }

  return NextResponse.json(data, { status: 201 });
}
