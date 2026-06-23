import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export async function GET() {
  // 인증 서버까지 한 번 깨워, 실제 사용자 진입 시 콜드 스타트로 미들웨어가
  // 멈추는 것을 예방한다. 실패해도 헬스체크 자체는 정상 응답한다.
  try {
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    );
    await supabase.auth.getUser();
  } catch {
    // 인증 서버 지연/실패는 무시한다.
  }

  return NextResponse.json({ ok: true });
}
