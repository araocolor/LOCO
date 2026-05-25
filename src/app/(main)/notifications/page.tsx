"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import type { Notification } from "@/types/notification";

const TYPE_LABELS: Record<Notification["type"], string> = {
  application: "신청",
  approved: "승인",
  cancelled: "취소",
  notice: "공지",
  modified: "수정",
};

function formatDateTime(dateStr: string) {
  const d = new Date(dateStr);
  const yy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  const hh = String(d.getHours()).padStart(2, "0");
  const min = String(d.getMinutes()).padStart(2, "0");
  return `${yy}.${mm}.${dd} ${hh}:${min}`;
}

export default function NotificationsPage() {
  const supabase = useMemo(() => createClient(), []);
  const router = useRouter();

  const [userId, setUserId] = useState<string>("");
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(true);
  const [markingAll, setMarkingAll] = useState(false);
  const [runningId, setRunningId] = useState<string>("");

  useEffect(() => {
    let mounted = true;

    async function load() {
      setLoading(true);
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        router.push("/login");
        return;
      }

      const { data } = await supabase
        .from("notifications")
        .select("*")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false });

      if (!mounted) return;
      setUserId(user.id);
      setNotifications((data as Notification[]) ?? []);
      setLoading(false);
    }

    void load();

    return () => {
      mounted = false;
    };
  }, [router, supabase]);

  const unreadCount = notifications.filter((n) => !n.is_read).length;

  async function handleMarkAllRead() {
    if (!userId || unreadCount === 0) return;
    setMarkingAll(true);

    const { error } = await supabase
      .from("notifications")
      .update({ is_read: true })
      .eq("user_id", userId)
      .eq("is_read", false);

    if (!error) {
      setNotifications((prev) => prev.map((n) => ({ ...n, is_read: true })));
      router.refresh();
    }

    setMarkingAll(false);
  }

  async function handleNotificationClick(item: Notification) {
    if (runningId) return;
    setRunningId(item.id);

    if (!item.is_read) {
      const { error } = await supabase
        .from("notifications")
        .update({ is_read: true })
        .eq("id", item.id);

      if (!error) {
        setNotifications((prev) =>
          prev.map((n) => (n.id === item.id ? { ...n, is_read: true } : n))
        );
        router.refresh();
      }
    }

    if (item.link_url) {
      router.push(item.link_url);
      return;
    }

    setRunningId("");
  }

  if (loading) {
    return (
      <div className="max-w-xl mx-auto px-4 py-4 pb-24">
        <h1 className="text-xl font-bold">알림함</h1>
        <p className="text-sm text-gray-500 mt-4">불러오는 중...</p>
      </div>
    );
  }

  return (
    <div className="max-w-xl mx-auto px-4 py-4 pb-24 space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold">알림함</h1>
        <button
          type="button"
          className="btn-outline text-sm py-2 px-3"
          disabled={unreadCount === 0 || markingAll}
          onClick={handleMarkAllRead}
        >
          {markingAll ? "처리 중..." : "전체 읽음 처리"}
        </button>
      </div>

      {notifications.length === 0 ? (
        <div className="card p-6 text-center text-sm text-gray-400">
          받은 알림이 없습니다.
        </div>
      ) : (
        <div className="space-y-2">
          {notifications.map((item) => {
            const typeLabel = TYPE_LABELS[item.type] ?? "알림";
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => handleNotificationClick(item)}
                disabled={runningId === item.id}
                className={`card w-full p-4 text-left transition-opacity ${runningId === item.id ? "opacity-60" : ""}`}
              >
                <div className="flex items-start gap-2">
                  {!item.is_read && (
                    <span className="w-2 h-2 rounded-full bg-red-500 mt-1.5 flex-shrink-0" />
                  )}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-xs px-2 py-0.5 rounded-full bg-gray-100 text-gray-600">
                        {typeLabel}
                      </span>
                      {!item.is_read && (
                        <span className="text-xs text-red-500 font-medium">NEW</span>
                      )}
                    </div>
                    <p className="text-sm text-gray-800 leading-relaxed whitespace-pre-wrap">
                      {item.message}
                    </p>
                    <p className="text-xs text-gray-400 mt-2">
                      {formatDateTime(item.created_at)}
                    </p>
                  </div>
                </div>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
