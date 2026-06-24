import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { createAuthenticatedRequestClient } from "@/lib/supabase/request-client";

type NotificationTab = "class" | "comment" | "general";

const NOTIFICATION_TYPES_BY_TAB: Record<NotificationTab, string[]> = {
  class: ["friend_class_created", "class_application"],
  comment: ["class_comment", "comment_reply", "class_like"],
  general: ["pre_charge_issued", "nickname_changed", "star_gift_received"],
};

function getNotificationTab(value: string | null): NotificationTab | null {
  return value === "class" || value === "comment" || value === "general" ? value : null;
}

export async function POST(request: NextRequest) {
  const { user } = await createAuthenticatedRequestClient(request);

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json().catch(() => ({}));
  const tab = getNotificationTab(typeof body.tab === "string" ? body.tab : null);

  if (!tab) {
    return NextResponse.json({ error: "tab required" }, { status: 400 });
  }

  const admin = createAdminClient();
  const { error } = await admin
    .from("notifications")
    .update({ is_read: true })
    .eq("user_id", user.id)
    .eq("is_read", false)
    .in("type", NOTIFICATION_TYPES_BY_TAB[tab]);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
