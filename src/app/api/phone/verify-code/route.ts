import { createClient } from "@/lib/supabase/server";
import { NextRequest, NextResponse } from "next/server";

export async function POST(req: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: "인증 필요" }, { status: 401 });

    const { phone, code } = await req.json();
    const cleaned = (phone ?? "").replace(/[^0-9]/g, "");

    const { data: record } = await supabase
      .from("phone_verifications")
      .select("id, code, expires_at")
      .eq("phone", cleaned)
      .eq("user_id", user.id)
      .eq("verified", false)
      .order("created_at", { ascending: false })
      .limit(1)
      .single();

    if (!record) {
      return NextResponse.json({ error: "인증 요청을 찾을 수 없습니다" }, { status: 400 });
    }

    if (new Date(record.expires_at) < new Date()) {
      return NextResponse.json({ error: "인증번호가 만료되었습니다" }, { status: 400 });
    }

    if (record.code !== code) {
      return NextResponse.json({ error: "인증번호가 일치하지 않습니다" }, { status: 400 });
    }

    await supabase
      .from("phone_verifications")
      .update({ verified: true })
      .eq("id", record.id);

    return NextResponse.json({ ok: true, verified: true });
  } catch (err) {
    console.error("인증 확인 실패:", err);
    return NextResponse.json({ error: "확인 실패" }, { status: 500 });
  }
}
