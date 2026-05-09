"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import Avatar from "@/components/ui/Avatar";

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

const REFRESH_INTERVAL = 10 * 60 * 1000;
const RADIUS_KM = 30;

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
  const [myProfile, setMyProfile] = useState<{ nickname: string; profile_image_url: string | null } | null>(null);
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

  const saveLocation = useCallback(async (lat: number, lng: number) => {
    await fetch("/api/location", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ lat, lng }),
    }).catch(() => {});
  }, []);

  const fetchNearby = useCallback(async (lat: number, lng: number) => {
    const res = await fetch(`/api/location/nearby?lat=${lat}&lng=${lng}`);
    const json = await res.json();
    return (json.data ?? []) as NearbyUser[];
  }, []);

  useEffect(() => {
    try {
      const raw = localStorage.getItem("loco_mypage_cache_local_v2");
      if (raw) {
        const cache = JSON.parse(raw);
        setMyProfile({ nickname: cache.profile?.nickname ?? "", profile_image_url: cache.profile?.profile_image_url ?? null });
      }
    } catch {}
  }, []);

  useEffect(() => {
    if (phase !== "radar") return;
    playSonarPing();
    const interval = setInterval(playSonarPing, 700);
    return () => clearInterval(interval);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase]);

  useEffect(() => {
    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        const { latitude: lat, longitude: lng } = pos.coords;
        coordsRef.current = { lat, lng };
        setMyCoords({ lat, lng });
        await saveLocation(lat, lng);
        const users = await fetchNearby(lat, lng);
        setNearbyUsers(users);
        setTimeout(() => setPhase("result"), 2000);
      },
      () => setError("위치 권한을 허용해주세요.")
    );
  }, [saveLocation, fetchNearby]);

  useEffect(() => {
    const interval = setInterval(() => {
      if (!coordsRef.current) return;
      const { lat, lng } = coordsRef.current;
      saveLocation(lat, lng);
      fetchNearby(lat, lng).then(setNearbyUsers);
    }, REFRESH_INTERVAL);
    return () => clearInterval(interval);
  }, [saveLocation, fetchNearby]);

  if (error) {
    return (
      <div className="flex items-center justify-center h-64 text-sm text-gray-400">{error}</div>
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
