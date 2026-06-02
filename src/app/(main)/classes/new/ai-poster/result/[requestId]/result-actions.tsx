"use client";

import { useState } from "react";
import ImageFullscreen from "../../image-fullscreen";

interface Props {
  imageUrl: string;
  requestId: string;
  title: string;
  rawContent: string;
}

export default function AiPosterResultActions({ imageUrl, requestId }: Props) {
  const [fullscreen, setFullscreen] = useState(false);

  async function handleDownload() {
    try {
      const res = await fetch(imageUrl);
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
      window.open(imageUrl, "_blank");
    }
  }

  function handleConfirm() {
    window.location.href = `/classes/new?ai_poster=${requestId}`;
  }

  return (
    <>
      <div className="fixed inset-x-0 bottom-0 z-40 border-t border-[#e5e7eb] bg-white px-4 py-3">
        <div className="mx-auto flex w-full max-w-[520px] gap-3">
          <button
            type="button"
            onClick={handleDownload}
            className="btn-outline flex-1 text-center"
          >
            다운로드
          </button>
          <button
            type="button"
            onClick={handleConfirm}
            className="btn-primary flex-1 text-center"
          >
            확인
          </button>
        </div>
      </div>

      {fullscreen && (
        <ImageFullscreen src={imageUrl} onClose={() => setFullscreen(false)} />
      )}
    </>
  );
}
