"use client";

import { useState } from "react";
import Image from "next/image";
import ImageFullscreen from "../../image-fullscreen";

interface Props {
  imageUrl: string;
}

export default function ResultImage({ imageUrl }: Props) {
  const [fullscreen, setFullscreen] = useState(false);

  return (
    <>
      <div
        className="relative mt-4 cursor-pointer overflow-hidden rounded-2xl"
        onClick={() => setFullscreen(true)}
      >
        <Image
          src={imageUrl}
          alt="AI 생성 포스터"
          width={1024}
          height={1536}
          sizes="(max-width: 520px) 100vw, 488px"
          className="w-full h-auto"
          priority
        />
      </div>
      <p className="mt-2 text-center text-sm text-[#999999]">이미지를 누르면 크게 볼 수 있어요</p>

      {fullscreen && (
        <ImageFullscreen src={imageUrl} onClose={() => setFullscreen(false)} />
      )}
    </>
  );
}
