"use client";

import { useState, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

function getSafeNextPath(next: string | null) {
  if (!next || !next.startsWith("/") || next.startsWith("//")) return "/";
  return next;
}

function LoginForm() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);
  const router = useRouter();
  const searchParams = useSearchParams();
  const nextPath = getSafeNextPath(searchParams.get("next"));

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError("");
    const supabase = createClient();
    const { error: authError } = await supabase.auth.signInWithPassword({
      email,
      password,
    });
    if (authError) {
      setError("이메일 또는 비밀번호가 올바르지 않습니다.");
    } else {
      router.push(nextPath);
      router.refresh();
    }
    setLoading(false);
  }

  async function handleGoogleLogin() {
    setGoogleLoading(true);
    setError("");
    const supabase = createClient();
    const { error: authError } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: {
        redirectTo: `${window.location.origin}/auth/callback?next=${encodeURIComponent(nextPath)}`,
        scopes: "email profile",
        queryParams: {
          prompt: "select_account",
        },
      },
    });
    if (authError) {
      setError("Google 로그인에 실패했습니다. 잠시 후 다시 시도해주세요.");
      setGoogleLoading(false);
    }
  }

  return (
    <div className="flex flex-col items-center">
      <button
        onClick={handleGoogleLogin}
        disabled={googleLoading}
        className="btn-primary"
        style={{ fontSize: "16px", width: "250px" }}
      >
        {googleLoading ? "Google 연결 중..." : "Google로 계속하기"}
      </button>

      <p className="mt-2 text-center leading-5" style={{ color: "#999999", fontSize: "13px" }}>
        Google 계정으로 간편하게 시작하세요.
      </p>

      {error && <p className="error-text mt-4 text-center">{error}</p>}

      <details className="mt-14 p-4" style={{ width: "280px" }}>
        <summary className="cursor-pointer text-center font-semibold text-gray-600 rounded-full border border-gray-200 py-3 px-6" style={{ fontSize: "16px", listStyle: "none" }}>
          이메일 로그인
        </summary>
        <form onSubmit={handleLogin} className="mt-4 flex flex-col gap-4">
          <div>
            <input
              type="email"
              className="input-field"
              style={{ fontSize: "16px", borderRadius: "9999px" }}
              placeholder="email@example.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
          </div>
          <div>
            <input
              type="password"
              className="input-field"
              style={{ fontSize: "16px", borderRadius: "9999px" }}
              placeholder="비밀번호"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
            />
          </div>
          <button type="submit" disabled={loading} className="btn-outline w-full">
            {loading ? "로그인 중..." : "이메일로 로그인"}
          </button>
        </form>
      </details>

      <p className="-mt-4 text-center" style={{ color: "#999999", fontSize: "13px" }}>
        기존 이메일 계정이 있다면 직접입력하세요
      </p>
    </div>
  );
}

export default function LoginPage() {
  return (
    <main className="relative flex min-h-screen items-center justify-center p-4">
      <button
        type="button"
        onClick={() => window.history.back()}
        className="absolute top-4 left-4 flex items-center justify-center rounded-full border border-gray-300"
        style={{ width: "44px", height: "44px", color: "#999999", fontSize: "18px" }}
      >
        {"<"}
      </button>
      <div className="w-full max-w-sm rounded-2xl bg-white p-8">
        <h1 className="font-bold text-center mb-1" style={{ fontSize: "30px" }}>Xlatin</h1>
        <p className="text-sm text-center mb-8" style={{ color: "#999999" }}>
          AI 포스터 생성 플랫폼
        </p>
        <Suspense>
          <LoginForm />
        </Suspense>
      </div>
    </main>
  );
}
