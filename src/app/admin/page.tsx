import { redirect } from "next/navigation";
import AdminPageClient from "@/components/admin/AdminPageClient";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import type { UserRole } from "@/types/user";

export default async function AdminPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single<{ role: UserRole }>();

  if (profile?.role !== "admin") redirect("/");

  const admin = createAdminClient();
  const [usersResult, proRequestsResult, classesResult] = await Promise.all([
    admin
      .from("profiles")
      .select("id, email, nickname, role, created_at")
      .order("created_at", { ascending: false })
      .limit(100),
    admin
      .from("pro_requests")
      .select("id, user_id, status, message, created_at, user:profiles!user_id(id, nickname, email)")
      .order("created_at", { ascending: false })
      .limit(100),
    admin
      .from("classes")
      .select("id, title, category, status, created_at, host:profiles!host_id(id, nickname)")
      .order("created_at", { ascending: false })
      .limit(100),
  ]);

  const users = (usersResult.data ?? []).map((item) => ({
    id: item.id,
    email: item.email,
    nickname: item.nickname,
    role: item.role as UserRole,
    created_at: item.created_at,
  }));

  const proRequests = (proRequestsResult.data ?? []).map((item) => ({
    id: item.id,
    user_id: item.user_id,
    status: item.status as "pending" | "approved" | "rejected",
    message: item.message,
    created_at: item.created_at,
    user: Array.isArray(item.user) ? item.user[0] ?? null : item.user,
  }));

  const classes = (classesResult.data ?? []).map((item) => ({
    id: item.id,
    title: item.title,
    type: item.category === "party" || item.category === "event" ? "event" as const : "class" as const,
    status: item.status as "recruiting" | "closed" | "cancelled",
    created_at: item.created_at,
    host: Array.isArray(item.host) ? item.host[0] ?? null : item.host,
  }));

  return (
    <AdminPageClient
      initialUsers={users}
      initialProRequests={proRequests}
      initialClasses={classes}
    />
  );
}
