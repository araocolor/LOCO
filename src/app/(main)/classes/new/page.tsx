import type { Metadata } from "next";
import ClassForm from "@/components/class/ClassForm";
import ClassHeader from "@/components/layout/ClassHeader";

export const metadata: Metadata = { title: "클래스 만들기" };

export default function ClassNewPage() {
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
        <ClassForm userRole="member" />
      </div>
    </div>
  );
}
