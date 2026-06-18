"use client";

import { useEffect, useRef, useState, useCallback, useMemo } from "react";
import { useRouter } from "next/navigation";
import Avatar from "@/components/ui/Avatar";
import SendMessageModal from "@/components/modal/SendMessageModal";
import { readFreshLocationSession, saveLocationIfSessionExpired } from "@/lib/location-session";
import { formatLocation, getMemberTypeLabel } from "@/app/(main)/search/_lib/search-utils";

interface NearbyUser {
  id: string;
  lat: number;
  lng: number;
  nickname: string;
  profile_image_url: string | null;
  bio: string | null;
  country: string | null;
  region: string | null;
  member_type: string[];
  updated_at: string | null;
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
const RADAR_RADIUS = 130;
const AVATAR_SIZE = 40;
const AVATAR_SIZE_WHEN_SPARSE = 50;
const SPARSE_USER_THRESHOLD = 20;
const TOP_SAFE_GAP = 20;
const BOTTOM_SAFE_GAP = 20;
const MAX_VISIBLE_USERS = 50;
const NEARBY_API_CACHE_KEY = "loco_nearby_api_cache_v2";
const NEARBY_API_TTL_MS = 2 * 60 * 1000;
const NEARBY_ZERO_RESULT_MAX_CALLS = 2;
const RIPPLE_DURATION_MS = 2000;
const RIPPLE_DURATION_SECONDS = RIPPLE_DURATION_MS / 1000;
const RESULT_FALLBACK_DELAY_MS = 2920;

interface NearbyApiCache {
  startedAt: number;
  count: number;
  executed: boolean;
  users: NearbyUser[];
  debug: NearbyDebug | null;
}

interface NearbyFetchResult {
  users: NearbyUser[];
  debug: NearbyDebug | null;
  fromCache: boolean;
}

export interface NearbyRefreshControl {
  disabled: boolean;
  spinning: boolean;
  onRefresh: () => void;
}

interface NearbyMapProps {
  soundEnabled?: boolean;
  onRefreshControlChange?: (control: NearbyRefreshControl) => void;
}

let pendingNearbyRequest: Promise<NearbyFetchResult> | null = null;

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

function readNearbyApiCache(): NearbyApiCache | null {
  try {
    const raw = sessionStorage.getItem(NEARBY_API_CACHE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as NearbyApiCache;
    if (!Number.isFinite(parsed.startedAt) || !Number.isFinite(parsed.count)) return null;
    if (Date.now() - parsed.startedAt > NEARBY_API_TTL_MS) return null;
    const users = Array.isArray(parsed.users) ? parsed.users : [];
    return {
      startedAt: parsed.startedAt,
      count: parsed.count,
      executed: parsed.executed === true || parsed.count > 0 || users.length > 0,
      users,
      debug: parsed.debug ?? null,
    };
  } catch {
    return null;
  }
}

function writeNearbyApiCache(next: NearbyApiCache) {
  try {
    sessionStorage.setItem(NEARBY_API_CACHE_KEY, JSON.stringify(next));
  } catch {}
}

function getNearbyApiCacheState() {
  const existing = readNearbyApiCache();
  if (existing) return existing;
  const fresh: NearbyApiCache = { startedAt: Date.now(), count: 0, executed: false, users: [], debug: null };
  writeNearbyApiCache(fresh);
  return fresh;
}

function getNearbyRefreshLockedUntil(cache: NearbyApiCache | null) {
  if (!cache?.executed || cache.users.length > 0 || cache.count < NEARBY_ZERO_RESULT_MAX_CALLS) return 0;
  return cache.startedAt + NEARBY_API_TTL_MS;
}

function getDistanceLabel(user: NearbyUser, myCoords: { lat: number; lng: number } | null) {
  if (!myCoords) return null;
  const R = 6371;
  const dLat = ((user.lat - myCoords.lat) * Math.PI) / 180;
  const dLng = ((user.lng - myCoords.lng) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((myCoords.lat * Math.PI) / 180) *
      Math.cos((user.lat * Math.PI) / 180) *
      Math.sin(dLng / 2) ** 2;
  const km = R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return km < 1 ? `${Math.round(km * 1000)}m 이내` : `${km.toFixed(1)}km 이내`;
}

function getActiveTimeLabel(updatedAt: string | null, nowMs: number) {
  if (!updatedAt) return null;
  const diff = Math.floor((nowMs - new Date(updatedAt).getTime()) / 60000);
  if (diff < 1) return "방금 전";
  if (diff < 60) return `${diff}분 전`;
  const h = Math.floor(diff / 60);
  if (h < 24) return `${h}시간 전`;
  return `${Math.floor(h / 24)}일 전`;
}

export default function NearbyMap({ soundEnabled = true, onRefreshControlChange }: NearbyMapProps) {
  const router = useRouter();
  const radarRef = useRef<HTMLDivElement>(null);
  const layoutRef = useRef<HTMLDivElement>(null);
  const initialCache = readNearbyApiCache();
  const [phase, setPhase] = useState<"radar" | "result">("radar");
  const [error, setError] = useState<string | null>(null);
  const [nearbyUsers, setNearbyUsers] = useState<NearbyUser[]>(initialCache?.users ?? []);
  const [myCoords, setMyCoords] = useState<{ lat: number; lng: number } | null>(null);
  const [selectedNearbyUser, setSelectedNearbyUser] = useState<NearbyUser | null>(null);
  const [messageModalTarget, setMessageModalTarget] = useState<NearbyUser | null>(null);
  const [debugPopupOpen, setDebugPopupOpen] = useState(false);
  const [rippleAnimating, setRippleAnimating] = useState(true);
  const [showMyAvatar, setShowMyAvatar] = useState(false);
  const [myProfile, setMyProfile] = useState<{ nickname: string; profile_image_url: string | null } | null>(() => {
    try {
      const keys = Object.keys(localStorage).filter((k) => k.startsWith("loco_home_my_classes_v1:"));
      for (const key of keys) {
        const raw = localStorage.getItem(key);
        if (!raw) continue;
        const cache = JSON.parse(raw);
        const p = cache?.profile;
        if (p?.nickname) return { nickname: p.nickname, profile_image_url: p.profile_image_url ?? null };
      }
    } catch {}
    return null;
  });
  // 캐시에 내 프로필이 없으면(웹뷰 등) 서버에서 한 번 불러온다
  useEffect(() => {
    if (myProfile) return;
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch("/api/home/my-classes");
        if (!res.ok) return;
        const json = await res.json();
        const p = json?.profile;
        if (!cancelled && p?.nickname) {
          setMyProfile({ nickname: p.nickname, profile_image_url: p.profile_image_url ?? null });
        }
      } catch {}
    })();
    return () => {
      cancelled = true;
    };
  }, [myProfile]);
  const [debugInfo, setDebugInfo] = useState<NearbyDebug | null>(null);
  const [nowMs] = useState(() => Date.now());
  const [refreshLockedUntil, setRefreshLockedUntil] = useState(() => getNearbyRefreshLockedUntil(initialCache));
  const [nearbyRefreshDisabled, setNearbyRefreshDisabled] = useState(() => getNearbyRefreshLockedUntil(initialCache) > Date.now());
  const [nearbyRefreshSpinning, setNearbyRefreshSpinning] = useState(false);
  const coordsRef = useRef<{ lat: number; lng: number } | null>(null);
  const audioCtxRef = useRef<AudioContext | null>(null);
  const resultTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const fallbackTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
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

  const SONAR_PLAYED_KEY = "loco_sonar_played";

  const playSonarPing = useCallback(() => {
    if (!soundEnabled) return;
    if (sessionStorage.getItem(SONAR_PLAYED_KEY)) return;
    try {
      if (!audioCtxRef.current) {
        audioCtxRef.current = new AudioContext();
      }
      const ctx = audioCtxRef.current;
      const now = ctx.currentTime;

      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain);
      gain.connect(ctx.destination);

      osc.type = "sine";
      osc.frequency.setValueAtTime(1000, now);
      osc.frequency.exponentialRampToValueAtTime(980, now + 2.0);

      gain.gain.setValueAtTime(0.0, now);
      gain.gain.linearRampToValueAtTime(0.036, now + 0.01);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 2.0);

      osc.start(now);
      osc.stop(now + 2.0);
      sessionStorage.setItem(SONAR_PLAYED_KEY, "1");
    } catch {}
  }, [soundEnabled]);

  const fetchNearby = useCallback(async (lat: number, lng: number) => {
    const gate = getNearbyApiCacheState();

    if (pendingNearbyRequest) {
      return pendingNearbyRequest;
    }

    // 사람이 발견된 경우에는 2분 동안 캐시 결과만 반환
    if (gate.users.length > 0) {
      return { users: gate.users.slice(0, MAX_VISIBLE_USERS), debug: gate.debug, fromCache: true };
    }

    // 0명 결과로 2회 소진된 경우에는 2분 동안 API 재호출을 막음
    if (gate.executed && gate.count >= NEARBY_ZERO_RESULT_MAX_CALLS) {
      return { users: gate.users.slice(0, MAX_VISIBLE_USERS), debug: gate.debug, fromCache: true };
    }

    pendingNearbyRequest = (async () => {
      const res = await fetch(`/api/location/nearby?lat=${lat}&lng=${lng}`);
      const json = await res.json().catch(() => null) as { data?: NearbyUser[]; debug?: NearbyDebug; error?: ApiError } | null;
      if (!res.ok || json?.error) {
        throw new Error(getApiErrorMessage(json?.error, "주변 회원 조회에 실패했습니다."));
      }
      const users = ((json?.data ?? []) as NearbyUser[]).slice(0, MAX_VISIBLE_USERS);
      const debug = json?.debug ?? null;
      const nextCount = users.length > 0 ? 1 : gate.count + 1;
      const startedAt = users.length > 0 || nextCount >= NEARBY_ZERO_RESULT_MAX_CALLS ? Date.now() : gate.startedAt;

      writeNearbyApiCache({ startedAt, count: nextCount, executed: true, users, debug });

      return { users, debug, fromCache: false };
    })();

    try {
      return await pendingNearbyRequest;
    } finally {
      pendingNearbyRequest = null;
    }
  }, []);

  const showNearbyResult = useCallback((result: NearbyFetchResult) => {
    if (fallbackTimerRef.current) {
      clearTimeout(fallbackTimerRef.current);
      fallbackTimerRef.current = null;
    }
    const nextCache = readNearbyApiCache();
    setRefreshLockedUntil(getNearbyRefreshLockedUntil(nextCache));
    setNearbyUsers(result.users);
    setDebugInfo(result.debug);
    setError(null);

    if (resultTimerRef.current) {
      clearTimeout(resultTimerRef.current);
    }

    const finish = () => {
      setRippleAnimating(false);
      setPhase("result");
      setNearbyRefreshSpinning(false);
    };

    if (result.fromCache) {
      resultTimerRef.current = setTimeout(finish, RIPPLE_DURATION_MS);
      return;
    }

    finish();
  }, []);

  const runNearbySearch = useCallback(async (lat: number, lng: number) => {
    setPhase("radar");
    setRippleAnimating(true);
    setShowMyAvatar(false);
    if (fallbackTimerRef.current) {
      clearTimeout(fallbackTimerRef.current);
    }
    fallbackTimerRef.current = setTimeout(() => {
      setRippleAnimating(false);
      setPhase("result");
      setNearbyRefreshSpinning(false);
    }, RESULT_FALLBACK_DELAY_MS);
    const result = await fetchNearby(lat, lng);
    showNearbyResult(result);
  }, [fetchNearby, showNearbyResult]);

  const handleNearbyRefresh = useCallback(() => {
    if (nearbyRefreshDisabled || nearbyRefreshSpinning) return;
    const coords = coordsRef.current;
    if (!coords) return;
    setNearbyRefreshSpinning(true);
    runNearbySearch(coords.lat, coords.lng)
      .catch((err) => {
        setNearbyRefreshSpinning(false);
        setError(err instanceof Error ? err.message : "주변 회원 조회 중 오류가 발생했습니다.");
      });
  }, [nearbyRefreshDisabled, nearbyRefreshSpinning, runNearbySearch]);

  useEffect(() => {
    onRefreshControlChange?.({
      disabled: !myCoords || nearbyRefreshDisabled || nearbyRefreshSpinning,
      spinning: nearbyRefreshSpinning,
      onRefresh: handleNearbyRefresh,
    });
  }, [handleNearbyRefresh, myCoords, nearbyRefreshDisabled, nearbyRefreshSpinning, onRefreshControlChange]);

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
    if (refreshLockedUntil <= 0) {
      queueMicrotask(() => setNearbyRefreshDisabled(false));
      return;
    }

    const remaining = refreshLockedUntil - Date.now();
    if (remaining <= 0) {
      queueMicrotask(() => {
        setNearbyRefreshDisabled(false);
        setRefreshLockedUntil(0);
      });
      return;
    }

    queueMicrotask(() => setNearbyRefreshDisabled(true));
    const timer = setTimeout(() => {
      setNearbyRefreshDisabled(false);
      setRefreshLockedUntil(0);
    }, remaining);
    return () => clearTimeout(timer);
  }, [refreshLockedUntil]);

  useEffect(() => {
    if (phase !== "radar") return;
    queueMicrotask(() => setRippleAnimating(true));
    queueMicrotask(() => setShowMyAvatar(false));
    const stopTimer = setTimeout(() => {
      setRippleAnimating(false);
    }, RIPPLE_DURATION_MS);
    playSonarPing();
    const interval = setInterval(playSonarPing, 700);
    return () => {
      clearInterval(interval);
      clearTimeout(stopTimer);
    };
  }, [phase, playSonarPing]);

  useEffect(() => {
    if (phase !== "result") return;
    const t = setTimeout(() => setShowMyAvatar(true), 80);
    return () => clearTimeout(t);
  }, [phase]);

  useEffect(() => {
    return () => {
      if (resultTimerRef.current) {
        clearTimeout(resultTimerRef.current);
      }
      if (fallbackTimerRef.current) {
        clearTimeout(fallbackTimerRef.current);
      }
    };
  }, []);

  useEffect(() => {
    const freshSession = readFreshLocationSession();
    if (freshSession) {
      const { lat, lng } = freshSession;
      coordsRef.current = { lat, lng };
      queueMicrotask(() => setMyCoords({ lat, lng }));
      queueMicrotask(() => {
        runNearbySearch(lat, lng)
          .catch((err) => setError(err instanceof Error ? err.message : "주변 회원 조회 중 오류가 발생했습니다."));
      });
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
          await runNearbySearch(lat, lng);
        } catch (err) {
          setError(err instanceof Error ? err.message : "위치 처리 중 오류가 발생했습니다.");
        }
      },
      (geoError) => {
        setError(getGeolocationErrorMessage(geoError));
      }
    );
  }, [runNearbySearch]);

  useEffect(() => {
    const interval = setInterval(() => {
      if (!coordsRef.current) return;
      const { lat, lng } = coordsRef.current;
      saveLocationIfSessionExpired(lat, lng)
        .catch(() => {});
    }, REFRESH_INTERVAL);
    return () => clearInterval(interval);
  }, []);

  if (error) {
    return (
      <div className="flex items-center justify-center h-64 px-6 text-sm text-red-500 text-center whitespace-pre-wrap">{error}</div>
    );
  }

  return (
    <div className="relative w-full bg-white flex flex-col" style={{ height: "calc(100dvh - 160px)" }}>
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
              animation: `ripple ${RIPPLE_DURATION_SECONDS}s ease-out ${delay}s 1 forwards`,
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
              onClick={() => setSelectedNearbyUser(u)}
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
          ? `내근처 회원 ${nearbyUsers.length}명 발견`
          : "내 근처 회원이 없습니다."}
      </div>

      {/* 내근처 회원 모달 */}
      {selectedNearbyUser && (
        <>
	          <div
	            className="fixed inset-0 z-[70] bg-black/50"
	            onClick={() => setSelectedNearbyUser(null)}
	          />
          <div className="fixed inset-0 z-[80] flex items-center justify-center pointer-events-none">
            <div className="relative w-[270px] bg-white rounded-2xl shadow-lg p-6 pointer-events-auto flex flex-col items-center gap-2">
              <Avatar
                src={selectedNearbyUser.profile_image_url}
                nickname={selectedNearbyUser.nickname}
                size={80}
              />
              <div className="text-center w-full">
                <p className="font-bold text-gray-900 truncate" style={{ fontSize: 16 }}>
                  {selectedNearbyUser.nickname}
                </p>
                {formatLocation(selectedNearbyUser.country, selectedNearbyUser.region) && (
                  <p className="text-xs text-gray-400 mt-0.5">
                    {formatLocation(selectedNearbyUser.country, selectedNearbyUser.region)}
                  </p>
                )}
                {selectedNearbyUser.member_type?.[0] && (
                  <div className="flex items-center justify-center mt-2">
                    <span className="px-2.5 py-1 rounded-full bg-gray-800 text-white text-[12px] font-medium">
                      {getMemberTypeLabel(selectedNearbyUser.member_type[0])}
                    </span>
                  </div>
                )}
                {selectedNearbyUser.bio && (
                  <p className="text-[15px] text-gray-600 line-clamp-4 mt-2 whitespace-pre-wrap">
                    {selectedNearbyUser.bio}
                  </p>
                )}
                <p className="text-xs text-gray-500 mt-2">
                  {[getDistanceLabel(selectedNearbyUser, myCoords), getActiveTimeLabel(selectedNearbyUser.updated_at, nowMs)]
                    .filter(Boolean)
                    .join(" · ")}
                </p>
              </div>
              <div className="flex gap-2 w-full mt-2">
                <button
	                  className="flex-1 h-9 rounded-full bg-[#FEE500] text-gray-900 font-semibold text-[14px]"
	                  onClick={() => {
	                    setMessageModalTarget(selectedNearbyUser);
	                    setSelectedNearbyUser(null);
	                  }}
                >
                  메시지 전송
                </button>
	                <button
	                  className="flex-1 h-9 rounded-full bg-[#FEE500] text-gray-900 font-semibold text-[14px]"
	                  onClick={() => {
	                    setSelectedNearbyUser(null);
	                    router.push(`/users/${selectedNearbyUser.id}/view`);
	                  }}
                >
                  회원프로필보기
                </button>
              </div>
            </div>
          </div>
        </>
      )}

      {messageModalTarget && (
        <SendMessageModal
	          isOpen={!!messageModalTarget}
	          onClose={() => {
	            setMessageModalTarget(null);
	          }}
          receiver={{
            id: messageModalTarget.id,
            nickname: messageModalTarget.nickname,
            profile_image_url: messageModalTarget.profile_image_url,
          }}
        />
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
