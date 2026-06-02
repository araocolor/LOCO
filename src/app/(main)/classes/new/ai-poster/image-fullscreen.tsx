"use client";

import Image from "next/image";
import { useEffect } from "react";

interface Props {
  src: string;
  alt?: string;
  onClose: () => void;
}

export default function ImageFullscreen({ src, alt = "AI 포스터", onClose }: Props) {
  useEffect(() => {
    function handleKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    document.addEventListener("keydown", handleKey);
    return () => document.removeEventListener("keydown", handleKey);
  }, [onClose]);

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center bg-black animate-fade-in"
      onClick={onClose}
    >
      <div className="relative h-full w-full" onClick={(e) => e.stopPropagation()}>
        <Image
          src={src}
          alt={alt}
          fill
          sizes="100vw"
          className="object-contain"
          priority
        />
      </div>
      <button
        type="button"
        onClick={(e) => { e.stopPropagation(); onClose(); }}
        className="absolute right-4 top-4 z-[110] flex h-11 w-11 items-center justify-center rounded-full bg-white/80 text-black shadow-lg"
        aria-label="닫기"
      >
        <svg width="22" height="22" viewBox="0 0 22 22" fill="none">
          <path d="M6 6l10 10M16 6L6 16" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" />
        </svg>
      </button>
    </div>
  );
}
