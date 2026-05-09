"use client";

import { useEffect, useRef, useState, useCallback, useMemo } from "react";
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
  left: number;
  top: number;
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
const RADAR_RADIUS = 130;
const AVATAR_SIZE = 40;
const AVATAR_SIZE_WHEN_SPARSE = 50;
const SPARSE_USER_THRESHOLD = 20;
const TOP_SAFE_GAP = 20;
const BOTTOM_SAFE_GAP = 20;
const MAX_VISIBLE_USERS = 50;

function getApiErrorMessage(error: ApiError | undefined, fallback: string) {
  if (!error) return fallback;
  return [error.message, error.code ? `code: ${error.code}` : null, error.details, error.hint]
    .filter(Boolean)
    .join(" / ");
}

function hashString(input: string) {
  let hash = 2166136261;
  for (let i = 0; i < input.length; i += 1) {
    hash ^= input.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

function makePrng(seed: number) {
  let t = seed || 1;
  return () => {
    t += 0x6d2b79f5;
    let v = Math.imul(t ^ (t >>> 15), t | 1);
    v ^= v + Math.imul(v ^ (v >>> 7), v | 61);
    return ((v ^ (v >>> 14)) >>> 0) / 4294967296;
  };
}

function buildRandomNearbyPositions(
  count: number,
  areaWidth: number,
  areaHeight: number,
  seedKey: string,
  avatarSize: number
) {
  const positions: { x: number; y: number }[] = [];
  if (areaWidth <= 0 || areaHeight <= 0) return positions;

  const avatarRadius = avatarSize / 2;
  const minGap = avatarSize - 2;
  const centerClearRadius = avatarSize + avatarRadius + 10;
  const maxX = Math.max(1, areaWidth / 2 - avatarRadius - 4);
  const maxYUp = Math.max(1, areaHeight / 2 - avatarRadius - 4 - TOP_SAFE_GAP);
  const maxYDown = Math.max(1, areaHeight / 2 - avatarRadius - 4 - BOTTOM_SAFE_GAP);
  const maxYSymmetric = Math.max(1, Math.min(maxYUp, maxYDown));
  const maxRadial = Math.max(1, Math.min(maxX, maxYSymmetric));
  const ringStep = avatarSize + 2;
  const rand = makePrng(hashString(seedKey));
  const yMin = -maxYUp;
  const yMax = maxYDown;

  const canPlace = (x: number, y: number) => {
    if (Math.abs(x) > maxX || y < yMin || y > yMax) return false;
    if (Math.sqrt(x * x + y * y) < centerClearRadius) return false;
    return !positions.some((p) => {
      const dx = p.x - x;
      const dy = p.y - y;
      return Math.sqrt(dx * dx + dy * dy) < minGap;
    });
  };

  const pushIfValid = (x: number, y: number) => {
    if (!canPlace(x, y)) return false;
    positions.push({ x, y });
    return true;
  };

  // 상단/하단 빈 공간 활용: 각 10명 우선 배치
  const edgeTargetPerSide = 10;
  const bandThickness = Math.min(140, Math.max(70, areaHeight * 0.18));
  let topPlaced = 0;
  let bottomPlaced = 0;
  for (let tries = 0; tries < 2500 && (topPlaced < edgeTargetPerSide || bottomPlaced < edgeTargetPerSide); tries += 1) {
    if (topPlaced < edgeTargetPerSide) {
      const x = (rand() * 2 - 1) * maxX * 0.95;
      const y = yMin + 8 + rand() * Math.max(8, bandThickness - 16);
      if (pushIfValid(x, y)) topPlaced += 1;
    }
    if (bottomPlaced < edgeTargetPerSide) {
      const x = (rand() * 2 - 1) * maxX * 0.95;
      const y = yMax - 8 - rand() * Math.max(8, bandThickness - 16);
      if (pushIfValid(x, y)) bottomPlaced += 1;
    }
  }

  // 중앙에서 바깥으로 고르게 퍼지는 동심원 슬롯 생성
  for (let radius = centerClearRadius; radius <= maxRadial && positions.length < count; radius += ringStep) {
    const circumference = 2 * Math.PI * radius;
    const slotCount = Math.max(4, Math.floor(circumference / (minGap - 4)));
    const startAngle = rand() * Math.PI * 2;

    for (let i = 0; i < slotCount && positions.length < count; i += 1) {
      const angle = startAngle + (i * Math.PI * 2) / slotCount;
      const x = Math.cos(angle) * radius;
      const y = Math.sin(angle) * radius;

      if (!pushIfValid(x, y)) continue;
    }
  }

  // 슬롯만으로 부족하면 동일 조건에서 랜덤 채움
  while (positions.length < count) {
    let placed = false;
    for (let tries = 0; tries < 1200; tries += 1) {
      const angle = rand() * Math.PI * 2;
      const radius = centerClearRadius + Math.sqrt(rand()) * (maxRadial - centerClearRadius);
      const x = Math.cos(angle) * radius;
      const y = Math.sin(angle) * radius;

      if (!pushIfValid(x, y)) continue;
      placed = true;
      break;
    }
    if (!placed) break;
  }

  return positions.slice(0, count);
}

function getGeolocationErrorMessage(error: GeolocationPositionError) {
  if (error.code === error.PERMISSION_DENIED) {
    return `위치 권한이 차단되었습니다. 브라우저에서 ${window.location.origin} 위치 권한을 허용해주세요.`;
  }
  if (error.code === error.POSITION_UNAVAILABLE) {
    return "위치 정보를 가져올 수 없습니다. 기기 위치 서비스(GPS/네트워크 위치)를 확인해주세요.";
  }
  if (error.code === error.TIMEOUT) {
    return "위치 조회 시간이 초과되었습니다. 잠시 후 다시 시도해주세요.";
  }
  return `위치 조회에 실패했습니다. (${error.message})`;
}

export default function NearbyMap() {
  const router = useRouter();
  const radarRef = useRef<HTMLDivElement>(null);
  const layoutRef = useRef<HTMLDivElement>(null);
  const [phase, setPhase] = useState<"radar" | "result">("radar");
  const [error, setError] = useState<string | null>(null);
  const [nearbyUsers, setNearbyUsers] = useState<NearbyUser[]>([]);
  const [myCoords, setMyCoords] = useState<{ lat: number; lng: number } | null>(null);
  const [menuTarget, setMenuTarget] = useState<MenuTarget | null>(null);
  const [debugPopupOpen, setDebugPopupOpen] = useState(false);
  const [rippleAnimating, setRippleAnimating] = useState(true);
  const [showMyAvatar, setShowMyAvatar] = useState(false);
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
  const [layoutSize, setLayoutSize] = useState({ width: 0, height: 0 });
  const radarRadius = RADAR_RADIUS;
  const nearbyAvatarSize = nearbyUsers.length < SPARSE_USER_THRESHOLD ? AVATAR_SIZE_WHEN_SPARSE : AVATAR_SIZE;
  const nearbyAvatarHalf = nearbyAvatarSize / 2;
  const randomPositions = useMemo(
    () => buildRandomNearbyPositions(
      nearbyUsers.length,
      layoutSize.width,
      layoutSize.height,
      nearbyUsers.map((u) => u.id).join("|"),
      nearbyAvatarSize
    ),
    [nearbyUsers, layoutSize.height, layoutSize.width, nearbyAvatarSize]
  );

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
    return { users: ((json?.data ?? []) as NearbyUser[]).slice(0, MAX_VISIBLE_USERS), debug: json?.debug ?? null };
  }, []);

  useEffect(() => {
    const node = layoutRef.current;
    if (!node) return;

    const updateSize = () => {
      setLayoutSize({ width: node.clientWidth, height: node.clientHeight });
    };

    updateSize();
    const observer = new ResizeObserver(updateSize);
    observer.observe(node);
    window.addEventListener("orientationchange", updateSize);
    return () => {
      observer.disconnect();
      window.removeEventListener("orientationchange", updateSize);
    };
  }, []);

  useEffect(() => {
    if (phase !== "radar") return;
    queueMicrotask(() => setRippleAnimating(true));
    queueMicrotask(() => setShowMyAvatar(false));
    const stopTimer = setTimeout(() => {
      setRippleAnimating(false);
    }, 3000);
    playSonarPing();
    const interval = setInterval(playSonarPing, 700);
    return () => {
      clearInterval(interval);
      clearTimeout(stopTimer);
    };
  }, [phase]);

  useEffect(() => {
    if (phase !== "result") return;
    const t = setTimeout(() => setShowMyAvatar(true), 80);
    return () => clearTimeout(t);
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

    if (!("geolocation" in navigator)) {
      queueMicrotask(() => setError("이 브라우저는 위치 기능을 지원하지 않습니다."));
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
      (geoError) => {
        setError(getGeolocationErrorMessage(geoError));
      }
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

  return (
    <div className="relative w-full bg-white flex flex-col" style={{ height: "calc(100vh - 160px)" }}>

      {/* 레이더 */}
      <div ref={layoutRef} className="relative w-full flex-1 overflow-hidden">
        <div
          ref={radarRef}
          className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2"
          style={{ width: radarRadius * 2, height: radarRadius * 2 }}
        >
        {/* 고정 원 (작은/중간/큰) */}
        {[0.33, 0.66, 1].map((scale, i) => (
          <div
            key={`ring-${i}`}
            className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 rounded-full border border-gray-200"
            style={{ width: radarRadius * 2 * scale, height: radarRadius * 2 * scale }}
          />
        ))}

        {/* 물결 파동 애니메이션 (3초만 재생 후 정지) */}
        {rippleAnimating && [0, 0.5, 1].map((delay, i) => (
          <div
            key={i}
            className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 rounded-full"
            style={{
              width: radarRadius * 2,
              height: radarRadius * 2,
              border: "2px solid #9ca3af",
              animation: `ripple 3s ease-out ${delay}s 1 forwards`,
            }}
          />
        ))}

        {/* 내 위치: 가장 작은 원의 정중앙 */}
        {phase === "result" && (
          <button
            className="absolute z-10"
            style={{
              left: "50%",
              top: "50%",
              marginLeft: -25,
              marginTop: -25,
              width: 50, height: 50,
              opacity: showMyAvatar ? 1 : 0,
              transform: `scale(${showMyAvatar ? 1 : 0.65})`,
              transition: "opacity 0.9s ease-out, transform 0.9s ease-out",
            }}
            onClick={() => {
              if (debugInfo) setDebugPopupOpen(true);
            }}
          >
            <div
              style={{
                animation: "avatarFloatY 3.6s ease-in-out 0.1s infinite",
                willChange: "transform",
              }}
            >
              <div
                className="rounded-full overflow-hidden w-full h-full"
                style={{
                  animation: "avatarBreath 2.8s ease-in-out 0.1s infinite",
                  willChange: "transform",
                }}
              >
                <Avatar src={myProfile?.profile_image_url ?? null} nickname={myProfile?.nickname ?? "me"} size={50} />
              </div>
            </div>
          </button>
        )}
        </div>

        {/* 회원 아바타 */}
        {phase === "result" && myCoords && nearbyUsers.map((u, idx) => {
          const pos = randomPositions[idx] ?? { x: 0, y: 0 };
          const floatDelay = `${(idx % 8) * 0.12}s`;
          const breathDelay = `${(idx % 6) * 0.1}s`;
          return (
            <button
              key={u.id}
              className="absolute z-20 left-1/2 top-1/2"
              style={{ transform: `translate(${pos.x - nearbyAvatarHalf}px, ${pos.y - nearbyAvatarHalf}px)` }}
              onClick={(e) => {
                const rect = e.currentTarget.getBoundingClientRect();
                const menuWidth = 180;
                const menuHeight = 96;
                const gap = 2;
                const isRightOfCenter = pos.x >= 0;
                const left = isRightOfCenter
                  ? Math.max(8, rect.left - menuWidth - gap)
                  : Math.min(window.innerWidth - menuWidth - 8, rect.right + gap);
                const centerTop = rect.top + rect.height / 2;
                const top = Math.min(window.innerHeight - menuHeight / 2 - 8, Math.max(menuHeight / 2 + 8, centerTop));
                setMenuTarget({ user: u, left, top });
              }}
            >
              <div
                style={{
                  animation: `avatarFloatY 3.2s ease-in-out ${floatDelay} infinite`,
                  willChange: "transform",
                }}
              >
                <div
                  className="rounded-full border-2 border-[#FEE500] overflow-hidden"
                  style={{
                    width: nearbyAvatarSize,
                    height: nearbyAvatarSize,
                    animation: `avatarBreath 2.4s ease-in-out ${breathDelay} infinite`,
                    willChange: "transform",
                  }}
                >
                  <Avatar src={u.profile_image_url} nickname={u.nickname} size={nearbyAvatarSize} />
                </div>
              </div>
            </button>
          );
        })}
      </div>

      {/* 결과 텍스트 */}
      <div className="pb-[78px] text-center text-sm text-gray-500">
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
            style={{ width: 180, top: menuTarget.top, left: menuTarget.left, transform: "translateY(-50%)" }}
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

      {/* 내 아바타 클릭 진단정보 팝업 */}
      {debugPopupOpen && debugInfo && (
        <>
          <div className="fixed inset-0 z-[80]" onClick={() => setDebugPopupOpen(false)} />
          <div
            className="fixed z-[90] bg-white rounded-xl shadow-lg border border-amber-200 p-3 text-xs text-amber-900 leading-5"
            style={{ width: 280, left: "50%", top: "50%", transform: "translate(-50%, -50%)" }}
          >
            <p className="font-semibold">진단 정보</p>
            <p>현재 서버시각: {debugInfo.serverNowKst}</p>
            <p>조회 기준: {debugInfo.staleMinutes}분 이내, 반경 {debugInfo.radiusKm}km</p>
            <p>후보 {debugInfo.candidateCount}명 / 최근 {debugInfo.freshCount}명 / 반경 내 {debugInfo.nearbyCount}명</p>
            <p>{debugInfo.likelyReason}</p>
          </div>
        </>
      )}
    </div>
  );
}
