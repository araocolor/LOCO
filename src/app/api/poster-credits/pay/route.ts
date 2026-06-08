import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { findPlan } from "@/lib/poster-credits/plans";

const KAKAOPAY_READY_URL = "https://open-api.kakaopay.com/online/v1/payment/ready";

export async function POST(req: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { planId } = await req.json();
  const plan = findPlan(planId);
  if (!plan) {
    return NextResponse.json({ error: "Invalid plan" }, { status: 400 });
  }

  const secretKey = process.env.KAKAOPAY_SECRET_KEY;
  if (!secretKey) {
    return NextResponse.json({ error: "Payment not configured" }, { status: 500 });
  }

  const partnerOrderId = `poster_${user.id}_${Date.now()}`;
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
      item_name: `AI 포스터 ${plan.label}`,
      quantity: 1,
      total_amount: plan.amount,
      tax_free_amount: 0,
      approval_url: `${origin}/api/poster-credits/pay/approve?partner_order_id=${partnerOrderId}`,
      cancel_url: `${origin}/api/poster-credits/pay/approve?cancel=1`,
      fail_url: `${origin}/api/poster-credits/pay/approve?fail=1`,
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
    amount: plan.amount,
    credit_amount: plan.credits,
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
