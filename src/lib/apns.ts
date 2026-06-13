import jwt from "jsonwebtoken";

const APNS_KEY_ID = process.env.APNS_KEY_ID ?? "";
const APNS_TEAM_ID = process.env.APNS_TEAM_ID ?? "";
const APNS_KEY_BASE64 = process.env.APNS_KEY_BASE64 ?? "";
const APNS_BUNDLE_ID = process.env.APNS_BUNDLE_ID ?? "com.xlatin.app";
const APNS_HOST = process.env.APNS_PRODUCTION === "1"
  ? "https://api.push.apple.com"
  : "https://api.sandbox.push.apple.com";

let cachedToken: { token: string; expiresAt: number } | null = null;

function getApnsJwt(): string {
  const now = Math.floor(Date.now() / 1000);
  if (cachedToken && cachedToken.expiresAt > now + 60) {
    return cachedToken.token;
  }

  const key = Buffer.from(APNS_KEY_BASE64, "base64").toString("utf8");
  const token = jwt.sign({}, key, {
    algorithm: "ES256",
    keyid: APNS_KEY_ID,
    issuer: APNS_TEAM_ID,
    expiresIn: "1h",
  });

  cachedToken = { token, expiresAt: now + 3600 };
  return token;
}

export interface ApnsPushPayload {
  deviceToken: string;
  title: string;
  body: string;
  data?: Record<string, string>;
  sound?: string;
  badge?: number;
}

export async function sendApnsPush(payload: ApnsPushPayload): Promise<boolean> {
  if (!APNS_KEY_ID || !APNS_TEAM_ID || !APNS_KEY_BASE64) {
    console.warn("[apns] 환경변수 미설정, 푸시 건너뜀");
    return false;
  }

  const apnsPayload = {
    aps: {
      alert: { title: payload.title, body: payload.body },
      sound: payload.sound ?? "default",
      ...(payload.badge !== undefined ? { badge: payload.badge } : {}),
    },
    ...payload.data,
  };

  try {
    const res = await fetch(
      `${APNS_HOST}/3/device/${payload.deviceToken}`,
      {
        method: "POST",
        headers: {
          authorization: `bearer ${getApnsJwt()}`,
          "apns-topic": APNS_BUNDLE_ID,
          "apns-push-type": "alert",
          "apns-priority": "10",
          "content-type": "application/json",
        },
        body: JSON.stringify(apnsPayload),
      }
    );

    if (!res.ok) {
      const text = await res.text();
      console.error("[apns] 발송 실패", res.status, text);
      return false;
    }

    return true;
  } catch (err) {
    console.error("[apns] 발송 오류", err);
    return false;
  }
}
