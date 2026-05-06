"use client";

import { useState, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";

const DEFAULT_PW = "loco1234";

function LoginForm() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [kakaoLoading, setKakaoLoading] = useState(false);
  const router = useRouter();
  const searchParams = useSearchParams();
  const next = searchParams.get("next") || "/";

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError("");
    const supabase = createClient();
    const { error: authError } = await supabase.auth.signInWithPassword({
      email,
      password: password || DEFAULT_PW,
    });
    if (authError) {
      setError("이메일 또는 비밀번호가 올바르지 않습니다.");
    } else {
      router.push(next);
      router.refresh();
    }
    setLoading(false);
  }

  async function handleKakaoLogin() {
    setKakaoLoading(true);
    setError("");
    const supabase = createClient();
    const { error: authError } = await supabase.auth.signInWithOAuth({
      provider: "kakao",
      options: {
        redirectTo: `${window.location.origin}/auth/callback?next=${next}`,
        scopes: "profile_nickname profile_image",
      },
    });
    if (authError) {
      setError("카카오 로그인에 실패했습니다.");
      setKakaoLoading(false);
    }
  }

  return (
    <>
      <form onSubmit={handleLogin} className="flex flex-col gap-4">
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
            placeholder="비워두면 loco1234 자동 적용"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
        </div>
        {error && <p className="error-text">{error}</p>}
        <button type="submit" disabled={loading} className="btn-primary mt-2">
          {loading ? "로그인 중..." : "로그인"}
        </button>
      </form>

      <div className="flex items-center gap-3 my-4">
        <hr className="flex-1 border-gray-200" />
        <span className="text-xs text-gray-400">또는</span>
        <hr className="flex-1 border-gray-200" />
      </div>

      <button
        onClick={handleKakaoLogin}
        disabled={kakaoLoading}
        className="w-full flex items-center justify-center gap-2 rounded-full py-3 font-bold text-[#111111]"
        style={{ backgroundColor: "#FEE500" }}
      >
        {kakaoLoading ? "로그인 중..." : "카카오로 로그인"}
      </button>

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
          계정이 없으신가요?{" "}
          <Link href="/signup" className="font-bold underline" style={{ color: "#111111" }}>
            회원가입
          </Link>
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
          라틴 댄스 클래스 플랫폼
        </p>
        <Suspense>
          <LoginForm />
        </Suspense>
      </div>
    </main>
  );
}
