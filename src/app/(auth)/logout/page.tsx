"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

export default function LogoutPage() {
  const router = useRouter();
  const [progress, setProgress] = useState(0);
  const [done, setDone] = useState(false);
  const intervalRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    if (navigator.userAgent.includes("XlatinApp")) {
      import("@/lib/push-notifications").then(({ removePushToken }) => {
        removePushToken();
      });
    }

    const startTime = Date.now();
    const duration = 2000;

    intervalRef.current = setInterval(() => {
      const elapsed = Date.now() - startTime;
      const pct = Math.min((elapsed / duration) * 100, 100);
      setProgress(pct);

      if (pct >= 100) {
        if (intervalRef.current) clearInterval(intervalRef.current);
        setDone(true);
      }
    }, 30);

    const supabase = createClient();
    supabase.auth.signOut().then(() => {
      localStorage.clear();
      sessionStorage.clear();
      if (intervalRef.current) clearInterval(intervalRef.current);
      setDone(true);
    });

    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, []);

  useEffect(() => {
    if (done) {
      router.replace("/login");
    }
  }, [done, router]);

  return (
    <div className="fixed inset-0 bg-white flex flex-col items-center justify-center z-[9999]">
      <p className="text-[15px] text-gray-500 mb-6">로그아웃 중...</p>
      <div className="w-48 h-1.5 bg-gray-200 rounded-full overflow-hidden">
        <div
          className="h-full bg-yellow-400 rounded-full transition-none"
          style={{ width: `${progress}%` }}
        />
      </div>
    </div>
  );
}
