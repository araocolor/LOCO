"use client";

import { useState, useEffect } from "react";
import { X } from "lucide-react";

export type CustomerServiceTab = "notice" | "support";

interface Props {
  open: boolean;
  onClose: () => void;
  initialTab?: CustomerServiceTab;
}

export default function CustomerServiceDrawer({ open, onClose, initialTab = "notice" }: Props) {
  const [activeTab, setActiveTab] = useState<CustomerServiceTab>(initialTab);

  useEffect(() => {
    if (open) setActiveTab(initialTab);
  }, [open, initialTab]);

  if (!open) return null;

  return (
    <>
      <div className="fixed inset-0 z-[250] bg-black/30" />
      <div className="fixed inset-0 z-[251] flex justify-center">
        <div className="relative w-full max-w-[500px] bg-white flex flex-col page-slide-in-from-right">
          <header className="sticky top-0 z-10 bg-white border-b border-[#e5e7eb]">
            <div className="relative h-14 px-4 flex items-center">
              <div className="font-black text-[22px] text-[#4d4d4d] leading-none">
                고객센터
              </div>
              <button
                type="button"
                onClick={onClose}
                className="ml-auto flex h-9 w-9 items-center justify-center rounded-full hover:bg-gray-100"
                aria-label="닫기"
              >
                <X size={20} />
              </button>
            </div>
            <div className="flex pl-4 pr-4 gap-2 pb-2">
              <button
                type="button"
                onClick={() => setActiveTab("notice")}
                className={`px-3.5 py-1.5 rounded-full text-[15px] font-semibold transition-colors ${
                  activeTab === "notice" ? "bg-black text-white" : "bg-gray-100 text-gray-400"
                }`}
              >
                공지사항
              </button>
              <button
                type="button"
                onClick={() => setActiveTab("support")}
                className={`px-3.5 py-1.5 rounded-full text-[15px] font-semibold transition-colors ${
                  activeTab === "support" ? "bg-black text-white" : "bg-gray-100 text-gray-400"
                }`}
              >
                고객센터
              </button>
            </div>
          </header>

          <main className="flex-1 overflow-y-auto scrollbar-hide overscroll-contain">
            {activeTab === "notice" ? <NoticeContent /> : <SupportContent />}
          </main>
        </div>
      </div>
    </>
  );
}

function NoticeContent() {
  return (
    <div className="flex flex-col items-center justify-center py-20 text-gray-400">
      <span className="text-[15px]">공지사항이 없습니다</span>
    </div>
  );
}

function SupportContent() {
  return (
    <div className="px-4 py-6 space-y-6">
      <section>
        <h3 className="text-[15px] font-bold text-gray-800 mb-3">문의하기</h3>
        <p className="text-[14px] text-gray-500 leading-relaxed">
          서비스 이용 중 궁금한 점이나 불편한 사항이 있으시면 아래 이메일로 문의해주세요.
        </p>
        <div className="mt-3 rounded-xl bg-gray-50 px-4 py-3">
          <span className="text-[14px] text-gray-700">jejusalsa@gmail.com</span>
        </div>
      </section>
      <section>
        <h3 className="text-[15px] font-bold text-gray-800 mb-3">운영시간</h3>
        <p className="text-[14px] text-gray-500 leading-relaxed">
          평일 10:00 ~ 18:00 (주말/공휴일 휴무)
        </p>
      </section>
    </div>
  );
}
