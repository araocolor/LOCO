"use client";

import { X } from "lucide-react";

interface LegalDrawerProps {
  open: boolean;
  onClose: () => void;
  title: string;
  children: React.ReactNode;
}

export default function LegalDrawer({ open, onClose, title, children }: LegalDrawerProps) {
  if (!open) return null;

  return (
    <>
      <div className="fixed inset-0 z-[70] bg-black/30" />
      <div className="fixed inset-0 z-[71] flex justify-center">
        <div className="relative w-full max-w-[500px] bg-white flex flex-col page-slide-in-from-right">
          <header className="sticky top-0 z-10 flex items-center justify-between border-b border-gray-100 bg-white px-4 py-3">
            <h1 className="text-[17px] font-bold text-gray-900">{title}</h1>
            <button
              type="button"
              onClick={onClose}
              className="flex h-9 w-9 items-center justify-center rounded-full hover:bg-gray-100"
              aria-label="닫기"
            >
              <X size={20} />
            </button>
          </header>
          <main className="flex-1 overflow-y-auto scrollbar-hide overscroll-contain px-5 py-6">
            {children}
          </main>
        </div>
      </div>
    </>
  );
}
