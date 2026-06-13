"use client";

import { useEffect, useState, useCallback, useMemo } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import { ArrowLeft, ChevronDown, ChevronRight, ImagePlus, Trash2, Upload, X, Zap } from "lucide-react";
import AiPosterForm from "@/app/(main)/classes/new/ai-poster/poster-form";
import CreditChargeSheet from "@/components/class/CreditChargeSheet";
import CountUp from "@/components/ui/CountUp";
import CelebrationEffect from "@/components/ui/CelebrationEffect";

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
  status: "reviewed" | "failed";
  error_message: string | null;
  created_at: string;
}

interface GeneratedItem {
  id: string;
  title: string;
  raw_content: string;
  prompt_text: string;
  source_images: SourceImage[];
  generated_image_url: string | null;
  created_at: string;
  linked_class_id: string | null;
}

type DrawerTab = "aiPoster" | "drafts" | "generated";
type DrawerView = "menu" | "aiPosterForm";

interface CreateClassDrawerProps {
  open: boolean;
  onClose: () => void;
}

const GRID_FILL_COLORS = ["#E84040", "#B8D44A", "#F5A623", "#5BB8E8"] as const;

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
  if (draft.status === "failed") return "수정 후 다시 생성";
  return "수정/생성하기";
}

function getDraftStatusLabel(draft: DraftItem) {
  if (draft.status === "failed") return "생성실패";
  return "임시저장";
}

export default function CreateClassDrawer({ open, onClose }: CreateClassDrawerProps) {
  const router = useRouter();
  const [slideIn, setSlideIn] = useState(false);
  const [drawerView, setDrawerView] = useState<DrawerView>("menu");
  const [activeTab, setActiveTab] = useState<DrawerTab>("aiPoster");
  const [drafts, setDrafts] = useState<DraftItem[]>([]);
  const [generatedItems, setGeneratedItems] = useState<GeneratedItem[]>([]);
  const [requestsLoading, setRequestsLoading] = useState(false);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [selectedGeneratedItem, setSelectedGeneratedItem] = useState<GeneratedItem | null>(null);
  const [gridFillSeed] = useState(() => Math.floor(Math.random() * GRID_FILL_COLORS.length));
  const [deleteMode, setDeleteMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [deleting, setDeleting] = useState(false);
  const CREDIT_CACHE_KEY = "credit_balance_cache";
  const [creditBalance, setCreditBalance] = useState<number>(() => {
    try {
      const cached = localStorage.getItem(CREDIT_CACHE_KEY);
      return cached !== null ? Number(cached) : 0;
    } catch { return 0; }
  });
  const [creditAnimated, setCreditAnimated] = useState(() => {
    try { return localStorage.getItem(CREDIT_CACHE_KEY) !== null; } catch { return false; }
  });
  const [chargeSheetOpen, setChargeSheetOpen] = useState(false);
  const [showCelebration, setShowCelebration] = useState(false);

  const updateCreditBalance = (balance: number, skipAnimation?: boolean) => {
    setCreditBalance(balance);
    if (skipAnimation) setCreditAnimated(true);
    try { localStorage.setItem(CREDIT_CACHE_KEY, String(balance)); } catch {}
  };

  useEffect(() => {
    if (open) {
      requestAnimationFrame(() => setSlideIn(true));
      queueMicrotask(() => setRequestsLoading(true));
      fetch("/api/ai-poster/requests")
        .then((res) => res.json())
        .then((json) => {
          setDrafts(json.drafts ?? []);
          setGeneratedItems(json.generated ?? []);
        })
        .catch(() => {})
        .finally(() => setRequestsLoading(false));
      fetch("/api/poster-credits")
        .then((res) => res.json())
        .then((json) => {
          const hasCached = localStorage.getItem(CREDIT_CACHE_KEY) !== null;
          updateCreditBalance(json.balance ?? 0, hasCached);
        })
        .catch(() => {});
    } else {
      queueMicrotask(() => {
        setSlideIn(false);
        setDrawerView("menu");
        setActiveTab("aiPoster");
        setExpandedId(null);
        setSelectedGeneratedItem(null);
        setDeleteMode(false);
        setSelectedIds(new Set());
        setChargeSheetOpen(false);
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

  const isAiPosterFormOpen = drawerView === "aiPosterForm";
  const isGeneratedDetailOpen = selectedGeneratedItem !== null;
  const headerTitle = isAiPosterFormOpen
    ? "AI 포스터 만들기"
    : isGeneratedDetailOpen
      ? "생성완료"
      : "클래스 만들기";
  const handleHeaderBack = useCallback(() => {
    if (isAiPosterFormOpen) {
      setDrawerView("menu");
      return;
    }
    if (isGeneratedDetailOpen) {
      setSelectedGeneratedItem(null);
      return;
    }
    handleClose();
  }, [handleClose, isAiPosterFormOpen, isGeneratedDetailOpen]);
  const showDeleteButton = !isAiPosterFormOpen && !isGeneratedDetailOpen && (activeTab === "drafts" || activeTab === "generated");

  const handleEnterDeleteMode = useCallback(() => {
    setDeleteMode(true);
    setSelectedIds(new Set());
    setExpandedId(null);
  }, []);

  const handleExitDeleteMode = useCallback(() => {
    setDeleteMode(false);
    setSelectedIds(new Set());
  }, []);

  const toggleSelectId = useCallback((id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  const handleDeleteSelected = useCallback(async () => {
    if (selectedIds.size === 0 || deleting) return;
    setDeleting(true);
    try {
      const ids = Array.from(selectedIds);
      const type = activeTab === "drafts" ? "draft" : "generated";
      await fetch("/api/ai-poster/requests", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ids, type }),
      });
      if (activeTab === "drafts") {
        setDrafts((prev) => prev.filter((d) => !selectedIds.has(d.id)));
      } else {
        setGeneratedItems((prev) => prev.filter((g) => !selectedIds.has(g.id)));
      }
      setDeleteMode(false);
      setSelectedIds(new Set());
    } catch {
      // 삭제 실패 시 무시
    } finally {
      setDeleting(false);
    }
  }, [selectedIds, deleting, activeTab]);

  const generatedFillerCells = useMemo(() => {
    const remain = generatedItems.length % 3;
    const count = remain === 0 ? 0 : 3 - remain;
    return Array.from({ length: count }, (_, idx) => {
      const color = GRID_FILL_COLORS[(gridFillSeed + generatedItems.length + idx) % GRID_FILL_COLORS.length];
      return { key: `generated-filler-${generatedItems.length}-${idx}`, color };
    });
  }, [generatedItems.length, gridFillSeed]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[100] flex justify-center">
      <div
        className={`absolute inset-0 bg-black/30 transition-opacity duration-300 ${slideIn ? "opacity-100" : "opacity-0"}`}
        onClick={handleClose}
      />
      <div
        className={`relative w-full max-w-[500px] bg-[#f4f4f4] flex flex-col transition-transform duration-300 ease-out ${slideIn ? "translate-y-0" : "translate-y-full"}`}
        style={{ paddingTop: 'env(safe-area-inset-top)' }}
      >
        <header className="shrink-0 bg-white border-b border-[#e5e7eb]">
          <div className="relative flex h-14 items-center px-4">
            {(isAiPosterFormOpen || isGeneratedDetailOpen) && (
              <button
                type="button"
                onClick={handleHeaderBack}
                className="-ml-2 mr-1 flex h-12 w-12 items-center justify-center text-gray-700"
                aria-label={
                  isAiPosterFormOpen ? "클래스 만들기로 돌아가기" : "생성완료 목록으로 돌아가기"
                }
              >
                <ArrowLeft size={21} strokeWidth={2.2} />
              </button>
            )}
            <div className="leading-none font-black text-[22px] text-[#4d4d4d]">{headerTitle}</div>
            <button
              type="button"
              onClick={handleHeaderBack}
              className="ml-auto -mr-2 flex h-12 w-12 items-center justify-center text-gray-700"
            >
              <X size={22} strokeWidth={2.2} />
            </button>
          </div>

          {!isAiPosterFormOpen && !isGeneratedDetailOpen && (
            <div className="flex items-center gap-2 px-4 pb-2">
              <button
                type="button"
                onClick={() => {
                  setActiveTab("aiPoster");
                  setExpandedId(null);
                  handleExitDeleteMode();
                }}
                className={`rounded-full px-3.5 py-1.5 text-[14px] font-semibold transition-colors ${
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
                  handleExitDeleteMode();
                }}
                className={`rounded-full px-3.5 py-1.5 text-[14px] font-semibold transition-colors ${
                  activeTab === "drafts" ? "bg-black text-white" : "bg-gray-100 text-black/[0.65]"
                }`}
              >
                임시저장
              </button>
              <button
                type="button"
                onClick={() => {
                  setActiveTab("generated");
                  setExpandedId(null);
                  handleExitDeleteMode();
                }}
                className={`rounded-full px-3.5 py-1.5 text-[14px] font-semibold transition-colors ${
                  activeTab === "generated"
                    ? "bg-black text-white"
                    : "bg-gray-100 text-black/[0.65]"
                }`}
              >
                생성완료
              </button>
              {showDeleteButton && (
                <button
                  type="button"
                  onClick={deleteMode ? handleExitDeleteMode : handleEnterDeleteMode}
                  className="ml-auto mr-1 font-semibold text-black transition-colors active:opacity-70"
                >
                  {deleteMode ? "취소" : <Trash2 size={20} strokeWidth={2.2} />}
                </button>
              )}
            </div>
          )}
        </header>

        {isAiPosterFormOpen ? (
          <AiPosterForm surface="drawer" onCancel={() => setDrawerView("menu")} />
        ) : isGeneratedDetailOpen && selectedGeneratedItem ? (
          <main className="flex-1 overflow-y-auto bg-white pb-8">
            <div className="px-4 pt-5">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="truncate text-[20px] font-bold text-[#111111]">
                    {selectedGeneratedItem.title || "제목 없음"}
                  </p>
                  <p className="mt-1 text-[13px] text-[#999999]">
                    {formatDate(selectedGeneratedItem.created_at)}
                  </p>
                </div>
                <span
                  className={`shrink-0 rounded-full px-3 py-1 text-[12px] font-bold ${
                    selectedGeneratedItem.linked_class_id
                      ? "bg-[#e8f7ee] text-[#1f8a4c]"
                      : "bg-[#fff5cf] text-[#8a6800]"
                  }`}
                >
                  {selectedGeneratedItem.linked_class_id ? "클래스 등록됨" : "생성만 완료"}
                </span>
              </div>
            </div>

            {selectedGeneratedItem.generated_image_url && (
              <div className="mt-5">
                <div className="relative aspect-[3/4] w-full overflow-hidden bg-[#f4f4f4]">
                  <Image
                    src={selectedGeneratedItem.generated_image_url}
                    alt="생성된 AI 포스터"
                    fill
                    sizes="100vw"
                    unoptimized
                    className="object-cover"
                  />
                </div>
              </div>
            )}

            <div className="pt-5">
              {selectedGeneratedItem.source_images.length > 0 && (
                <section>
                  <h3 className="mb-3 text-center text-[15px] font-bold text-black/70">참조 이미지</h3>
                  <div className="flex justify-center">
                    <div className="flex w-fit flex-wrap justify-center gap-2">
                      {selectedGeneratedItem.source_images.map((img, index) => (
                        <div
                          key={img.path}
                          className="relative aspect-square w-24 overflow-hidden bg-[#f6f6f6]"
                        >
                          <Image
                            src={img.url}
                            alt={`참조 이미지 ${index + 1}`}
                            fill
                            sizes="96px"
                            unoptimized
                            className="object-cover"
                          />
                        </div>
                      ))}
                    </div>
                  </div>
                </section>
              )}

              <section
                className={`${selectedGeneratedItem.source_images.length > 0 ? "mt-6 " : ""}bg-black/80 p-4`}
              >
                <h3 className="mb-3 text-[13px] font-semibold text-white/65">최종 프롬프트</h3>
                <p className="whitespace-pre-wrap text-[15px] font-normal leading-7 tracking-[-0.01em] text-white">
                  {selectedGeneratedItem.prompt_text || selectedGeneratedItem.raw_content || "내용 없음"}
                </p>
              </section>

              <button
                type="button"
                onClick={() =>
                  handleNavigate(
                    selectedGeneratedItem.linked_class_id
                      ? `/classes/${selectedGeneratedItem.linked_class_id}`
                      : `/classes/new?ai_poster=${selectedGeneratedItem.id}`
                  )
                }
                className="mx-auto mt-8 flex w-fit items-center justify-center gap-1 rounded-full bg-[#fee500] px-5 py-3 text-[15px] font-semibold text-[#191600] transition active:scale-[0.98]"
              >
                {selectedGeneratedItem.linked_class_id ? "클래스 보기" : "클래스 등록하기"}
                <ChevronRight size={16} />
              </button>
            </div>
          </main>
        ) : (
          <main className="flex-1 overflow-y-auto px-4 pt-5 pb-8">
            {activeTab === "aiPoster" && (
              <div className="mx-auto flex w-full max-w-[520px] flex-col gap-4">
                <button
                  type="button"
                  onClick={creditBalance === 0 ? undefined : () => setDrawerView("aiPosterForm")}
                  className={`relative flex min-h-[180px] flex-col justify-between rounded-2xl border border-[#e5e7eb] bg-white p-6 text-left shadow-sm transition ${
                    creditBalance === 0 ? "opacity-60" : "active:scale-[0.99]"
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span className="flex h-12 w-12 items-center justify-center rounded-full bg-[#fee500] text-[#191600]">
                      <ImagePlus size={25} strokeWidth={2.2} />
                    </span>
                    <span className="flex items-center gap-1.5 text-[14px] font-semibold text-[#666666]">
                      {/* 두꺼운 코인 2개 겹쳐 쌓인 아이콘 */}
                      <svg width="22" height="24" viewBox="0 0 22 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                        <ellipse cx="11" cy="16" rx="10" ry="5" fill="#E5C100" />
                        <ellipse cx="11" cy="14.5" rx="10" ry="5" fill="#FFD600" />
                        <ellipse cx="11" cy="14.5" rx="7" ry="3.2" fill="#FFE866" opacity="0.5" />
                        <ellipse cx="11" cy="9" rx="10" ry="5" fill="#E5C100" />
                        <ellipse cx="11" cy="7.5" rx="10" ry="5" fill="#FFD600" />
                        <ellipse cx="11" cy="7.5" rx="7" ry="3.2" fill="#FFE866" opacity="0.5" />
                      </svg>
                      <CountUp
                        value={creditBalance}
                        animate={!creditAnimated}
                        className="text-[17px] font-bold text-[#111111]"
                        onAnimationEnd={() => {
                          if (!creditAnimated) setShowCelebration(true);
                        }}
                      />
                      <span>회 남음</span>
                    </span>
                  </div>
                  <span className="mt-8 text-2xl font-extrabold tracking-[-0.02em] text-[#111111]">
                    AI 포스터 만들기
                  </span>
                  <span className="mt-2 text-sm font-medium leading-5 text-[#666666]">
                    강사 사진과 수업 내용을 입력해서 포스터 초안을 준비합니다.
                  </span>
                  {showCelebration && (
                    <CelebrationEffect onDone={() => setShowCelebration(false)} />
                  )}
                </button>

                <button
                  type="button"
                  onClick={() => handleNavigate("/classes/new")}
                  className="flex min-h-[180px] flex-col justify-between rounded-2xl border border-[#e5e7eb] bg-white p-6 text-left shadow-sm transition active:scale-[0.99]"
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

                <div className="flex justify-center">
                  <button
                    type="button"
                    onClick={() => setChargeSheetOpen(true)}
                    className="flex items-center gap-1.5 rounded-full bg-[#fee500] px-5 py-2.5 text-[17px] font-bold text-[#191600] transition active:scale-[0.97]"
                  >
                    <Zap size={20} strokeWidth={2.5} />
                    크레딧 충전하기
                  </button>
                </div>
              </div>
            )}

            {activeTab === "drafts" && (
              <div className="mx-auto flex w-full max-w-[520px] flex-col gap-3">
                {requestsLoading && (
                  <div className="py-16 text-center text-[15px] text-gray-400">불러오는 중...</div>
                )}
                {!requestsLoading && drafts.length === 0 && (
                  <div className="py-16 text-center text-[15px] text-gray-400">
                    임시저장된 항목이 없습니다
                  </div>
                )}
                {!requestsLoading &&
                  drafts.map((draft) => {
                    const isOpen = !deleteMode && expandedId === draft.id;
                    const isSelected = selectedIds.has(draft.id);
                    return (
                      <div
                        key={draft.id}
                        className="overflow-hidden rounded-2xl border border-[#e5e7eb] bg-white shadow-sm"
                      >
                        <button
                          type="button"
                          onClick={() => deleteMode ? toggleSelectId(draft.id) : setExpandedId(isOpen ? null : draft.id)}
                          className="flex w-full items-center justify-between px-5 py-4 text-left"
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
                          {deleteMode ? (
                            <div
                              className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full border-2 transition-colors ${
                                isSelected
                                  ? "border-[#E84040] bg-[#E84040]"
                                  : "border-[#cccccc] bg-white"
                              }`}
                            >
                              {isSelected && (
                                <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
                                  <path d="M2.5 6L5 8.5L9.5 3.5" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                                </svg>
                              )}
                            </div>
                          ) : (
                            <ChevronDown
                              size={20}
                              className={`shrink-0 text-[#aaaaaa] transition-transform duration-200 ${
                                isOpen ? "rotate-180" : ""
                              }`}
                            />
                          )}
                        </button>
                        {isOpen && (
                          <div className="flex flex-col gap-4 px-5 pb-4">
                            {draft.status === "failed" && draft.error_message && (
                              <div className="rounded-xl bg-[#fff2f2] px-4 py-3 text-[13px] font-semibold leading-5 text-red-500">
                                {draft.error_message}
                              </div>
                            )}
                            {draft.source_images.length > 0 && (
                              <div>
                                <h3 className="mb-2 text-[13px] font-semibold text-[#888888]">
                                  참조 이미지
                                </h3>
                                <div className="grid grid-cols-3 gap-2">
                                  {draft.source_images.map((img, index) => (
                                    <div
                                      key={img.path}
                                      className="relative aspect-square overflow-hidden rounded-xl border border-[#ececec] bg-[#f6f6f6]"
                                    >
                                      <Image
                                        src={img.url}
                                        alt={`참조 이미지 ${index + 1}`}
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
                              <h3 className="mb-2 text-[13px] font-semibold text-[#888888]">
                                최종 프롬프트
                              </h3>
                              <p className="max-h-[280px] overflow-y-auto whitespace-pre-wrap rounded-xl bg-[#111111] px-4 py-3 text-[14px] leading-6 text-white">
                                {draft.prompt_text || draft.raw_content || "내용 없음"}
                              </p>
                            </div>
                            <button
                              type="button"
                              onClick={() =>
                                handleNavigate(`/classes/new/ai-poster/review/${draft.id}`)
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
                {deleteMode && drafts.length > 0 && (
                  <div className="flex justify-center pt-4">
                    <button
                      type="button"
                      onClick={handleDeleteSelected}
                      disabled={selectedIds.size === 0 || deleting}
                      className={`rounded-full px-6 py-3 text-[15px] font-bold transition-colors ${
                        selectedIds.size > 0
                          ? "bg-[#E84040] text-white active:opacity-80"
                          : "bg-gray-200 text-gray-400 cursor-not-allowed"
                      }`}
                    >
                      {deleting ? "삭제 중..." : selectedIds.size > 0 ? `삭제(${selectedIds.size})` : "삭제"}
                    </button>
                  </div>
                )}
              </div>
            )}

            {activeTab === "generated" && (
              <div className="-mx-4 flex w-[calc(100%+2rem)] flex-col gap-3">
                {requestsLoading && (
                  <div className="py-16 text-center text-[15px] text-gray-400">불러오는 중...</div>
                )}
                {!requestsLoading && generatedItems.length === 0 && (
                  <div className="py-16 text-center text-[15px] text-gray-400">
                    생성완료 항목이 없습니다
                  </div>
                )}
                {!requestsLoading && generatedItems.length > 0 && (
                  <div className="grid grid-cols-3 gap-[1px] bg-gray-200">
                    {generatedItems.map((item) => {
                      const isSelected = selectedIds.has(item.id);
                      return (
                        <button
                          key={item.id}
                          type="button"
                          onClick={() => deleteMode ? toggleSelectId(item.id) : setSelectedGeneratedItem(item)}
                          className="group relative aspect-[3/4] overflow-hidden bg-gray-100 text-left transition active:scale-[0.98]"
                        >
                          {item.generated_image_url ? (
                            <Image
                              src={item.generated_image_url}
                              alt="생성된 AI 포스터"
                              fill
                              sizes="180px"
                              unoptimized
                              className="object-cover transition-transform duration-200 group-active:scale-[1.02]"
                            />
                          ) : (
                            <div className="flex h-full w-full items-center justify-center text-[12px] font-semibold text-[#aaaaaa]">
                              이미지 없음
                            </div>
                          )}
                          {deleteMode && (
                            <div className="absolute top-2 right-2 z-10">
                              <div
                                className={`flex h-6 w-6 items-center justify-center rounded-full border-2 transition-colors ${
                                  isSelected
                                    ? "border-[#E84040] bg-[#E84040]"
                                    : "border-white/80 bg-black/20"
                                }`}
                              >
                                {isSelected && (
                                  <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
                                    <path d="M2.5 6L5 8.5L9.5 3.5" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                                  </svg>
                                )}
                              </div>
                            </div>
                          )}
                        </button>
                      );
                    })}
                    {generatedFillerCells.map((cell) => (
                      <div
                        key={cell.key}
                        aria-hidden="true"
                        className="aspect-[3/4]"
                        style={{ backgroundColor: cell.color }}
                      />
                    ))}
                  </div>
                )}
                {deleteMode && generatedItems.length > 0 && (
                  <div className="flex justify-center pt-4">
                    <button
                      type="button"
                      onClick={handleDeleteSelected}
                      disabled={selectedIds.size === 0 || deleting}
                      className={`rounded-full px-6 py-3 text-[15px] font-bold transition-colors ${
                        selectedIds.size > 0
                          ? "bg-[#E84040] text-white active:opacity-80"
                          : "bg-gray-200 text-gray-400 cursor-not-allowed"
                      }`}
                    >
                      {deleting ? "삭제 중..." : selectedIds.size > 0 ? `삭제(${selectedIds.size})` : "삭제"}
                    </button>
                  </div>
                )}
              </div>
            )}
          </main>
        )}
      </div>

      <CreditChargeSheet
        open={chargeSheetOpen}
        onClose={() => setChargeSheetOpen(false)}
        onComplete={(chargedCredits) => {
          setChargeSheetOpen(false);
          setCreditAnimated(false);
          // [임시] 서버 결제 미연동 상태이므로 프론트에서 직접 잔액 추가
          // TODO: 결제 연동 완료 후 서버에서 잔액을 가져오는 방식으로 복원
          const newBalance = (creditBalance ?? 0) + (chargedCredits ?? 0);
          setCreditBalance(newBalance);
          try { localStorage.setItem(CREDIT_CACHE_KEY, String(newBalance)); } catch {}
        }}
      />
    </div>
  );
}
