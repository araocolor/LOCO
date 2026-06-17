"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { warmFriendsCache } from "@/lib/chat/friends-cache";

function getSafePath(value: string | null): string {
  if (!value || !value.startsWith("/") || value.startsWith("//") || value.startsWith("/\\")) return "/";
  if (!/^\/[A-Za-z0-9_\-/?#=&%.]*$/.test(value)) return "/";
  return value;
}

export default function AppDeepLinkHandler() {
  const router = useRouter();

  // 앱 시작 시 친구목록을 미리 받아둬서 메시지 메뉴 클릭 시 즉시 표시되게 한다.
  useEffect(() => {
    void warmFriendsCache();
  }, []);

  useEffect(() => {
    const isApp = navigator.userAgent.includes("XlatinApp");
    if (!isApp) return;

    let cleanup: (() => void) | undefined;

    Promise.all([
      import("@capacitor/app"),
      import("@capacitor/browser"),
    ]).then(([{ App }, { Browser }]) => {
      App.addListener("appUrlOpen", async (data) => {
        Browser.close().catch(() => {});

        const url = new URL(data.url.replace("xlatin://", "https://placeholder/"));
        const pathname = url.pathname === "/" ? "" : url.pathname;
        const params = url.searchParams;

        if (pathname === "/auth-callback" || data.url.startsWith("xlatin://auth-callback")) {
          const code = params.get("code");
          const next = getSafePath(params.get("next"));

          if (code) {
            const supabase = createClient();
            await supabase.auth.exchangeCodeForSession(code);

            const { data: { user } } = await supabase.auth.getUser();
            if (user) {
              const { data: profile } = await supabase
                .from("profiles")
                .select("nickname, region, favorite_genre, gender")
                .eq("id", user.id)
                .maybeSingle();

              const hasGenres = Array.isArray(profile?.favorite_genre) && profile.favorite_genre.length > 0;
              if (!profile?.nickname || !profile?.region || !profile?.gender || !hasGenres) {
                router.push("/onboarding");
                router.refresh();
                return;
              }
            }
          }

          router.push(next);
          router.refresh();
          return;
        }

        const path = "/" + pathname.replace(/^\/+/, "");
        if (path.startsWith("//") || path.startsWith("/\\")) return;
        if (!/^\/[A-Za-z0-9_\-/?#=&%.]*$/.test(path)) return;
        if (path !== "/") {
          router.push(path);
          router.refresh();
        }
      });
      cleanup = () => {
        App.removeAllListeners();
      };
    });

    return () => cleanup?.();
  }, [router]);

  return null;
}
