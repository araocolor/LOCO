"use client";

import { useRouter } from "next/navigation";

export default function SearchCloseButton() {
  const router = useRouter();

  function handleClose() {
    const shell = document.querySelector(".search-page-shell");
    shell?.classList.add("search-slide-out");

    window.setTimeout(() => {
      if (window.history.length > 1) router.back();
      else router.push("/search");
    }, 180);
  }

  return (
    <button
      type="button"
      onClick={handleClose}
      data-search-close="true"
      className="w-10 h-10 -ml-1 flex items-center justify-center text-[17px] font-bold leading-none text-gray-700 cursor-pointer"
      aria-label="닫기"
    >
      X
    </button>
  );
}
