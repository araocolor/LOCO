"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { REGIONS, GENRES } from "@/lib/constants";

const MAX_GENRES = 2;
const MAX_NICKNAME_LENGTH = 10;
const HANGUL_JAMO_REGEX = /[\u1100-\u11FF\u3130-\u318F\uA960-\uA97F\uD7B0-\uD7FF\uFFA0-\uFFDC]/;
const ALLOWED_NICKNAME_REGEX = /^[A-Za-z0-9\uAC00-\uD7A3]+$/;

function hasStandaloneHangulJamo(value: string) {
  return HANGUL_JAMO_REGEX.test(value);
}

function hasInvalidNicknameChars(value: string) {
  return !ALLOWED_NICKNAME_REGEX.test(value);
}

export default function OnboardingPage() {
  const [nickname, setNickname] = useState("");
  const [nicknameEdited, setNicknameEdited] = useState(false);
  const [nicknameStatus, setNicknameStatus] = useState<
    "idle" | "checking" | "ok" | "taken" | "invalid" | "tooLong"
  >("idle");
  const [region, setRegion] = useState("");
  const [selectedGenres, setSelectedGenres] = useState<string[]>([]);
  const [gender, setGender] = useState<"ro" | "la" | "all" | "">("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  useEffect(() => {
    async function loadProfile() {
      const supabase = createClient();
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        router.push("/login");
        return;
      }

      const nicknameFromMeta =
        typeof user.user_metadata?.name === "string"
          ? user.user_metadata.name.trim()
          : typeof user.user_metadata?.full_name === "string"
            ? user.user_metadata.full_name.trim()
            : "";

      const { data: profile } = await supabase
        .from("profiles")
        .select("nickname, region, preferred_genres, gender")
        .eq("id", user.id)
        .maybeSingle();

      if (profile?.nickname) {
        setNickname(profile.nickname);
        setNicknameStatus("idle");
      } else if (nicknameFromMeta.length >= 2) {
        setNickname(nicknameFromMeta);
        setNicknameStatus("idle");
      }
      if (profile?.region) setRegion(profile.region);
      if (Array.isArray(profile?.preferred_genres)) {
        setSelectedGenres(profile.preferred_genres);
      }
      if (profile?.gender === "ro" || profile?.gender === "la" || profile?.gender === "all") {
        setGender(profile.gender);
      }
    }

    loadProfile();
  }, [router]);

  useEffect(() => {
    if (!nicknameEdited) return;

    const normalizedNickname = nickname.trim();
    if (!normalizedNickname || normalizedNickname.length < 2) {
      setNicknameStatus("idle");
      return;
    }
    if (normalizedNickname.length > MAX_NICKNAME_LENGTH) {
      setNicknameStatus("tooLong");
      return;
    }
    if (hasStandaloneHangulJamo(normalizedNickname)) {
      setNicknameStatus("invalid");
      return;
    }
    if (hasInvalidNicknameChars(normalizedNickname)) {
      setNicknameStatus("invalid");
      return;
    }

    setNicknameStatus("checking");
    const timer = window.setTimeout(() => {
      void checkNickname(normalizedNickname);
    }, 300);

    return () => window.clearTimeout(timer);
  }, [nickname, nicknameEdited]);

  async function checkNickname(nick: string) {
    const normalizedNickname = nick.trim();
    if (!normalizedNickname || normalizedNickname.length < 2) {
      setNicknameStatus("idle");
      return;
    }
    if (normalizedNickname.length > MAX_NICKNAME_LENGTH) {
      setNicknameStatus("tooLong");
      return;
    }
    if (hasStandaloneHangulJamo(normalizedNickname)) {
      setNicknameStatus("invalid");
      return;
    }
    if (hasInvalidNicknameChars(normalizedNickname)) {
      setNicknameStatus("invalid");
      return;
    }

    setNicknameStatus("checking");
    const supabase = createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      setNicknameStatus("idle");
      router.push("/login");
      return;
    }

    const { data } = await supabase
      .from("profiles")
      .select("id")
      .eq("nickname", normalizedNickname)
      .neq("id", user.id)
      .maybeSingle();

    setNicknameStatus(data ? "taken" : "ok");
  }

  function handleNicknameChange(value: string) {
    setNicknameEdited(true);
    setNickname(value);
    setNicknameStatus("idle");
  }

  function toggleGenre(value: string) {
    setSelectedGenres((prev) => {
      if (prev.includes(value)) return prev.filter((g) => g !== value);
      if (prev.length >= MAX_GENRES) return prev;
      return [...prev, value];
    });
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const trimmedNickname = nickname.trim();

    if (trimmedNickname.length < 2) {
      setError("닉네임은 2자 이상이어야 합니다.");
      return;
    }
    if (trimmedNickname.length > MAX_NICKNAME_LENGTH || nicknameStatus === "tooLong") {
      setError("아이디는 10자 이내로 입력해주세요.");
      return;
    }
    if (hasStandaloneHangulJamo(trimmedNickname) || nicknameStatus === "invalid") {
      setError("아이디는 한글, 영어, 숫자만 사용할 수 있어요.");
      return;
    }
    if (nicknameStatus === "checking") {
      setError("닉네임 확인 중입니다. 잠시 후 다시 시도해주세요.");
      return;
    }
    if (nicknameStatus === "taken") {
      setError("이미 사용 중인 닉네임입니다.");
      return;
    }
    if (!region) {
      setError("활동지역을 선택해주세요.");
      return;
    }
    if (!gender) {
      setError("역할을 선택해주세요.");
      return;
    }
    if (selectedGenres.length === 0) {
      setError("관심 장르를 1개 이상 선택해주세요.");
      return;
    }

    setLoading(true);
    setError("");
    const supabase = createClient();

    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      setLoading(false);
      router.push("/login");
      return;
    }

    const { data: nicknameOwner, error: nicknameCheckError } = await supabase
      .from("profiles")
      .select("id")
      .eq("nickname", trimmedNickname)
      .neq("id", user.id)
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

    const { error: updateError } = await supabase
      .from("profiles")
      .update({
        nickname: trimmedNickname,
        region,
        preferred_genres: selectedGenres,
        gender,
      })
      .eq("id", user.id);

    if (updateError) {
      setError("저장 중 오류가 발생했습니다. 다시 시도해주세요.");
      setLoading(false);
      return;
    }

    const defaultFollowerRes = await fetch("/api/friends/default-follower", {
      method: "POST",
    });

    if (!defaultFollowerRes.ok) {
      setError("최종 가입 처리 중 오류가 발생했습니다. 다시 시도해주세요.");
      setLoading(false);
      return;
    }

    router.push("/");
    router.refresh();
  }

  return (
    <main className="flex min-h-screen items-center justify-center p-4">
      <div className="w-full max-w-sm card p-8">
        <div className="text-center mb-8">
          <h1 className="text-2xl font-bold mb-1">Xlatin</h1>
          <p className="text-sm" style={{ color: "#999999" }}>
            기본정보를 입력해주세요
          </p>
        </div>

        <form onSubmit={handleSubmit} className="flex flex-col gap-6">
          <div className="flex flex-col items-center">
            <label className="field-label">아이디 등록</label>
            <input
              type="text"
              className="w-full rounded-full border border-gray-200 bg-white px-5 py-3 text-center text-[16px] text-[#111111] outline-none transition focus:border-[#fee500]"
              style={{ fontSize: "16px" }}
              placeholder="2자 이상"
              maxLength={MAX_NICKNAME_LENGTH}
              value={nickname}
              onChange={(e) => handleNicknameChange(e.target.value)}
              required
            />
            <div className="mt-1 min-h-[20px] w-full text-center">
              {nicknameStatus === "checking" && (
                <p className="text-xs" style={{ color: "#999999" }}>
                  확인 중...
                </p>
              )}
              {nicknameStatus === "ok" && (
                <p className="text-xs" style={{ color: "#10b981" }}>
                  사용 가능한 닉네임입니다
                </p>
              )}
              {nicknameStatus === "taken" && (
                <p className="error-text">이미 사용 중인 닉네임입니다</p>
              )}
              {nicknameStatus === "invalid" && (
                <p className="error-text">한글, 영어, 숫자만 사용할 수 있어요</p>
              )}
              {nicknameStatus === "tooLong" && (
                <p className="error-text">10자 이내로 입력해주세요</p>
              )}
            </div>
          </div>

          {/* 활동지역 */}
          <div className="flex flex-col items-center">
            <label className="field-label">활동지역</label>
            <div className="relative w-full">
              <select
                value={region}
                onChange={(e) => setRegion(e.target.value)}
                className="w-full appearance-none rounded-full border border-gray-200 bg-white px-5 py-3 text-center text-[16px] text-[#111111] outline-none transition focus:border-[#fee500]"
                style={{ cursor: "pointer", fontSize: "16px" }}
              >
                <option value="">도시를 선택해주세요</option>
                {REGIONS.map((r) => (
                  <option key={r} value={r}>
                    {r}
                  </option>
                ))}
              </select>
              <span
                aria-hidden="true"
                className="pointer-events-none absolute right-5 top-1/2 -translate-y-1/2 text-xs text-gray-400"
              >
                v
              </span>
            </div>
          </div>
          {/* 역할 */}
          <div>
            <label className="field-label">역할</label>
            <div className="flex gap-3 mt-2">
              {([
                { value: "ro", label: "로" },
                { value: "la", label: "라" },
                { value: "all", label: "모두" },
              ] as const).map((item) => (
                <button
                  key={item.value}
                  type="button"
                  onClick={() => setGender(item.value)}
                  className={`w-[88px] rounded-full border px-4 py-2 text-[13px] transition ${
                    gender === item.value
                      ? "border-[#fee500] bg-[#fee500] text-[#191600] font-bold"
                      : "border-gray-200 bg-white text-gray-600"
                  }`}
                >
                  <input
                    type="radio"
                    name="gender"
                    value={item.value}
                    checked={gender === item.value}
                    onChange={() => setGender(item.value)}
                    className="sr-only"
                  />
                  {item.label}
                </button>
              ))}
            </div>
          </div>
          {/* 활동 장르 */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="field-label" style={{ marginBottom: 0 }}>
                활동장르
              </label>
              <span className="text-xs" style={{ color: "#999999" }}>
                {selectedGenres.length}/{MAX_GENRES} 선택
              </span>
            </div>
            <div className="flex flex-wrap gap-2 mt-2">
              {GENRES.map((g) => (
                <button
                  key={g.value}
                  type="button"
                  onClick={() => toggleGenre(g.value)}
                  className={`chip ${selectedGenres.includes(g.value) ? "active" : ""}`}
                >
                  {g.label}
                </button>
              ))}
            </div>
          </div>

          {error && <p className="error-text">{error}</p>}

          <button
            type="submit"
            disabled={loading}
            className="btn-primary"
          >
            {loading ? "저장 중..." : "시작하기"}
          </button>
        </form>
      </div>
    </main>
  );
}
