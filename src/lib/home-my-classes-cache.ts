import type { ClassWithHost } from "@/components/class/ClassCard";
import type { ApplicationStatus } from "@/types/application";

export const HOME_MY_CLASSES_CACHE_KEY = "loco_home_my_classes_v1";

type CachedParticipatingClass = ClassWithHost & {
  application_status?: ApplicationStatus;
};

type HomeMyClassesCachePayload = {
  participatingClasses?: CachedParticipatingClass[];
};

export function getHomeMyClassesCacheKey(userId: string) {
  return `${HOME_MY_CLASSES_CACHE_KEY}:${userId}`;
}

export function upsertParticipatingClassCache(
  userId: string,
  classData: ClassWithHost,
  applicationStatus: ApplicationStatus
) {
  if (typeof window === "undefined") return;

  try {
    const key = getHomeMyClassesCacheKey(userId);
    const raw = localStorage.getItem(key);
    if (!raw) return;

    const parsed = JSON.parse(raw) as HomeMyClassesCachePayload;
    const currentClasses = Array.isArray(parsed.participatingClasses)
      ? parsed.participatingClasses
      : [];
    const nextClass = {
      ...classData,
      application_status: applicationStatus,
    };

    parsed.participatingClasses = [
      nextClass,
      ...currentClasses.filter((item) => item.id !== classData.id),
    ];
    localStorage.setItem(key, JSON.stringify(parsed));
  } catch {}
}

export async function refreshHomeMyClassesCache(userId: string) {
  if (typeof window === "undefined") return;

  try {
    const res = await fetch("/api/home/my-classes");
    if (!res.ok) return;

    const json = await res.json();
    localStorage.setItem(getHomeMyClassesCacheKey(userId), JSON.stringify(json));
  } catch {}
}
