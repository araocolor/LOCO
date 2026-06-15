const NOTIFICATION_CACHE_KEY = "loco_notifications_v1";
const NOTIFICATION_CACHE_TTL_MS = 3 * 60 * 1000;

type NotificationTab = "class" | "comment" | "general";

interface NotificationCachePayload {
  savedAt: number;
  notifications: unknown[];
}

export function getNotificationCacheKey(userId: string | null | undefined, tab: NotificationTab) {
  return userId ? `${NOTIFICATION_CACHE_KEY}:${userId}:${tab}` : null;
}

export function readNotificationCache(userId: string | null | undefined, tab: NotificationTab) {
  const key = getNotificationCacheKey(userId, tab);
  if (!key) return null;

  try {
    const raw = sessionStorage.getItem(key);
    if (!raw) return null;

    const parsed = JSON.parse(raw) as Partial<NotificationCachePayload>;
    if (
      typeof parsed.savedAt !== "number" ||
      !Array.isArray(parsed.notifications) ||
      Date.now() - parsed.savedAt > NOTIFICATION_CACHE_TTL_MS
    ) {
      sessionStorage.removeItem(key);
      return null;
    }

    return parsed.notifications;
  } catch {
    sessionStorage.removeItem(key);
    return null;
  }
}

export function writeNotificationCache(
  userId: string | null | undefined,
  tab: NotificationTab,
  notifications: unknown[]
) {
  const key = getNotificationCacheKey(userId, tab);
  if (!key) return;

  try {
    sessionStorage.setItem(
      key,
      JSON.stringify({
        savedAt: Date.now(),
        notifications,
      } satisfies NotificationCachePayload)
    );
  } catch {}
}

export function prefetchNotifications(userId: string | null | undefined) {
  if (!userId) return;

  const cached = readNotificationCache(userId, "class");
  if (cached) return;

  fetch(`/api/notifications?page=0&tab=class`)
    .then((res) => (res.ok ? res.json() : null))
    .then((json) => {
      if (json?.notifications) {
        writeNotificationCache(userId, "class", json.notifications);
      }
    })
    .catch(() => {});
}
