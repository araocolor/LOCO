import { notFound, redirect } from "next/navigation";
import type { Metadata } from "next";
import ClassHeader from "@/components/layout/ClassHeader";
import { createClient } from "@/lib/supabase/server";
import AiPosterResultActions from "./result-actions";
import ResultImage from "./result-image";

export const metadata: Metadata = { title: "AI 포스터 결과" };

export default async function AiPosterResultPage({
  params,
}: {
  params: Promise<{ requestId: string }>;
}) {
  const { requestId } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  const { data } = await supabase
    .from("ai_poster_requests")
    .select("*")
    .eq("id", requestId)
    .eq("user_id", user.id)
    .single();

  if (!data) notFound();

  const imageUrl = typeof data.generated_image_url === "string" ? data.generated_image_url : null;
  const title = typeof data.title === "string" ? data.title : "";
  const rawContent = typeof data.raw_content === "string" ? data.raw_content : "";

  if (!imageUrl) redirect(`/classes/new/ai-poster/review/${requestId}`);

  return (
    <div data-page-shell className="min-h-dvh bg-[#f4f4f4] page-slide-in-from-top">
      <ClassHeader
        title="AI 포스터 결과"
        className="h-[70px]"
        backExitAnimationClass="page-slide-out-to-top"
        backExitDelayMs={200}
      />

      <main className="px-4 pt-5 pb-28">
        <div className="mx-auto flex w-full max-w-[520px] flex-col items-center gap-5">
          <section className="w-full rounded-2xl bg-white p-4 shadow-sm">
            <h2 className="text-base font-bold text-[#111111]">생성된 포스터</h2>
            <ResultImage imageUrl={imageUrl} />
          </section>
        </div>
      </main>

      <AiPosterResultActions imageUrl={imageUrl} requestId={requestId} title={title} rawContent={rawContent} />
    </div>
  );
}
