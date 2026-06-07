"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import { ArrowLeft, ChevronDown, ChevronRight, ImagePlus, Upload, X } from "lucide-react";
import AiPosterForm from "@/app/(main)/classes/new/ai-poster/poster-form";

interface SourceImage {
  url: string;
  path: string;
}

interface DraftItem {
  id: string;
  title: string;
  raw_content: string;
  prompt_text: string;
  source_images: SourceImage[];
  status: "reviewed" | "failed" | "generated";
  generated_image_url: string | null;
  error_message: string | null;
  created_at: string;
}

interface ClassImage {
  icon_url: string;
  card_url: string;
  full_url: string;
}

interface CompletedClassItem {
  class_id: string;
  class_title: string;
  class_status: string;
  deadline: string | null;
  created_at: string;
  ai_poster_request_id: string;
  ai_poster_title: string | null;
  generated_image_url: string | null;
  images: ClassImage[] | null;
}

type DrawerTab = "aiPoster" | "drafts" | "completed";
type DrawerView = "menu" | "aiPosterForm";

interface CreateClassDrawerProps {
  open: boolean;
  onClose: () => void;
}

function formatDate(dateStr: string) {
  const d = new Date(dateStr);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  const h = String(d.getHours()).padStart(2, "0");
  const min = String(d.getMinutes()).padStart(2, "0");
  return `${y}.${m}.${day} ${h}:${min}`;
}

function getDraftActionLabel(draft: DraftItem) {
  if (draft.status === "generated") return "클래스 등록하기";
  if (draft.status === "failed") return "수정 후 다시 생성";
  return "수정/생성하기";
}

function getDraftStatusLabel(draft: DraftItem) {
  if (draft.status === "generated") return "생성완료";
  if (draft.status === "failed") return "생성실패";
  return "임시저장";
}

function getCompletedClassImageUrl(item: CompletedClassItem) {
  if (item.generated_image_url) return item.generated_image_url;
  return (
    item.images?.[0]?.card_url ?? item.images?.[0]?.full_url ?? item.images?.[0]?.icon_url ?? null
  );
}

export default function CreateClassDrawer({ open, onClose }: CreateClassDrawerProps) {
  const router = useRouter();
  const [slideIn, setSlideIn] = useState(false);
  const [drawerView, setDrawerView] = useState<DrawerView>("menu");
  const [activeTab, setActiveTab] = useState<DrawerTab>("aiPoster");
  const [drafts, setDrafts] = useState<DraftItem[]>([]);
  const [completedClasses, setCompletedClasses] = useState<CompletedClassItem[]>([]);
  const [draftsLoading, setDraftsLoading] = useState(false);
  const [completedLoading, setCompletedLoading] = useState(false);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  useEffect(() => {
    if (open) {
      requestAnimationFrame(() => setSlideIn(true));
      queueMicrotask(() => setDraftsLoading(true));
      queueMicrotask(() => setCompletedLoading(true));
      fetch("/api/ai-poster/requests")
        .then((res) => res.json())
        .then((json) => {
          setDrafts(json.drafts ?? []);
        })
        .catch(() => {})
        .finally(() => setDraftsLoading(false));
      fetch("/api/ai-poster/completed-classes")
        .then((res) => res.json())
        .then((json) => {
          setCompletedClasses(json.classes ?? []);
        })
        .catch(() => {})
        .finally(() => setCompletedLoading(false));
    } else {
      queueMicrotask(() => {
        setSlideIn(false);
        setDrawerView("menu");
        setActiveTab("aiPoster");
        setExpandedId(null);
      });
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

  const isAiPosterFormOpen = drawerView === "aiPosterForm";

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
            {isAiPosterFormOpen && (
              <button
                type="button"
                onClick={() => setDrawerView("menu")}
                className="-ml-2 mr-1 h-12 w-12 flex items-center justify-center text-gray-700"
                aria-label="클래스 만들기로 돌아가기"
              >
                <ArrowLeft size={21} strokeWidth={2.2} />
              </button>
            )}
            <div className="font-black text-[22px] text-[#4d4d4d] leading-none">
              {isAiPosterFormOpen ? "AI 포스터 만들기" : "클래스 만들기"}
            </div>
            <button
              type="button"
              onClick={handleClose}
              className="ml-auto h-12 w-12 -mr-2 flex items-center justify-center text-gray-700"
            >
              <X size={22} strokeWidth={2.2} />
            </button>
          </div>
          {!isAiPosterFormOpen && (
            <div className="flex pl-4 pr-4 gap-2 pb-2">
              <button
                type="button"
                onClick={() => {
                  setActiveTab("aiPoster");
                  setExpandedId(null);
                }}
                className={`px-3.5 py-1.5 rounded-full text-[14px] font-semibold transition-colors ${
                  activeTab === "aiPoster" ? "bg-black text-white" : "bg-gray-100 text-black/[0.65]"
                }`}
              >
                AI포스터
              </button>
              <button
                type="button"
                onClick={() => {
                  setActiveTab("drafts");
                  setExpandedId(null);
                }}
                className={`px-3.5 py-1.5 rounded-full text-[14px] font-semibold transition-colors ${
                  activeTab === "drafts" ? "bg-black text-white" : "bg-gray-100 text-black/[0.65]"
                }`}
              >
                임시저장
              </button>
              <button
                type="button"
                onClick={() => {
                  setActiveTab("completed");
                  setExpandedId(null);
                }}
                className={`px-3.5 py-1.5 rounded-full text-[14px] font-semibold transition-colors ${
                  activeTab === "completed"
                    ? "bg-black text-white"
                    : "bg-gray-100 text-black/[0.65]"
                }`}
              >
                클래스완료
              </button>
            </div>
          )}
        </header>

        {isAiPosterFormOpen ? (
          <AiPosterForm surface="drawer" onCancel={() => setDrawerView("menu")} />
        ) : (
          <main className="flex-1 overflow-y-auto px-4 pt-5 pb-8">
            {activeTab === "aiPoster" && (
              <div className="mx-auto flex w-full max-w-[520px] flex-col gap-4">
                <button
                  type="button"
                  onClick={() => setDrawerView("aiPosterForm")}
                  className="flex min-h-[180px] flex-col justify-between rounded-2xl border border-[#e5e7eb] bg-white p-6 shadow-sm transition active:scale-[0.99] text-left"
                >
                  <div className="flex items-center justify-between">
                    <span className="flex h-12 w-12 items-center justify-center rounded-full bg-[#fee500] text-[#191600]">
                      <ImagePlus size={25} strokeWidth={2.2} />
                    </span>
                    <span className="text-[14px] font-semibold text-[#666666]">
                      무료 <span className="text-[17px] font-bold text-[#111111]">3</span>회 남음
                    </span>
                  </div>
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
              <div className="mx-auto w-full max-w-[520px] flex flex-col gap-3">
                {draftsLoading && (
                  <div className="py-16 text-center text-[15px] text-gray-400">불러오는 중...</div>
                )}
                {!draftsLoading && drafts.length === 0 && (
                  <div className="py-16 text-center text-[15px] text-gray-400">
                    임시저장된 항목이 없습니다
                  </div>
                )}
                {!draftsLoading &&
                  drafts.map((draft) => {
                    const isOpen = expandedId === draft.id;
                    return (
                      <div
                        key={draft.id}
                        className="rounded-2xl border border-[#e5e7eb] bg-white shadow-sm overflow-hidden"
                      >
                        <button
                          type="button"
                          onClick={() => setExpandedId(isOpen ? null : draft.id)}
                          className="w-full flex items-center justify-between px-5 py-4 text-left"
                        >
                          <div className="flex flex-col">
                            <span className="flex items-center gap-2 text-[16px] font-bold text-[#111111]">
                              {draft.title || "제목 없음"}
                              <span className="rounded-full bg-gray-100 px-2 py-0.5 text-[11px] font-bold text-[#777777]">
                                {getDraftStatusLabel(draft)}
                              </span>
                            </span>
                            <span className="mt-0.5 text-[13px] text-[#999999]">
                              {formatDate(draft.created_at)}
                            </span>
                          </div>
                          <ChevronDown
                            size={20}
                            className={`shrink-0 text-[#aaaaaa] transition-transform duration-200 ${isOpen ? "rotate-180" : ""}`}
                          />
                        </button>
                        {isOpen && (
                          <div className="px-5 pb-4 flex flex-col gap-4">
                            {draft.status === "generated" && draft.generated_image_url && (
                              <div>
                                <h3 className="text-[13px] font-semibold text-[#888888] mb-2">
                                  생성된 포스터
                                </h3>
                                <div className="relative aspect-[3/4] w-full overflow-hidden rounded-xl border border-[#ececec] bg-[#f6f6f6]">
                                  <Image
                                    src={draft.generated_image_url}
                                    alt="생성된 AI 포스터"
                                    fill
                                    sizes="520px"
                                    unoptimized
                                    className="object-cover"
                                  />
                                </div>
                              </div>
                            )}
                            {draft.status === "failed" && draft.error_message && (
                              <div className="rounded-xl bg-[#fff2f2] px-4 py-3 text-[13px] font-semibold leading-5 text-red-500">
                                {draft.error_message}
                              </div>
                            )}
                            {Array.isArray(draft.source_images) &&
                              draft.source_images.length > 0 && (
                                <div>
                                  <h3 className="text-[13px] font-semibold text-[#888888] mb-2">
                                    참조 이미지
                                  </h3>
                                  <div className="grid grid-cols-3 gap-2">
                                    {draft.source_images.map((img, i) => (
                                      <div
                                        key={img.path}
                                        className="relative aspect-square overflow-hidden rounded-xl border border-[#ececec] bg-[#f6f6f6]"
                                      >
                                        <Image
                                          src={img.url}
                                          alt={`참조 이미지 ${i + 1}`}
                                          fill
                                          sizes="160px"
                                          unoptimized
                                          className="object-cover"
                                        />
                                      </div>
                                    ))}
                                  </div>
                                </div>
                              )}
                            <div>
                              <h3 className="text-[13px] font-semibold text-[#888888] mb-2">
                                최종 프롬프트
                              </h3>
                              <p className="whitespace-pre-wrap text-[14px] leading-6 text-white bg-[#111111] rounded-xl px-4 py-3 max-h-[280px] overflow-y-auto">
                                {draft.prompt_text || draft.raw_content || "내용 없음"}
                              </p>
                            </div>
                            <button
                              type="button"
                              onClick={() =>
                                handleNavigate(
                                  draft.status === "generated"
                                    ? `/classes/new?ai_poster=${draft.id}`
                                    : `/classes/new/ai-poster/review/${draft.id}`
                                )
                              }
                              className="flex w-full items-center justify-center gap-1 rounded-full bg-[#fee500] py-2.5 text-[14px] font-semibold text-[#191600] transition active:scale-[0.98]"
                            >
                              {getDraftActionLabel(draft)}
                              <ChevronRight size={16} />
                            </button>
                          </div>
                        )}
                      </div>
                    );
                  })}
              </div>
            )}

            {activeTab === "completed" && (
              <div className="mx-auto w-full max-w-[520px] flex flex-col gap-3">
                {completedLoading && (
                  <div className="py-16 text-center text-[15px] text-gray-400">불러오는 중...</div>
                )}
                {!completedLoading && completedClasses.length === 0 && (
                  <div className="py-16 text-center text-[15px] text-gray-400">
                    클래스 등록완료 항목이 없습니다
                  </div>
                )}
                {!completedLoading &&
                  completedClasses.map((item) => {
                    const imageUrl = getCompletedClassImageUrl(item);
                    const isOpen = expandedId === item.class_id;
                    return (
                      <div
                        key={item.class_id}
                        className="rounded-2xl border border-[#e5e7eb] bg-white shadow-sm overflow-hidden"
                      >
                        <button
                          type="button"
                          onClick={() => setExpandedId(isOpen ? null : item.class_id)}
                          className="w-full flex items-center justify-between px-5 py-4 text-left"
                        >
                          <div className="flex flex-col">
                            <span className="flex items-center gap-2 text-[16px] font-bold text-[#111111]">
                              {item.class_title || item.ai_poster_title || "제목 없음"}
                              <span className="rounded-full bg-[#e8f7ee] px-2 py-0.5 text-[11px] font-bold text-[#1f8a4c]">
                                클래스완료
                              </span>
                            </span>
                            <span className="mt-0.5 text-[13px] text-[#999999]">
                              {formatDate(item.created_at)}
                            </span>
                          </div>
                          <ChevronDown
                            size={20}
                            className={`shrink-0 text-[#aaaaaa] transition-transform duration-200 ${isOpen ? "rotate-180" : ""}`}
                          />
                        </button>
                        {isOpen && (
                          <div className="px-5 pb-4 flex flex-col gap-4">
                            {imageUrl && (
                              <div>
                                <h3 className="text-[13px] font-semibold text-[#888888] mb-2">
                                  등록된 포스터
                                </h3>
                                <div className="relative aspect-[3/4] w-full overflow-hidden rounded-xl border border-[#ececec] bg-[#f6f6f6]">
                                  <Image
                                    src={imageUrl}
                                    alt="등록된 AI 포스터"
                                    fill
                                    sizes="520px"
                                    unoptimized
                                    className="object-cover"
                                  />
                                </div>
                              </div>
                            )}
                            <button
                              type="button"
                              onClick={() => handleNavigate(`/classes/${item.class_id}`)}
                              className="flex w-full items-center justify-center gap-1 rounded-full bg-[#fee500] py-2.5 text-[14px] font-semibold text-[#191600] transition active:scale-[0.98]"
                            >
                              클래스 보기
                              <ChevronRight size={16} />
                            </button>
                          </div>
                        )}
                      </div>
                    );
                  })}
              </div>
            )}
          </main>
        )}
      </div>
    </div>
  );
}
