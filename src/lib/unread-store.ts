const CHAT_UNREAD_EVENT = "loco-chat-unread";
const NOTIFICATION_UNREAD_EVENT = "loco-notification-unread";

let chatUnreadCount = 0;
let notificationUnreadCount = 0;

const chatListeners = new Set<() => void>();
const notificationListeners = new Set<() => void>();

export function getChatUnread() { return chatUnreadCount; }
export function getNotificationUnread() { return notificationUnreadCount; }

export function subscribeChatUnread(cb: () => void) {
  chatListeners.add(cb);
  return () => { chatListeners.delete(cb); };
}

export function subscribeNotificationUnread(cb: () => void) {
  notificationListeners.add(cb);
  return () => { notificationListeners.delete(cb); };
}

export function setChatUnread(count: number) {
  if (chatUnreadCount === count) return;
  chatUnreadCount = count;
  chatListeners.forEach((cb) => cb());
  window.dispatchEvent(new CustomEvent(CHAT_UNREAD_EVENT, { detail: count }));
}

export function setNotificationUnread(count: number) {
  if (notificationUnreadCount === count) return;
  notificationUnreadCount = count;
  notificationListeners.forEach((cb) => cb());
  window.dispatchEvent(new CustomEvent(NOTIFICATION_UNREAD_EVENT, { detail: count }));
}

export function incrementChatUnread(delta = 1) {
  setChatUnread(chatUnreadCount + delta);
}

export function incrementNotificationUnread(delta = 1) {
  setNotificationUnread(notificationUnreadCount + delta);
}

export async function fetchChatUnread() {
  try {
    const res = await fetch("/api/chat/unread-count?type=direct");
    if (!res.ok) return;
    const json = await res.json();
    setChatUnread(json?.count ?? 0);
  } catch {}
}

export async function fetchNotificationUnread() {
  try {
    const res = await fetch("/api/notifications/unread-count");
    if (!res.ok) return;
    const json = await res.json();
    setNotificationUnread(json?.count ?? 0);
  } catch {}
}

let lastSoundTime = 0;
const SOUND_COOLDOWN = 5000;

export function canPlayAlertSound(): boolean {
  const now = Date.now();
  if (now - lastSoundTime < SOUND_COOLDOWN) return false;
  lastSoundTime = now;
  return true;
}
