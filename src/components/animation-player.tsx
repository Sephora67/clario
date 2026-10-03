import { tf } from "@/lib/i18n";
import { useEffect, useMemo, useRef, useState } from "react";
import { Pause, Play, RotateCcw, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { analyzeSpeech } from "@/lib/speech-analysis";
import { fracToTime, type Speech } from "@/lib/scene-timing";
import type { AnimScript, AnimStep, Zone } from "@/lib/animation-types";
import { cn } from "@/lib/utils";

// Lecteur d'animation sur la page : calque canvas au-dessus du document.
// Surligne la zone au moment où la voix la prononce, déplace un pointeur
// doux et écrit les notes progressivement, synchronisés sur l'audio réel.

type Props = { script: AnimScript; audioUrl: string; pageWidth: number; pageHeight: number; onExit: () => void };

const HL = "rgba(255, 214, 61, 0.38)"; // jaune surligneur Clario, transparent
const INK = "#3d2f5c";

// Temps de début de chaque étape, dérivé de la vraie voix (segments de parole).
function stepTimes(script: AnimScript, speech: Speech): number[] {
  const texts = script.steps.map((s) => s.narration);
  const total = texts.reduce((acc, t) => acc + t.length + 1, 0) || 1;
  let acc = 0;
  return texts.map((t) => {
    const at = fracToTime(acc / total, speech);
    acc += t.length + 1;
    return at;
  });
}

function ease(p: number): number {
  return p < 0.5 ? 2 * p * p : 1 - Math.pow(-2 * p + 2, 2) / 2;
}

function center(z: Zone): [number, number] {
  return [z.x + z.w / 2, z.y + z.h / 2];
}

export default function AnimationPlayer({ script, audioUrl, pageWidth, pageHeight, onExit }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [playing, setPlaying] = useState(false);
  const [ready, setReady] = useState(false);
  const [t, setT] = useState(0);
  const [duration, setDuration] = useState(0);
  const rafRef = useRef<number | null>(null);
  const speechRef = useRef<Speech | null>(null);
  const timesRef = useRef<number[]>([]);
  const pointerRef = useRef<[number, number] | null>(null);

  const subtitle = useMemo(() => {
    const times = timesRef.current;
    let index = -1;
    script.steps.forEach((_, i) => { if (t >= (times[i] ?? 0)) index = i; });
    return index >= 0 ? script.steps[index]?.narration ?? "" : "";
  }, [t, script]);

  useEffect(() => {
    const audio = new Audio(audioUrl);
    audioRef.current = audio;
    let alive = true;
    void analyzeSpeech(audioUrl).then((speech) => {
      if (!alive || !speech) return;
      speechRef.current = speech;
      timesRef.current = stepTimes(script, speech);
      setReady(true);
    });
    audio.addEventListener("loadedmetadata", () => setDuration(audio.duration || 0));
    const tick = () => {
      setT(audio.currentTime);
      rafRef.current = requestAnimationFrame(tick);
    };
    rafRef.current = requestAnimationFrame(tick);
    return () => {
      alive = false;
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      audio.pause();
    };
  }, [audioUrl, script]);

  // Dessin du calque à chaque image.
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    const w = pageWidth, h = pageHeight;
    if (canvas.width !== Math.round(w) || canvas.height !== Math.round(h)) {
      canvas.width = Math.round(w);
      canvas.height = Math.round(h);
    }
    ctx.clearRect(0, 0, w, h);
    const times = timesRef.current;
    const now = t;

    script.steps.forEach((step, i) => {
      const start = times[i] ?? 0;
      if (start > now) return;
      const age = now - start;
      // Surlignage de la zone de l'étape (fondu d'entrée rapide, reste allumé
      // jusqu'à la fin de l'étape, puis s'efface doucement).
      if (step.zone) {
        const [z, next] = [step.zone, times[i + 1] ?? Number.POSITIVE_INFINITY];
        const inA = Math.min(1, age / 0.35);
        const outA = next === Number.POSITIVE_INFINITY ? 1 : Math.max(0, Math.min(1, (next - now) / 0.4));
        ctx.globalAlpha = 0.9 * inA * outA;
        ctx.fillStyle = HL;
        const pad = 0.006 * w;
        const x = z.x * w - pad, y = z.y * h - pad, rw = z.w * w + pad * 2, rh = z.h * h + pad * 2;
        const r = Math.min(10, rh / 2);
        ctx.beginPath();
        ctx.roundRect(x, y, rw, rh, r);
        ctx.fill();
        // Pointeur : pastille douce qui suit la zone active.
        const [cx, cy] = center(z);
        const target: [number, number] = [cx * w, cy * h];
        const prev = pointerRef.current;
        const move = prev ? Math.min(1, age / 0.5) : 1;
        const px = prev ? prev[0] + (target[0] - prev[0]) * ease(move) : target[0];
        const py = prev ? prev[1] + (target[1] - prev[1]) * ease(move) : target[1];
        pointerRef.current = [px, py];
        ctx.globalAlpha = inA * outA;
        ctx.beginPath();
        ctx.arc(px, py, 9, 0, Math.PI * 2);
        ctx.fillStyle = "rgba(61, 47, 92, 0.16)";
        ctx.fill();
        ctx.beginPath();
        ctx.arc(px, py, 3.5, 0, Math.PI * 2);
        ctx.fillStyle = INK;
        ctx.fill();
      }
      // Note dessinée progressivement pendant ~1,4 s après le début de l'étape.
      if (step.note) {
        const p = Math.min(1, age / 1.4);
        if (p > 0) drawNote(ctx, step.note, w, h, p);
      }
    });
    ctx.globalAlpha = 1;
  }, [t, script, pageWidth, pageHeight]);

  const toggle = () => {
    const audio = audioRef.current;
    if (!audio) return;
    if (audio.paused) { void audio.play(); setPlaying(true); } else { audio.pause(); setPlaying(false); }
  };
  const restart = () => {
    const audio = audioRef.current;
    if (!audio) return;
    audio.currentTime = 0;
    pointerRef.current = null;
    void audio.play();
    setPlaying(true);
  };

  return (
    <div className="pointer-events-none absolute inset-0 z-20">
      <canvas ref={canvasRef} className="pointer-events-none absolute inset-0 size-full" />
      <div className="pointer-events-auto absolute inset-x-2 bottom-2 sm:inset-x-4 sm:bottom-4">
        <div className="border bg-background/95 p-2 shadow-lg backdrop-blur sm:p-3">
          <p className="min-h-5 px-1 text-center text-xs leading-5 text-foreground sm:text-sm" aria-live="polite">{subtitle || "…"}</p>
          <div className="mt-2 flex items-center gap-2">
            <Button size="icon" variant="ghost" className="size-9 shrink-0" onClick={restart} aria-label={tf("Recommencer")}><RotateCcw /></Button>
            <Button size="icon" className="size-10 shrink-0 rounded-full" onClick={toggle} disabled={!ready} aria-label={playing ? tf("Pause") : tf("Lecture")}>
              {playing ? <Pause /> : <Play />}
            </Button>
            <input
              type="range"
              min={0}
              max={duration || 1}
              step={0.05}
              value={t}
              onChange={(e) => { const audio = audioRef.current; if (audio) { audio.currentTime = Number(e.target.value); pointerRef.current = null; } }}
              aria-label={tf("Position dans l'animation")}
              className="min-w-0 flex-1"
            />
            <Button size="icon" variant="ghost" className="size-9 shrink-0" onClick={onExit} aria-label={tf("Quitter l'animation")}><X /></Button>
          </div>
        </div>
      </div>
      {!ready && <div className="pointer-events-auto absolute right-2 top-2 border bg-background/95 px-2 py-1 text-[11px] text-muted-foreground shadow">{tf("Préparation de la voix…")}</div>}
    </div>
  );
}

// Notes de Clario : cercle autour d'une zone, soulignement, flèche, texte en marge.
function drawNote(ctx: CanvasRenderingContext2D, note: NonNullable<AnimStep["note"]>, w: number, h: number, p: number) {
  const z = note.zone;
  const x = z.x * w, y = z.y * h, rw = z.w * w, rh = z.h * h;
  ctx.strokeStyle = INK;
  ctx.fillStyle = INK;
  ctx.lineWidth = Math.max(1.5, w * 0.0022);
  ctx.lineCap = "round";
  const stroke = (path: () => void) => { ctx.save(); ctx.beginPath(); path(); const L = (ctx as unknown as { __len?: number }).__len ?? 1; void L; ctx.globalAlpha = 0.85; ctx.stroke(); ctx.restore(); };
  if (note.style === "circle") {
    const pad = w * 0.012;
    ctx.save();
    ctx.beginPath();
    ctx.ellipse(x + rw / 2, y + rh / 2, (rw / 2 + pad) * p, (rh / 2 + pad) * p, 0, 0, Math.PI * 2);
    ctx.globalAlpha = 0.85;
    ctx.stroke();
    ctx.restore();
  } else if (note.style === "underline") {
    ctx.save();
    ctx.globalAlpha = 0.85;
    ctx.beginPath();
    ctx.moveTo(x, y + rh + w * 0.006);
    ctx.lineTo(x + rw * p, y + rh + w * 0.006);
    ctx.stroke();
    ctx.restore();
  } else if (note.style === "arrow") {
    const sx = x - w * 0.08, sy = y + rh + h * 0.03;
    const ex = x + rw * 0.1, ey = y + rh * 0.6;
    const cx = sx + (ex - sx) * p, cy = sy + (ey - sy) * p;
    ctx.save();
    ctx.globalAlpha = 0.85;
    ctx.beginPath();
    ctx.moveTo(sx, sy);
    ctx.quadraticCurveTo((sx + ex) / 2 + w * 0.01, (sy + ey) / 2, cx, cy);
    ctx.stroke();
    if (p > 0.9) { ctx.beginPath(); ctx.moveTo(ex, ey); ctx.lineTo(ex - w * 0.012, ey - h * 0.008); ctx.lineTo(ex - w * 0.004, ey - h * 0.014); ctx.closePath(); ctx.fill(); }
    ctx.restore();
  } else {
    // note en marge : texte court écrit caractère par caractère
    const fs = Math.max(11, w * 0.017);
    ctx.save();
    ctx.font = `600 ${fs}px "Caveat", cursive`;
    const tx = x + rw + w * 0.02, ty = y + rh / 2;
    const chars = Math.ceil(note.text.length * p);
    ctx.globalAlpha = 0.9;
    ctx.fillText(note.text.slice(0, chars), tx, ty);
    ctx.restore();
  }
}

export function PlayerShell({ className, children }: { className?: string; children: React.ReactNode }) {
  return <div className={cn("relative", className)}>{children}</div>;
}
