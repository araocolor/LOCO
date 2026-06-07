"use client";

import { useEffect, useRef, useState } from "react";
import Image from "next/image";
import { ImagePlus, Plus, X } from "lucide-react";
import { useRouter } from "next/navigation";
import { validateAiPosterPromptInput } from "@/lib/ai-poster/prompt";

const MAX_IMAGE_COUNT = 5;
const MAX_TITLE_LENGTH = 30;
const POSTER_SOURCE_MAX_WIDTH = 800;
const POSTER_SOURCE_WEBP_QUALITY = 0.8;
const STYLE_OPTIONS = ["감성적", "강렬한", "깔끔한", "페스티발느낌"] as const;
const PERSON_FOCUS_OPTIONS = ["크게", "자연스럽게", "배경중심"] as const;
const TONE_OPTIONS = ["핑크", "빨간", "평범한", "흑백"] as const;
const RATIO_OPTIONS = ["3:4", "1:1", "4:5"] as const;

interface SelectedImageItem {
  file: File;
  previewUrl: string;
}

interface AiPosterFormProps {
  surface?: "page" | "drawer";
  onCancel?: () => void;
}

async function loadImage(file: File): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const objectUrl = URL.createObjectURL(file);
    const image = new window.Image();

    image.onload = () => {
      URL.revokeObjectURL(objectUrl);
      resolve(image);
    };
    image.onerror = () => {
      URL.revokeObjectURL(objectUrl);
      reject(new Error("이미지를 불러오지 못했습니다."));
    };

    image.src = objectUrl;
  });
}

async function canvasToWebpFile(
  canvas: HTMLCanvasElement,
  originalName: string,
  quality: number
): Promise<File> {
  const blob = await new Promise<Blob>((resolve, reject) => {
    canvas.toBlob(
      (result) => {
        if (!result) {
          reject(new Error("이미지 변환에 실패했습니다."));
          return;
        }

        resolve(result);
      },
      "image/webp",
      quality
    );
  });

  const safeName = originalName.replace(/\.[^.]+$/, "") || "poster-source";
  return new File([blob], `${safeName}.webp`, {
    type: "image/webp",
    lastModified: Date.now(),
  });
}

async function resizeImageForPosterSource(file: File): Promise<File> {
  const image = await loadImage(file);
  const targetWidth = Math.min(POSTER_SOURCE_MAX_WIDTH, image.width);
  const targetHeight = Math.round((image.height * targetWidth) / image.width);

  const canvas = document.createElement("canvas");
  canvas.width = targetWidth;
  canvas.height = targetHeight;

  const context = canvas.getContext("2d");
  if (!context) {
    throw new Error("이미지 처리에 실패했습니다.");
  }

  context.drawImage(image, 0, 0, targetWidth, targetHeight);

  return canvasToWebpFile(canvas, file.name, POSTER_SOURCE_WEBP_QUALITY);
}

export default function AiPosterForm({ surface = "page", onCancel }: AiPosterFormProps) {
  const router = useRouter();
  const isDrawerSurface = surface === "drawer";
  const inputRef = useRef<HTMLInputElement>(null);
  const previewUrlsRef = useRef<string[]>([]);
  const [selectedImages, setSelectedImages] = useState<SelectedImageItem[]>([]);
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [styleOption, setStyleOption] = useState<(typeof STYLE_OPTIONS)[number]>("감성적");
  const [personFocusOption, setPersonFocusOption] =
    useState<(typeof PERSON_FOCUS_OPTIONS)[number]>("자연스럽게");
  const [toneOption, setToneOption] = useState<(typeof TONE_OPTIONS)[number]>("평범한");
  const [posterRatio, setPosterRatio] = useState<(typeof RATIO_OPTIONS)[number]>("3:4");
  const [useRecommendedGeneration, setUseRecommendedGeneration] = useState(false);
  const [submitError, setSubmitError] = useState("");
  const [isPreparingImages, setIsPreparingImages] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    return () => {
      previewUrlsRef.current.forEach((url) => URL.revokeObjectURL(url));
    };
  }, []);

  async function handleImageChange(event: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(event.target.files ?? []);
    if (files.length === 0) return;

    const remainingCount = MAX_IMAGE_COUNT - selectedImages.length;
    event.target.value = "";

    setIsPreparingImages(true);
    setSubmitError("");

    try {
      const nextImages = await Promise.all(
        files.slice(0, remainingCount).map(async (file) => {
          if (!file.type.startsWith("image/")) {
            throw new Error("이미지 파일만 올릴 수 있습니다.");
          }

          const resizedFile = await resizeImageForPosterSource(file);
          return {
            file: resizedFile,
            previewUrl: URL.createObjectURL(resizedFile),
          };
        })
      );

      setSelectedImages((current) => {
        const updated = [...current, ...nextImages].slice(0, MAX_IMAGE_COUNT);
        previewUrlsRef.current = updated.map((item) => item.previewUrl);
        return updated;
      });
    } catch (error) {
      setSubmitError(
        error instanceof Error ? error.message : "이미지를 준비하는 중 오류가 발생했습니다."
      );
    } finally {
      setIsPreparingImages(false);
    }
  }

  function handleRemoveImage(targetUrl: string) {
    URL.revokeObjectURL(targetUrl);

    setSelectedImages((current) => {
      const updated = current.filter((item) => item.previewUrl !== targetUrl);
      previewUrlsRef.current = updated.map((item) => item.previewUrl);
      return updated;
    });
  }

  async function handleReviewPrompt() {
    if (isSubmitting || isPreparingImages) return;

    const validation = validateAiPosterPromptInput({
      title,
      content,
      sourceImageCount: selectedImages.length,
      options: {
        style: styleOption,
        personFocus: personFocusOption,
        tone: toneOption,
        ratio: posterRatio,
        useRecommendedGeneration,
      },
    });

    if (!validation.isValid) {
      setSubmitError(validation.errors[0] ?? "입력값을 다시 확인해주세요.");
      return;
    }

    setSubmitError("");
    setIsSubmitting(true);

    try {
      const formData = new FormData();
      formData.append("title", title);
      formData.append("content", content);
      formData.append("style", styleOption);
      formData.append("personFocus", personFocusOption);
      formData.append("tone", toneOption);
      formData.append("ratio", posterRatio);
      formData.append("useRecommendedGeneration", String(useRecommendedGeneration));
      selectedImages.forEach((item) => {
        formData.append("images", item.file);
      });

      const response = await fetch("/api/ai-poster/requests", {
        method: "POST",
        body: formData,
      });
      const payload = (await response.json().catch(() => null)) as {
        error?: string;
        id?: string;
      } | null;

      if (!response.ok || !payload?.id) {
        setSubmitError(payload?.error ?? "프롬프트를 정리하지 못했습니다.");
        return;
      }

      router.push(`/classes/new/ai-poster/review/${payload.id}`);
    } catch {
      setSubmitError("프롬프트를 정리하는 중 오류가 발생했습니다.");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <main
      className={isDrawerSurface ? "flex-1 overflow-y-auto px-4 pt-5 pb-28" : "px-4 pt-5 pb-28"}
    >
      <div className="mx-auto flex w-full max-w-[520px] flex-col gap-5">
        <section className="rounded-2xl bg-white p-4 shadow-sm">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-base font-bold text-[#111111]">1. 인물들 이미지</h2>
            <button
              type="button"
              onClick={() => inputRef.current?.click()}
              disabled={selectedImages.length >= MAX_IMAGE_COUNT || isPreparingImages}
              className="flex h-9 w-9 items-center justify-center rounded-full bg-[#fee500] text-[#191600] disabled:cursor-not-allowed disabled:opacity-60"
              aria-label="인물 이미지 추가"
            >
              <Plus size={20} strokeWidth={2.5} />
            </button>
          </div>

          <input
            ref={inputRef}
            type="file"
            accept="image/*"
            multiple
            className="hidden"
            onChange={handleImageChange}
          />

          {selectedImages.length > 0 ? (
            <div className="grid grid-cols-3 gap-2">
              {selectedImages.map((item, index) => (
                <div
                  key={item.previewUrl}
                  className="relative aspect-square overflow-hidden rounded-xl border border-[#e5e7eb] bg-[#f4f4f4]"
                >
                  <Image
                    src={item.previewUrl}
                    alt={`인물 이미지 미리보기 ${index + 1}`}
                    fill
                    unoptimized
                    sizes="(max-width: 520px) 33vw, 160px"
                    className="object-cover"
                  />
                  <button
                    type="button"
                    onClick={() => handleRemoveImage(item.previewUrl)}
                    className="absolute right-1.5 top-1.5 flex h-7 w-7 items-center justify-center rounded-full bg-black/70 text-white"
                    aria-label={`인물 이미지 ${index + 1} 삭제`}
                  >
                    <X size={15} strokeWidth={2.6} />
                  </button>
                </div>
              ))}

              {selectedImages.length < MAX_IMAGE_COUNT && (
                <button
                  type="button"
                  onClick={() => inputRef.current?.click()}
                  disabled={isPreparingImages}
                  className="flex aspect-square w-full flex-col items-center justify-center rounded-xl border-2 border-dashed border-[#d7d7d7] bg-[#fafafa] text-[#666666] disabled:cursor-not-allowed disabled:opacity-60"
                  aria-label="인물 이미지 추가"
                >
                  <Plus size={24} strokeWidth={2.2} />
                </button>
              )}
            </div>
          ) : (
            <button
              type="button"
              onClick={() => inputRef.current?.click()}
              disabled={isPreparingImages}
              className="flex min-h-[210px] w-full flex-col items-center justify-center rounded-xl border-2 border-dashed border-[#d7d7d7] bg-[#fafafa] text-[#666666] disabled:cursor-not-allowed disabled:opacity-60"
            >
              <ImagePlus size={34} strokeWidth={1.9} />
              <span className="mt-3 text-sm font-semibold">
                {isPreparingImages ? "이미지를 정리하고 있어요" : "사진을 최대 5장까지 올려주세요"}
              </span>
            </button>
          )}
        </section>

        <section className="rounded-2xl bg-white p-4 shadow-sm">
          <h2 className="mb-4 text-base font-bold text-[#111111]">2. 제목/내용</h2>
          <div>
            <input
              id="poster-title"
              value={title}
              onChange={(event) => setTitle(event.target.value.slice(0, MAX_TITLE_LENGTH))}
              maxLength={MAX_TITLE_LENGTH}
              className="input-field"
              placeholder={`제목은 30자 이내 (${title.length}/30)`}
            />
          </div>

          <div className="mt-5">
            <textarea
              id="poster-content"
              value={content}
              onChange={(event) => setContent(event.target.value)}
              className="input-field min-h-[180px] resize-none leading-6"
              placeholder="수업내용들 작성하세요"
            />
          </div>
        </section>

        <section className="rounded-2xl bg-white p-4 shadow-sm">
          <div className="flex items-center justify-between gap-3">
            <h2 className="text-base font-bold text-[#111111]">3. 추가옵션</h2>
            <label className="flex items-center gap-2 text-sm font-bold text-[#4d4d4d]">
              <input
                type="checkbox"
                checked={useRecommendedGeneration}
                onChange={(event) => setUseRecommendedGeneration(event.target.checked)}
                className="h-4 w-4 accent-[#fee500]"
              />
              추천생성
            </label>
          </div>

          <div className="mt-4">
            <p className="field-label">포스터 스타일</p>
            <div className="grid grid-cols-2 gap-2">
              {STYLE_OPTIONS.map((option) => (
                <button
                  key={option}
                  type="button"
                  disabled={useRecommendedGeneration}
                  onClick={() => setStyleOption(option)}
                  className={`rounded-full border px-3 py-3 text-sm font-bold transition disabled:cursor-not-allowed disabled:opacity-45 ${
                    styleOption === option
                      ? "border-[#fee500] bg-[#fee500] text-[#191600]"
                      : "border-[#e5e7eb] bg-white text-[#666666]"
                  }`}
                >
                  {option}
                </button>
              ))}
            </div>
          </div>

          <div className="mt-5">
            <p className="field-label">인물강조 선택</p>
            <div className="grid grid-cols-3 gap-2">
              {PERSON_FOCUS_OPTIONS.map((option) => (
                <button
                  key={option}
                  type="button"
                  disabled={useRecommendedGeneration}
                  onClick={() => setPersonFocusOption(option)}
                  className={`rounded-full border px-2 py-3 text-sm font-bold transition disabled:cursor-not-allowed disabled:opacity-45 ${
                    personFocusOption === option
                      ? "border-[#fee500] bg-[#fee500] text-[#191600]"
                      : "border-[#e5e7eb] bg-white text-[#666666]"
                  }`}
                >
                  {option}
                </button>
              ))}
            </div>
          </div>

          <div className="mt-5">
            <p className="field-label">톤분위</p>
            <div className="grid grid-cols-4 gap-2">
              {TONE_OPTIONS.map((option) => (
                <button
                  key={option}
                  type="button"
                  disabled={useRecommendedGeneration}
                  onClick={() => setToneOption(option)}
                  className={`rounded-full border px-2 py-3 text-sm font-bold transition disabled:cursor-not-allowed disabled:opacity-45 ${
                    toneOption === option
                      ? "border-[#fee500] bg-[#fee500] text-[#191600]"
                      : "border-[#e5e7eb] bg-white text-[#666666]"
                  }`}
                >
                  {option}
                </button>
              ))}
            </div>
          </div>
        </section>

        <section className="rounded-2xl bg-white p-4 shadow-sm">
          <h2 className="text-base font-bold text-[#111111]">4. 규격</h2>
          <div className="mt-4">
            <p className="field-label">포스터 비율</p>
            <div className="grid grid-cols-3 gap-2">
              {RATIO_OPTIONS.map((option) => (
                <button
                  key={option}
                  type="button"
                  onClick={() => setPosterRatio(option)}
                  className={`rounded-full border px-2 py-3 text-sm font-bold transition ${
                    posterRatio === option
                      ? "border-[#fee500] bg-[#fee500] text-[#191600]"
                      : "border-[#e5e7eb] bg-white text-[#666666]"
                  }`}
                >
                  {option}
                </button>
              ))}
            </div>
          </div>
        </section>
      </div>

      {submitError ? (
        <div className="mx-auto mt-4 w-full max-w-[520px] rounded-2xl bg-[#fff2f2] px-4 py-3 text-sm font-semibold text-[#c43131]">
          {submitError}
        </div>
      ) : null}

      <div
        className={
          isDrawerSurface
            ? "fixed inset-x-0 bottom-0 z-[120] border-t border-[#e5e7eb] bg-white px-4 py-3"
            : "fixed inset-x-0 bottom-0 z-40 border-t border-[#e5e7eb] bg-white px-4 py-3"
        }
      >
        <div className="mx-auto flex w-full max-w-[520px] gap-3">
          <button
            type="button"
            onClick={onCancel ?? (() => router.back())}
            disabled={isSubmitting || isPreparingImages}
            className="btn-outline flex-1 disabled:cursor-not-allowed disabled:opacity-60"
          >
            취소
          </button>
          <button
            type="button"
            onClick={handleReviewPrompt}
            disabled={isSubmitting || isPreparingImages}
            className="btn-primary flex-1 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {isPreparingImages ? "이미지 정리 중..." : isSubmitting ? "정리 중..." : "다음진행"}
          </button>
        </div>
      </div>
    </main>
  );
}
