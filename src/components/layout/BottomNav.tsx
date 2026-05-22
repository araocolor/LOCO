"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useScrollChromeVisibility } from "@/hooks/useScrollChromeVisibility";

const NAV_COLORS: Record<string, string> = {
  "/": "#E84040",
  "/messages": "#F5A623",
  "/search": "#B8D44A",
  "/mypage": "#5BB8E8",
};

const NAV_ITEMS = [
  {
    href: "/",
    label: "home",
    renderIcon: (isActive: boolean) => (
      <svg xmlns="http://www.w3.org/2000/svg" width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M3 9.5L12 3l9 6.5V20a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V9.5z" />
        <rect x="9" y="12" width="6" height="9" rx="0.8" fill={isActive ? "white" : "none"} />
      </svg>
    ),
  },
  {
    href: "/messages",
    label: "message",
    renderIcon: (isActive: boolean) => (
      <svg xmlns="http://www.w3.org/2000/svg" width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
        <rect x="8" y="8" width="8" height="6" rx="1.2" fill={isActive ? "white" : "none"} stroke="none" />
      </svg>
    ),
  },
  {
    href: "/search",
    label: "Search",
    renderIcon: (isActive: boolean) => (
      <svg xmlns="http://www.w3.org/2000/svg" width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
        <circle cx="9" cy="7" r="4" fill={isActive ? "white" : "none"} />
        <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
        <path d="M16 3.13a4 4 0 0 1 0 7.75" />
      </svg>
    ),
  },
  {
    href: "/mypage",
    label: "My",
    renderIcon: (isActive: boolean) => (
      <svg xmlns="http://www.w3.org/2000/svg" width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="12" cy="12" r="3" fill={isActive ? "white" : "none"} />
        <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
      </svg>
    ),
  },
];

export default function BottomNav() {
  const pathname = usePathname();
  const [hydrated, setHydrated] = useState(false);
  const shouldAutoHide = pathname === "/";
  const isChromeVisible = useScrollChromeVisibility(shouldAutoHide);

  useEffect(() => {
    queueMicrotask(() => setHydrated(true));
  }, []);

  if (pathname.startsWith("/classes/") || pathname.startsWith("/users/")) return null;
  if (!hydrated) return null;

  const activeHref = pathname;

  return (
    <nav
      className={`fixed bottom-0 left-1/2 w-full max-w-[500px] z-50 h-[70px] flex items-center touch-manipulation overscroll-contain select-none transition-transform duration-200 ease-out motion-reduce:transition-none ${
        isChromeVisible ? "-translate-x-1/2 translate-y-0" : "-translate-x-1/2 translate-y-full"
      }`}
    >
      {NAV_ITEMS.map(({ href, label, renderIcon }) => {
        const isActive =
          href === "/" ? activeHref === "/" : activeHref.startsWith(href);
        const className = `flex-1 h-full flex flex-col items-center justify-center gap-0.5 transition-colors ${
          isActive ? "text-white" : "text-[#FEE500]"
        } `;

        return (
          <Link
            key={href}
            href={href}
            className={className}
            style={{ backgroundColor: NAV_COLORS[href] }}
            prefetch={href === "/" || href === "/messages" ? true : undefined}
          >
            {renderIcon(isActive)}
            <span className="sr-only">{label}</span>
          </Link>
        );
      })}
    </nav>
  );
}
