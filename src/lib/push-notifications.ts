let registeredToken: string | null = null;

export function getRegisteredToken() {
  return registeredToken;
}

export async function initPushNotifications() {
  const isApp = typeof navigator !== "undefined" && navigator.userAgent.includes("XlatinApp");
  if (!isApp) return;

  const { PushNotifications } = await import("@capacitor/push-notifications");

  const permResult = await PushNotifications.requestPermissions();
  if (permResult.receive !== "granted") return;

  PushNotifications.addListener("registration", async (token) => {
    registeredToken = token.value;
    try {
      await fetch("/api/device-tokens", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token: token.value, platform: "ios" }),
      });
    } catch {}
  });

  PushNotifications.addListener("registrationError", (err) => {
    console.error("[push] registration error", err);
  });

  PushNotifications.addListener("pushNotificationActionPerformed", (notification) => {
    const data = notification.notification.data;
    if (data?.url && typeof data.url === "string") {
      try {
        const u = new URL(data.url, window.location.origin);
        if (u.origin === window.location.origin) {
          window.location.href = u.toString();
        }
      } catch {}
    }
  });

  await PushNotifications.register();
}

export async function removePushToken() {
  if (!registeredToken) return;
  try {
    await fetch("/api/device-tokens", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ token: registeredToken }),
    });
  } catch {}
  registeredToken = null;
}
