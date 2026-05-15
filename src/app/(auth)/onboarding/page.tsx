"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { REGIONS, GENRES } from "@/lib/constants";

const MAX_GENRES = 2;
const SOLO_GENRES = ["kizomba", "other"];

export default function OnboardingPage() {
  const [region, setRegion] = useState("");
  const [selectedGenres, setSelectedGenres] = useState<string[]>([]);
  const [gender, setGender] = useState<"로" | "라" | "">("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  function toggleGenre(value: string) {
    setSelectedGenres((prev) => {
      if (prev.includes(value)) return prev.filter((g) => g !== value);
      if (SOLO_GENRES.includes(value)) return [value];
      if (prev.some((g) => SOLO_GENRES.includes(g))) return [value];
      if (prev.length >= MAX_GENRES) return prev;
      return [...prev, value];
    });
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!region) {
      setError("활동지역을 선택해주세요.");
      return;
    }
    if (!gender) {
      setError("포지션을 선택해주세요.");
      return;
    }
    if (selectedGenres.length === 0) {
      setError("관심 장르를 1개 이상 선택해주세요.");
      return;
    }

    setLoading(true);
    const supabase = createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      setLoading(false);
      router.push("/login");
      return;
    }

    const nicknameFromMeta =
      typeof user.user_metadata?.nickname === "string"
        ? user.user_metadata.nickname.trim()
        : "";

    const profilePatch: {
      region: string;
      preferred_genres: string[];
      nickname?: string;
      gender?: string;
    } = {
      region,
      preferred_genres: selectedGenres,
      ...(gender ? { gender } : {}),
    };

    if (nicknameFromMeta.length >= 2) {
      profilePatch.nickname = nicknameFromMeta;
    }

    const { error: updateError } = await supabase
      .from("profiles")
      .update(profilePatch)
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
          <p className="text-3xl mb-3">🕺</p>
          <h1 className="text-2xl font-bold mb-1">거의 다 왔어요!</h1>
          <p className="text-sm" style={{ color: "#999999" }}>
            활동 정보를 알려주세요
          </p>
        </div>

        <form onSubmit={handleSubmit} className="flex flex-col gap-6">
          {/* 활동지역 */}
          <div>
            <label className="field-label">활동지역</label>
            <select
              value={region}
              onChange={(e) => setRegion(e.target.value)}
              className="input-field"
              style={{ cursor: "pointer" }}
            >
              <option value="">도시를 선택해주세요</option>
              {REGIONS.map((r) => (
                <option key={r} value={r}>
                  {r}
                </option>
              ))}
            </select>
          </div>
          {/* 포지션 */}
          <div>
            <label className="field-label">포지션</label>
            <div className="flex gap-6 mt-2">
              {(["로", "라"] as const).map((value) => (
                <label key={value} className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="radio"
                    name="gender"
                    value={value}
                    checked={gender === value}
                    onChange={() => setGender(value)}
                    className="h-4 w-4 accent-black"
                  />
                  <span className="text-sm font-semibold text-gray-800">{value}</span>
                </label>
              ))}
            </div>
          </div>
          {/* 관심 장르 */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="field-label" style={{ marginBottom: 0 }}>
                관심 장르
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
