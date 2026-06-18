"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

export default function AuthGate() {
  const router = useRouter();
  const [progress, setProgress] = useState(0);
  const checkedRef = useRef(false);

  useEffect(() => {
    if (checkedRef.current) return;
    checkedRef.current = true;

    const startTime = Date.now();
    const duration = 3000;
    const interval = setInterval(() => {
      const elapsed = Date.now() - startTime;
      setProgress(Math.min((elapsed / duration) * 100, 95));
    }, 30);

    const supabase = createClient();
    supabase.auth.getSession().then(({ data: { session } }) => {
      clearInterval(interval);
      if (session) {
        setProgress(100);
        router.refresh();
      } else {
        router.replace("/login");
      }
    });

    return () => clearInterval(interval);
  }, [router]);

  return (
    <div className="fixed inset-0 bg-white flex flex-col items-center justify-center z-[9999]">
      <p className="text-[15px] text-gray-500 mb-6">로그인 중...</p>
      <div className="w-48 h-1.5 bg-gray-200 rounded-full overflow-hidden">
        <div
          className="h-full bg-yellow-400 rounded-full transition-none"
          style={{ width: `${progress}%` }}
        />
      </div>
    </div>
  );
}
