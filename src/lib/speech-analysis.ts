import type { Speech } from "./scene-timing";

// Finds where the narrator actually speaks in an audio file (browser only),
// so board elements and captions follow the voice through its pauses.
const cache = new Map<string, Promise<Speech | null>>();

export function analyzeSpeech(url: string): Promise<Speech | null> {
  let p = cache.get(url);
  if (!p) {
    p = run(url).catch(() => null);
    cache.set(url, p);
  }
  return p;
}

async function run(url: string): Promise<Speech | null> {
  const buf = await (await fetch(url)).arrayBuffer();
  const Ctx = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
  if (!Ctx) return null;
  const ctx = new Ctx();
  try {
    const audio = await ctx.decodeAudioData(buf);
    const data = audio.getChannelData(0);
    const win = Math.max(1, Math.round(audio.sampleRate * 0.02));
    const rms: number[] = [];
    for (let i = 0; i + win <= data.length; i += win) {
      let s = 0;
      for (let j = i; j < i + win; j++) { const v = data[j] ?? 0; s += v * v; }
      rms.push(Math.sqrt(s / win));
    }
    const sorted = [...rms].sort((a, b) => a - b);
    const peak = sorted[Math.floor(sorted.length * 0.95)] ?? 0;
    const thr = Math.max(0.004, peak * 0.08);
    const minGap = 10; // 0.2 s of silence splits two spoken segments
    const segments: [number, number][] = [];
    let start = -1, quiet = 0;
    rms.forEach((v, i) => {
      if (v > thr) { if (start < 0) start = i; quiet = 0; }
      else if (start >= 0 && ++quiet >= minGap) { segments.push([start * 0.02, (i - quiet + 1) * 0.02]); start = -1; quiet = 0; }
    });
    if (start >= 0) segments.push([start * 0.02, (rms.length - quiet) * 0.02]);
    if (!segments.length) return null;
    return { duration: audio.duration, segments };
  } finally {
    void ctx.close?.();
  }
}
