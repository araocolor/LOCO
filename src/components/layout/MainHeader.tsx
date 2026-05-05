"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import SearchNavButton from "@/components/layout/SearchNavButton";
import { createClient } from "@/lib/supabase/client";

export default function MainHeader() {
  const [nickname, setNickname] = useState<string>("");
  const [isLoggedIn, setIsLoggedIn] = useState(false);

  useEffect(() => {
    async function loadUser() {
      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();

      if (user) {
        setIsLoggedIn(true);
        const { data } = await supabase
          .from("profiles")
          .select("nickname")
          .eq("id", user.id)
          .single();

        if (data?.nickname) {
          setNickname(data.nickname);
        }
      }
    }

    loadUser();
  }, []);

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
        {nickname || "LOCO"}
      </div>
      <div className="ml-auto w-10 flex items-center justify-end">
        <SearchNavButton isLoggedIn={isLoggedIn} />
      </div>
    </header>
  );
}
