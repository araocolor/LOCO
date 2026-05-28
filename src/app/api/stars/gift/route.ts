import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

function getErrorStatus(message: string) {
  if (message.includes("unauthorized")) return 401;
  if (message.includes("receiver_required")) return 400;
  if (message.includes("cannot_gift_self")) return 400;
  if (message.includes("invalid_count")) return 400;
  if (message.includes("gift_already_exists")) return 409;
  if (message.includes("insufficient_balance")) return 400;
  return 500;
}

export async function POST(request: Request) {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = (await request.json().catch(() => ({}))) as {
      receiverId?: string;
      count?: number;
    };

    const receiverId = typeof body.receiverId === "string" ? body.receiverId.trim() : "";
    const count = Number.parseInt(String(body.count), 10);

    if (!receiverId) {
      return NextResponse.json({ error: "receiver_required" }, { status: 400 });
    }

    if (!Number.isInteger(count) || count < 1 || count > 1) {
      return NextResponse.json({ error: "invalid_count" }, { status: 400 });
    }

    const { data, error } = await supabase.rpc("grant_star_gift", {
      p_receiver_id: receiverId,
      p_count: count,
    });

    if (error) {
      return NextResponse.json(
        { error: error.message || "star_gift_failed" },
        { status: getErrorStatus(error.message || "") }
      );
    }

    const result = Array.isArray(data) ? data[0] : data;

    return NextResponse.json({
      giftId: result?.gift_id ?? null,
      remainingBalance: result?.remaining_balance ?? 0,
    });
  } catch (error) {
    console.error("[stars/gift] unexpected failed", error);
    return NextResponse.json({ error: "별 선물에 실패했습니다." }, { status: 500 });
  }
}
