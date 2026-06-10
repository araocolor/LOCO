"use client";

import { useState, useCallback, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { X } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import TermsContent from "./TermsContent";

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
  const [showEmailForm, setShowEmailForm] = useState(false);
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
      {!showEmailForm ? (
        <>
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

          <button
            onClick={() => setShowEmailForm(true)}
            className="mt-14 cursor-pointer text-center font-semibold text-gray-600 rounded-full border border-gray-200 py-3 px-6"
            style={{ fontSize: "16px", width: "250px" }}
          >
            이메일 로그인
          </button>

          <p className="mt-2 text-center" style={{ color: "#999999", fontSize: "13px" }}>
            기존 이메일 계정이 있다면 직접입력하세요
          </p>
        </>
      ) : (
        <>
          {error && <p className="error-text mb-4 text-center">{error}</p>}

          <form onSubmit={handleLogin} className="flex flex-col gap-4" style={{ width: "280px" }}>
            <input
              type="email"
              className="input-field"
              style={{ fontSize: "16px", borderRadius: "9999px" }}
              placeholder="email@example.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              autoFocus
            />
            <div className="relative">
              <input
                type="password"
                className="input-field"
                style={{ fontSize: "16px", borderRadius: "9999px", paddingRight: "70px" }}
                placeholder="비밀번호"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
              />
              {password && (
                <button
                  type="submit"
                  disabled={loading}
                  className="absolute right-2 top-1/2 -translate-y-1/2 rounded-full px-3 py-1 text-sm font-semibold"
                  style={{ backgroundColor: "#facc15", color: "#111", fontSize: "13px" }}
                >
                  {loading ? "..." : "확인"}
                </button>
              )}
            </div>
          </form>

          <button
            onClick={() => { setShowEmailForm(false); setError(""); }}
            className="mt-6 text-sm text-gray-400 underline"
          >
            다른 방법으로 로그인
          </button>
        </>
      )}
    </div>
  );
}

type PolicyType = "terms" | "privacy" | null;

function PolicyDrawer({ type, onClose }: { type: PolicyType; onClose: () => void }) {
  const [slideIn, setSlideIn] = useState(false);

  useState(() => {
    requestAnimationFrame(() => setSlideIn(true));
  });

  const handleClose = useCallback(() => {
    setSlideIn(false);
    setTimeout(onClose, 300);
  }, [onClose]);

  if (!type) return null;

  const title = type === "terms" ? "서비스 약관" : "개인정보 처리방침";

  return (
    <div className="fixed inset-0 z-[100]">
      <div
        className={`absolute inset-0 bg-black/30 transition-opacity duration-300 ${slideIn ? "opacity-100" : "opacity-0"}`}
        onClick={handleClose}
      />
      <div
        className={`absolute bottom-0 left-0 right-0 max-h-[85vh] bg-white rounded-t-2xl flex flex-col transition-transform duration-300 ease-out ${slideIn ? "translate-y-0" : "translate-y-full"}`}
      >
        <header className="shrink-0 flex items-center justify-between px-5 py-4 border-b border-[#e5e7eb]">
          <h2 className="text-[18px] font-bold text-[#111111]">{title}</h2>
          <button
            type="button"
            onClick={handleClose}
            className="h-10 w-10 flex items-center justify-center text-gray-500"
          >
            <X size={22} />
          </button>
        </header>
        <div className="flex-1 overflow-y-auto px-5 py-5 text-[14px] leading-7 text-[#444444]">
          {type === "terms" ? <TermsContent /> : <PrivacyContent />}
        </div>
      </div>
    </div>
  );
}

function PrivacyContent() {
  return (
    <div className="flex flex-col gap-5">
      <section>
        <h3 className="font-bold text-[#111111] mb-1">1. 수집하는 개인정보</h3>
        <p>서비스는 회원가입 및 서비스 제공을 위해 다음 정보를 수집합니다: 이메일 주소, 닉네임, 프로필 이미지, 활동 지역. Google 로그인 시 Google 계정의 이름과 이메일을 제공받습니다.</p>
      </section>
      <section>
        <h3 className="font-bold text-[#111111] mb-1">2. 개인정보의 이용 목적</h3>
        <p>수집된 정보는 회원 식별, 클래스 등록 및 참여 관리, AI 포스터 생성, 서비스 개선 및 통계 분석에 사용됩니다.</p>
      </section>
      <section>
        <h3 className="font-bold text-[#111111] mb-1">3. 개인정보의 보유 및 파기</h3>
        <p>회원 탈퇴 시 개인정보는 즉시 파기됩니다. 단, 관련 법령에 따라 일정 기간 보관이 필요한 경우 해당 기간 동안 보관 후 파기합니다.</p>
      </section>
      <section>
        <h3 className="font-bold text-[#111111] mb-1">4. 개인정보의 제3자 제공</h3>
        <p>서비스는 회원의 동의 없이 개인정보를 제3자에게 제공하지 않습니다. 단, 법령에 의한 요청이 있는 경우 예외로 합니다.</p>
      </section>
      <section>
        <h3 className="font-bold text-[#111111] mb-1">5. 이미지 및 콘텐츠</h3>
        <p>AI 포스터 생성을 위해 업로드한 이미지는 포스터 생성 목적으로만 사용되며, 별도의 마케팅 목적으로 활용되지 않습니다.</p>
      </section>
      <section>
        <h3 className="font-bold text-[#111111] mb-1">6. 문의</h3>
        <p>개인정보 관련 문의는 아래 담당자에게 연락해주세요.<br />책임자: Han cheol<br />역할: 기술지원담당<br />연락처: jejusalsa@gmail.com</p>
      </section>
    </div>
  );
}

export default function LoginPage() {
  const [policyType, setPolicyType] = useState<PolicyType>(null);

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
        <p className="mt-8 text-center text-[13px] leading-5 text-[#bbbbbb]">
          계속하면 Xlatin의{" "}
          <button type="button" onClick={() => setPolicyType("terms")} className="underline text-[#999999]">
            서비스 약관
          </button>
          {" "}및{" "}
          <button type="button" onClick={() => setPolicyType("privacy")} className="underline text-[#999999]">
            개인정보 처리방침
          </button>
          에 동의하게 됩니다.
        </p>
      </div>

      {policyType && (
        <PolicyDrawer type={policyType} onClose={() => setPolicyType(null)} />
      )}
    </main>
  );
}
