const cache = new Map<string, HTMLAudioElement>();

export function playSound(
  name: "message-send" | "talk-send" | "notification-show",
  options?: { volume?: number }
) {
  try {
    let audio = cache.get(name);
    if (!audio) {
      audio = new Audio(`/sound/${name}.mp3`);
      cache.set(name, audio);
    }
    audio.currentTime = 0;
    audio.volume = options?.volume ?? 0.7;
    audio.play().catch(() => {});
  } catch {}
}
