import type { Metadata } from "next";
import ClassForm from "@/components/class/ClassForm";
import ClassHeader from "@/components/layout/ClassHeader";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "클래스 만들기" };

interface Props {
  searchParams: Promise<{ ai_poster?: string }>;
}

export default async function ClassNewPage({ searchParams }: Props) {
  const params = await searchParams;
  let aiPosterData:
    | { requestId: string; imageUrl: string; title: string; rawContent: string; promptText: string }
    | undefined;

  if (params.ai_poster) {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (user) {
      const { data } = await supabase
        .from("ai_poster_requests")
        .select("title, raw_content, prompt_text, generated_image_url")
        .eq("id", params.ai_poster)
        .eq("user_id", user.id)
        .single();

      if (data?.generated_image_url) {
        aiPosterData = {
          requestId: params.ai_poster,
          imageUrl: data.generated_image_url,
          title: data.title ?? "",
          rawContent: data.raw_content ?? "",
          promptText: data.prompt_text ?? "",
        };
      }
    }
  }

  return (
    <div data-page-shell className="page-slide-in-from-top">
      <ClassHeader
        title="클래스 만들기"
        className="h-[70px]"
        hideBackButton
        backExitAnimationClass="page-slide-out-to-top"
        backExitDelayMs={200}
      />
      <div className="bg-[#f4f4f4] pt-[10px]">
        <ClassForm userRole="member" aiPosterData={aiPosterData} />
      </div>
    </div>
  );
}
