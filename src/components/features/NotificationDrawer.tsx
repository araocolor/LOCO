"use client";

import { useEffect, useState, useCallback } from "react";
import Image from "next/image";
import { ArrowLeft, Check, X } from "lucide-react";
import UserViewLoader from "@/components/user/UserViewLoader";

interface NotificationItem {
  id: string;
  type: string;
  ref_id: string | null;
  meta: Record<string, unknown>;
  is_read: boolean;
  created_at: string;
  actor: {
    id: string;
    nickname: string;
    profile_image_url: string | null;
  } | null;
}

interface NotificationDrawerProps {
  open: boolean;
  onClose: () => void;
  userId?: string | null;
  onUnreadCountChange?: (count: number) => void;
  onOpenClassDetail?: (classId: string) => void;
}

interface NotificationCachePayload {
  savedAt: number;
  notifications: NotificationItem[];
}

const NOTIFICATION_CACHE_KEY = "loco_notifications_v1";
const NOTIFICATION_CACHE_TTL_MS = 3 * 60 * 1000;

function getNotificationCacheKey(userId?: string | null) {
  return userId ? `${NOTIFICATION_CACHE_KEY}:${userId}` : null;
}

function getUnreadCount(notifications: NotificationItem[]) {
  return notifications.filter((n) => !n.is_read).length;
}

function readNotificationCache(userId?: string | null) {
  const key = getNotificationCacheKey(userId);
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

function writeNotificationCache(userId: string | null | undefined, notifications: NotificationItem[]) {
  const key = getNotificationCacheKey(userId);
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

function formatTime(dateStr: string) {
  const now = Date.now();
  const diff = now - new Date(dateStr).getTime();
  const minutes = Math.floor(diff / 60000);
  if (minutes < 1) return "방금";
  if (minutes < 60) return `${minutes}분 전`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}시간 전`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}일 전`;
  return new Date(dateStr).toLocaleDateString("ko-KR", { month: "short", day: "numeric" });
}

function formatMessage(item: NotificationItem): string {
  const nickname = item.actor?.nickname ?? "알 수 없음";
  const meta = item.meta ?? {};
  const classTitle = typeof meta.class_title === "string" ? meta.class_title : "";
  const truncTitle = classTitle.length > 6 ? classTitle.slice(0, 6) + "..." : classTitle;
  const region = typeof meta.region === "string" ? meta.region : "";
  const category = typeof meta.category === "string" ? meta.category : "";
  const starCount = typeof meta.count === "number" ? meta.count : 0;

  switch (item.type) {
    case "friend_class_created": {
      const parts = [region, category].filter(Boolean).join(" ");
      return `${nickname} 님이 ${parts ? parts + " " : ""}클래스를 개설하였습니다.`;
    }
    case "star_gift_received":
      return `${nickname}님이 별${starCount}개를 선물하였습니다.`;
    case "class_application":
      return `${nickname}님이 ${truncTitle} 신청요청 함`;
    case "class_comment":
      return `내 클래스에 ${nickname}님이 댓글을 남겼습니다`;
    case "class_like":
      return `내 클래스에 ${nickname}님이 하트를 남겼습니다.`;
    case "comment_reply":
      return `내 글에 ${nickname}님이 댓글을 남겼어요`;
    default:
      return "알림";
  }
}

export default function NotificationDrawer({ open, onClose, userId, onUnreadCountChange, onOpenClassDetail }: NotificationDrawerProps) {
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [profileUserId, setProfileUserId] = useState<string | null>(null);

  const fetchNotifications = useCallback(async () => {
    const cachedNotifications = readNotificationCache(userId);
    if (cachedNotifications) {
      setNotifications(cachedNotifications);
      onUnreadCountChange?.(getUnreadCount(cachedNotifications));
      setLoading(false);
      return;
    }

    setLoading(true);
    try {
      const res = await fetch("/api/notifications?page=0");
      if (!res.ok) return;
      const json = await res.json();
      const nextNotifications = json.notifications ?? [];
      setNotifications(nextNotifications);
      writeNotificationCache(userId, nextNotifications);
      onUnreadCountChange?.(getUnreadCount(nextNotifications));
    } catch {} finally {
      setLoading(false);
    }
  }, [onUnreadCountChange, userId]);

  useEffect(() => {
    if (open) {
      void Promise.resolve().then(fetchNotifications);
    }
  }, [open, fetchNotifications]);

  useEffect(() => {
    document.body.style.overflow = open ? "hidden" : "";
    return () => { document.body.style.overflow = ""; };
  }, [open]);

  const markAsRead = async (id: string) => {
    const nextNotifications = notifications.map((n) => (n.id === id ? { ...n, is_read: true } : n));
    setNotifications(nextNotifications);
    writeNotificationCache(userId, nextNotifications);
    onUnreadCountChange?.(getUnreadCount(nextNotifications));

    try {
      await fetch("/api/notifications/read", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id }),
      });
    } catch {}
  };

  const handleNotificationClick = (item: NotificationItem) => {
    void markAsRead(item.id);

    if (item.type === "class_comment" && item.ref_id) {
      onClose();
      onOpenClassDetail?.(item.ref_id);
    }
  };

  return (
    <>
      <div
        className={`fixed inset-0 z-[150] bg-black/40 transition-opacity duration-300 ${
          open ? "opacity-100 pointer-events-auto" : "opacity-0 pointer-events-none"
        }`}
        onClick={onClose}
      />
      <div
        className={`fixed top-0 right-0 h-full w-full max-w-[500px] bg-white z-[200] flex flex-col transition-transform duration-300 ease-in-out ${
          open ? "translate-x-0" : "translate-x-full"
        }`}
      >
        <div className="flex items-center justify-between px-4 h-14 border-b border-gray-100">
          <span className="text-[20px] font-bold text-[#333333]">알림</span>
          <button type="button" onClick={onClose}>
            <X className="w-5 h-5 text-gray-500" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto">
          {loading ? (
            <div className="flex items-center justify-center h-32 text-gray-400">로딩 중...</div>
          ) : notifications.length === 0 ? (
            <div className="flex items-center justify-center h-32">
              <p className="text-sm text-gray-400">알림이 없습니다</p>
            </div>
          ) : (
            <ul>
              {notifications.map((item) => (
                <li
                  key={item.id}
                  className={`flex items-start gap-3 px-4 py-3 border-b border-gray-50 ${
                    item.is_read ? "bg-white" : "bg-yellow-50"
                  }`}
                >
                  <button
                    type="button"
                    className="flex-shrink-0 w-[38px] h-[38px] rounded-full overflow-hidden bg-gray-200"
                    onClick={() => item.actor?.id && setProfileUserId(item.actor.id)}
                  >
                    {item.actor?.profile_image_url ? (
                      <Image
                        src={item.actor.profile_image_url}
                        alt={item.actor.nickname ?? ""}
                        width={38}
                        height={38}
                        className="object-cover w-full h-full"
                        unoptimized
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center text-gray-400 text-xs">
                        {(item.actor?.nickname ?? "?")[0]}
                      </div>
                    )}
                  </button>

                  <button
                    type="button"
                    className="flex-1 min-w-0 text-left"
                    onClick={() => handleNotificationClick(item)}
                  >
                    <p className="text-[16px] text-gray-800 leading-snug">
                      {formatMessage(item)}
                    </p>
                    <p className="text-[11px] text-gray-400 mt-0.5">
                      {formatTime(item.created_at)}
                    </p>
                  </button>

                  {!item.is_read && (
                    <button
                      type="button"
                      className="flex-shrink-0 w-7 h-7 flex items-center justify-center text-gray-400 hover:text-green-500"
                      onClick={() => markAsRead(item.id)}
                    >
                      <Check size={16} strokeWidth={2.5} />
                    </button>
                  )}
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>

      {/* 프로필 드로어 */}
      <div
        className={`fixed inset-0 z-[250] bg-white flex flex-col transition-transform duration-300 ease-in-out ${
          profileUserId ? "translate-x-0" : "translate-x-full"
        }`}
      >
        <header className="sticky top-0 z-50 bg-white h-14 px-4 relative">
          <button
            onClick={() => setProfileUserId(null)}
            className="absolute left-4 top-1/2 -translate-y-1/2 w-[37px] h-[37px] flex items-center justify-center text-gray-600"
          >
            <ArrowLeft size={20} />
          </button>
          <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2">
            <span className="font-bold text-[#4d4d4d]" style={{ fontSize: 18 }}>프로필</span>
          </div>
        </header>
        <div className="flex-1 overflow-y-auto">
          {profileUserId && <UserViewLoader userId={profileUserId} />}
        </div>
      </div>
    </>
  );
}
