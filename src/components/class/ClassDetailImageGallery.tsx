"use client";

import { useEffect, useMemo, useState } from "react";

type GalleryImage = {
  card_url?: string;
  full_url?: string;
};

interface ClassDetailImageGalleryProps {
  images: GalleryImage[];
  title?: string;
}

function formatBytes(bytes: number): string {
  if (bytes >= 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  if (bytes >= 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${bytes} B`;
}

async function handleDownloadImage(url: string, title: string | undefined, index: number) {
  try {
    const res = await fetch(url);
    const blob = await res.blob();
    const blobUrl = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = blobUrl;
    const safeTitle = (title ?? "").replace(/[^가-힣]/g, "").slice(0, 15) || "클래스";
    a.download = `${safeTitle}_${String(index + 1).padStart(2, "0")}.jpg`;
    a.click();
    URL.revokeObjectURL(blobUrl);
  } catch {
    window.open(url, "_blank");
  }
}

export default function ClassDetailImageGallery({ images, title }: ClassDetailImageGalleryProps) {
  const [readyForFull, setReadyForFull] = useState(false);
  const [loadedFullMap, setLoadedFullMap] = useState<Record<string, boolean>>({});
  const [sizeMap, setSizeMap] = useState<Record<string, string>>({});

  const imageKeys = useMemo(
    () => images.map((img, index) => `${index}-${img.full_url ?? img.card_url ?? "image"}`),
    [images]
  );

  useEffect(() => {
    if (document.readyState === "complete") {
      setReadyForFull(true);
      return;
    }

    const onLoad = () => setReadyForFull(true);
    window.addEventListener("load", onLoad, { once: true });
    return () => window.removeEventListener("load", onLoad);
  }, []);

  useEffect(() => {
    if (!readyForFull) return;

    const preloaders: HTMLImageElement[] = [];

    images.forEach((img, index) => {
      const fullUrl = img.full_url;
      if (!fullUrl) return;

      const key = imageKeys[index];
      if (loadedFullMap[key]) return;

      const preloader = new window.Image();
      preloader.onload = () => {
        setLoadedFullMap((prev) => ({ ...prev, [key]: true }));
        fetch(fullUrl, { method: "HEAD" })
          .then((res) => {
            const len = res.headers.get("Content-Length");
            if (len) setSizeMap((prev) => ({ ...prev, [key]: formatBytes(Number(len)) }));
          })
          .catch(() => {});
      };
      preloader.src = fullUrl;
      preloaders.push(preloader);
    });

    return () => {
      preloaders.forEach((item) => {
        item.onload = null;
      });
    };
  }, [images, imageKeys, loadedFullMap, readyForFull]);

  return (
    <div className="flex overflow-x-auto snap-x snap-mandatory" style={{ paddingTop: 'env(safe-area-inset-top)' }}>
      {images.map((img, i) => {
        const key = imageKeys[i];
        const showFull = readyForFull && !!img.full_url && !!loadedFullMap[key];
        const src = showFull ? img.full_url : (img.card_url ?? img.full_url ?? "");

        return (
          <div key={key} className="relative flex-shrink-0 w-full snap-start">
            {sizeMap[key] && (
              <span className="absolute top-2 left-2 z-10 text-xs text-white bg-black/50 rounded px-1.5 py-0.5">
                {sizeMap[key]}
              </span>
            )}
            <button
              type="button"
              aria-label="사진 다운로드"
              className="absolute top-2 right-2 z-10 bg-black/70 rounded-full p-1.5 text-white"
              onClick={() => handleDownloadImage(src ?? "", title, i)}
            >
              <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                <polyline points="7 10 12 15 17 10" />
                <line x1="12" y1="15" x2="12" y2="3" />
              </svg>
            </button>
            <img
              src={src}
              alt={`클래스 이미지 ${i + 1}`}
              loading="eager"
              decoding="async"
              style={{ width: "100%", height: "auto", maxHeight: "70vh", objectFit: "contain" }}
              className="bg-black/5"
            />
          </div>
        );
      })}
    </div>
  );
}
