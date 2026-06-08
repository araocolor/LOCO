import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";

const KAKAOPAY_APPROVE_URL = "https://open-api.kakaopay.com/online/v1/payment/approve";

export async function GET(req: NextRequest) {
  const { searchParams } = req.nextUrl;

  if (searchParams.get("cancel") || searchParams.get("fail")) {
    return NextResponse.redirect(new URL("/?payment=cancelled", req.url));
  }

  const pgToken = searchParams.get("pg_token");
  const partnerOrderId = searchParams.get("partner_order_id");

  if (!pgToken || !partnerOrderId) {
    return NextResponse.redirect(new URL("/?payment=error", req.url));
  }

  const admin = createAdminClient();

  const { data: payment } = await admin
    .from("poster_payments")
    .select("*")
    .eq("partner_order_id", partnerOrderId)
    .eq("status", "ready")
    .single();

  if (!payment) {
    return NextResponse.redirect(new URL("/?payment=error", req.url));
  }

  const secretKey = process.env.KAKAOPAY_SECRET_KEY;
  if (!secretKey) {
    return NextResponse.redirect(new URL("/?payment=error", req.url));
  }

  const res = await fetch(KAKAOPAY_APPROVE_URL, {
    method: "POST",
    headers: {
      Authorization: `SECRET_KEY ${secretKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      cid: "TC0ONETIME",
      tid: payment.tid,
      partner_order_id: partnerOrderId,
      partner_user_id: payment.user_id,
      pg_token: pgToken,
    }),
  });

  if (!res.ok) {
    await admin
      .from("poster_payments")
      .update({ status: "failed" })
      .eq("id", payment.id);
    return NextResponse.redirect(new URL("/?payment=error", req.url));
  }

  await admin
    .from("poster_payments")
    .update({ status: "approved", pg_token: pgToken, approved_at: new Date().toISOString() })
    .eq("id", payment.id);

  const { data: credit } = await admin
    .from("poster_credits")
    .select("balance")
    .eq("user_id", payment.user_id)
    .single();

  if (credit) {
    await admin
      .from("poster_credits")
      .update({
        balance: credit.balance + payment.credit_amount,
        updated_at: new Date().toISOString(),
      })
      .eq("user_id", payment.user_id);
  } else {
    await admin.from("poster_credits").insert({
      user_id: payment.user_id,
      balance: payment.credit_amount,
    });
  }

  return NextResponse.redirect(new URL("/?payment=success", req.url));
}
