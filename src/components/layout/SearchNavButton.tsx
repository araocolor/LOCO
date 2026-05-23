"use client";

export default function SearchNavButton({ isLoggedIn }: { isLoggedIn: boolean }) {
  void isLoggedIn;

  function handleClick() {
    window.dispatchEvent(new CustomEvent("open-search-sheet"));
  }

  return (
    <button
      type="button"
      onClick={handleClick}
      className="w-14 h-14 -mr-2 flex items-center justify-center text-gray-700 cursor-pointer"
      aria-label="검색"
    >
      <svg
        xmlns="http://www.w3.org/2000/svg"
        width="22"
        height="22"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <circle cx="11" cy="11" r="8" />
        <path d="m21 21-4.3-4.3" />
      </svg>
    </button>
  );
}
