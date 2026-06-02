"use client";

import { useState } from "react";
import Image from "next/image";
import type { AiPosterExtractedFields } from "@/types/ai-poster";
import TypingLoader from "../../typing-loader";
import ImageFullscreen from "../../image-fullscreen";

interface Props {
  requestId: string;
  initialTitle: string;
  initialExtractedFields: AiPosterExtractedFields;
  initialPromptText: string;
}

function EditableField({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string | null;
  onChange: (v: string) => void;
}) {
  if (value === null) return null;

  return (
    <div className="rounded-xl bg-[#f8f8f8] px-4 py-3">
      <p className="text-xs font-bold text-[#7a7a7a]">{label}</p>
      <input
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="mt-1 w-full border-none bg-transparent text-sm font-semibold leading-6 text-[#111111] outline-none placeholder:text-[#bbb]"
      />
    </div>
  );
}

export default function AiPosterReviewEditable({
  requestId,
  initialTitle,
  initialExtractedFields,
  initialPromptText,
}: Props) {
  const [title, setTitle] = useState(initialTitle);
  const [fields, setFields] = useState(initialExtractedFields);
  const [promptText, setPromptText] = useState(initialPromptText);
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState("");
  const [generatedImageUrl, setGeneratedImageUrl] = useState<string | null>(null);
  const [fullscreen, setFullscreen] = useState(false);

  function updateField(key: keyof AiPosterExtractedFields, value: string) {
    setFields((prev) => ({ ...prev, [key]: value }));
  }

  async function handleGenerate() {
    setGenerating(true);
    setError("");

    try {
      const res = await fetch("/api/ai-poster/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          requestId,
          promptText,
          title,
          extractedFields: fields,
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "이미지 생성에 실패했습니다.");

      setGeneratedImageUrl(data.imageUrl);
      setGenerating(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : "이미지 생성에 실패했습니다.");
      setGenerating(false);
    }
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

  if (generatedImageUrl) {
    return (
      <>
        <section className="rounded-2xl bg-white p-4 shadow-sm">
          <h2 className="text-base font-bold text-[#111111]">생성된 포스터</h2>
          <p className="mt-1 text-sm text-[#999999]">이미지를 누르면 크게 볼 수 있어요</p>
          <div
            className="relative mt-4 cursor-pointer overflow-hidden rounded-2xl"
            onClick={() => setFullscreen(true)}
          >
            <Image
              src={generatedImageUrl}
              alt="AI 생성 포스터"
              width={1024}
              height={1536}
              sizes="(max-width: 520px) 100vw, 488px"
              className="w-full h-auto"
              priority
            />
          </div>
        </section>

        <div className="fixed inset-x-0 bottom-0 z-40 border-t border-[#e5e7eb] bg-white px-4 py-3">
          <div className="mx-auto flex w-full max-w-[520px] gap-3">
            <button type="button" onClick={handleDownload} className="btn-outline flex-1 text-center">
              다운로드
            </button>
            <button type="button" onClick={handleConfirm} className="btn-primary flex-1 text-center">
              확인
            </button>
          </div>
        </div>

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
        <h2 className="text-base font-bold text-[#111111]">정리된 정보</h2>
        <div className="mt-4 space-y-3">
          <EditableField label="제목" value={title} onChange={setTitle} />
          <EditableField label="수업 소개" value={fields.summary} onChange={(v) => updateField("summary", v)} />
          <EditableField label="모집기간" value={fields.recruitDeadline} onChange={(v) => updateField("recruitDeadline", v)} />
          <EditableField label="장소" value={fields.location} onChange={(v) => updateField("location", v)} />
          <EditableField label="회비" value={fields.fee} onChange={(v) => updateField("fee", v)} />
          <EditableField label="연락처" value={fields.contact} onChange={(v) => updateField("contact", v)} />
        </div>
      </section>

      <section className="rounded-2xl bg-white p-4 shadow-sm">
        <h2 className="text-base font-bold text-[#111111]">AI에 전달될 최종 프롬프트</h2>
        <textarea
          value={promptText}
          onChange={(e) => setPromptText(e.target.value)}
          rows={12}
          className="mt-4 w-full whitespace-pre-wrap rounded-2xl bg-[#111111] px-4 py-4 text-sm leading-6 text-white outline-none resize-none"
        />
      </section>

      <div className="fixed inset-x-0 bottom-0 z-40 border-t border-[#e5e7eb] bg-white px-4 py-3">
        <div className="mx-auto flex w-full max-w-[520px] flex-col gap-2">
          {error && <p className="text-center text-sm text-red-500">{error}</p>}
          <button
            type="button"
            onClick={handleGenerate}
            disabled={generating}
            className="btn-primary w-full text-center disabled:opacity-60"
          >
            {generating ? "생성 중..." : "이미지 생성하기"}
          </button>
        </div>
      </div>
    </>
  );
}
