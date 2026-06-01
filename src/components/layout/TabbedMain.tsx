"use client";

import { useSyncExternalStore, useRef, useState, useEffect, useCallback } from "react";
import { usePathname } from "next/navigation";
import { getMainTab, subscribeMainTab, replaceMainTab } from "@/lib/main-tab";
import { useAuth } from "@/lib/auth-context";
import MainTabbedHomePage from "@/components/features/MainTabbedHomePage";
import MessagesHeaderClient from "@/components/layout/MessagesHeaderClient";
import MessagesPageClient from "@/app/(main)/messages/page-client";
import NotificationDrawer from "@/components/features/NotificationDrawer";
import SearchPageClient from "@/app/(main)/search/_components/SearchPageClient";
import MyPageHeader from "@/components/layout/MyPageHeader";
import MyPageCacheLoader from "@/components/user/MyPageCacheLoader";

export default function TabbedMain() {
  const activeTab = useSyncExternalStore(subscribeMainTab, getMainTab, () => "home" as const);
  const { user } = useAuth();
  const pathname = usePathname();
  const mountedRef = useRef(new Set<string>(["home"]));
  const prevTabRef = useRef(activeTab);
  const [notificationOpen, setNotificationOpen] = useState(false);

  useEffect(() => {
    if (activeTab === "notifications") {
      setNotificationOpen(true);
    }
  }, [activeTab]);

  const handleNotificationClose = useCallback(() => {
    setNotificationOpen(false);
    const fallback = prevTabRef.current === "notifications" ? "home" : prevTabRef.current;
    replaceMainTab(fallback);
  }, []);

  useEffect(() => {
    if (activeTab !== "notifications") {
      prevTabRef.current = activeTab;
    }
  }, [activeTab]);

  const isSubRoute = pathname.startsWith("/classes/") || pathname.startsWith("/users/");
  if (isSubRoute) return null;

  if (activeTab !== "notifications") {
    mountedRef.current.add(activeTab);
  }
  const mounted = mountedRef.current;

  return (
    <div className="flex-1 flex flex-col min-h-0">
      <NotificationDrawer
        open={notificationOpen}
        onClose={handleNotificationClose}
        userId={user?.id}
      />

      {mounted.has("home") && (
        <div className={activeTab === "home" ? "flex flex-col flex-1" : "hidden"}>
          <MainTabbedHomePage initialClasses={[]} />
        </div>
      )}

      {mounted.has("messages") && (
        <div className={activeTab === "messages" ? "flex flex-col flex-1" : "hidden"}>
          <MessagesHeaderClient />
          {user && <MessagesPageClient userId={user.id} />}
        </div>
      )}

      {mounted.has("search") && (
        <div className={activeTab === "search" ? "flex flex-col flex-1" : "hidden"}>
          <SearchPageClient />
        </div>
      )}

      {mounted.has("mypage") && (
        <div className={activeTab === "mypage" ? "flex flex-col flex-1" : "hidden"}>
          <MyPageHeader />
          <MyPageCacheLoader />
        </div>
      )}
    </div>
  );
}
