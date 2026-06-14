import { createClient } from "@/lib/supabase/server";
import { NextRequest, NextResponse } from "next/server";
import { randomInt } from "crypto";

const PHONE_REGEX = /^01[016789]\d{7,8}$/;

export async function POST(req: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: "인증 필요" }, { status: 401 });

    const { phone, blocked } = await req.json();
    const cleaned = (phone ?? "").replace(/[^0-9]/g, "");
    if (!PHONE_REGEX.test(cleaned)) {
      return NextResponse.json({ error: "올바른 전화번호를 입력하세요" }, { status: 400 });
    }

    if (blocked) {
      const blockedUntil = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();
      await supabase.from("phone_rate_limits").insert({
        user_id: user.id,
        blocked_until: blockedUntil,
      });
      return NextResponse.json({ error: "발송횟수가 초과되었습니다" }, { status: 429 });
    }

    const { data: rateLimit } = await supabase
      .from("phone_rate_limits")
      .select("blocked_until")
      .eq("user_id", user.id)
      .gt("blocked_until", new Date().toISOString())
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (rateLimit) {
      return NextResponse.json({ error: "발송횟수가 초과되었습니다. 잠시 후 다시 시도해주세요" }, { status: 429 });
    }

    const code = String(randomInt(100000, 1000000));
    const expiresAt = new Date(Date.now() + 3 * 60 * 1000).toISOString();

    const { error: dbError } = await supabase.from("phone_verifications").insert({
      phone: cleaned,
      code,
      user_id: user.id,
      expires_at: expiresAt,
    });
    if (dbError) throw dbError;

    const apiKey = process.env.SOLAPI_API_KEY!;
    const apiSecret = process.env.SOLAPI_API_SECRET!;
    const sender = process.env.SOLAPI_SENDER!;

    const { SolapiMessageService } = await import("solapi");
    const messageService = new SolapiMessageService(apiKey, apiSecret);

    await messageService.send({
      to: cleaned,
      from: sender,
      text: `[XLATIN] 인증번호 ${code}를 입력해주세요.`,
    });

    return NextResponse.json({ ok: true });
  } catch (err: unknown) {
    const errMsg = err instanceof Error ? err.message : JSON.stringify(err);
    console.error("인증코드 발송 실패:", errMsg, err);
    return NextResponse.json({ error: "발송 실패", detail: errMsg }, { status: 500 });
  }
}
