"use client";

import { useRouter } from "next/navigation";

interface HeaderBackCircleButtonProps {
  exitAnimationClass?: string;
  exitDelayMs?: number;
  onBeforeBack?: () => void;
}

export default function HeaderBackCircleButton({
  exitAnimationClass,
  exitDelayMs = 200,
  onBeforeBack,
}: HeaderBackCircleButtonProps) {
  const router = useRouter();

  function handleBack() {
    if (!exitAnimationClass) {
      onBeforeBack?.();
      router.back();
      return;
    }

    const shell = document.querySelector("[data-page-shell]");
    if (!shell) {
      onBeforeBack?.();
      router.back();
      return;
    }

    shell.classList.add(exitAnimationClass);
    window.setTimeout(() => {
      onBeforeBack?.();
      router.back();
    }, exitDelayMs);
  }

  return (
    <button
      type="button"
      aria-label="뒤로 가기"
      onClick={handleBack}
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
  );
}
