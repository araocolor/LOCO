import { createAdminClient } from "@/lib/supabase/admin";
import { sendApnsPush } from "@/lib/apns";

interface ChatPushParams {
  roomId: string;
  senderId: string;
  senderNickname: string;
  messageContent: string;
  messageKind: string;
}

export async function sendChatPush({
  roomId,
  senderId,
  senderNickname,
  messageContent,
  messageKind,
}: ChatPushParams) {
  const admin = createAdminClient();

  const { data: members } = await admin
    .from("chat_room_members")
    .select("user_id, muted")
    .eq("room_id", roomId)
    .eq("status", "active")
    .neq("user_id", senderId);

  if (!members || members.length === 0) return;

  const recipientIds = members
    .filter((m) => !m.muted)
    .map((m) => m.user_id);

  if (recipientIds.length === 0) return;

  const { data: profiles } = await admin
    .from("profiles")
    .select("id, notification_sound_off")
    .in("id", recipientIds);

  const soundOffSet = new Set(
    (profiles ?? []).filter((p) => p.notification_sound_off).map((p) => p.id)
  );

  const { data: tokens } = await admin
    .from("device_tokens")
    .select("user_id, token")
    .in("user_id", recipientIds);

  if (!tokens || tokens.length === 0) return;

  let body: string;
  switch (messageKind) {
    case "image":
      body = "사진을 보냈습니다.";
      break;
    case "file":
      body = "파일을 보냈습니다.";
      break;
    case "emoji":
      body = "이모티콘을 보냈습니다.";
      break;
    default:
      body = messageContent.length > 100
        ? messageContent.slice(0, 100) + "..."
        : messageContent;
  }

  const pushUrl = `/messages?room=${roomId}`;

  await Promise.allSettled(
    tokens.map((t) =>
      sendApnsPush({
        deviceToken: t.token,
        title: senderNickname,
        body,
        sound: soundOffSet.has(t.user_id) ? "" : "default",
        data: { url: pushUrl, roomId },
      })
    )
  );
}
