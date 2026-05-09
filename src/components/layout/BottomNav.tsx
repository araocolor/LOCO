"use client";
import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";

const NAV_ITEMS = [
  {
    href: "/",
    label: "home",
    icon: (
      <svg xmlns="http://www.w3.org/2000/svg" width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M3 9.5L12 3l9 6.5V20a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V9.5z"/>
        <polyline points="9 21 9 12 15 12 15 21"/>
      </svg>
    ),
  },
  {
    href: "/messages",
    label: "message",
    icon: (
      <svg xmlns="http://www.w3.org/2000/svg" width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>
      </svg>
    ),
  },
  {
    href: "/search",
    label: "Search",
    icon: (
      <svg xmlns="http://www.w3.org/2000/svg" width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/>
        <circle cx="9" cy="7" r="4"/>
        <path d="M23 21v-2a4 4 0 0 0-3-3.87"/>
        <path d="M16 3.13a4 4 0 0 1 0 7.75"/>
      </svg>
    ),
  },
  {
    href: "/mypage",
    label: "My",
    icon: (
      <svg xmlns="http://www.w3.org/2000/svg" width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="12" cy="12" r="3"/>
        <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/>
      </svg>
    ),
  },
];

export default function BottomNav({ isLoggedIn }: { isLoggedIn: boolean }) {
  const pathname = usePathname();
  const [pressedNav, setPressedNav] = useState<{ href: string; basePath: string } | null>(null);
  void isLoggedIn;

  if (pathname.startsWith("/classes/") || pathname.startsWith("/users/")) return null;

  const activeHref =
    pressedNav && pressedNav.basePath === pathname
      ? pressedNav.href
      : pathname;

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-50 bg-white border-t border-[#e5e7eb] h-[70px] flex items-center">
      {NAV_ITEMS.map(({ href, label, icon }) => {
        const isActive =
          href === "/" ? activeHref === "/" : activeHref.startsWith(href);
        const className = `flex-1 h-full flex flex-col items-center justify-center gap-0.5 transition-colors ${
          isActive ? "text-[#FEE500]" : "text-gray-400"
        } ${href === "/" ? "pl-[15px]" : ""} ${href === "/mypage" ? "pr-[15px]" : ""}`;

        return (
          <Link
            key={href}
            href={href}
            className={className}
            prefetch={href === "/" || href === "/messages" ? true : undefined}
            onTouchStart={() => {
              setPressedNav({ href, basePath: pathname });
              setTimeout(() => {
                setPressedNav((prev) =>
                  prev?.href === href && prev?.basePath === pathname ? null : prev
                );
              }, 1200);
            }}
            onMouseDown={() => {
              setPressedNav({ href, basePath: pathname });
              setTimeout(() => {
                setPressedNav((prev) =>
                  prev?.href === href && prev?.basePath === pathname ? null : prev
                );
              }, 1200);
            }}
          >
            {icon}
            <span className="sr-only">{label}</span>
          </Link>
        );
      })}
    </nav>
  );
}
