import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { createAuthenticatedRequestClient } from "@/lib/supabase/request-client";

const NOTIFICATION_TYPES_BY_TAB = {
  class: ["friend_class_created", "class_application"],
  comment: ["class_comment", "comment_reply", "class_like"],
  general: ["pre_charge_issued", "nickname_changed", "star_gift_received"],
} as const;

type NotificationTab = keyof typeof NOTIFICATION_TYPES_BY_TAB;
const TABS: NotificationTab[] = ["class", "comment", "general"];

export async function GET(request: NextRequest) {
  const { user } = await createAuthenticatedRequestClient(request);

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const admin = createAdminClient();

  const results = await Promise.all(
    TABS.map(async (tab) => {
      const { count, error } = await admin
        .from("notifications")
        .select("id", { count: "exact", head: true })
        .eq("user_id", user.id)
        .eq("is_read", false)
        .in("type", NOTIFICATION_TYPES_BY_TAB[tab]);

      if (error) throw error;
      return { tab, count: count ?? 0 };
    })
  );

  const byTab: Record<string, number> = {};
  let total = 0;
  for (const { tab, count } of results) {
    byTab[tab] = count;
    total += count;
  }

  return NextResponse.json({ count: total, byTab });
}
