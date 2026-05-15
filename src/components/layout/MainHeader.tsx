"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Bookmark, Shell } from "lucide-react";
import SearchNavButton from "@/components/layout/SearchNavButton";
import { useAuth } from "@/lib/auth-context";

export default function MainHeader() {
  const { user } = useAuth();
  const router = useRouter();
  const searchParams = useSearchParams();
  const isBookmarkMode = searchParams.get("bookmark") === "true";

  return (
    <header className="sticky top-0 z-50 bg-white border-b border-[#e5e7eb] h-14 px-4 relative flex items-center">
      <div className="flex items-center gap-1">
        <SearchNavButton isLoggedIn={!!user} />
        {user && (
          <button
            type="button"
            aria-label="북마크"
            onClick={() => router.push(isBookmarkMode ? "/" : "/?bookmark=true")}
            className="w-10 h-10 flex items-center justify-center"
          >
            <Bookmark
              size={21}
              strokeWidth={2.5}
              fill={isBookmarkMode ? "#FEE500" : "none"}
              className={isBookmarkMode ? "text-[#FEE500]" : "text-gray-700"}
            />
          </button>
        )}
      </div>
      <div className="absolute left-1/2 -translate-x-1/2">
        <Shell size={31} className="text-[#808080]" />
      </div>
      <div className="ml-auto w-10 flex items-center justify-end">
        <Link
          href="/classes/new?from=main-plus"
          aria-label="추가"
          className="w-10 h-10 -mr-1 flex items-center justify-center text-[20px] font-bold leading-none text-gray-900"
        >
          +
        </Link>
      </div>
    </header>
  );
}
