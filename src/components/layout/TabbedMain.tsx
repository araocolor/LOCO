"use client";

import { useSyncExternalStore, useRef } from "react";
import { usePathname } from "next/navigation";
import { getMainTab, subscribeMainTab } from "@/lib/main-tab";
import { useAuth } from "@/lib/auth-context";
import MainTabbedHomePage from "@/components/features/MainTabbedHomePage";
import MessagesHeaderClient from "@/components/layout/MessagesHeaderClient";
import MessagesPageClient from "@/app/(main)/messages/page-client";
import SearchPageClient from "@/app/(main)/search/_components/SearchPageClient";
import MyPageHeader from "@/components/layout/MyPageHeader";
import MyPageCacheLoader from "@/components/user/MyPageCacheLoader";

export default function TabbedMain() {
  const activeTab = useSyncExternalStore(subscribeMainTab, getMainTab, () => "home" as const);
  const { user } = useAuth();
  const pathname = usePathname();
  const mountedRef = useRef(new Set<string>(["home"]));

  const isSubRoute = pathname.startsWith("/classes/") || pathname.startsWith("/users/");
  if (isSubRoute) return null;

  mountedRef.current.add(activeTab);
  const mounted = mountedRef.current;

  return (
    <div className="flex-1 flex flex-col min-h-0">
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
