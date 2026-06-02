import Image from "next/image";
import { notFound, redirect } from "next/navigation";
import type { Metadata } from "next";
import ClassHeader from "@/components/layout/ClassHeader";
import { createClient } from "@/lib/supabase/server";
import type {
  AiPosterExtractedFields,
  AiPosterOptions,
  AiPosterSourceImage,
} from "@/types/ai-poster";
import AiPosterReviewEditable from "./review-editable";

export const metadata: Metadata = { title: "프롬프트 확인하기" };

function getStatusLabel(status: string) {
  if (status === "generated") return "생성 완료";
  if (status === "submitted") return "전달 완료";
  if (status === "failed") return "오류";
  return "검토 저장";
}

function formatDateTime(value: string) {
  return new Intl.DateTimeFormat("ko-KR", {
    dateStyle: "long",
    timeStyle: "short",
  }).format(new Date(value));
}

function renderInfoLine(label: string, value: string | null) {
  if (!value) return null;

  return (
    <div className="rounded-xl bg-[#f8f8f8] px-4 py-3">
      <p className="text-xs font-bold text-[#7a7a7a]">{label}</p>
      <p className="mt-1 text-sm font-semibold leading-6 text-[#111111]">{value}</p>
    </div>
  );
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
  const extractedFields = (record.extracted_fields ?? {}) as AiPosterExtractedFields;
  const options = (record.options ?? {}) as AiPosterOptions;
  const promptText = typeof record.prompt_text === "string" ? record.prompt_text : "";
  const title = typeof record.title === "string" ? record.title : "";
  const status = typeof record.status === "string" ? record.status : "reviewed";
  const createdAt = typeof record.created_at === "string" ? record.created_at : new Date().toISOString();

  return (
    <div data-page-shell className="min-h-dvh bg-[#f4f4f4] page-slide-in-from-top">
      <ClassHeader
        title="프롬프트 확인하기"
        className="h-[70px]"
        backExitAnimationClass="page-slide-out-to-top"
        backExitDelayMs={200}
      />

      <main className="px-4 pt-5 pb-28">
        <div className="mx-auto flex w-full max-w-[520px] flex-col gap-5">
          <section className="rounded-2xl bg-white p-4 shadow-sm">
            <div className="flex items-center justify-between gap-3">
              <div>
                <h2 className="text-base font-bold text-[#111111]">업로드된 강사 사진</h2>
                <p className="mt-1 text-sm text-[#666666]">
                  {sourceImages.length}장 저장됨 · {formatDateTime(createdAt)}
                </p>
              </div>
              <span className="rounded-full bg-[#fff5bf] px-3 py-1 text-xs font-bold text-[#5f4c00]">
                {getStatusLabel(status)}
              </span>
            </div>

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
            initialTitle={title}
            initialExtractedFields={extractedFields}
            initialPromptText={promptText}
          />

          <section className="rounded-2xl bg-white p-4 shadow-sm">
            <h2 className="text-base font-bold text-[#111111]">선택한 옵션</h2>
            <div className="mt-4 grid grid-cols-2 gap-3">
              {renderInfoLine("스타일", options.style)}
              {renderInfoLine("인물 강조", options.personFocus)}
              {renderInfoLine("톤 분위기", options.tone)}
              {renderInfoLine("비율", options.ratio)}
            </div>
          </section>
        </div>
      </main>
    </div>
  );
}
