"use client";

import { useEffect, useState } from "react";
import HeaderBackCircleButton from "@/components/layout/HeaderBackCircleButton";

interface ClassHeaderProps {
  backExitAnimationClass?: string;
  backExitDelayMs?: number;
  title?: string;
  className?: string;
  hideBackButton?: boolean;
  onBack?: () => void;
}

export default function ClassHeader({
  backExitAnimationClass,
  backExitDelayMs,
  title = "클래스 정복",
  className = "h-14",
  hideBackButton = false,
  onBack,
}: ClassHeaderProps) {
  const [notice, setNotice] = useState("");

  useEffect(() => {
    function handleNotice(event: Event) {
      const customEvent = event as CustomEvent<{ message?: string }>;
      setNotice(customEvent.detail?.message ?? "");
    }

    window.addEventListener("class-header-notice", handleNotice);
    return () => {
      window.removeEventListener("class-header-notice", handleNotice);
    };
  }, []);

  return (
    <header className={`sticky top-0 z-50 bg-white px-4 relative flex items-center ${className}`}>
      <div className="w-10 flex items-center justify-start">
        {!hideBackButton && (
          onBack ? (
            <button
              type="button"
              aria-label="뒤로 가기"
              onClick={onBack}
              className="w-10 h-10 -ml-1 flex items-center justify-center text-gray-500"
            >
              <svg
                xmlns="http://www.w3.org/2000/svg"
                width="18"
                height="18"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="3"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <path d="m15 18-6-6 6-6" />
              </svg>
            </button>
          ) : (
            <HeaderBackCircleButton
              exitAnimationClass={backExitAnimationClass}
              exitDelayMs={backExitDelayMs}
            />
          )
        )}
      </div>
      <div className="absolute left-1/2 -translate-x-1/2 font-bold text-xl text-[#4d4d4d] leading-none">
        {title}
      </div>
      {notice && (
        <div className="absolute left-0 right-0 top-[45px] px-4 text-center text-xs font-semibold text-red-500">
          {notice}
        </div>
      )}
      <div className="ml-auto w-10" />
    </header>
  );
}
