"use client";

import { useState } from "react";
import Image from "next/image";
import { Download } from "lucide-react";
import ImageFullscreen from "../../image-fullscreen";

interface Props {
  imageUrl: string;
  requestId: string;
}

export default function ResultImage({ imageUrl, requestId }: Props) {
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

  return (
    <>
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
          src={imageUrl}
          alt="AI 생성 포스터"
          width={1024}
          height={1536}
          sizes="(max-width: 520px) 100vw, 488px"
          className="w-full h-auto cursor-pointer"
          priority
          onClick={() => setFullscreen(true)}
        />
      </div>
      <p className="mt-2 text-center text-sm text-[#999999]">이미지를 누르면 크게 볼 수 있어요</p>

      {fullscreen && <ImageFullscreen src={imageUrl} onClose={() => setFullscreen(false)} />}
    </>
  );
}
