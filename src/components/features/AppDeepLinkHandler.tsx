"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

export default function AppDeepLinkHandler() {
  const router = useRouter();

  useEffect(() => {
    const isApp = new URLSearchParams(window.location.search).has("app");
    if (!isApp) return;

    let cleanup: (() => void) | undefined;

    import("@capacitor/app").then(({ App }) => {
      App.addListener("appUrlOpen", (data) => {
        const raw = data.url.replace(/^xlatin:\/\//, "");
        const path = "/" + raw.replace(/^\/+/, "");
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
