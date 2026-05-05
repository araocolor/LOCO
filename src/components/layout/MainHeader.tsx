"use client";

import Link from "next/link";
import SearchNavButton from "@/components/layout/SearchNavButton";
import { useAuth } from "@/lib/auth-context";

export default function MainHeader() {
  const { user } = useAuth();

  return (
    <header className="sticky top-0 z-50 bg-white border-b border-[#e5e7eb] h-14 px-4 relative flex items-center">
      <div className="w-10 flex items-center justify-start">
        <Link
          href="/classes/new?from=main-plus"
          aria-label="추가"
          className="w-10 h-10 -ml-1 flex items-center justify-center text-[20px] font-bold leading-none text-gray-900"
        >
          +
        </Link>
      </div>
      <div className="absolute left-1/2 -translate-x-1/2 font-bold text-lg text-[#808080] leading-none">
        LOCO
      </div>
      <div className="ml-auto w-10 flex items-center justify-end">
        <SearchNavButton isLoggedIn={!!user} />
      </div>
    </header>
  );
}
