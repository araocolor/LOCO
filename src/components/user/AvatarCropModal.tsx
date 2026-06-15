"use client";

import { useEffect, useRef, useState } from "react";
import { X } from "lucide-react";

interface Props {
  imageSrc: string;
  onCancel: () => void;
  onConfirm: (blob: Blob, hdBlob: Blob) => void;
}

const FRAME_W = 200;
const FRAME_H = 230;
const CIRCLE = 130;
const OUTPUT = 200;
const HD_W = 400;
const HD_H = 500;
const MIN_SCALE = 1;
const MAX_SCALE = 4;

export default function AvatarCropModal({ imageSrc, onCancel, onConfirm }: Props) {
  const [img, setImg] = useState<HTMLImageElement | null>(null);
  const [scale, setScale] = useState(1);
  const [pos, setPos] = useState({ x: 0, y: 0 });
  const [busy, setBusy] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const dragRef = useRef<{ x: number; y: number; px: number; py: number } | null>(null);
  const pinchRef = useRef<{ dist: number; scale: number } | null>(null);

  useEffect(() => {
    const image = new Image();
    image.crossOrigin = "anonymous";
    image.onload = () => {
      setImg(image);
      const baseScale = Math.max(CIRCLE / image.width, CIRCLE / image.height);
      setScale(baseScale);
      setPos({ x: 0, y: 0 });
    };
    image.src = imageSrc;
  }, [imageSrc]);


  function clampPos(x: number, y: number, s: number) {
    if (!img) return { x, y };
    const w = img.width * s;
    const h = img.height * s;
    const maxX = Math.max(0, (w - CIRCLE) / 2);
    const maxY = Math.max(0, (h - CIRCLE) / 2);
    return {
      x: Math.max(-maxX, Math.min(maxX, x)),
      y: Math.max(-maxY, Math.min(maxY, y)),
    };
  }

  function onPointerDown(e: React.PointerEvent) {
    if (e.pointerType === "touch") return;
    (e.target as Element).setPointerCapture(e.pointerId);
    dragRef.current = { x: e.clientX, y: e.clientY, px: pos.x, py: pos.y };
  }
  function onPointerMove(e: React.PointerEvent) {
    if (!dragRef.current) return;
    const dx = e.clientX - dragRef.current.x;
    const dy = e.clientY - dragRef.current.y;
    setPos(clampPos(dragRef.current.px + dx, dragRef.current.py + dy, scale));
  }
  function onPointerUp() {
    dragRef.current = null;
  }

  function onWheel(e: React.WheelEvent) {
    e.preventDefault();
    if (!img) return;
    const baseScale = Math.max(CIRCLE / img.width, CIRCLE / img.height);
    const next = Math.max(
      baseScale * MIN_SCALE,
      Math.min(baseScale * MAX_SCALE, scale * (e.deltaY < 0 ? 1.1 : 0.9))
    );
    setScale(next);
    setPos(clampPos(pos.x, pos.y, next));
  }

  function onTouchStart(e: React.TouchEvent) {
    if (e.touches.length === 2) {
      const dx = e.touches[0].clientX - e.touches[1].clientX;
      const dy = e.touches[0].clientY - e.touches[1].clientY;
      pinchRef.current = { dist: Math.hypot(dx, dy), scale };
      dragRef.current = null;
    } else if (e.touches.length === 1) {
      const t = e.touches[0];
      dragRef.current = { x: t.clientX, y: t.clientY, px: pos.x, py: pos.y };
    }
  }
  function onTouchMove(e: React.TouchEvent) {
    if (!img) return;
    if (e.touches.length === 2 && pinchRef.current) {
      const dx = e.touches[0].clientX - e.touches[1].clientX;
      const dy = e.touches[0].clientY - e.touches[1].clientY;
      const dist = Math.hypot(dx, dy);
      const baseScale = Math.max(CIRCLE / img.width, CIRCLE / img.height);
      const next = Math.max(
        baseScale * MIN_SCALE,
        Math.min(baseScale * MAX_SCALE, pinchRef.current.scale * (dist / pinchRef.current.dist))
      );
      setScale(next);
      setPos((p) => clampPos(p.x, p.y, next));
    } else if (e.touches.length === 1 && dragRef.current) {
      const t = e.touches[0];
      const dx = t.clientX - dragRef.current.x;
      const dy = t.clientY - dragRef.current.y;
      setPos(clampPos(dragRef.current.px + dx, dragRef.current.py + dy, scale));
    }
  }
  function onTouchEnd(e: React.TouchEvent) {
    if (e.touches.length < 2) pinchRef.current = null;
    if (e.touches.length === 0) dragRef.current = null;
  }

  async function handleConfirm() {
    if (!img || busy) return;
    setBusy(true);
    try {
      const sw = CIRCLE / scale;
      const sh = CIRCLE / scale;
      const sx = img.width / 2 - sw / 2 - pos.x / scale;
      const sy = img.height / 2 - sh / 2 - pos.y / scale;

      const canvas = document.createElement("canvas");
      canvas.width = OUTPUT;
      canvas.height = OUTPUT;
      const ctx = canvas.getContext("2d")!;
      ctx.drawImage(img, sx, sy, sw, sh, 0, 0, OUTPUT, OUTPUT);
      const blob: Blob = await new Promise((resolve, reject) =>
        canvas.toBlob((b) => (b ? resolve(b) : reject(new Error("blob fail"))), "image/webp", 0.9)
      );

      const frameSw = FRAME_W / scale;
      const frameSh = FRAME_H / scale;
      const frameSx = img.width / 2 - frameSw / 2 - pos.x / scale;
      const frameSy = img.height / 2 - frameSh / 2 - pos.y / scale;
      const hdCanvas = document.createElement("canvas");
      hdCanvas.width = HD_W;
      hdCanvas.height = HD_H;
      const hdCtx = hdCanvas.getContext("2d")!;
      hdCtx.drawImage(img, frameSx, frameSy, frameSw, frameSh, 0, 0, HD_W, HD_H);
      const hdBlob: Blob = await new Promise((resolve, reject) =>
        hdCanvas.toBlob((b) => (b ? resolve(b) : reject(new Error("hd blob fail"))), "image/webp", 0.9)
      );

      onConfirm(blob, hdBlob);
    } finally {
      setBusy(false);
    }
  }

  if (!img) {
    return (
      <div className="fixed inset-0 z-[270] bg-black/50 flex items-center justify-center">
        <div className="text-white text-sm">이미지 로딩 중...</div>
      </div>
    );
  }

  const baseScale = Math.max(CIRCLE / img.width, CIRCLE / img.height);

  return (
    <div className="fixed inset-0 z-[270] bg-black/60 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl overflow-hidden flex flex-col" style={{ width: FRAME_W }}>
        <div className="flex items-center justify-between px-3 py-1.5 border-b">
          <span className="text-xs font-semibold">사진 편집</span>
          <button onClick={onCancel} className="p-1 hover:bg-gray-100 rounded">
            <X size={16} />
          </button>
        </div>
        <div
          ref={containerRef}
          className="relative bg-black overflow-hidden touch-none select-none"
          style={{ width: FRAME_W, height: FRAME_H }}
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
          onPointerCancel={onPointerUp}
          onWheel={onWheel}
          onTouchStart={onTouchStart}
          onTouchMove={onTouchMove}
          onTouchEnd={onTouchEnd}
        >
          <img
            src={imageSrc}
            alt=""
            draggable={false}
            style={{
              position: "absolute",
              left: "50%",
              top: "50%",
              width: img.width * scale,
              height: img.height * scale,
              transform: `translate(calc(-50% + ${pos.x}px), calc(-50% + ${pos.y}px))`,
              maxWidth: "none",
              pointerEvents: "none",
            }}
          />
          <svg
            className="absolute inset-0 pointer-events-none"
            width={FRAME_W}
            height={FRAME_H}
          >
            <defs>
              <mask id="avatar-mask">
                <rect width={FRAME_W} height={FRAME_H} fill="white" />
                <circle cx={FRAME_W / 2} cy={FRAME_H / 2} r={CIRCLE / 2} fill="black" />
              </mask>
            </defs>
            <rect
              width={FRAME_W}
              height={FRAME_H}
              fill="rgba(0,0,0,0.6)"
              mask="url(#avatar-mask)"
            />
            <circle
              cx={FRAME_W / 2}
              cy={FRAME_H / 2}
              r={CIRCLE / 2}
              fill="none"
              stroke="rgba(255,255,255,0.85)"
              strokeWidth={2}
            />
          </svg>
          <div className="absolute bottom-2 left-3 right-3 flex items-center gap-2">
            <input
              type="range"
              min={baseScale * MIN_SCALE}
              max={baseScale * MAX_SCALE}
              step={0.01}
              value={scale}
              onChange={(e) => {
                const next = parseFloat(e.target.value);
                setScale(next);
                setPos((p) => clampPos(p.x, p.y, next));
              }}
              className="flex-1 accent-yellow-400"
            />
          </div>
        </div>
        <div className="flex gap-2 justify-center p-2">
          <button
            onClick={onCancel}
            disabled={busy}
            className="px-3 py-1.5 border border-gray-300 text-gray-900 rounded-lg text-xs hover:bg-gray-50 disabled:opacity-50"
          >
            취소
          </button>
          <button
            onClick={handleConfirm}
            disabled={busy}
            className="px-3 py-1.5 bg-yellow-400 text-gray-900 font-medium rounded-lg text-xs hover:bg-yellow-500 disabled:opacity-50"
          >
            {busy ? "처리 중..." : "확인"}
          </button>
        </div>
      </div>
    </div>
  );
}
