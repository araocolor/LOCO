"use client";
import { useState, useEffect } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { fetchWithAuthRetry } from "@/lib/auth/fetch-with-auth-retry";

const CONVERSATIONS_CACHE_KEY = "loco_conversations_cache_v2";
const MYPAGE_CACHE_KEY = "loco_mypage_cache_local_v2";
const SEARCH_CACHE_KEY = "search_prefetch_cache";
const SUGGESTIONS_KEY = "search_suggestions_cache";

function shouldRefreshSearchCache(raw: string | null) {
  if (!raw) return true;

  try {
    const parsed = JSON.parse(raw);
    if (typeof parsed.subscriptionCount !== "number") return true;
    if (!Array.isArray(parsed.followers) || !Array.isArray(parsed.following) || !Array.isArray(parsed.mySubscribers)) return true;
    const lists = [parsed.followers, parsed.following, parsed.mySubscribers].filter(Array.isArray);
    return lists.some((items) =>
      items.some((item: { member_type?: unknown }) => !("member_type" in item))
    );
  } catch {
    return true;
  }
}

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
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    queueMicrotask(() => setHydrated(true));

    async function prefetch() {
      try {
        const shouldPrefetchConversations = !localStorage.getItem(CONVERSATIONS_CACHE_KEY);
        const shouldPrefetchMyPage = !localStorage.getItem(MYPAGE_CACHE_KEY);
        const shouldPrefetchSearch = shouldRefreshSearchCache(localStorage.getItem(SEARCH_CACHE_KEY));
        const shouldPrefetchSuggestions = !localStorage.getItem(SUGGESTIONS_KEY);
        if (
          !isLoggedIn ||
          (
            !shouldPrefetchConversations &&
            !shouldPrefetchMyPage &&
            !shouldPrefetchSearch &&
            !shouldPrefetchSuggestions
          )
        ) return;

        const supabase = createClient();
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return;

        if (shouldPrefetchConversations) {
          const convRes = await fetch("/api/conversations");
          if (convRes.ok) {
            const json = await convRes.json();
            if (json.data) localStorage.setItem(CONVERSATIONS_CACHE_KEY, JSON.stringify(json.data.slice(0, 20)));
          }
        }

        if (shouldPrefetchMyPage) {
          const mypageRes = await fetch("/api/mypage/summary");
          if (mypageRes.ok) {
            const json = await mypageRes.json();
            if (json.profile) localStorage.setItem(MYPAGE_CACHE_KEY, JSON.stringify(json));
          }
        }

        if (shouldPrefetchSearch) {
          const socialRes = await fetchWithAuthRetry("/api/friends/social");
          if (socialRes.ok) {
            const social = await socialRes.json();
            const followers = social.data?.followers ?? [];
            const following = social.data?.following ?? [];
            const mySubscribers = social.data?.mySubscribers ?? [];
            const subscriptionCount = social.data?.subscriptionCount ?? 0;
            localStorage.setItem(
              SEARCH_CACHE_KEY,
              JSON.stringify({
                followers,
                following,
                mySubscribers,
                subscriptionCount,
                ts: Date.now(),
              })
            );
            const mypageRaw = localStorage.getItem(MYPAGE_CACHE_KEY);
            if (mypageRaw) {
              const mypage = JSON.parse(mypageRaw);
              localStorage.setItem(
                MYPAGE_CACHE_KEY,
                JSON.stringify({
                  ...mypage,
                  socialCounts: {
                    following: following.filter((item: { status?: string }) => item.status === "approved").length,
                    followers: followers.filter((item: { status?: string }) => item.status === "approved").length,
                    friends: following.filter((item: { status?: string }) => item.status === "friend").length,
                    subscriptionCount,
                  },
                })
              );
            }
          }
        }

        if (shouldPrefetchSuggestions) {
          const suggestionsRes = await fetch("/api/friends/suggestions?limit=30");
          if (suggestionsRes.ok) {
            const json = await suggestionsRes.json();
            if (json.data) localStorage.setItem(SUGGESTIONS_KEY, JSON.stringify({ suggestions: json.data, ts: Date.now() }));
          }
        }
      } catch {}
    }

    void prefetch();
  }, [isLoggedIn]);

  if (pathname.startsWith("/classes/") || pathname.startsWith("/users/")) return null;
  if (!hydrated) return null;

  const activeHref =
    pressedNav && pressedNav.basePath === pathname
      ? pressedNav.href
      : pathname;

  return (
    <nav
      className="fixed bottom-0 left-1/2 -translate-x-1/2 w-full max-w-[500px] z-50 h-[70px] flex items-center touch-none overscroll-contain select-none"
      onTouchMove={(event) => event.preventDefault()}
    >
      {NAV_ITEMS.map(({ href, label, icon }) => {
        const isActive =
          href === "/" ? activeHref === "/" : activeHref.startsWith(href);
        const className = `flex-1 h-full flex flex-col items-center justify-center gap-0.5 transition-colors ${
          isActive ? "text-[#FEE500]" : "text-white"
        } `;

        return (
          <Link
            key={href}
            href={href}
            className={className}
            style={{ backgroundColor: NAV_COLORS[href] }}
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
