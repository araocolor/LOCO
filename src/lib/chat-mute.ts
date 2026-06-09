const PREFIX = "chat_mute_";

export function isChatMuted(roomId: string): boolean {
  try {
    return localStorage.getItem(PREFIX + roomId) === "1";
  } catch {
    return false;
  }
}

export function setChatMuted(roomId: string, muted: boolean) {
  try {
    if (muted) {
      localStorage.setItem(PREFIX + roomId, "1");
    } else {
      localStorage.removeItem(PREFIX + roomId);
    }
  } catch {}
}
