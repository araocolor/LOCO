import { createClient } from "@/lib/supabase/server";
import { NextRequest, NextResponse } from "next/server";
import { randomBytes, scryptSync, timingSafeEqual } from "crypto";

const PIN_REGEX = /^\d{4}$/;

function hashPin(pin: string) {
  const salt = randomBytes(16).toString("hex");
  const key = scryptSync(pin, salt, 32).toString("hex");
  return `${salt}:${key}`;
}

function verifyPin(pin: string, storedHash: string) {
  const [salt, keyHex] = storedHash.split(":");
  if (!salt || !keyHex) return false;

  try {
    const inputKey = scryptSync(pin, salt, 32);
    const storedKey = Buffer.from(keyHex, "hex");
    if (storedKey.length !== inputKey.length) return false;
    return timingSafeEqual(inputKey, storedKey);
  } catch {
    return false;
  }
}

async function getAuthedUser() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return { supabase, user };
}

export async function GET() {
  try {
    const { supabase, user } = await getAuthedUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { data, error } = await supabase
      .from("friend_blacklist_pins")
      .select("owner_id")
      .eq("owner_id", user.id)
      .maybeSingle();
    if (error) throw error;

    return NextResponse.json({ hasPin: !!data });
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: "서버 오류" }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const { supabase, user } = await getAuthedUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { pin } = await request.json();
    if (!PIN_REGEX.test(pin ?? "")) {
      return NextResponse.json({ error: "PIN은 숫자 4자리여야 합니다" }, { status: 400 });
    }

    const { data: existing, error: existingError } = await supabase
      .from("friend_blacklist_pins")
      .select("owner_id")
      .eq("owner_id", user.id)
      .maybeSingle();
    if (existingError) throw existingError;

    if (existing) {
      return NextResponse.json({ error: "이미 PIN이 설정되었습니다" }, { status: 409 });
    }

    const { error: insertError } = await supabase.from("friend_blacklist_pins").insert({
      owner_id: user.id,
      pin_hash: hashPin(pin),
    });
    if (insertError) throw insertError;

    return NextResponse.json({ success: true });
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: "서버 오류" }, { status: 500 });
  }
}

export async function PUT(request: NextRequest) {
  try {
    const { supabase, user } = await getAuthedUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { pin } = await request.json();
    if (!PIN_REGEX.test(pin ?? "")) {
      return NextResponse.json({ error: "PIN은 숫자 4자리여야 합니다" }, { status: 400 });
    }

    const { data, error } = await supabase
      .from("friend_blacklist_pins")
      .select("pin_hash")
      .eq("owner_id", user.id)
      .maybeSingle();
    if (error) throw error;

    if (!data) {
      return NextResponse.json({ error: "PIN_NOT_SET" }, { status: 404 });
    }

    const ok = verifyPin(pin, data.pin_hash);
    if (!ok) {
      return NextResponse.json({ error: "비밀번호가 일치하지 않습니다" }, { status: 401 });
    }

    return NextResponse.json({ success: true });
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: "서버 오류" }, { status: 500 });
  }
}
