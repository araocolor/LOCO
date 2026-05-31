import type { Metadata } from "next";
import Link from "next/link";
import { ImagePlus, Upload } from "lucide-react";
import ClassHeader from "@/components/layout/ClassHeader";

export const metadata: Metadata = { title: "포스터 만들기 선택" };

export default function ClassCreateChoicePage() {
  return (
    <div data-page-shell className="min-h-dvh bg-[#f4f4f4] page-slide-in-from-top">
      <ClassHeader
        title="클래스 만들기"
        className="h-[70px]"
        backExitAnimationClass="page-slide-out-to-top"
        backExitDelayMs={200}
      />

      <main className="px-4 pt-5 pb-8">
        <div className="mx-auto flex w-full max-w-[520px] flex-col gap-4">
          <Link
            href="/classes/new/ai-poster"
            className="group flex min-h-[180px] flex-col justify-between rounded-2xl border border-[#e5e7eb] bg-white p-6 shadow-sm transition active:scale-[0.99]"
          >
            <span className="flex h-12 w-12 items-center justify-center rounded-full bg-[#fee500] text-[#191600]">
              <ImagePlus size={25} strokeWidth={2.2} />
            </span>
            <span className="mt-8 text-2xl font-extrabold tracking-[-0.02em] text-[#111111]">
              AI 포스터 만들기
            </span>
            <span className="mt-2 text-sm font-medium leading-5 text-[#666666]">
              강사 사진과 수업 내용을 입력해서 포스터 초안을 준비합니다.
            </span>
          </Link>

          <Link
            href="/classes/new"
            className="group flex min-h-[180px] flex-col justify-between rounded-2xl border border-[#e5e7eb] bg-white p-6 shadow-sm transition active:scale-[0.99]"
          >
            <span className="flex h-12 w-12 items-center justify-center rounded-full bg-[#111111] text-white">
              <Upload size={24} strokeWidth={2.2} />
            </span>
            <span className="mt-8 text-2xl font-extrabold tracking-[-0.02em] text-[#111111]">
              포스터직접업로드
            </span>
            <span className="mt-2 text-sm font-medium leading-5 text-[#666666]">
              기존 클래스 만들기 화면에서 포스터와 정보를 직접 등록합니다.
            </span>
          </Link>
        </div>
      </main>
    </div>
  );
}
