"use client";

import { Suspense, useState } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";

function SignupForm() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function handleGoogleSignup() {
    setLoading(true);
    setError("");

    const supabase = createClient();
    const { error: authError } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: {
        redirectTo: `${window.location.origin}/auth/callback?next=${encodeURIComponent("/")}`,
        scopes: "email profile",
        queryParams: {
          prompt: "select_account",
        },
      },
    });

    if (authError) {
      setError("Google 가입 연결에 실패했습니다. 잠시 후 다시 시도해주세요.");
      setLoading(false);
    }
  }

  return (
    <>
      <button onClick={handleGoogleSignup} disabled={loading} className="btn-primary gap-3">
        <span className="flex h-6 w-6 items-center justify-center rounded-full bg-white text-sm font-black text-[#4285f4]">
          G
        </span>
        {loading ? "Google 연결 중..." : "Google로 가입하기"}
      </button>

      <p className="mt-4 text-center text-xs leading-5" style={{ color: "#999999" }}>
        가입 후 닉네임과 활동 정보를 한 번만 입력합니다.
      </p>

      {error && <p className="error-text mt-4 text-center">{error}</p>}

      <p className="text-center text-sm mt-6" style={{ color: "#999999" }}>
        이미 계정이 있으신가요?{" "}
        <Link href="/login" className="font-bold underline" style={{ color: "#111111" }}>
          로그인
        </Link>
      </p>
    </>
  );
}

export default function SignupPage() {
  return (
    <main className="flex min-h-screen items-center justify-center p-4">
      <div className="w-full max-w-sm card p-8">
        <h1 className="text-2xl font-bold text-center mb-1">LOCO 시작하기</h1>
        <p className="text-sm text-center mb-8" style={{ color: "#999999" }}>
          Google 계정으로 안전하게 가입하세요
        </p>
        <Suspense>
          <SignupForm />
        </Suspense>
      </div>
    </main>
  );
}
