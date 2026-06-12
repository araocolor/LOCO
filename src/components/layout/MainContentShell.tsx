"use client";

import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";

export default function MainContentShell({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const hideBottomNav = pathname.startsWith("/classes/") || pathname.startsWith("/users/");
  const [isApp, setIsApp] = useState(false);

  useEffect(() => {
    setIsApp(navigator.userAgent.includes("XlatinApp"));
  }, []);

  const bottomPadding = hideBottomNav ? undefined : isApp ? '65px' : 'calc(65px + env(safe-area-inset-bottom))';

  return <main className={`flex-1 overflow-y-auto ${hideBottomNav ? "" : "pb-[65px]"}`} style={hideBottomNav ? undefined : { paddingBottom: bottomPadding }}>{children}</main>;
}
