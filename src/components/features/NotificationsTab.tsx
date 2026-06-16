"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import Image from "next/image";
import { Trash2 } from "lucide-react";
import UserProfileModal from "@/components/user/UserProfileModal";
import CachedClassDetailPage from "@/components/class/CachedClassDetailPage";
import ClassHeader from "@/components/layout/ClassHeader";
import { readNotificationCache, writeNotificationCache } from "@/lib/notification-cache";
import { useSyncExternalStore } from "react";
import { setNotificationUnread, getNotificationUnreadByTab, subscribeNotificationUnread } from "@/lib/unread-store";

type NotificationTab = "class" | "comment" | "general";

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

interface NotificationsTabProps {
  userId?: string | null;
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
  const creditAmount = typeof meta.credit_amount === "number" ? meta.credit_amount : 10;

  switch (item.type) {
    case "friend_class_created": {
      const parts = [region, category].filter(Boolean).join(" ");
      return (
        <>
          <b className="text-[16px]">{nickname}</b> 님이{" "}
          {parts ? <><b className="text-[16px]">{parts}</b> </> : ""}클래스를 개설하였습니다.
        </>
      );
    }
    case "star_gift_received":
      return (
        <>
          <b className="text-[16px]">{nickname}</b>님이 별
          <b className="text-[16px]">{starCount}</b>개를 선물하였습니다.
        </>
      );
    case "class_application":
      return (
        <>
          <b className="text-[16px]">{nickname}</b>님이{" "}
          <b className="text-[16px]">{truncate(classTitle, 30)}</b> 신청함
        </>
      );
    case "class_comment":
      return (
        <>
          <b className="text-[16px]">{nickname}</b>님이{" "}
          <b className="text-[16px]">{truncate(classTitle, 30)}</b>에 댓글남김
        </>
      );
    case "class_like":
      return (
        <>
          <b className="text-[16px]">{nickname}</b>님이{" "}
          <b className="text-[16px]">{truncate(classTitle, 30)}</b>에 하트남김
        </>
      );
    case "comment_reply":
      return (
        <>
          <b className="text-[16px]">{nickname}</b>님이{" "}
          <b className="text-[16px]">{truncate(commentContent, 30)}</b>에 댓글남김
        </>
      );
    case "pre_charge_issued":
      return (
        <>
          <b className="text-[16px]">관리자</b>님이 외상크레딧{" "}
          <b className="text-[16px]">{creditAmount}</b>회 충전을 발급하였습니다.
        </>
      );
    case "nickname_changed": {
      const newNick = typeof meta.new_nickname === "string" ? meta.new_nickname : "";
      return (
        <>
          <b className="text-[16px]">{nickname}</b>님이 아이디를{" "}
          <b className="text-[16px]">{newNick}</b>로 변경하였습니다.
        </>
      );
    }
    default:
      return "알림";
  }
}

const NOTIFICATION_TABS: NotificationTab[] = ["class", "comment", "general"];

function getEmptyNotificationMap(): Record<NotificationTab, NotificationItem[]> {
  return { class: [], comment: [], general: [] };
}

function getEmptyLoadingMap(): Record<NotificationTab, boolean> {
  return { class: false, comment: false, general: false };
}

function getEmptyLoadedMap(): Record<NotificationTab, boolean> {
  return { class: false, comment: false, general: false };
}

export default function NotificationsTab({ userId }: NotificationsTabProps) {
  const [notificationsByTab, setNotificationsByTab] =
    useState<Record<NotificationTab, NotificationItem[]>>(getEmptyNotificationMap);
  const [loadingMap, setLoadingMap] = useState<Record<NotificationTab, boolean>>(getEmptyLoadingMap);
  const [loadedTabs, setLoadedTabs] = useState<Record<NotificationTab, boolean>>(getEmptyLoadedMap);
  const [profileModalTarget, setProfileModalTarget] = useState<NotificationItem["actor"]>(null);
  const [activeTab, setActiveTab] = useState<NotificationTab>("class");
  const [classDetailId, setClassDetailId] = useState<string | null>(null);
  const [viewedTabs, setViewedTabs] = useState<Set<NotificationTab>>(new Set(["class"]));
  const viewedTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const initialUnreadByTab = useSyncExternalStore(subscribeNotificationUnread, getNotificationUnreadByTab, () => ({ class: 0, comment: 0, general: 0 }));

  const fetchNotifications = useCallback(async (tab: NotificationTab, silent = false) => {
    if (loadedTabs[tab]) return;

    const cachedNotifications = readNotificationCache(userId, tab);
    if (cachedNotifications) {
      setNotificationsByTab((prev) => ({ ...prev, [tab]: cachedNotifications }));
      setLoadedTabs((prev) => ({ ...prev, [tab]: true }));
      return;
    }

    if (!silent) {
      setLoadingMap((prev) => ({ ...prev, [tab]: true }));
    }

    try {
      const res = await fetch(`/api/notifications?page=0&tab=${tab}`);
      if (!res.ok) return;
      const json = await res.json();
      const nextNotifications = json.notifications ?? [];
      setNotificationsByTab((prev) => ({ ...prev, [tab]: nextNotifications }));
      writeNotificationCache(userId, tab, nextNotifications);
      setLoadedTabs((prev) => ({ ...prev, [tab]: true }));
    } catch {
    } finally {
      if (!silent) {
        setLoadingMap((prev) => ({ ...prev, [tab]: false }));
      }
    }
  }, [loadedTabs, userId]);

  useEffect(() => {
    queueMicrotask(() => {
      void fetchNotifications(activeTab);
    });
  }, [activeTab, fetchNotifications]);

  useEffect(() => {
    if (!loadedTabs.class || activeTab !== "class") return;
    queueMicrotask(() => {
      void fetchNotifications("comment", true);
      void fetchNotifications("general", true);
    });
  }, [activeTab, fetchNotifications, loadedTabs.class]);

  useEffect(() => {
    if (viewedTimerRef.current) clearTimeout(viewedTimerRef.current);
    viewedTimerRef.current = setTimeout(() => {
      setViewedTabs((prev) => {
        if (prev.has(activeTab)) return prev;
        const next = new Set(prev);
        next.add(activeTab);
        return next;
      });
      fetch("/api/notifications/read-tab", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tab: activeTab }),
      }).then(() => {
        setNotificationsByTab((prev) => {
          const updated = prev[activeTab].map((n) => (n.is_read ? n : { ...n, is_read: true }));
          writeNotificationCache(userId, activeTab, updated);
          return { ...prev, [activeTab]: updated };
        });
      }).catch(() => {});
    }, 500);
    return () => {
      if (viewedTimerRef.current) clearTimeout(viewedTimerRef.current);
    };
  }, [activeTab, userId]);

  useEffect(() => {
    const allLoaded = NOTIFICATION_TABS.every((tab) => loadedTabs[tab]);
    if (!allLoaded) return;
    const totalUnread = NOTIFICATION_TABS.reduce((sum, tab) => {
      if (viewedTabs.has(tab)) return sum;
      return sum + notificationsByTab[tab].filter((n) => !n.is_read).length;
    }, 0);
    setNotificationUnread(totalUnread);
  }, [notificationsByTab, viewedTabs, loadedTabs]);

  useEffect(() => {
    document.body.style.overflow = classDetailId ? "hidden" : "";
    return () => {
      document.body.style.overflow = "";
    };
  }, [classDetailId]);

  const markAsRead = async (id: string) => {
    setNotificationsByTab((prev) => {
      const next = { ...prev };
      for (const tab of NOTIFICATION_TABS) {
        next[tab] = prev[tab].map((n) => (n.id === id ? { ...n, is_read: true } : n));
        if (loadedTabs[tab]) writeNotificationCache(userId, tab, next[tab]);
      }
      return next;
    });

    try {
      await fetch("/api/notifications/read", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id }),
      });
    } catch {}
  };

  const [editMode, setEditMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [deleting, setDeleting] = useState(false);

  const [approvingId, setApprovingId] = useState<string | null>(null);
  const [approvedIds, setApprovedIds] = useState<Set<string>>(new Set());

  const handleApprove = async (applicationId: string) => {
    setApprovingId(applicationId);
    try {
      const res = await fetch(`/api/applications/${applicationId}`, { method: "PATCH" });
      if (res.ok) {
        setApprovedIds((prev) => new Set(prev).add(applicationId));
        setNotificationsByTab((prev) => {
          const nextNotifications = prev.class.map((item) =>
            item.meta?.application_id === applicationId
              ? { ...item, meta: { ...item.meta, application_status: "approved" } }
              : item
          );
          writeNotificationCache(userId, "class", nextNotifications);
          return { ...prev, class: nextNotifications };
        });
      }
    } finally {
      setApprovingId(null);
    }
  };

  const handleNotificationClick = (item: NotificationItem) => {
    void markAsRead(item.id);

    if (
      (item.type === "class_comment" ||
        item.type === "comment_reply" ||
        item.type === "class_like") &&
      item.ref_id
    ) {
      setClassDetailId(item.ref_id);
    }
  };

  const isPendingApplication = (item: NotificationItem) => {
    if (item.type !== "class_application") return false;
    const appId = typeof item.meta?.application_id === "string" ? item.meta.application_id : null;
    if (!appId) return false;
    return !approvedIds.has(appId) && item.meta?.application_status !== "approved";
  };

  const toggleSelect = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const toggleSelectAll = () => {
    if (selectedIds.size === deletableNotifications.length && deletableNotifications.length > 0) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(deletableNotifications.map((n) => n.id)));
    }
  };

  const handleDelete = async () => {
    if (selectedIds.size === 0) return;
    setDeleting(true);
    try {
      const res = await fetch("/api/notifications/delete", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ids: Array.from(selectedIds) }),
      });
      if (res.ok) {
        setNotificationsByTab((prev) => {
          const next = { ...prev };
          next[activeTab] = prev[activeTab].filter((n) => !selectedIds.has(n.id));
          writeNotificationCache(userId, activeTab, next[activeTab]);
          return next;
        });
        setSelectedIds(new Set());
        setEditMode(false);
      }
    } finally {
      setDeleting(false);
    }
  };

  const filteredNotifications = notificationsByTab[activeTab];
  const deletableNotifications = filteredNotifications.filter((n) => !isPendingApplication(n));
  const loading = loadingMap[activeTab];

  return (
    <>
      <div className="flex flex-col flex-1">
        <header className="sticky top-0 z-50 bg-white border-b border-[#e5e7eb]">
          <div className="relative h-14 px-4 flex items-center">
            <div className="font-black text-[22px] text-[#4d4d4d] leading-none">알림</div>
            <div className="ml-auto flex items-center gap-0">
              {editMode ? (
                <button
                  type="button"
                  className="h-12 w-12 -mr-2 flex items-center justify-center text-[14px] font-semibold text-gray-600"
                  onClick={() => { setEditMode(false); setSelectedIds(new Set()); }}
                >
                  취소
                </button>
              ) : (
                <button
                  type="button"
                  aria-label="알림 삭제"
                  className="h-12 w-12 -mr-2 flex items-center justify-center text-gray-700"
                  onClick={() => setEditMode(true)}
                >
                  <Trash2 size={20} strokeWidth={2.2} />
                </button>
              )}
            </div>
          </div>
          <div className="flex pl-4 pr-4 gap-2 pb-2 overflow-x-auto scrollbar-hide whitespace-nowrap">
            {(["class", "comment", "general"] as const).map((tab) => {
              const label = tab === "class" ? "클래스" : tab === "comment" ? "댓글" : "일반";
              const unreadCount = loadedTabs[tab]
                ? notificationsByTab[tab].filter((n) => !n.is_read).length
                : initialUnreadByTab[tab];
              const showBadge = activeTab !== tab && !viewedTabs.has(tab) && unreadCount > 0;
              return (
                <button
                  key={tab}
                  onClick={() => { setActiveTab(tab); setEditMode(false); setSelectedIds(new Set()); }}
                  className={`relative px-3.5 py-1.5 rounded-full text-[15px] font-semibold transition-colors ${
                    activeTab === tab ? "bg-black text-white" : "bg-gray-100 text-black/60"
                  }`}
                >
                  {label}
                  {showBadge && (
                    <span className="absolute top-0.5 -right-1 min-w-[18px] h-[18px] rounded-full bg-blue-500 border-2 border-white flex items-center justify-center">
                      <span className="text-[10px] font-bold text-white leading-none px-0.5">
                        {unreadCount > 99 ? "99+" : unreadCount}
                      </span>
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        </header>

        <div className="flex-1 overflow-y-auto">
          {loading ? (
            <div className="flex items-center justify-center h-32 text-gray-400">로딩 중...</div>
          ) : filteredNotifications.length === 0 ? (
            <div className="flex flex-col items-center justify-center flex-1 min-h-[60dvh]">
              <Image src="/app_img/surprise.png" alt="" width={80} height={80} unoptimized />
              <p className="text-sm text-gray-400 mt-3">현재 알림이 없습니다</p>
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
                    onClick={() => {
                      if (activeTab === "class") void markAsRead(item.id);
                      if (item.actor?.id) setProfileModalTarget(item.actor);
                    }}
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
                      {formatMessage(item)}{" "}
                      <span className="text-[11px] text-gray-400 ml-1">
                        {formatTime(item.created_at)}
                      </span>
                      {item.type === "class_application" &&
                        (() => {
                          const appId =
                            typeof item.meta?.application_id === "string"
                              ? item.meta.application_id
                              : null;
                          const isApproved = appId
                            ? approvedIds.has(appId) || item.meta?.application_status === "approved"
                            : false;
                          return isApproved ? (
                            <span className="ml-1 text-[14px] text-green-600 align-middle">승인됨</span>
                          ) : null;
                        })()}
                    </p>
                  </button>

                  {item.type === "class_application" &&
                    (() => {
                      const appId =
                        typeof item.meta?.application_id === "string"
                          ? item.meta.application_id
                          : null;
                      if (!appId) return null;
                      const isApproved =
                        approvedIds.has(appId) || item.meta?.application_status === "approved";
                      if (isApproved && !editMode) {
                        return (
                          <span
                            aria-hidden="true"
                            className="self-center h-[28px] w-[46px] flex-shrink-0"
                          />
                        );
                      }
                      if (!isApproved) {
                        return (
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
                      }
                      return null;
                    })()}

                  {editMode && !isPendingApplication(item) && (
                    <button
                      type="button"
                      className="flex-shrink-0 self-center ml-auto"
                      onClick={() => toggleSelect(item.id)}
                    >
                      <div className={`w-[22px] h-[22px] rounded-full border-2 flex items-center justify-center transition-colors ${
                        selectedIds.has(item.id)
                          ? "bg-black border-black"
                          : "border-gray-300 bg-white"
                      }`}>
                        {selectedIds.has(item.id) && (
                          <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
                            <path d="M2.5 6L5 8.5L9.5 3.5" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                          </svg>
                        )}
                      </div>
                    </button>
                  )}
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
      {editMode && (
        <div className="sticky bottom-0 z-50 bg-white border-t border-gray-200 px-4 py-3 flex items-center gap-3">
          <button
            type="button"
            className="text-[14px] font-semibold text-gray-600"
            onClick={toggleSelectAll}
          >
            {selectedIds.size === deletableNotifications.length && deletableNotifications.length > 0
              ? "전체 해제"
              : "전체 선택"}
          </button>
          <button
            type="button"
            disabled={selectedIds.size === 0 || deleting}
            className="ml-auto px-5 py-2 rounded-full bg-red-500 text-white text-[14px] font-semibold disabled:opacity-40"
            onClick={handleDelete}
          >
            {deleting ? "삭제 중..." : `삭제 (${selectedIds.size})`}
          </button>
        </div>
      )}

      {profileModalTarget?.id && (
        <UserProfileModal
          userId={profileModalTarget.id}
          initialProfile={profileModalTarget}
          onClose={() => setProfileModalTarget(null)}
        />
      )}

      <div
        className={`fixed inset-0 z-[160] bg-white flex flex-col transition-transform duration-300 ease-in-out ${
          classDetailId ? "translate-x-0" : "translate-x-full"
        }`}
        style={{ paddingTop: 'env(safe-area-inset-top)' }}
      >
        <ClassHeader onBack={() => setClassDetailId(null)} />
        <div className="flex-1 overflow-y-auto">
          {classDetailId && (
            <CachedClassDetailPage
              classIdOverride={classDetailId}
              onClose={() => setClassDetailId(null)}
            />
          )}
        </div>
      </div>
    </>
  );
}
