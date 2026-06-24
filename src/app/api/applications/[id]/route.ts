import { NextRequest, NextResponse } from "next/server";
import { sendKakaoAlimtalk } from "@/lib/kakao/notify";
import { createAuthenticatedRequestClient } from "@/lib/supabase/request-client";

// 승인 (host only)
export async function PATCH(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const { supabase, user } = await createAuthenticatedRequestClient(_request);

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { data: application } = await supabase
    .from("applications")
    .select("class_id, applicant_id, status")
    .eq("id", id)
    .single();

  if (!application) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  // 개설자 확인
  const { data: cls } = await supabase
    .from("classes")
    .select("host_id, title")
    .eq("id", application.class_id)
    .single();

  if (!cls || cls.host_id !== user.id) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { data, error } = await supabase
    .from("applications")
    .update({ status: "approved" })
    .eq("id", id)
    .select()
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  // 신청자에게 승인 알림
  const message = `"${cls.title}" 클래스 신청이 승인되었습니다.`;
  const linkUrl = `/classes/${application.class_id}`;

  await supabase.from("notifications").insert({
    user_id: application.applicant_id,
    type: "approved",
    message,
    link_url: linkUrl,
    related_id: application.class_id,
  });

  await sendKakaoAlimtalk({
    event: "approved",
    recipients: [application.applicant_id],
    message,
    linkUrl,
  });

  return NextResponse.json(data);
}

// 신청 취소 (applicant only)
export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const { supabase, user } = await createAuthenticatedRequestClient(_request);

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { data: application } = await supabase
    .from("applications")
    .select("applicant_id, class_id")
    .eq("id", id)
    .single();

  if (!application || application.applicant_id !== user.id) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { error } = await supabase
    .from("applications")
    .update({ status: "cancelled" })
    .eq("id", id);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ cancelled: true });
}
