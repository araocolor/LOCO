"use client";

const LOCATION_SESSION_KEY = "loco_location_session_v1";
const LOCATION_SESSION_TTL_MS = 10 * 60 * 1000;

interface LocationSession {
  lat: number;
  lng: number;
  savedAt: number;
}

interface ApiError {
  message?: string;
  code?: string | null;
  details?: string | null;
  hint?: string | null;
}

function getApiErrorMessage(error: ApiError | undefined, fallback: string) {
  if (!error) return fallback;
  return [error.message, error.code ? `code: ${error.code}` : null, error.details, error.hint]
    .filter(Boolean)
    .join(" / ");
}

export function readFreshLocationSession() {
  try {
    const raw = sessionStorage.getItem(LOCATION_SESSION_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as LocationSession;
    if (Date.now() - parsed.savedAt > LOCATION_SESSION_TTL_MS) return null;
    return parsed;
  } catch {
    return null;
  }
}

export function writeLocationSession(lat: number, lng: number) {
  try {
    sessionStorage.setItem(LOCATION_SESSION_KEY, JSON.stringify({ lat, lng, savedAt: Date.now() }));
  } catch {}
}

export async function saveLocationIfSessionExpired(lat: number, lng: number) {
  const freshSession = readFreshLocationSession();
  if (freshSession) return { saved: false, session: freshSession };

  const res = await fetch("/api/location", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ lat, lng }),
  });
  const json = await res.json().catch(() => null) as { ok?: boolean; error?: ApiError } | null;
  if (!res.ok || json?.ok === false) {
    throw new Error(getApiErrorMessage(json?.error, "위치 저장에 실패했습니다."));
  }

  writeLocationSession(lat, lng);
  return { saved: true, session: { lat, lng, savedAt: Date.now() } };
}
