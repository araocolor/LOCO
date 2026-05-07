import type { Metadata } from "next";
import ClassForm from "@/components/class/ClassForm";
import ClassHeader from "@/components/layout/ClassHeader";

export const metadata: Metadata = { title: "클래스 개설" };

export default function ClassNewPage() {
  return (
    <div data-page-shell className="page-slide-in-from-top">
      <ClassHeader backExitAnimationClass="page-slide-out-to-top" backExitDelayMs={200} />
      <div className="sticky top-14 z-30 bg-white border-b border-[#e5e7eb] px-4 h-12 flex items-center">
        <h1 className="font-semibold text-base">클래스 개설</h1>
      </div>
      <ClassForm userRole="member" />
    </div>
  );
}
