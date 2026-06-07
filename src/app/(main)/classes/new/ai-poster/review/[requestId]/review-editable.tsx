"use client";

import { useEffect, useRef, useState } from "react";
import Image from "next/image";
import { Copy, Download } from "lucide-react";
import { useRouter } from "next/navigation";
import TypingLoader from "../../typing-loader";
import ImageFullscreen from "../../image-fullscreen";

interface Props {
  requestId: string;
  initialPromptText: string;
  initialErrorMessage: string;
  initialIsGenerated: boolean;
  isGenerationBlocked: boolean;
}

export default function AiPosterReviewEditable({
  requestId,
  initialPromptText,
  initialErrorMessage,
  initialIsGenerated,
  isGenerationBlocked,
}: Props) {
  const router = useRouter();
  const [promptText, setPromptText] = useState(initialPromptText);
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState(initialErrorMessage);
  const [generatedImageUrl, setGeneratedImageUrl] = useState<string | null>(null);
  const [fullscreen, setFullscreen] = useState(false);
  const [copyToast, setCopyToast] = useState(false);
  const [isRemaking, setIsRemaking] = useState(initialIsGenerated);
  const copyTimerRef = useRef<number | null>(null);

  useEffect(() => {
    return () => {
      if (copyTimerRef.current) window.clearTimeout(copyTimerRef.current);
    };
  }, []);

  function handleBack() {
    const shell = document.querySelector("[data-page-shell]");
    if (shell) {
      shell.classList.add("page-slide-out-to-top");
      window.setTimeout(() => router.push("/?section=bookmark"), 200);
    } else {
      router.push("/?section=bookmark");
    }
  }

  async function handleGenerate() {
    if (isGenerationBlocked) return;
    setGenerating(true);
    setError("");

    try {
      const res = await fetch("/api/ai-poster/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ requestId, promptText, regenerate: isRemaking }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "이미지 생성에 실패했습니다.");

      setGeneratedImageUrl(data.imageUrl);
      setIsRemaking(false);
      setGenerating(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : "이미지 생성에 실패했습니다.");
      setGenerating(false);
    }
  }

  async function handleCopyPrompt() {
    try {
      await navigator.clipboard.writeText(promptText);
    } catch {
      const textarea = document.createElement("textarea");
      textarea.value = promptText;
      textarea.style.position = "fixed";
      textarea.style.opacity = "0";
      document.body.appendChild(textarea);
      textarea.select();
      document.execCommand("copy");
      document.body.removeChild(textarea);
    }

    setCopyToast(true);
    if (copyTimerRef.current) window.clearTimeout(copyTimerRef.current);
    copyTimerRef.current = window.setTimeout(() => {
      setCopyToast(false);
    }, 1000);
  }

  function handleConfirm() {
    window.location.href = `/classes/new?ai_poster=${requestId}`;
  }

  async function handleDownload() {
    if (!generatedImageUrl) return;
    try {
      const res = await fetch(generatedImageUrl);
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `ai-poster-${requestId}.webp`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch {
      window.open(generatedImageUrl, "_blank");
    }
  }

  function handleRemake() {
    setGeneratedImageUrl(null);
    setFullscreen(false);
    setError("");
    setIsRemaking(true);
  }

  if (generatedImageUrl) {
    return (
      <>
        <section className="rounded-2xl bg-white p-4 shadow-sm">
          <h2 className="text-base font-bold text-[#111111]">생성된 포스터</h2>
          <p className="mt-1 text-sm text-[#999999]">이미지를 누르면 크게 볼 수 있어요</p>
          <div className="relative mt-4 overflow-hidden rounded-2xl">
            <button
              type="button"
              onClick={handleDownload}
              className="absolute right-3 top-3 z-10 flex h-11 w-11 items-center justify-center rounded-full bg-black/70 text-white shadow-lg backdrop-blur transition active:scale-95"
              aria-label="AI 포스터 다운로드"
            >
              <Download size={21} strokeWidth={2.4} />
            </button>
            <Image
              src={generatedImageUrl}
              alt="AI 생성 포스터"
              width={1024}
              height={1536}
              sizes="(max-width: 520px) 100vw, 488px"
              className="w-full h-auto cursor-pointer"
              priority
              onClick={() => setFullscreen(true)}
            />
          </div>
        </section>

        <section className="rounded-2xl bg-white p-4 shadow-sm">
          <div className="flex gap-3">
            <button type="button" onClick={handleRemake} className="btn-outline flex-1 text-center">
              다시만들기
            </button>
            <button
              type="button"
              onClick={handleConfirm}
              className="btn-primary flex-1 text-center"
            >
              확인
            </button>
          </div>
        </section>

        {fullscreen && (
          <ImageFullscreen src={generatedImageUrl} onClose={() => setFullscreen(false)} />
        )}
      </>
    );
  }

  return (
    <>
      <TypingLoader active={generating} />

      <section className="rounded-2xl bg-white p-4 shadow-sm">
        <div className="relative flex items-center justify-between gap-3">
          <h2 className="text-base font-bold text-[#111111]">최종 프롬프트</h2>
          <button
            type="button"
            onClick={handleCopyPrompt}
            className="flex h-9 items-center gap-1.5 rounded-full border border-[#e5e7eb] px-3 text-sm font-bold text-[#444444] transition active:scale-[0.98]"
            aria-label="프롬프트 복사"
          >
            <Copy size={16} strokeWidth={2.4} />
            <span>복사</span>
          </button>
          {copyToast && (
            <div className="pointer-events-none absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 rounded-full bg-black/85 px-5 py-2 text-sm font-bold text-white shadow-lg">
              복사완료
            </div>
          )}
        </div>
        <textarea
          value={promptText}
          onChange={(e) => setPromptText(e.target.value)}
          className="mt-4 h-[350px] w-full resize-none overflow-y-auto whitespace-pre-wrap rounded-2xl bg-[#111111] px-4 py-4 text-sm leading-6 text-white outline-none"
        />
      </section>

      <section className="rounded-2xl bg-white p-4 shadow-sm">
        <div className="space-y-2">
          {isGenerationBlocked && (
            <div className="rounded-2xl px-4 py-3 text-center leading-6">
              <p className="text-[16px] font-bold text-[#111111]">
                포스터만들기 기능은 현재 월1회만 가능
              </p>
              <p className="mt-1 text-[15px] font-semibold text-[#888888]">
                현재 사용가능한 크레딧 0개
              </p>
            </div>
          )}
          {error && (
            <div className="rounded-2xl bg-[#fff2f2] px-4 py-3 text-center">
              <p className="text-sm font-bold leading-6 text-red-500">{error}</p>
              <p className="mt-1 text-xs font-semibold leading-5 text-[#9f4b4b]">
                위 프롬프트를 수정한 뒤 다시 생성해 주세요. 참조 이미지 문제라면 이미지를 바꿔서
                다시 시도해 주세요.
              </p>
            </div>
          )}
          {isGenerationBlocked ? (
            <div className="flex gap-3">
              <button type="button" onClick={handleBack} className="btn-outline flex-1 text-center">
                홈으로
              </button>
              <button
                type="button"
                disabled
                className="btn-primary flex-1 text-center opacity-40 cursor-not-allowed"
              >
                충전하기
              </button>
            </div>
          ) : (
            <div className="flex gap-3">
              <button
                type="button"
                onClick={handleBack}
                disabled={generating}
                className="btn-outline flex-1 text-center disabled:opacity-60"
              >
                취소
              </button>
              <button
                type="button"
                onClick={handleGenerate}
                disabled={generating}
                className="btn-primary flex-1 text-center disabled:opacity-60"
              >
                {generating ? "생성 중..." : isRemaking ? "다시 만들기" : "이미지 생성하기"}
              </button>
            </div>
          )}
        </div>
      </section>
    </>
  );
}
