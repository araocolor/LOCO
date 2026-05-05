"use client";
import { useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";

const NAV_ITEMS = [
  {
    href: "/",
    label: "home",
    icon: (
      <svg
        xmlns="http://www.w3.org/2000/svg"
        width="35"
        height="35"
        viewBox="0 0 24 24"
        fill="currentColor"
      >
        <path d="M12 2.8a1 1 0 0 1 .7.29l7.2 7.02a1 1 0 0 1 .3.72V20a2 2 0 0 1-2 2h-4.2a1 1 0 0 1-1-1v-4.6a.6.6 0 0 0-.6-.6h-.8a.6.6 0 0 0-.6.6V21a1 1 0 0 1-1 1H5.8a2 2 0 0 1-2-2v-9.17a1 1 0 0 1 .3-.72l7.2-7.02a1 1 0 0 1 .7-.29Z" />
      </svg>
    ),
  },
  {
    href: "/messages",
    label: "message",
    icon: (
      <svg
        xmlns="http://www.w3.org/2000/svg"
        width="35"
        height="35"
        viewBox="0 0 24 24"
        fill="currentColor"
      >
        <path d="M12 3.2c-4.7 0-8.5 3.53-8.5 7.9 0 2.03.82 3.87 2.18 5.26l-.98 3.26a.8.8 0 0 0 1 .98l3.16-.96A9.3 9.3 0 0 0 12 20c4.7 0 8.5-3.53 8.5-7.9S16.7 3.2 12 3.2Zm-3.1 9.3a1.1 1.1 0 1 1 0-2.2 1.1 1.1 0 0 1 0 2.2Zm3.1 0a1.1 1.1 0 1 1 0-2.2 1.1 1.1 0 0 1 0 2.2Zm3.1 0a1.1 1.1 0 1 1 0-2.2 1.1 1.1 0 0 1 0 2.2Z" />
      </svg>
    ),
  },
  {
    href: "/search",
    label: "Search",
    icon: (
      <svg
        xmlns="http://www.w3.org/2000/svg"
        width="35"
        height="35"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <path d="M12 21s-6-5.1-6-10a6 6 0 1 1 12 0c0 4.9-6 10-6 10z" />
        <circle cx="12" cy="11" r="2.5" />
      </svg>
    ),
  },
  {
    href: "/mypage",
    label: "My",
    icon: (
      <svg
        xmlns="http://www.w3.org/2000/svg"
        width="35"
        height="35"
        viewBox="0 0 24 24"
        fill="currentColor"
      >
        <path d="M12 12.2a4.2 4.2 0 1 0 0-8.4 4.2 4.2 0 0 0 0 8.4ZM12 13.8c-3.75 0-6.8 2.45-6.8 5.46 0 .52.42.94.94.94h11.72c.52 0 .94-.42.94-.94 0-3.01-3.05-5.46-6.8-5.46Z" />
      </svg>
    ),
  },
];

export default function BottomNav({ isLoggedIn }: { isLoggedIn: boolean }) {
  const pathname = usePathname();
  const router = useRouter();
  const [activeHref, setActiveHref] = useState(pathname);
  void isLoggedIn;

  if (pathname === "/classes/new") return null;

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-50 bg-white border-t border-[#e5e7eb] h-16 flex items-center">
      {NAV_ITEMS.map(({ href, label, icon }) => {
        const isActive =
          href === "/" ? activeHref === "/" : activeHref.startsWith(href);
        const className = `flex-1 h-full flex flex-col items-center justify-center gap-0.5 transition-colors ${
          isActive ? "text-[#FEE500]" : "text-gray-400"
        }`;

        return (
          <Link
            key={href}
            href={href}
            className={className}
            prefetch={href === "/" || href === "/messages" ? true : undefined}
            onTouchStart={() => { setActiveHref(href); router.push(href); }}
            onMouseDown={() => { setActiveHref(href); router.push(href); }}
          >
            {icon}
            <span className="sr-only">{label}</span>
          </Link>
        );
      })}
    </nav>
  );
}
