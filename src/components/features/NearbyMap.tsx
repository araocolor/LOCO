"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import Avatar from "@/components/ui/Avatar";
import { readFreshLocationSession, saveLocationIfSessionExpired } from "@/lib/location-session";

interface NearbyUser {
  id: string;
  lat: number;
  lng: number;
  nickname: string;
  profile_image_url: string | null;
}

interface MenuTarget {
  user: NearbyUser;
  x: number;
  y: number;
}

interface NearbyDebug {
  serverNowUtc: string;
  serverNowKst: string;
  staleThresholdUtc: string;
  staleThresholdKst: string;
  staleMinutes: number;
  radiusKm: number;
  candidateCount: number;
  freshCount: number;
  nearbyCount: number;
  staleCount: number;
  outsideRadiusCount: number;
  likelyReason: string;
}

interface ApiError {
  message?: string;
  code?: string | null;
  details?: string | null;
  hint?: string | null;
}

const REFRESH_INTERVAL = 10 * 60 * 1000;
const RADIUS_KM = 30;

function getApiErrorMessage(error: ApiError | undefined, fallback: string) {
  if (!error) return fallback;
  return [error.message, error.code ? `code: ${error.code}` : null, error.details, error.hint]
    .filter(Boolean)
    .join(" / ");
}

function toRadarPosition(myLat: number, myLng: number, userLat: number, userLng: number, radarRadius: number) {
  const dLat = (userLat - myLat) * 111;
  const dLng = (userLng - myLng) * 111 * Math.cos((myLat * Math.PI) / 180);
  const dist = Math.sqrt(dLat ** 2 + dLng ** 2);
  const scale = Math.min(dist / RADIUS_KM, 0.95);
  const angle = Math.atan2(dLng, dLat);
  return {
    x: Math.sin(angle) * scale * radarRadius,
    y: -Math.cos(angle) * scale * radarRadius,
  };
}

export default function NearbyMap() {
  const router = useRouter();
  const radarRef = useRef<HTMLDivElement>(null);
  const [phase, setPhase] = useState<"radar" | "result">("radar");
  const [error, setError] = useState<string | null>(null);
  const [nearbyUsers, setNearbyUsers] = useState<NearbyUser[]>([]);
  const [myCoords, setMyCoords] = useState<{ lat: number; lng: number } | null>(null);
  const [menuTarget, setMenuTarget] = useState<MenuTarget | null>(null);
  const [myProfile] = useState<{ nickname: string; profile_image_url: string | null } | null>(() => {
    try {
      const raw = localStorage.getItem("loco_mypage_cache_local_v2");
      if (!raw) return null;
      const cache = JSON.parse(raw);
      return { nickname: cache.profile?.nickname ?? "", profile_image_url: cache.profile?.profile_image_url ?? null };
    } catch {
      return null;
    }
  });
  const [debugInfo, setDebugInfo] = useState<NearbyDebug | null>(null);
  const coordsRef = useRef<{ lat: number; lng: number } | null>(null);
  const audioCtxRef = useRef<AudioContext | null>(null);

  function playSonarPing() {
    try {
      if (!audioCtxRef.current) {
        audioCtxRef.current = new AudioContext();
      }
      const ctx = audioCtxRef.current;
      const now = ctx.currentTime;

      // 주파수가 내려가는 소나 핑
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain);
      gain.connect(ctx.destination);

      osc.type = "sine";
      osc.frequency.setValueAtTime(1000, now);
      osc.frequency.exponentialRampToValueAtTime(980, now + 2.0);

      gain.gain.setValueAtTime(0.0, now);
      gain.gain.linearRampToValueAtTime(0.12, now + 0.01);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 2.0);

      osc.start(now);
      osc.stop(now + 2.0);
    } catch {}
  }

  const fetchNearby = useCallback(async (lat: number, lng: number) => {
    const res = await fetch(`/api/location/nearby?lat=${lat}&lng=${lng}`);
    const json = await res.json().catch(() => null) as { data?: NearbyUser[]; debug?: NearbyDebug; error?: ApiError } | null;
    if (!res.ok || json?.error) {
      throw new Error(getApiErrorMessage(json?.error, "주변 회원 조회에 실패했습니다."));
    }
    return { users: (json?.data ?? []) as NearbyUser[], debug: json?.debug ?? null };
  }, []);

  useEffect(() => {
    if (phase !== "radar") return;
    playSonarPing();
    const interval = setInterval(playSonarPing, 700);
    return () => clearInterval(interval);
  }, [phase]);

  useEffect(() => {
    const freshSession = readFreshLocationSession();
    if (freshSession) {
      const { lat, lng } = freshSession;
      coordsRef.current = { lat, lng };
      queueMicrotask(() => setMyCoords({ lat, lng }));
      fetchNearby(lat, lng)
        .then((result) => {
          setNearbyUsers(result.users);
          setDebugInfo(result.debug);
          setError(null);
          setTimeout(() => setPhase("result"), 2000);
        })
        .catch((err) => setError(err instanceof Error ? err.message : "주변 회원 조회 중 오류가 발생했습니다."));
      return;
    }

    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        const { latitude: lat, longitude: lng } = pos.coords;
        coordsRef.current = { lat, lng };
        setMyCoords({ lat, lng });
        try {
          await saveLocationIfSessionExpired(lat, lng);
          const result = await fetchNearby(lat, lng);
          setNearbyUsers(result.users);
          setDebugInfo(result.debug);
          setError(null);
          setTimeout(() => setPhase("result"), 2000);
        } catch (err) {
          setError(err instanceof Error ? err.message : "위치 처리 중 오류가 발생했습니다.");
        }
      },
      () => setError("위치 권한을 허용해주세요.")
    );
  }, [fetchNearby]);

  useEffect(() => {
    const interval = setInterval(() => {
      if (!coordsRef.current) return;
      const { lat, lng } = coordsRef.current;
      saveLocationIfSessionExpired(lat, lng)
        .then(() => fetchNearby(lat, lng))
        .then((result) => {
          setNearbyUsers(result.users);
          setDebugInfo(result.debug);
          setError(null);
        })
        .catch((err) => setError(err instanceof Error ? err.message : "위치 새로고침 중 오류가 발생했습니다."));
    }, REFRESH_INTERVAL);
    return () => clearInterval(interval);
  }, [fetchNearby]);

  if (error) {
    return (
      <div className="flex items-center justify-center h-64 px-6 text-sm text-red-500 text-center whitespace-pre-wrap">{error}</div>
    );
  }

  const radarRadius = 130;

  return (
    <div className="relative w-full bg-white flex flex-col items-center" style={{ height: "calc(100vh - 160px)" }}>

      {/* 레이더 */}
      <div ref={radarRef} className="relative flex items-center justify-center mt-16" style={{ width: radarRadius * 2, height: radarRadius * 2 }}>
        {/* 레이더 원 */}
        {[1, 0.66, 0.33].map((scale, i) => (
          <div
            key={i}
            className="absolute rounded-full border border-gray-200"
            style={{ width: radarRadius * 2 * scale, height: radarRadius * 2 * scale }}
          />
        ))}

        {/* 물결 파동 애니메이션 */}
        {phase === "radar" && [0, 0.5, 1].map((delay, i) => (
          <div
            key={i}
            className="absolute rounded-full"
            style={{
              width: radarRadius * 2,
              height: radarRadius * 2,
              border: "2px solid #9ca3af",
              animation: `ripple 2s ease-out ${delay}s infinite`,
            }}
          />
        ))}

        {/* 내 위치 */}
        {phase === "result" && (
          <div
            className="absolute z-10"
            style={{
              top: "50%", left: "50%",
              width: 50, height: 50,
              animation: "fadeInScale 1s ease-out forwards",
            }}
          >
            <div className="rounded-full border-2 border-black overflow-hidden w-full h-full">
              <Avatar src={myProfile?.profile_image_url ?? null} nickname={myProfile?.nickname ?? "me"} size={50} />
            </div>
          </div>
        )}

        {/* 회원 아바타 */}
        {phase === "result" && myCoords && nearbyUsers.map((u) => {
          const pos = toRadarPosition(myCoords.lat, myCoords.lng, u.lat, u.lng, radarRadius);
          return (
            <button
              key={u.id}
              className="absolute z-20"
              style={{ transform: `translate(${pos.x - 18}px, ${pos.y - 18}px)` }}
              onClick={(e) => {
                const rect = e.currentTarget.getBoundingClientRect();
                setMenuTarget({ user: u, x: rect.left, y: rect.bottom });
              }}
            >
              <div className="rounded-full border-2 border-[#FEE500] overflow-hidden" style={{ width: 36, height: 36 }}>
                <Avatar src={u.profile_image_url} nickname={u.nickname} size={36} />
              </div>
            </button>
          );
        })}
      </div>

      {/* 결과 텍스트 */}
      <div className="mt-8 text-sm text-gray-500">
        {phase === "radar"
          ? "주변 회원을 탐색 중..."
          : nearbyUsers.length > 0
          ? `반경 ${RADIUS_KM}km 내 회원 ${nearbyUsers.length}명 발견`
          : `반경 ${RADIUS_KM}km 내 회원이 없습니다`}
      </div>

      {phase === "result" && debugInfo && (
        <div
          className="mt-3 mx-4 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-900 leading-5"
          style={{ width: "min(calc(100% - 32px), 360px)" }}
        >
          <p className="font-semibold">진단 정보</p>
          <p>현재 서버시각: {debugInfo.serverNowKst}</p>
          <p>조회 기준: {debugInfo.staleMinutes}분 이내, 반경 {debugInfo.radiusKm}km</p>
          <p>후보 {debugInfo.candidateCount}명 / 최근 {debugInfo.freshCount}명 / 반경 내 {debugInfo.nearbyCount}명</p>
          <p>{debugInfo.likelyReason}</p>
        </div>
      )}

      {/* 아바타 클릭 메뉴 */}
      {menuTarget && (
        <>
          <div className="fixed inset-0 z-[70]" onClick={() => setMenuTarget(null)} />
          <div
            className="fixed z-[80] bg-white rounded-xl shadow-lg border border-gray-100 overflow-hidden"
            style={{ width: 180, top: menuTarget.y + 8, left: menuTarget.x }}
          >
            <div className="flex items-center gap-3 px-4 py-3 border-b border-gray-100">
              <Avatar src={menuTarget.user.profile_image_url} nickname={menuTarget.user.nickname} size={32} />
              <span className="font-semibold text-gray-900 truncate" style={{ fontSize: 15 }}>{menuTarget.user.nickname}</span>
            </div>
            <button
              className="flex items-center w-full px-4 py-3 text-gray-700"
              style={{ fontSize: 15 }}
              onClick={() => { setMenuTarget(null); router.push(`/users/${menuTarget.user.id}/view`); }}
            >
              프로필 보기
            </button>
          </div>
        </>
      )}
    </div>
  );
}
