"use client";

interface ToastOverlayProps {
  message: string;
}

export default function ToastOverlay({ message }: ToastOverlayProps) {
  if (!message) return null;

  return (
    <div className="pointer-events-none absolute inset-0 z-[100] flex items-center justify-center">
      <div className="rounded-md bg-black/80 px-4 py-2 text-sm font-bold text-white shadow-lg">
        {message}
      </div>
    </div>
  );
}
