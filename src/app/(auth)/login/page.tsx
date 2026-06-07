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
    <>
      <button
        onClick={handleGoogleLogin}
        disabled={googleLoading}
        className="btn-primary"
      >
        {googleLoading ? "Google 연결 중..." : "Google로 계속하기"}
      </button>

      <p className="mt-4 text-center text-xs leading-5" style={{ color: "#999999" }}>
        Google 계정으로 간편하게 시작하세요.
      </p>

      {error && <p className="error-text mt-4 text-center">{error}</p>}

      <details className="mt-6 rounded-xl border border-gray-200 p-4">
        <summary className="cursor-pointer text-center text-sm font-semibold text-gray-600">
          기존 이메일 로그인
        </summary>
        <form onSubmit={handleLogin} className="mt-4 flex flex-col gap-4">
          <div>
            <label className="field-label">이메일</label>
            <input
              type="email"
              className="input-field"
              style={{ fontSize: "16px" }}
              placeholder="email@example.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
          </div>
          <div>
            <label className="field-label">비밀번호</label>
            <input
              type="password"
              className="input-field"
              style={{ fontSize: "16px" }}
              placeholder="기존 임시 비밀번호"
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

      <div className="mt-6 relative text-sm">
        <button
          type="button"
          onClick={() => router.back()}
          className="absolute left-0 top-1/2 -translate-y-1/2"
          style={{ color: "#999999" }}
        >
          {"<"}
        </button>
        <p className="text-center" style={{ color: "#999999" }}>
          기존 이메일 계정이 있다면 아래에서 로그인하세요.
        </p>
      </div>
    </>
  );
}

export default function LoginPage() {
  return (
    <main className="flex min-h-screen items-center justify-center p-4">
      <div className="w-full max-w-sm card p-8">
        <h1 className="text-2xl font-bold text-center mb-1">LOCO</h1>
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
