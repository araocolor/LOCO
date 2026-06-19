"use client";

import { useSyncExternalStore, useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { getMainTab, subscribeMainTab } from "@/lib/main-tab";
import { useAuth } from "@/lib/auth-context";
import MainTabbedHomePage from "@/components/features/MainTabbedHomePage";
import MessagesHeaderClient from "@/components/layout/MessagesHeaderClient";
import MessagesPageClient from "@/app/(main)/messages/page-client";
import CustomerServiceContent from "@/components/user/CustomerServiceContent";
import SearchPageClient from "@/app/(main)/search/_components/SearchPageClient";
import MyPageHeader from "@/components/layout/MyPageHeader";
import MyPageCacheLoader from "@/components/user/MyPageCacheLoader";
import type { ClassWithHost } from "@/components/class/ClassCard";

export default function TabbedMain({ initialClasses = [] }: { initialClasses?: ClassWithHost[] }) {
  const activeTab = useSyncExternalStore(subscribeMainTab, getMainTab, () => "home" as const);
  const { user } = useAuth();
  const pathname = usePathname();
  const [mountedTabs, setMountedTabs] = useState<Set<string>>(() => new Set(["home"]));

  const isSubRoute = pathname.startsWith("/classes/") || pathname.startsWith("/users/");

  useEffect(() => {
    queueMicrotask(() => {
      setMountedTabs((prev) => {
        if (prev.has(activeTab)) return prev;
        return new Set(prev).add(activeTab);
      });
    });
  }, [activeTab]);

  if (isSubRoute) return null;

  const mounted = mountedTabs;

  return (
    <div className="flex-1 flex flex-col min-h-0">
      {mounted.has("home") && (
        <div className={activeTab === "home" ? "flex flex-col flex-1" : "hidden"}>
          <MainTabbedHomePage initialClasses={initialClasses} />
        </div>
      )}

      {mounted.has("messages") && (
        <div className={activeTab === "messages" ? "flex flex-col flex-1" : "hidden"}>
          <MessagesHeaderClient />
          {user && <MessagesPageClient userId={user.id} />}
        </div>
      )}

      {mounted.has("community") && (
        <div className={activeTab === "community" ? "flex flex-col flex-1 min-h-0" : "hidden"}>
          <CustomerServiceContent active={activeTab === "community"} />
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
