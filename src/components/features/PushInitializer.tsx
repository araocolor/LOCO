"use client";

import { useEffect } from "react";

export default function PushInitializer() {
  useEffect(() => {
    const isApp = navigator.userAgent.includes("XlatinApp");
    if (!isApp) return;

    import("@/lib/push-notifications").then(({ initPushNotifications }) => {
      initPushNotifications();
    });
  }, []);

  return null;
}
