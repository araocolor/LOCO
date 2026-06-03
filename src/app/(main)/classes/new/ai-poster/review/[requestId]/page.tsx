import Image from "next/image";
import { notFound, redirect } from "next/navigation";
import type { Metadata } from "next";
import ClassHeader from "@/components/layout/ClassHeader";
import { createClient } from "@/lib/supabase/server";
import type { AiPosterSourceImage } from "@/types/ai-poster";
import AiPosterReviewEditable from "./review-editable";

export const metadata: Metadata = { title: "프롬프트 확인하기" };

function stripReferenceSection(promptText: string) {
  return promptText.split("\n참고 원문:")[0].trimEnd();
}

export default async function AiPosterReviewPage({
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

  const record = data as Record<string, unknown>;
  const sourceImages = Array.isArray(record.source_images)
    ? (record.source_images as AiPosterSourceImage[])
    : [];
  const promptText = stripReferenceSection(
    typeof record.prompt_text === "string" ? record.prompt_text : ""
  );
  const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();

  const { data: recentGeneratedRequest } = await supabase
    .from("ai_poster_requests")
    .select("id, generated_at")
    .eq("user_id", user.id)
    .eq("status", "generated")
    .gte("generated_at", sevenDaysAgo)
    .order("generated_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  const ALLOWED_EMAILS = ["araocolor@gmail.com", "jejuputty@gmail.com"];
  const isAllowed = user.email ? ALLOWED_EMAILS.includes(user.email) : false;
  const isGenerationBlocked = !isAllowed && Boolean(recentGeneratedRequest);

  return (
    <div data-page-shell className="min-h-dvh bg-white page-slide-in-from-top">
      <ClassHeader
        title="프롬프트 확인하기"
        className="h-[70px]"
        backExitAnimationClass="page-slide-out-to-top"
        backExitDelayMs={200}
      />

      <main className="px-4 pt-5 pb-8">
        <div className="mx-auto flex w-full max-w-[520px] flex-col gap-5">
          <section className="shrink-0 rounded-2xl bg-white p-4 shadow-sm">
            <h2 className="text-base font-bold text-[#111111]">첨부된 참조이미지</h2>

            <div className="mt-4 grid grid-cols-3 gap-2">
              {sourceImages.map((image, index) => (
                <div
                  key={image.path}
                  className="relative aspect-square overflow-hidden rounded-xl border border-[#ececec] bg-[#f6f6f6]"
                >
                  <Image
                    src={image.url}
                    alt={`강사 사진 ${index + 1}`}
                    fill
                    sizes="(max-width: 520px) 33vw, 160px"
                    className="object-cover"
                  />
                </div>
              ))}
            </div>
          </section>

          <AiPosterReviewEditable
            requestId={requestId}
            initialPromptText={promptText}
            isGenerationBlocked={isGenerationBlocked}
          />
        </div>
      </main>
    </div>
  );
}
