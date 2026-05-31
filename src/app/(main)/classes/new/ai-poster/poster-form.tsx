"use client";

import { useEffect, useRef, useState } from "react";
import Image from "next/image";
import { ImagePlus, Plus, X } from "lucide-react";
import { useRouter } from "next/navigation";

const MAX_IMAGE_COUNT = 5;
const MAX_TITLE_LENGTH = 30;
const STYLE_OPTIONS = ["감성적", "강렬한", "깔끔한", "페스티발느낌"] as const;
const PERSON_FOCUS_OPTIONS = ["크게", "자연스럽게", "배경중심"] as const;
const TONE_OPTIONS = ["핑크", "빨간", "평범한", "흑백"] as const;
const RATIO_OPTIONS = ["3:4", "1:1", "4:5"] as const;

export default function AiPosterForm() {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const previewUrlsRef = useRef<string[]>([]);
  const [previewUrls, setPreviewUrls] = useState<string[]>([]);
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [styleOption, setStyleOption] = useState<(typeof STYLE_OPTIONS)[number]>("감성적");
  const [personFocusOption, setPersonFocusOption] =
    useState<(typeof PERSON_FOCUS_OPTIONS)[number]>("자연스럽게");
  const [toneOption, setToneOption] = useState<(typeof TONE_OPTIONS)[number]>("평범한");
  const [posterRatio, setPosterRatio] = useState<(typeof RATIO_OPTIONS)[number]>("3:4");
  const [useRecommendedGeneration, setUseRecommendedGeneration] = useState(false);

  useEffect(() => {
    return () => {
      previewUrlsRef.current.forEach((url) => URL.revokeObjectURL(url));
    };
  }, []);

  function handleImageChange(event: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(event.target.files ?? []);
    if (files.length === 0) return;

    const remainingCount = MAX_IMAGE_COUNT - previewUrls.length;
    const nextUrls = files.slice(0, remainingCount).map((file) => URL.createObjectURL(file));
    setPreviewUrls((current) => {
      const updated = [...current, ...nextUrls].slice(0, MAX_IMAGE_COUNT);
      previewUrlsRef.current = updated;
      return updated;
    });
    event.target.value = "";
  }

  function handleRemoveImage(targetUrl: string) {
    URL.revokeObjectURL(targetUrl);
    setPreviewUrls((current) => {
      const updated = current.filter((url) => url !== targetUrl);
      previewUrlsRef.current = updated;
      return updated;
    });
  }

  return (
    <main className="px-4 pt-5 pb-28">
      <div className="mx-auto flex w-full max-w-[520px] flex-col gap-5">
        <section className="rounded-2xl bg-white p-4 shadow-sm">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-base font-bold text-[#111111]">1. 인물들 이미지</h2>
            <button
              type="button"
              onClick={() => inputRef.current?.click()}
              disabled={previewUrls.length >= MAX_IMAGE_COUNT}
              className="flex h-9 w-9 items-center justify-center rounded-full bg-[#fee500] text-[#191600]"
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

          {previewUrls.length > 0 ? (
            <div className="grid grid-cols-3 gap-2">
              {previewUrls.map((previewUrl, index) => (
                <div
                  key={previewUrl}
                  className="relative aspect-square overflow-hidden rounded-xl border border-[#e5e7eb] bg-[#f4f4f4]"
                >
                  <Image
                    src={previewUrl}
                    alt={`인물 이미지 미리보기 ${index + 1}`}
                    fill
                    unoptimized
                    sizes="(max-width: 520px) 33vw, 160px"
                    className="object-cover"
                  />
                  <button
                    type="button"
                    onClick={() => handleRemoveImage(previewUrl)}
                    className="absolute right-1.5 top-1.5 flex h-7 w-7 items-center justify-center rounded-full bg-black/70 text-white"
                    aria-label={`인물 이미지 ${index + 1} 삭제`}
                  >
                    <X size={15} strokeWidth={2.6} />
                  </button>
                </div>
              ))}

              {previewUrls.length < MAX_IMAGE_COUNT && (
                <button
                  type="button"
                  onClick={() => inputRef.current?.click()}
                  className="flex aspect-square w-full flex-col items-center justify-center rounded-xl border-2 border-dashed border-[#d7d7d7] bg-[#fafafa] text-[#666666]"
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
              className="flex min-h-[210px] w-full flex-col items-center justify-center rounded-xl border-2 border-dashed border-[#d7d7d7] bg-[#fafafa] text-[#666666]"
            >
              <ImagePlus size={34} strokeWidth={1.9} />
              <span className="mt-3 text-sm font-semibold">사진을 최대 5장까지 올려주세요</span>
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

      <div className="fixed inset-x-0 bottom-0 z-40 border-t border-[#e5e7eb] bg-white px-4 py-3">
        <div className="mx-auto flex w-full max-w-[520px] gap-3">
          <button type="button" onClick={() => router.back()} className="btn-outline flex-1">
            취소
          </button>
          <button type="button" className="btn-primary flex-1">
            포스터만들기
          </button>
        </div>
      </div>
    </main>
  );
}
