"use client";
import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import { usePathname } from "next/navigation";
import { useScrollChromeVisibility } from "@/hooks/useScrollChromeVisibility";
import { type MainTabId, getMainTab, subscribeMainTab, replaceMainTab } from "@/lib/main-tab";
import { useAuth } from "@/lib/auth-context";
import { prefetchNotifications } from "@/lib/notification-cache";
import { createClient } from "@/lib/supabase/client";
import { playSound } from "@/lib/sound";
import Avatar from "@/components/ui/Avatar";
import {
  getChatUnread,
  getNotificationUnread,
  subscribeChatUnread,
  subscribeNotificationUnread,
  fetchChatUnread,
  fetchNotificationUnread,
  incrementNotificationUnread,
  canPlayAlertSound,
} from "@/lib/unread-store";

const HOME_SUBTAB_CHANGE_EVENT = "loco-home-subtab-change";
type HomeSubTab = "allClasses" | "mySubscriptions" | "friendClasses";

const NAV_ITEMS: {
  tabId: MainTabId;
  label: string;
  activeColor: string;
  renderIcon: (isActive: boolean) => React.ReactNode;
}[] = [
  {
    tabId: "home",
    label: "home",
    activeColor: "#E84040",
    renderIcon: (isActive: boolean) => (
      <svg xmlns="http://www.w3.org/2000/svg" width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M3 9.5L12 3l9 6.5V20a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V9.5z" />
        <rect x="9" y="12" width="6" height="9" rx="0.8" fill={isActive ? "currentColor" : "none"} opacity={isActive ? 0.9 : undefined} />
      </svg>
    ),
  },
  {
    tabId: "messages",
    label: "message",
    activeColor: "#E84040",
    renderIcon: (isActive: boolean) => (
      <svg xmlns="http://www.w3.org/2000/svg" width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
        <rect x="8" y="8" width="8" height="6" rx="1.2" fill={isActive ? "currentColor" : "none"} stroke="none" opacity={isActive ? 0.9 : undefined} />
      </svg>
    ),
  },
  {
    tabId: "notifications",
    label: "알림",
    activeColor: "#E84040",
    renderIcon: (isActive: boolean) => (
      <svg xmlns="http://www.w3.org/2000/svg" width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9" />
        <path d="M10.3 21a1.94 1.94 0 0 0 3.4 0" />
        {isActive && <circle cx="12" cy="11" r="3" fill="currentColor" stroke="none" opacity={0.9} />}
      </svg>
    ),
  },
  {
    tabId: "search",
    label: "Search",
    activeColor: "#E84040",
    renderIcon: (isActive: boolean) => (
      <svg xmlns="http://www.w3.org/2000/svg" width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M14 18a2 2 0 0 0-4 0" />
        <path d="m19 11-2.11-6.657a2 2 0 0 0-2.752-1.148l-1.276.61A2 2 0 0 1 12 4H8.5a2 2 0 0 0-1.925 1.456L5 11" />
        <path d="M2 11h20" />
        <circle cx="17" cy="18" r="3" fill={isActive ? "currentColor" : "none"} opacity={isActive ? 0.9 : undefined} />
        <circle cx="7" cy="18" r="3" fill={isActive ? "currentColor" : "none"} opacity={isActive ? 0.9 : undefined} />
      </svg>
    ),
  },
  {
    tabId: "mypage",
    label: "My",
    activeColor: "#E84040",
    renderIcon: (isActive: boolean) => (
      <svg xmlns="http://www.w3.org/2000/svg" width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="12" cy="12" r="10" />
        <circle cx="12" cy="10" r="3" fill={isActive ? "currentColor" : "none"} opacity={isActive ? 0.9 : undefined} />
        <path d="M7 20.662V19a4 4 0 0 1 4-4h2a4 4 0 0 1 4 4v1.662" fill={isActive ? "currentColor" : "none"} opacity={isActive ? 0.9 : undefined} />
      </svg>
    ),
  },
];

function BadgeDot({ count, color }: { count: number; color: "red" | "blue" }) {
  if (count <= 0) return null;
  const bg = color === "red" ? "bg-red-500" : "bg-blue-500";
  return (
    <span className={`absolute -right-1.5 -top-1 min-w-[18px] h-[18px] rounded-full ${bg} border-2 border-white flex items-center justify-center`}>
      <span className="text-[10px] font-bold text-white leading-none px-0.5">
        {count > 99 ? "99+" : count}
      </span>
    </span>
  );
}

export default function BottomNav() {
  const pathname = usePathname();
  const [hydrated, setHydrated] = useState(false);
  const [homeSubTab, setHomeSubTab] = useState<HomeSubTab>("allClasses");
  const [profileImageUrl, setProfileImageUrl] = useState<string | null>(() => {
    if (typeof window === "undefined") return null;
    try {
      const raw = localStorage.getItem("loco_mypage_cache_local_v3");
      if (raw) {
        const parsed = JSON.parse(raw);
        return parsed?.profile?.profile_image_url ?? null;
      }
    } catch {}
    return null;
  });
  const [nickname, setNickname] = useState(() => {
    if (typeof window === "undefined") return "me";
    try {
      const raw = localStorage.getItem("loco_mypage_cache_local_v3");
      if (raw) {
        const parsed = JSON.parse(raw);
        return parsed?.profile?.nickname ?? "me";
      }
    } catch {}
    return "me";
  });
  const [avatarLoadFailed, setAvatarLoadFailed] = useState(false);
  const loginUnreadSoundPlayedUserRef = useRef<string | null>(null);
  const { user } = useAuth();
  const activeTab = useSyncExternalStore(subscribeMainTab, getMainTab, () => "home" as const);
  const chatUnread = useSyncExternalStore(subscribeChatUnread, getChatUnread, () => 0);
  const notificationUnread = useSyncExternalStore(subscribeNotificationUnread, getNotificationUnread, () => 0);
  const shouldAutoHide = pathname === "/" && activeTab === "home" && homeSubTab === "allClasses";
  const isChromeVisible = useScrollChromeVisibility(shouldAutoHide);

  useEffect(() => {
    queueMicrotask(() => setHydrated(true));
  }, []);

  useEffect(() => {
    function handleHomeSubTabChange(event: Event) {
      const nextTab = (event as CustomEvent<HomeSubTab>).detail;
      if (nextTab === "allClasses" || nextTab === "mySubscriptions" || nextTab === "friendClasses") {
        setHomeSubTab(nextTab);
      }
    }

    window.addEventListener(HOME_SUBTAB_CHANGE_EVENT, handleHomeSubTabChange);
    return () => window.removeEventListener(HOME_SUBTAB_CHANGE_EVENT, handleHomeSubTabChange);
  }, []);

  useEffect(() => {
    if (!user?.id) {
      queueMicrotask(() => {
        setProfileImageUrl(null);
        setNickname("me");
      });
      return;
    }
    try {
      const raw = localStorage.getItem("loco_mypage_cache_local_v3");
      if (!raw) return;
      const parsed = JSON.parse(raw);
      queueMicrotask(() => {
        setNickname(parsed?.profile?.nickname ?? "me");
        setProfileImageUrl(parsed?.profile?.profile_image_url ?? null);
      });
    } catch {}
  }, [user?.id]);

  useEffect(() => {
    queueMicrotask(() => setAvatarLoadFailed(false));
  }, [profileImageUrl]);

  useEffect(() => {
    if (!user?.id) return;
    void fetchNotificationUnread();
    void fetchChatUnread();
    prefetchNotifications(user.id);
  }, [user?.id]);

  useEffect(() => {
    if (!user?.id) return;
    const supabase = createClient();
    const channel = supabase
      .channel(`bottom-nav-notifications-${user.id}`)
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "notifications", filter: `user_id=eq.${user.id}` },
        () => {
          incrementNotificationUnread();
          if (canPlayAlertSound()) playSound("notification-arrived");
        }
      )
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [user?.id]);

  useEffect(() => {
    if (!user?.id) {
      loginUnreadSoundPlayedUserRef.current = null;
      return;
    }

    const isApp = /XlatinApp/.test(navigator.userAgent);
    if (isApp && chatUnread > 0 && loginUnreadSoundPlayedUserRef.current !== user.id) {
      loginUnreadSoundPlayedUserRef.current = user.id;
      try {
        const audio = new Audio("/sound/login_arrived_message.mp3");
        audio.volume = 0.7;
        void audio.play();
      } catch {}
    }
  }, [user?.id, chatUnread]);

  if (pathname.startsWith("/classes/") || pathname.startsWith("/users/")) return null;
  if (!hydrated) return null;

  return (
    <nav
      className={`fixed bottom-0 left-1/2 grid w-full max-w-[500px] z-50 grid-cols-5 px-4 bg-white shadow-[0_-8px_24px_rgba(0,0,0,0.08)] touch-manipulation overscroll-contain select-none transition-transform duration-200 ease-out motion-reduce:transition-none ${
        isChromeVisible ? "-translate-x-1/2 translate-y-0" : "-translate-x-1/2 translate-y-full"
      }`}
    >
      {NAV_ITEMS.map(({ tabId, label, activeColor, renderIcon }) => {
        const isActive = activeTab === tabId;
        const shouldShowAvatar = tabId === "mypage" && !isActive && user && profileImageUrl && !avatarLoadFailed;
        const className =
          "h-[65px] w-full min-w-0 flex flex-col items-center justify-start pt-3 gap-0.5 text-black/60 transition-colors";

        return (
          <button
            key={tabId}
            type="button"
            onClick={() => replaceMainTab(tabId)}
            className={className}
            style={isActive ? { color: activeColor } : undefined}
          >
            <span className="relative">
              {shouldShowAvatar ? (
                <Avatar src={profileImageUrl} nickname={nickname} size={30} onError={() => setAvatarLoadFailed(true)} />
              ) : (
                renderIcon(isActive)
              )}
              {tabId === "messages" && chatUnread > 0 && (
                <BadgeDot count={chatUnread} color="red" />
              )}
              {tabId === "notifications" && notificationUnread > 0 && (
                <BadgeDot count={notificationUnread} color="blue" />
              )}
            </span>
            <span className="sr-only">{label}</span>
          </button>
        );
      })}
    </nav>
  );
}
