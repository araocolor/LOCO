const cache = new Map<string, HTMLAudioElement>();
const SOUND_FILE_BY_NAME = {
  "message-send": "message-send.mp3",
  "talk-send": "send_02.mp3",
  "notification-show": "notification-show.mp3",
  "game-stik": "game_stik.mp3",
  "game-hit": "send_02.mp3",
} as const;

type SoundName = keyof typeof SOUND_FILE_BY_NAME;

function getAudio(name: SoundName) {
  let audio = cache.get(name);
  if (!audio) {
    audio = new Audio(`/sound/${SOUND_FILE_BY_NAME[name]}`);
    audio.preload = "auto";
    cache.set(name, audio);
  }
  return audio;
}

export function playSound(
  name: SoundName,
  options?: { volume?: number }
) {
  try {
    const audio = getAudio(name);
    audio.currentTime = 0;
    audio.volume = options?.volume ?? 0.7;
    audio.play().catch(() => {});
  } catch {}
}

export function primeSound(name: SoundName) {
  try {
    const audio = getAudio(name);
    const originalMuted = audio.muted;
    const originalVolume = audio.volume;
    audio.muted = true;
    audio.volume = 0;
    audio.play()
      .then(() => {
        audio.pause();
        audio.currentTime = 0;
        audio.muted = originalMuted;
        audio.volume = originalVolume;
      })
      .catch(() => {
        audio.muted = originalMuted;
        audio.volume = originalVolume;
      });
  } catch {}
}
