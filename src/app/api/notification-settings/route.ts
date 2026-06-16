import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

const SETTING_COLUMNS = [
  "chat_all",
  "chat_dm",
  "chat_group",
  "chat_class",
  "news_all",
  "news_class",
  "news_comment",
  "class_visibility",
  "message_visibility",
  "friend_alert",
  "location_consent",
] as const;

const BOOLEAN_KEYS = [
  "chat_all",
  "chat_dm",
  "chat_group",
  "chat_class",
  "news_all",
  "news_class",
  "news_comment",
  "friend_alert",
  "location_consent",
];

const VISIBILITY_KEYS = ["class_visibility", "message_visibility"];
const VALID_VISIBILITY = ["public", "friends", "private"];

export async function GET() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const admin = createAdminClient();
  const { data, error } = await admin
    .from("notification_settings")
    .select(SETTING_COLUMNS.join(","))
    .eq("user_id", user.id)
    .maybeSingle();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  if (!data) {
    return NextResponse.json({
      chat_all: true,
      chat_dm: true,
      chat_group: true,
      chat_class: true,
      news_all: true,
      news_class: true,
      news_comment: true,
      class_visibility: "public",
      message_visibility: "public",
      friend_alert: true,
      location_consent: true,
    });
  }

  return NextResponse.json(data);
}

export async function PATCH(request: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json();

  const update: Record<string, boolean | string> = {};
  for (const key of BOOLEAN_KEYS) {
    if (key in body && typeof body[key] === "boolean") {
      update[key] = body[key];
    }
  }
  for (const key of VISIBILITY_KEYS) {
    if (key in body && VALID_VISIBILITY.includes(body[key])) {
      update[key] = body[key];
    }
  }

  if (Object.keys(update).length === 0) {
    return NextResponse.json({ error: "No valid fields" }, { status: 400 });
  }

  const admin = createAdminClient();
  const { data: existing } = await admin
    .from("notification_settings")
    .select("user_id")
    .eq("user_id", user.id)
    .maybeSingle();

  if (existing) {
    const { error } = await admin
      .from("notification_settings")
      .update({ ...update, updated_at: new Date().toISOString() })
      .eq("user_id", user.id);

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
  } else {
    const { error } = await admin
      .from("notification_settings")
      .insert({ user_id: user.id, ...update });

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
  }

  return NextResponse.json({ ok: true });
}
