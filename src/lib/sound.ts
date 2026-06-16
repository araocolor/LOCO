let ctx: AudioContext | null = null;
const bufferCache = new Map<string, AudioBuffer>();

const SOUND_FILE_BY_NAME = {
  "message-send": "message-send.mp3",
  "talk-send": "send_02.mp3",
  "notification-show": "notification-show.mp3",
  "game-stik": "game_stik.mp3",
  "game-hit": "send_02.mp3",
  "game-end": "loco_charging.mp3",
  "chat-arrived": "realtime_alert_arrived_02.mp3",
  "notification-arrived": "alert01.mp3",
} as const;

type SoundName = keyof typeof SOUND_FILE_BY_NAME;

function getContext(): AudioContext {
  if (!ctx) {
    ctx = new AudioContext();
  }
  if (ctx.state === "suspended") {
    ctx.resume().catch(() => {});
  }
  return ctx;
}

async function loadBuffer(name: SoundName): Promise<AudioBuffer | null> {
  const cached = bufferCache.get(name);
  if (cached) return cached;

  try {
    const res = await fetch(`/sound/${SOUND_FILE_BY_NAME[name]}`);
    const arrayBuffer = await res.arrayBuffer();
    const audioBuffer = await getContext().decodeAudioData(arrayBuffer);
    bufferCache.set(name, audioBuffer);
    return audioBuffer;
  } catch {
    return null;
  }
}

export function preloadSound(name: SoundName) {
  loadBuffer(name).catch(() => {});
}

export function playSound(
  name: SoundName,
  options?: { volume?: number }
) {
  const audioCtx = getContext();
  const buffer = bufferCache.get(name);

  if (!buffer) {
    loadBuffer(name).then((buf) => {
      if (buf) playSoundBuffer(audioCtx, buf, options?.volume ?? 0.5);
    });
    return;
  }

  playSoundBuffer(audioCtx, buffer, options?.volume ?? 0.5);
}

function playSoundBuffer(audioCtx: AudioContext, buffer: AudioBuffer, volume: number) {
  try {
    const source = audioCtx.createBufferSource();
    const gain = audioCtx.createGain();
    source.buffer = buffer;
    gain.gain.value = volume;
    source.connect(gain);
    gain.connect(audioCtx.destination);
    source.start(0);
  } catch {}
}
