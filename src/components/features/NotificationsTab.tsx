"use client";

import { useEffect, useState, useCallback } from "react";
import Image from "next/image";
import { Heart, Settings } from "lucide-react";
import UserProfileModal from "@/components/user/UserProfileModal";

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

interface NotificationCachePayload {
  savedAt: number;
  notifications: NotificationItem[];
}

interface NotificationsTabProps {
  userId?: string | null;
  onOpenClassDetail?: (classId: string) => void;
}

const NOTIFICATION_CACHE_KEY = "loco_notifications_v1";
const NOTIFICATION_CACHE_TTL_MS = 3 * 60 * 1000;

function getNotificationCacheKey(userId?: string | null) {
  return userId ? `${NOTIFICATION_CACHE_KEY}:${userId}` : null;
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

function hasStaleApplicationNotification(notifications: NotificationItem[]) {
  return notifications.some(
    (item) => item.type === "class_application" && typeof item.meta?.application_id !== "string"
  );
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

function truncate(text: string, max: number) {
  return text.length > max ? text.slice(0, max) + "..." : text;
}

function formatMessage(item: NotificationItem): React.ReactNode {
  const nickname = item.actor?.nickname ?? "알 수 없음";
  const meta = item.meta ?? {};
  const classTitle = typeof meta.class_title === "string" ? meta.class_title : "";
  const region = typeof meta.region === "string" ? meta.region : "";
  const category = typeof meta.category === "string" ? meta.category : "";
  const starCount = typeof meta.count === "number" ? meta.count : 0;
  const commentContent = typeof meta.comment_content === "string" ? meta.comment_content : "";

  switch (item.type) {
    case "friend_class_created": {
      const parts = [region, category].filter(Boolean).join(" ");
      return `${nickname} 님이 ${parts ? parts + " " : ""}클래스를 개설하였습니다.`;
    }
    case "star_gift_received":
      return `${nickname}님이 별${starCount}개를 선물하였습니다.`;
    case "class_application":
      return <><b className="text-[16px]">{nickname}</b>님이 <b className="text-[16px]">{truncate(classTitle, 30)}</b> 신청함</>;
    case "class_comment":
      return <><b className="text-[16px]">{nickname}</b>님이 <b className="text-[16px]">{truncate(classTitle, 30)}</b>에 댓글남김</>;
    case "class_like":
      return <><b className="text-[16px]">{nickname}</b>님이 <b className="text-[16px]">{truncate(classTitle, 30)}</b>에 하트남김</>;
    case "comment_reply":
      return <><b className="text-[16px]">{nickname}</b>님이 <b className="text-[16px]">{truncate(commentContent, 30)}</b>에 댓글남김</>;
    default:
      return "알림";
  }
}

type NotificationTab = "class" | "comment" | "heart";

export default function NotificationsTab({ userId, onOpenClassDetail }: NotificationsTabProps) {
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [profileModalTarget, setProfileModalTarget] = useState<NotificationItem["actor"]>(null);
  const [hasFetched, setHasFetched] = useState(false);
  const [activeTab, setActiveTab] = useState<NotificationTab>("class");

  const fetchNotifications = useCallback(async () => {
    const cachedNotifications = readNotificationCache(userId);
    if (cachedNotifications && !hasStaleApplicationNotification(cachedNotifications)) {
      setNotifications(cachedNotifications);
      setLoading(false);
      setHasFetched(true);
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
    } catch {} finally {
      setLoading(false);
      setHasFetched(true);
    }
  }, [userId]);

  useEffect(() => {
    if (!hasFetched) {
      queueMicrotask(() => {
        void fetchNotifications();
      });
    }
  }, [hasFetched, fetchNotifications]);

  const markAsRead = async (id: string) => {
    const nextNotifications = notifications.map((n) => (n.id === id ? { ...n, is_read: true } : n));
    setNotifications(nextNotifications);
    writeNotificationCache(userId, nextNotifications);

    try {
      await fetch("/api/notifications/read", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id }),
      });
    } catch {}
  };

  const [approvingId, setApprovingId] = useState<string | null>(null);
  const [approvedIds, setApprovedIds] = useState<Set<string>>(new Set());

  const handleApprove = async (applicationId: string) => {
    setApprovingId(applicationId);
    try {
      const res = await fetch(`/api/applications/${applicationId}`, { method: "PATCH" });
      if (res.ok) {
        setApprovedIds((prev) => new Set(prev).add(applicationId));
        setNotifications((prev) => {
          const nextNotifications = prev.map((item) =>
            item.meta?.application_id === applicationId
              ? { ...item, meta: { ...item.meta, application_status: "approved" } }
              : item
          );
          writeNotificationCache(userId, nextNotifications);
          return nextNotifications;
        });
      }
    } finally {
      setApprovingId(null);
    }
  };

  const handleNotificationClick = (item: NotificationItem) => {
    void markAsRead(item.id);
    if ((item.type === "class_comment" || item.type === "comment_reply") && item.ref_id) {
      onOpenClassDetail?.(item.ref_id);
    }
  };

  const COMMENT_TYPES = new Set(["class_comment", "comment_reply"]);
  const HEART_TYPES = new Set(["class_like"]);
  const filteredNotifications = activeTab === "comment"
    ? notifications.filter((n) => COMMENT_TYPES.has(n.type))
    : activeTab === "heart"
    ? notifications.filter((n) => HEART_TYPES.has(n.type))
    : notifications.filter((n) => !COMMENT_TYPES.has(n.type) && !HEART_TYPES.has(n.type));

  return (
    <>
    <div className="flex flex-col flex-1">
      <header className="sticky top-0 z-50 bg-white border-b border-[#e5e7eb]">
        <div className="relative h-14 px-4 flex items-center">
          <div className="font-black text-[22px] text-[#4d4d4d] leading-none">
            알림
          </div>
          <button
            type="button"
            aria-label="설정"
            className="ml-auto h-10 -mr-1 flex items-center text-gray-700"
          >
            <Settings size={22} strokeWidth={2.2} />
          </button>
        </div>
        <div className="flex pl-4 pr-4 gap-2 pb-2 overflow-x-auto scrollbar-hide whitespace-nowrap">
          <button
            onClick={() => setActiveTab("class")}
            className={`px-3.5 py-1.5 rounded-full text-[14px] font-semibold transition-colors ${
              activeTab === "class" ? "bg-black text-white" : "bg-gray-100 text-gray-400"
            }`}
          >
            클래스
          </button>
          <button
            onClick={() => setActiveTab("comment")}
            className={`px-3.5 py-1.5 rounded-full text-[14px] font-semibold transition-colors ${
              activeTab === "comment" ? "bg-black text-white" : "bg-gray-100 text-gray-400"
            }`}
          >
            댓글
          </button>
          <button
            onClick={() => setActiveTab("heart")}
            className={`px-3.5 py-1.5 rounded-full text-[14px] font-semibold transition-colors ${
              activeTab === "heart" ? "bg-black text-white" : "bg-gray-100 text-gray-400"
            }`}
          >
            <Heart size={14} fill={activeTab === "heart" ? "white" : "#9ca3af"} stroke="none" />
          </button>
        </div>
      </header>

      <div className="flex-1 overflow-y-auto">
        {loading ? (
          <div className="flex items-center justify-center h-32 text-gray-400">로딩 중...</div>
        ) : filteredNotifications.length === 0 ? (
          <div className="flex items-center justify-center h-32">
            <p className="text-sm text-gray-400">알림이 없습니다</p>
          </div>
        ) : (
          <ul>
            {filteredNotifications.map((item) => (
              <li
                key={item.id}
                className={`flex items-start gap-3 px-4 py-3 border-b border-gray-50 ${
                  item.is_read ? "bg-white" : "bg-yellow-50"
                }`}
              >
                <button
                  type="button"
                  className="flex-shrink-0 w-[38px] h-[38px] rounded-full overflow-hidden bg-gray-200"
                  onClick={() => item.actor?.id && setProfileModalTarget(item.actor)}
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
                  <p className="text-[14px] text-gray-800 leading-snug">
                    {formatMessage(item)} <span className="text-[11px] text-gray-400 ml-1">{formatTime(item.created_at)}</span>
                    {item.type === "class_application" && (() => {
                      const appId = typeof item.meta?.application_id === "string" ? item.meta.application_id : null;
                      const isApproved = appId
                        ? approvedIds.has(appId) || item.meta?.application_status === "approved"
                        : false;
                      return isApproved ? (
                        <span className="ml-1 whitespace-nowrap rounded-full bg-black/50 px-2 py-0.5 text-[14px] font-medium text-white">승인완료</span>
                      ) : null;
                    })()}
                  </p>
                </button>

                {item.type === "class_application" && (() => {
                  const appId = typeof item.meta?.application_id === "string" ? item.meta.application_id : null;
                  if (!appId) return null;
                  const isApproved =
                    approvedIds.has(appId) || item.meta?.application_status === "approved";
                  return isApproved ? (
                    <span aria-hidden="true" className="self-center h-[28px] w-[46px] flex-shrink-0" />
                  ) : (
                    <button
                      type="button"
                      className="self-center flex-shrink-0 whitespace-nowrap rounded-full bg-[#FEE500] px-3 py-1 text-[14px] font-medium text-gray-900"
                      onClick={(e) => {
                        e.stopPropagation();
                        void handleApprove(appId);
                      }}
                    >
                      {approvingId === appId ? "..." : "승인"}
                    </button>
                  );
                })()}
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
    {profileModalTarget?.id && (
      <UserProfileModal
        userId={profileModalTarget.id}
        initialProfile={profileModalTarget}
        onClose={() => setProfileModalTarget(null)}
      />
    )}
    </>
  );
}
