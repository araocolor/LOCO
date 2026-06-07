"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { ChevronRight, ImagePlus, Upload, X } from "lucide-react";

interface DraftItem {
  id: string;
  title: string;
  created_at: string;
}

type DrawerTab = "aiPoster" | "drafts";

interface CreateClassDrawerProps {
  open: boolean;
  onClose: () => void;
}

export default function CreateClassDrawer({ open, onClose }: CreateClassDrawerProps) {
  const router = useRouter();
  const [slideIn, setSlideIn] = useState(false);
  const [activeTab, setActiveTab] = useState<DrawerTab>("aiPoster");
  const [drafts, setDrafts] = useState<DraftItem[]>([]);
  const [draftsLoading, setDraftsLoading] = useState(false);

  useEffect(() => {
    if (open) {
      requestAnimationFrame(() => setSlideIn(true));
      setDraftsLoading(true);
      fetch("/api/ai-poster/requests")
        .then((res) => res.json())
        .then((json) => setDrafts(json.drafts ?? []))
        .catch(() => {})
        .finally(() => setDraftsLoading(false));
    } else {
      setSlideIn(false);
      setActiveTab("aiPoster");
    }
  }, [open]);

  const handleClose = useCallback(() => {
    setSlideIn(false);
    setTimeout(onClose, 300);
  }, [onClose]);

  const handleNavigate = useCallback(
    (path: string) => {
      handleClose();
      setTimeout(() => router.push(path), 320);
    },
    [handleClose, router]
  );

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[100]">
      <div
        className={`absolute inset-0 bg-black/30 transition-opacity duration-300 ${slideIn ? "opacity-100" : "opacity-0"}`}
        onClick={handleClose}
      />
      <div
        className={`absolute inset-0 bg-[#f4f4f4] flex flex-col transition-transform duration-300 ease-out ${slideIn ? "translate-y-0" : "translate-y-full"}`}
      >
        <header className="shrink-0 bg-white border-b border-[#e5e7eb]">
          <div className="relative h-14 px-4 flex items-center">
            <div className="font-black text-[22px] text-[#4d4d4d] leading-none">클래스 만들기</div>
            <button
              type="button"
              onClick={handleClose}
              className="ml-auto h-12 w-12 -mr-2 flex items-center justify-center text-gray-700"
            >
              <X size={22} strokeWidth={2.2} />
            </button>
          </div>
          <div className="flex pl-4 pr-4 gap-2 pb-2">
            <button
              type="button"
              onClick={() => setActiveTab("aiPoster")}
              className={`px-3.5 py-1.5 rounded-full text-[14px] font-semibold transition-colors ${
                activeTab === "aiPoster" ? "bg-black text-white" : "bg-gray-100 text-black/[0.65]"
              }`}
            >
              AI포스터
            </button>
            <button
              type="button"
              onClick={() => setActiveTab("drafts")}
              className={`px-3.5 py-1.5 rounded-full text-[14px] font-semibold transition-colors ${
                activeTab === "drafts" ? "bg-black text-white" : "bg-gray-100 text-black/[0.65]"
              }`}
            >
              임시저장
            </button>
          </div>
        </header>

        <main className="flex-1 overflow-y-auto px-4 pt-5 pb-8">
          {activeTab === "aiPoster" && (
            <div className="mx-auto flex w-full max-w-[520px] flex-col gap-4">
              <button
                type="button"
                onClick={() => handleNavigate("/classes/new/ai-poster")}
                className="flex min-h-[180px] flex-col justify-between rounded-2xl border border-[#e5e7eb] bg-white p-6 shadow-sm transition active:scale-[0.99] text-left"
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
              </button>

              <button
                type="button"
                onClick={() => handleNavigate("/classes/new")}
                className="flex min-h-[180px] flex-col justify-between rounded-2xl border border-[#e5e7eb] bg-white p-6 shadow-sm transition active:scale-[0.99] text-left"
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
              </button>
            </div>
          )}

          {activeTab === "drafts" && (
            <div className="mx-auto w-full max-w-[520px] flex flex-col gap-2">
              {draftsLoading && (
                <div className="py-16 text-center text-[15px] text-gray-400">불러오는 중...</div>
              )}
              {!draftsLoading && drafts.length === 0 && (
                <div className="py-16 text-center text-[15px] text-gray-400">임시저장된 항목이 없습니다</div>
              )}
              {!draftsLoading &&
                drafts.map((draft) => (
                  <button
                    key={draft.id}
                    type="button"
                    onClick={() => handleNavigate(`/classes/new/ai-poster/review/${draft.id}`)}
                    className="flex flex-col rounded-2xl border border-[#e5e7eb] bg-white px-5 py-4 shadow-sm transition active:scale-[0.99] text-left"
                  >
                    <span className="self-start inline-flex items-center px-3 py-1.5 rounded-full bg-[#111111] text-white text-[15px] font-semibold mb-2">
                      임시저장
                    </span>
                    <div className="flex items-center justify-between w-full">
                      <span className="text-[22px] font-bold text-[#111111] truncate pr-2">
                        {draft.title || "제목 없음"}
                      </span>
                      <ChevronRight size={20} className="shrink-0 text-[#aaaaaa]" />
                    </div>
                  </button>
                ))}
            </div>
          )}
        </main>
      </div>
    </div>
  );
}
