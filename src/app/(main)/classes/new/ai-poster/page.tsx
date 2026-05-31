import type { Metadata } from "next";
import ClassHeader from "@/components/layout/ClassHeader";
import AiPosterForm from "./poster-form";

export const metadata: Metadata = { title: "AI 포스터 만들기" };

export default function AiPosterPage() {
  return (
    <div data-page-shell className="min-h-dvh bg-[#f4f4f4] page-slide-in-from-top">
      <ClassHeader
        title="AI 포스터 만들기"
        className="h-[70px]"
        backExitAnimationClass="page-slide-out-to-top"
        backExitDelayMs={200}
      />
      <AiPosterForm />
    </div>
  );
}
