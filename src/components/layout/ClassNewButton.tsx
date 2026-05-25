"use client";

import { useRouter } from "next/navigation";

export default function ClassNewButton({ isLoggedIn }: { isLoggedIn: boolean }) {
  const router = useRouter();

  function handleClick() {
    if (!isLoggedIn) {
      router.push("/login");
    } else {
      router.push("/classes/new");
    }
  }

  return (
    <button
      type="button"
      onClick={handleClick}
      className="w-10 h-10 -ml-1 flex items-center justify-center text-gray-500 cursor-pointer"
      aria-label="클래스 등록"
    >
      <svg
        xmlns="http://www.w3.org/2000/svg"
        width="24"
        height="24"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2.4"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <path d="M12 6v12M6 12h12" />
      </svg>
    </button>
  );
}
