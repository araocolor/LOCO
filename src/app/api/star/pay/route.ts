import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

const KAKAOPAY_READY_URL = "https://open-api.kakaopay.com/online/v1/payment/ready";

const BASE_STARS = 20;
const BASE_PRICE = 11000;
const BONUS_MAP: Record<number, number> = { 1: 1, 2: 5, 3: 10, 4: 20, 5: 40 };

export async function POST(req: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { quantity } = await req.json();
  if (!quantity || quantity < 1 || quantity > 5) {
    return NextResponse.json({ error: "Invalid quantity" }, { status: 400 });
  }

  const totalStars = BASE_STARS * quantity + (BONUS_MAP[quantity] ?? 0);
  const totalAmount = BASE_PRICE * quantity;

  const secretKey = process.env.KAKAOPAY_SECRET_KEY;
  if (!secretKey) {
    return NextResponse.json({ error: "Payment not configured" }, { status: 500 });
  }

  const partnerOrderId = `star_${user.id}_${Date.now()}`;
  const origin = req.nextUrl.origin;

  const res = await fetch(KAKAOPAY_READY_URL, {
    method: "POST",
    headers: {
      Authorization: `SECRET_KEY ${secretKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      cid: "TC0ONETIME",
      partner_order_id: partnerOrderId,
      partner_user_id: user.id,
      item_name: `별 ${totalStars}개 충전`,
      quantity: 1,
      total_amount: totalAmount,
      tax_free_amount: 0,
      approval_url: `${origin}/api/star/pay/approve?partner_order_id=${partnerOrderId}`,
      cancel_url: `${origin}/api/star/pay/approve?cancel=1`,
      fail_url: `${origin}/api/star/pay/approve?fail=1`,
    }),
  });

  if (!res.ok) {
    const errText = await res.text();
    return NextResponse.json(
      { error: "카카오페이 결제 준비 실패", detail: errText },
      { status: 502 }
    );
  }

  const data = await res.json();

  const admin = createAdminClient();
  await admin.from("poster_payments").insert({
    user_id: user.id,
    tid: data.tid,
    partner_order_id: partnerOrderId,
    amount: totalAmount,
    credit_amount: totalStars,
    payment_type: "kakao_pay",
    status: "ready",
  });

  return NextResponse.json({
    tid: data.tid,
    next_redirect_app_url: data.next_redirect_app_url,
    next_redirect_mobile_url: data.next_redirect_mobile_url,
    next_redirect_pc_url: data.next_redirect_pc_url,
    partner_order_id: partnerOrderId,
  });
}
