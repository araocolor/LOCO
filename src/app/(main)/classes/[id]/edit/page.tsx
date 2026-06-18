import { notFound, redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import ClassForm from "@/components/class/ClassForm";
import type { DanceClass } from "@/types/class";
import ClassHeader from "@/components/layout/ClassHeader";

export default async function ClassEditPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  const { data: cls } = await supabase.from("classes").select("*").eq("id", id).single();

  if (!cls) notFound();
  if (cls.host_id !== user.id) redirect(`/classes/${id}`);

  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single();

  const role = (profile?.role as "member" | "pro" | "admin" | "suspended") ?? "member";

  return (
    <div data-page-shell className="page-slide-in-from-top">
      <ClassHeader
        title="클래스 수정"
        className="h-[70px]"
        backExitAnimationClass="page-slide-out-to-top"
        backExitDelayMs={200}
      />
      <div className="bg-[#f4f4f4] pt-[10px]">
        <ClassForm initialData={cls as DanceClass} classId={id} userRole={role} />
      </div>
    </div>
  );
}
