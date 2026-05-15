"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";

const DEFAULT_PW = "loco1234";

export default function SignupPage() {
  const [email, setEmail] = useState("");
  const [nickname, setNickname] = useState("");
  const [nicknameStatus, setNicknameStatus] = useState<
    "idle" | "checking" | "ok" | "taken"
  >("idle");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  async function checkNickname(nick: string) {
    const normalizedNickname = nick.trim();
    if (!normalizedNickname || normalizedNickname.length < 2) {
      setNicknameStatus("idle");
      return;
    }
    setNicknameStatus("checking");
    const supabase = createClient();
    const { data } = await supabase
      .from("profiles")
      .select("id")
      .eq("nickname", normalizedNickname)
      .maybeSingle();
    setNicknameStatus(data ? "taken" : "ok");
  }

  async function handleSignup(e: React.FormEvent) {
    e.preventDefault();
    const trimmedNickname = nickname.trim();

    if (nicknameStatus === "taken") {
      setError("이미 사용 중인 닉네임입니다.");
      return;
    }
    if (nicknameStatus === "checking") {
      setError("닉네임 확인 중입니다. 잠시 후 다시 시도해주세요.");
      return;
    }
    if (trimmedNickname.length < 2) {
      setError("닉네임은 2자 이상이어야 합니다.");
      return;
    }

    setLoading(true);
    setError("");
    const supabase = createClient();

    const { data: nicknameOwner, error: nicknameCheckError } = await supabase
      .from("profiles")
      .select("id")
      .eq("nickname", trimmedNickname)
      .maybeSingle();

    if (nicknameCheckError) {
      setError("닉네임 확인 중 오류가 발생했습니다. 다시 시도해주세요.");
      setLoading(false);
      return;
    }

    if (nicknameOwner) {
      setNicknameStatus("taken");
      setError("이미 사용 중인 닉네임입니다.");
      setLoading(false);
      return;
    }

    const { data, error: signUpError } = await supabase.auth.signUp({
      email,
      password: DEFAULT_PW,
      options: {
        data: {
          nickname: trimmedNickname,
        },
      },
    });

    if (signUpError) {
      if (signUpError.message.includes("Database error saving new user")) {
        setError(
          "회원가입 처리 중 오류가 발생했습니다. 닉네임/이메일을 다시 확인하고 재시도해주세요."
        );
      } else {
        setError(signUpError.message);
      }
      setLoading(false);
      return;
    }

    if (data.user) {
      router.push("/onboarding");
    } else {
      // 이메일 확인이 필요한 경우
      setError(
        "가입 이메일을 확인해주세요. (Supabase 대시보드에서 이메일 확인을 비활성화하면 바로 입장 가능)"
      );
    }
    setLoading(false);
  }

  return (
    <main className="flex min-h-screen items-center justify-center p-4">
      <div className="w-full max-w-sm card p-8">
        <h1 className="text-2xl font-bold text-center mb-1">회원가입</h1>
        <p className="text-sm text-center mb-8" style={{ color: "#999999" }}>
          LOCO와 함께 댄스를 시작해요
        </p>

        <form onSubmit={handleSignup} className="flex flex-col gap-4">
          <div>
            <label className="field-label">이메일</label>
            <input
              type="email"
              className="input-field"
              placeholder="email@example.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
          </div>

          <div>
            <label className="field-label">닉네임</label>
            <input
              type="text"
              className="input-field"
              placeholder="2자 이상"
              value={nickname}
              onChange={(e) => {
                setNickname(e.target.value);
                checkNickname(e.target.value);
              }}
              required
            />
            {nicknameStatus === "checking" && (
              <p className="text-xs mt-1" style={{ color: "#999999" }}>
                확인 중...
              </p>
            )}
            {nicknameStatus === "ok" && (
              <p className="text-xs mt-1" style={{ color: "#10b981" }}>
                사용 가능한 닉네임입니다
              </p>
            )}
            {nicknameStatus === "taken" && (
              <p className="error-text">이미 사용 중인 닉네임입니다</p>
            )}
          </div>

          {error && <p className="error-text">{error}</p>}

          <button type="submit" disabled={loading} className="btn-primary mt-2">
            {loading ? "처리 중..." : "가입하기"}
          </button>
        </form>

        <p className="text-center text-sm mt-6" style={{ color: "#999999" }}>
          이미 계정이 있으신가요?{" "}
          <Link
            href="/login"
            className="font-bold underline"
            style={{ color: "#111111" }}
          >
            로그인
          </Link>
        </p>
      </div>
    </main>
  );
}
