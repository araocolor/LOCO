"use client";

import { useEffect, useMemo, useState } from "react";

type GalleryImage = {
  card_url?: string;
  full_url?: string;
};

interface ClassDetailImageGalleryProps {
  images: GalleryImage[];
}

function formatBytes(bytes: number): string {
  if (bytes >= 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  if (bytes >= 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${bytes} B`;
}

export default function ClassDetailImageGallery({ images }: ClassDetailImageGalleryProps) {
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
    <div className="flex overflow-x-auto snap-x snap-mandatory">
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
