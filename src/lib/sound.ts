const cache = new Map<string, HTMLAudioElement>();
const SOUND_FILE_BY_NAME = {
  "message-send": "message-send.mp3",
  "talk-send": "send_02.mp3",
  "notification-show": "notification-show.mp3",
} as const;

export function playSound(
  name: "message-send" | "talk-send" | "notification-show",
  options?: { volume?: number }
) {
  try {
    let audio = cache.get(name);
    if (!audio) {
      audio = new Audio(`/sound/${SOUND_FILE_BY_NAME[name]}`);
      cache.set(name, audio);
    }
    audio.currentTime = 0;
    audio.volume = options?.volume ?? 0.7;
    audio.play().catch(() => {});
  } catch {}
}
