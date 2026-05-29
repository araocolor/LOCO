"use client";

import { useEffect, useState } from "react";
import { X, Download, Trash2 } from "lucide-react";

export interface ImageViewerData {
  messageId: string;
  fullUrl: string;
  isMine: boolean;
}

interface ImageViewerDrawerProps {
  data: ImageViewerData | null;
  onClose: () => void;
  onDelete: (messageId: string) => void;
}

interface ImageInfo {
  width: number;
  height: number;
  sizeKB: number | null;
  type: string;
}

export default function ImageViewerDrawer({ data, onClose, onDelete }: ImageViewerDrawerProps) {
  const [info, setInfo] = useState<ImageInfo | null>(null);

  useEffect(() => {
    if (!data) { setInfo(null); return; }

    function handleKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    document.addEventListener("keydown", handleKey);

    const img = new window.Image();
    img.onload = () => {
      setInfo((prev) => ({
        width: img.naturalWidth,
        height: img.naturalHeight,
        sizeKB: prev?.sizeKB ?? null,
        type: prev?.type ?? data.fullUrl.split(".").pop()?.toUpperCase() ?? "IMAGE",
      }));
    };
    img.src = data.fullUrl;

    fetch(data.fullUrl, { method: "HEAD" })
      .then((res) => {
        const len = res.headers.get("content-length");
        const ct = res.headers.get("content-type");
        setInfo((prev) => ({
          width: prev?.width ?? 0,
          height: prev?.height ?? 0,
          sizeKB: len ? Math.round(Number(len) / 1024) : null,
          type: ct ? ct.split("/").pop()?.toUpperCase() ?? "IMAGE" : prev?.type ?? "IMAGE",
        }));
      })
      .catch(() => {});

    return () => document.removeEventListener("keydown", handleKey);
  }, [data, onClose]);

  if (!data) return null;

  function handleDownload() {
    if (!data) return;
    const a = document.createElement("a");
    a.href = data.fullUrl;
    a.download = `image_${data.messageId}.webp`;
    a.target = "_blank";
    a.rel = "noreferrer";
    a.click();
  }

  function handleDelete() {
    if (!data) return;
    onDelete(data.messageId);
    onClose();
  }

  return (
    <div className="fixed inset-0 z-[9999] flex flex-col bg-black">
      <div className="flex items-center justify-between px-4 py-3">
        <div className="flex flex-col text-white text-xs gap-0.5">
          {info && (
            <>
              <span>{info.type} · {info.width} x {info.height}</span>
              {info.sizeKB !== null && <span>{info.sizeKB} KB</span>}
            </>
          )}
        </div>
        <button
          type="button"
          onClick={onClose}
          className="flex h-10 w-10 items-center justify-center rounded-full bg-white/20 text-white"
        >
          <X size={24} />
        </button>
      </div>

      <div className="flex-1 min-h-0 flex items-center justify-center" onClick={onClose}>
        <img
          src={data.fullUrl}
          alt="사진"
          className="h-full w-full object-contain"
          onClick={(e) => e.stopPropagation()}
        />
      </div>

      <div className="flex items-center justify-between px-6 py-4">
        <button
          type="button"
          onClick={handleDownload}
          className="flex h-12 w-12 items-center justify-center rounded-full bg-white/20 text-white"
        >
          <Download size={22} />
        </button>
        {data.isMine && (
          <button
            type="button"
            onClick={handleDelete}
            className="flex h-12 w-12 items-center justify-center rounded-full bg-white/20 text-red-400"
          >
            <Trash2 size={22} />
          </button>
        )}
      </div>
    </div>
  );
}
