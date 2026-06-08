import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

const PAGE_SIZE = 30;
type NotificationTab = "class" | "comment" | "heart" | "other";

const NOTIFICATION_TYPES_BY_TAB: Record<NotificationTab, string[]> = {
  class: ["friend_class_created", "star_gift_received", "class_application"],
  comment: ["class_comment", "comment_reply"],
  heart: ["class_like"],
  other: ["pre_charge_issued"],
};

function getNotificationTab(value: string | null): NotificationTab {
  return value === "comment" || value === "heart" || value === "other" ? value : "class";
}

interface NotificationRow {
  id: string;
  type: string;
  ref_id: string | null;
  meta: Record<string, unknown> | null;
  is_read: boolean;
  created_at: string;
  actor: {
    id: string;
    nickname: string;
    profile_image_url: string | null;
  } | null;
}

interface ApplicationStatusRow {
  id: string;
  class_id: string;
  applicant_id: string;
  status: string;
}

export async function GET(request: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const page = Number(request.nextUrl.searchParams.get("page") ?? "0");
  const tab = getNotificationTab(request.nextUrl.searchParams.get("tab"));
  const admin = createAdminClient();

  const oneWeekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
  void admin
    .from("notifications")
    .update({ is_read: true })
    .eq("user_id", user.id)
    .eq("is_read", false)
    .lt("created_at", oneWeekAgo);

  const { data, error } = await admin
    .from("notifications")
    .select(
      "id, type, ref_id, meta, is_read, created_at, actor:profiles!actor_id(id, nickname, profile_image_url)"
    )
    .eq("user_id", user.id)
    .in("type", NOTIFICATION_TYPES_BY_TAB[tab])
    .order("created_at", { ascending: false })
    .range(page * PAGE_SIZE, (page + 1) * PAGE_SIZE - 1)
    .returns<NotificationRow[]>();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const rows = data ?? [];
  const applicationNotifications = rows.filter(
    (item) => item.type === "class_application" && item.ref_id && item.actor?.id
  );
  const applicationByKey = new Map<string, ApplicationStatusRow>();

  if (applicationNotifications.length > 0) {
    const classIds = Array.from(new Set(applicationNotifications.map((item) => item.ref_id as string)));
    const applicantIds = Array.from(
      new Set(applicationNotifications.map((item) => item.actor?.id).filter((id): id is string => Boolean(id)))
    );

    const { data: applications, error: applicationsError } = await admin
      .from("applications")
      .select("id, class_id, applicant_id, status")
      .in("class_id", classIds)
      .in("applicant_id", applicantIds)
      .neq("status", "cancelled")
      .returns<ApplicationStatusRow[]>();

    if (applicationsError) {
      return NextResponse.json({ error: applicationsError.message }, { status: 500 });
    }

    for (const application of applications ?? []) {
      applicationByKey.set(`${application.class_id}:${application.applicant_id}`, application);
    }
  }

  const notifications = rows.map((item) => {
    if (item.type !== "class_application" || !item.ref_id || !item.actor?.id) {
      return item;
    }

    const application = applicationByKey.get(`${item.ref_id}:${item.actor.id}`);
    if (!application) return item;

    return {
      ...item,
      meta: {
        ...(item.meta ?? {}),
        application_id: application.id,
        application_status: application.status,
      },
    };
  });

  return NextResponse.json({
    notifications,
    hasMore: rows.length === PAGE_SIZE,
  });
}
