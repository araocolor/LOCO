let chatUnreadCount = 0;
let chatUnreadByType = { direct: 0, group: 0, class: 0 };
let notificationUnreadCount = 0;
let notificationUnreadByTab = { class: 0, comment: 0, heart: 0, other: 0 };

const chatListeners = new Set<() => void>();
const notificationListeners = new Set<() => void>();

export function getChatUnread() { return chatUnreadCount; }
export function getChatUnreadByType() { return chatUnreadByType; }
export function getNotificationUnread() { return notificationUnreadCount; }
export function getNotificationUnreadByTab() { return notificationUnreadByTab; }

export function subscribeChatUnread(cb: () => void) {
  chatListeners.add(cb);
  return () => { chatListeners.delete(cb); };
}

export function subscribeNotificationUnread(cb: () => void) {
  notificationListeners.add(cb);
  return () => { notificationListeners.delete(cb); };
}

function notifyChatListeners() {
  chatListeners.forEach((cb) => cb());
}

export function setChatUnread(count: number, byType?: { direct: number; group: number; class: number }) {
  chatUnreadCount = count;
  if (byType) chatUnreadByType = { ...byType };
  notifyChatListeners();
}

export function setNotificationUnread(count: number, byTab?: { class: number; comment: number; heart: number; other: number }) {
  notificationUnreadCount = count;
  if (byTab) notificationUnreadByTab = { ...byTab };
  notificationListeners.forEach((cb) => cb());
}

export function incrementChatUnread(delta = 1) {
  setChatUnread(chatUnreadCount + delta);
}

export function incrementNotificationUnread(delta = 1) {
  setNotificationUnread(notificationUnreadCount + delta);
}

export async function fetchChatUnread() {
  try {
    const res = await fetch("/api/chat/unread-count");
    if (!res.ok) return;
    const json = await res.json();
    setChatUnread(json?.count ?? 0, json?.byType ?? { direct: 0, group: 0, class: 0 });
  } catch {}
}

export async function fetchNotificationUnread() {
  try {
    const res = await fetch("/api/notifications/unread-count");
    if (!res.ok) return;
    const json = await res.json();
    const byTab = json?.byTab ?? { class: 0, comment: 0, heart: 0, other: 0 };
    const total = json?.count ?? 0;
    setNotificationUnread(total, byTab);
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
