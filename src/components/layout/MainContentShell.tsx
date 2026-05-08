"use client";

import { usePathname } from "next/navigation";

export default function MainContentShell({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const hideBottomNav = pathname.startsWith("/classes/") || pathname.startsWith("/users/");

  return <main className={`flex-1 ${hideBottomNav ? "" : "pb-[70px]"}`}>{children}</main>;
}
