"use client";

import { useEffect, useRef, useState } from "react";

interface CommentSheetProps {
  open: boolean;
  onClose: () => void;
  classId: string;
}

export default function CommentSheet({ open, onClose, classId }: CommentSheetProps) {
  const [visible, setVisible] = useState(false);
  const [animated, setAnimated] = useState(false);
  const [input, setInput] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (open) {
      setVisible(true);
      document.body.style.overflow = "hidden";
      requestAnimationFrame(() => requestAnimationFrame(() => setAnimated(true)));
    } else {
      setAnimated(false);
      document.body.style.overflow = "";
      const t = setTimeout(() => setVisible(false), 350);
      return () => clearTimeout(t);
    }
    return () => { document.body.style.overflow = ""; };
  }, [open]);

  if (!visible) return null;

  return (
    <div className="fixed inset-0 z-[60] flex flex-col justify-end">
      {/* 배경 */}
      <div
        className="absolute inset-0 bg-black/40 transition-opacity duration-300"
        style={{ opacity: animated ? 1 : 0 }}
        onClick={onClose}
      />

      {/* 시트 */}
      <div
        className="relative bg-white rounded-t-2xl flex flex-col transition-transform duration-350 ease-out"
        style={{
          height: "50dvh",
          transform: animated ? "translateY(0)" : "translateY(100%)",
          transition: "transform 0.35s cubic-bezier(0.25, 0.46, 0.45, 0.94)",
        }}
      >
        {/* 핸들 */}
        <button
          onClick={onClose}
          className="flex justify-center pt-3 pb-1 w-full"
          aria-label="닫기"
        >
          <div className="w-10 h-1 rounded-full bg-gray-300" />
        </button>

        {/* 제목 */}
        <div className="px-4 pb-3">
          <button onClick={onClose} className="flex items-center gap-1 text-gray-800 font-semibold text-base">
            <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="15 18 9 12 15 6"/>
            </svg>
            댓글
          </button>
        </div>
        <div className="border-t border-gray-100" />

        {/* 댓글 영역 */}
        <div className="flex-1 overflow-y-auto px-4 py-4">
          <p className="text-sm text-gray-400 text-center mt-8">아직 댓글이 없습니다.</p>
        </div>

        {/* 풋터 */}
        <div className="border-t border-gray-100 px-4 py-3 pb-6 flex justify-center">
          <div className="flex gap-2 w-[90%]">
            <input
              ref={inputRef}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="댓글을 입력하세요"
              className="flex-1 text-[16px] border border-gray-200 rounded-xl px-3 py-2 outline-none focus:border-gray-400"
            />
            <button
              className="text-sm font-semibold px-4 py-2 rounded-xl bg-gray-900 text-white flex-shrink-0"
              onClick={() => setInput("")}
            >
              등록
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
