import type { LessonScene } from "./lesson-types";

// Derives, for every scene, the exact moment (0..1 of the scene) when each
// visual element must appear, from the word the narrator pronounces.
// `at` is the element's position on the board (normalized 0..1, r relative to height).
export type CueSpot = { x: number; y: number; r: number };
export type Cue = { label: string; anchor: string; at?: CueSpot };
export type TimedCue = Cue & { t: number };
export type ActiveSpot = { cue: TimedCue; p: number; o: number };

// Spotlight timing, in seconds of real playback.
const POP_S = 0.25;
const HOLD_S = 2.5;
const FADE_S = 0.7;

// Normalizes one token: typographic apostrophes, accents, punctuation.
const norm = (s: string) =>
  s
    .toLowerCase()
    .replace(/[\u2018\u2019\u02bc\u00b4`]/g, "'")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9' -]/g, "")
    .replace(/^[-']+|[-']+$/g, "");

// Splits French elisions so "l'électricité" is searchable as "electricite".
function tokenize(text: string): { w: string; src: number }[] {
  const out: { w: string; src: number }[] = [];
  text.split(/\s+/).forEach((raw, src) => {
    const n = norm(raw);
    if (!n) return;
    for (const piece of n.split("'")) {
      const p = piece.replace(/^-+|-+$/g, "");
      if (p) out.push({ w: p, src });
    }
  });
  return out;
}

// Two tokens are the same word, tolerating plurals/inflections ("couts" ~ "cout").
function sameWord(token: string, target: string): boolean {
  if (token === target) return true;
  if (token.length < 4 || target.length < 4) return false;
  const stem = Math.min(token.length, target.length) - 1;
  return token.slice(0, stem) === target.slice(0, stem);
}

type Token = { w: string; src: number };

// Finds an anchor strictly after `from`: exact words first, then inflections.
function findAnchor(tokens: Token[], anchor: string, from: number): { k: number; len: number } | null {
  const parts = tokenize(anchor).map((t) => t.w);
  if (!parts.length) return null;
  for (const exact of [true, false]) {
    for (let k = from; k < tokens.length; k++) {
      const hit = parts.every((p, pi) => {
        const tk = tokens[k + pi];
        if (!tk) return false;
        return exact ? tk.w === p : sameWord(tk.w, p);
      });
      if (hit) return { k, len: parts.length };
    }
  }
  return null;
}

export function sceneCues(scene: LessonScene, _durationSec = 18): TimedCue[] {
  const raw: Cue[] = scene.cues?.length
    ? scene.cues
    : (scene.keywords ?? []).map((label) => ({ label, anchor: label }));
  if (!raw.length) return [];
  const tokens = tokenize(scene.narration);
  const nWords = Math.max(1, scene.narration.split(/\s+/).length);
  let cursor = 0;
  const timed: TimedCue[] = [];
  raw.forEach((cue) => {
    const found = findAnchor(tokens, cue.anchor, cursor);
    if (!found) return;
    cursor = found.k + found.len;
    const t = (tokens[found.k]!.src + 0.4) / nWords;
    timed.push({ ...cue, t: Math.min(0.92, Math.max(0.02, t)) });
  });
  return timed;
}

// ---- Voice-driven timeline ----
// Where the narrator really speaks (seconds), measured on the audio.
export type Speech = { duration: number; segments: [number, number][] };

// Position (0..1 of spoken text, weighted by characters) where each word starts.
export function wordFractions(narration: string): number[] {
  const words = narration.trim().split(/\s+/);
  const total = words.reduce((s, w) => s + w.length + 1, 0) || 1;
  let acc = 0;
  return words.map((w) => { const f = acc / total; acc += w.length + 1; return f; });
}

// Spoken fraction at which each anchor is pronounced (chronological). An anchor
// that cannot be found appears together with the previous element, never skipped.
export function elementFractions(narration: string, anchors: string[]): number[] {
  const text = narration.trim();
  const tokens = tokenize(text);
  const wf = wordFractions(text);
  let cursor = 0, last = 0;
  return anchors.map((anchor) => {
    const found = findAnchor(tokens, anchor, cursor);
    if (!found) return last;
    cursor = found.k + found.len;
    last = wf[tokens[found.k]!.src] ?? last;
    return last;
  });
}

const speechTotal = (sp: Speech) => sp.segments.reduce((s, [a, b]) => s + (b - a), 0) || 1;

export function fracToTime(f: number, sp: Speech): number {
  let target = f * speechTotal(sp);
  for (const [a, b] of sp.segments) {
    if (target <= b - a) return a + target;
    target -= b - a;
  }
  return sp.segments[sp.segments.length - 1]?.[1] ?? 0;
}

export function timeToFrac(t: number, sp: Speech): number {
  let acc = 0;
  for (const [a, b] of sp.segments) {
    if (t >= b) acc += b - a;
    else if (t > a) acc += t - a;
  }
  return Math.min(1, acc / speechTotal(sp));
}

// Every recently named element remains independent. If the narrator names
// several objects quickly, their rings overlap instead of replacing one another.
export function activeSpots(
  frac: number,
  timed: TimedCue[],
  durationSec = 18,
): ActiveSpot[] {
  return timed.flatMap((cue) => {
    if (!cue.at) return [];
    const elapsed = (frac - cue.t) * Math.max(1, durationSec);
    if (elapsed <= 0 || elapsed > POP_S + HOLD_S + FADE_S) return [];
    const p = backOut(Math.min(1, elapsed / POP_S));
    const o = elapsed <= POP_S + HOLD_S
      ? Math.min(1, elapsed / POP_S)
      : Math.max(0, 1 - (elapsed - POP_S - HOLD_S) / FADE_S);
    return [{ cue, p, o }];
  });
}

// Friendly back-out ease for the spotlight pop.
function backOut(p: number): number {
  if (p >= 1) return 1;
  const c1 = 1.70158, c3 = c1 + 1;
  return 1 + c3 * Math.pow(p - 1, 3) + c1 * Math.pow(p - 1, 2);
}
