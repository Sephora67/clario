import { tf } from "@/lib/i18n";
import { useEffect, useMemo, useRef, useState } from "react";
import { Maximize, Maximize2, MessageCircleQuestion, Minimize2, Pause, Play, RotateCcw, SkipBack, SkipForward, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { MathFormula } from "@/components/math-formula";
import { getAnimationAudio } from "@/lib/library";
import type { ExplainerScene, ExplainerScript } from "@/lib/explainer-types";
import { elementFractions, timeToFrac, type Speech } from "@/lib/scene-timing";
import { analyzeSpeech } from "@/lib/speech-analysis";
import { cn } from "@/lib/utils";

// Les nouvelles vidéos ont une piste par scène : leurs silences réels pilotent
// les visuels et sous-titres. Le mode continu reste lisible pour les anciennes.

type Props = { script: ExplainerScript; onClose: () => void };
const SPEEDS = [1, 1.25, 1.5, 0.75];

export default function ExplainerPlayer({ script, onClose }: Props) {
  const continuous = !!script.fullAudioPath;
  const [urls, setUrls] = useState<(string | null)[] | null>(null);
  const [fullUrl, setFullUrl] = useState<string | null>(null);
  const [pageUrl, setPageUrl] = useState<string | null>(null);
  const [durations, setDurations] = useState<number[]>([]);
  const [speeches, setSpeeches] = useState<(Speech | null)[]>([]);
  const [scene, setScene] = useState(0);
  const [t, setT] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [speed, setSpeed] = useState(1);
  const [mode, setMode] = useState<"mini" | "large" | "full">("mini");
  const audioRef = useRef<HTMLAudioElement>(null);
  const autoplay = useRef(true);

  useEffect(() => {
    let alive = true;
    const made: string[] = [];
    void (async () => {
      const img = script.pageImagePath ? await getAnimationAudio(script.pageImagePath).catch(() => null) : null;
      if (img) made.push(img);
      if (!alive) return;
      setPageUrl(img);
      if (script.fullAudioPath) {
        const url = await getAnimationAudio(script.fullAudioPath).catch(() => null);
        if (url) made.push(url);
        if (!alive) return;
        setFullUrl(url);
        return;
      }
      const list = await Promise.all(script.scenes.map((s) => (s.audioPath ? getAnimationAudio(s.audioPath).catch(() => null) : Promise.resolve(null))));
      list.forEach((u) => u && made.push(u));
      if (!alive) return;
      // Repère les portions réellement parlées : les silences ne décalent plus les visuels.
      const speech = await Promise.all(list.map((u) => u ? analyzeSpeech(u) : Promise.resolve(null)));
      const metadataDurations = await Promise.all(list.map((u) => new Promise<number>((resolve) => {
        if (!u) { resolve(4); return; }
        const audio = new Audio(u);
        audio.preload = "metadata";
        audio.onloadedmetadata = () => resolve(Number.isFinite(audio.duration) ? audio.duration : 4);
        audio.onerror = () => resolve(4);
      })));
      if (alive) {
        setUrls(list);
        setSpeeches(speech);
        setDurations(speech.map((s, index) => s?.duration ?? metadataDurations[index] ?? 4));
      }
    })();
    return () => { alive = false; made.forEach((u) => URL.revokeObjectURL(u)); };
  }, [script]);

  // Narration continue : début de chaque scène, réparti selon la longueur de son texte.
  const fullDur = fullUrl ? (audioRef.current?.duration || 0) : 0;
  const bounds = useMemo(() => {
    if (!continuous) return [];
    const totalChars = script.scenes.reduce((a, s) => a + s.narration.length, 0) || 1;
    const out: number[] = [];
    let acc = 0;
    for (const s of script.scenes) { out.push((acc / totalChars) * fullDur); acc += s.narration.length; }
    return out;
  }, [continuous, fullDur, script]);

  const ready = continuous ? !!fullUrl : !!urls;
  // En continu, la scène affichée découle directement de la position dans le fichier.
  const activeScene = continuous ? Math.max(0, bounds.filter((b) => t >= b).length - 1) : scene;
  const cur = script.scenes[activeScene];

  const src = continuous ? fullUrl : (urls?.[scene] ?? null);
  useEffect(() => {
    const a = audioRef.current;
    if (!a || !src) return;
    a.src = src; a.playbackRate = speed; setT(0);
    if (autoplay.current) void a.play().then(() => setPlaying(true)).catch(() => setPlaying(false));
  }, [src]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { if (audioRef.current) audioRef.current.playbackRate = speed; }, [speed]);
  useEffect(() => {
    let raf = 0;
    const tick = () => { const a = audioRef.current; if (a) setT(a.currentTime); raf = requestAnimationFrame(tick); };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, []);

  const sceneOffset = (i: number) => (continuous ? (bounds[i] ?? 0) : durations.slice(0, i).reduce((a, b) => a + b, 0));
  const sceneLength = (i: number) => (continuous ? ((bounds[i + 1] ?? fullDur) - (bounds[i] ?? 0)) : (durations[i] || 0)) || 1;
  const total = continuous ? fullDur : durations.reduce((a, b) => a + b, 0);
  const dur = continuous ? sceneLength(activeScene) : (durations[activeScene] || audioRef.current?.duration || 1);
  const localT = continuous ? Math.max(0, t - (bounds[activeScene] ?? 0)) : t;
  const progress = Math.min(1, localT / dur);
  const speech = speeches[activeScene];
  const spokenProgress = speech ? timeToFrac(Math.min(dur, localT + 0.12), speech) : progress;

  const go = (i: number, play = true) => {
    if (i < 0 || i >= script.scenes.length) return;
    autoplay.current = play;
    if (continuous) {
      const a = audioRef.current;
      if (a) { a.currentTime = bounds[i] ?? 0; setT(bounds[i] ?? 0); if (play) void a.play().then(() => setPlaying(true)).catch(() => setPlaying(false)); }
      return;
    }
    if (i === scene && audioRef.current) { audioRef.current.currentTime = 0; if (play) void audioRef.current.play(); }
    setScene(i);
  };
  const toggle = () => { const a = audioRef.current; if (!a) return; if (a.paused) { autoplay.current = true; void a.play(); setPlaying(true); } else { a.pause(); setPlaying(false); } };
  const onEnded = () => { if (!continuous && activeScene < script.scenes.length - 1) go(activeScene + 1); else setPlaying(false); };
  const seek = (g: number) => {
    if (continuous) { const a = audioRef.current; if (a) a.currentTime = g; setT(g); return; }
    let acc = 0;
    for (let i = 0; i < durations.length; i++) {
      const d = durations[i] ?? 0;
      if (g < acc + d || i === durations.length - 1) {
        autoplay.current = playing;
        if (i !== scene) { setScene(i); setTimeout(() => { if (audioRef.current) audioRef.current.currentTime = Math.max(0, g - acc); }, 60); }
        else if (audioRef.current) audioRef.current.currentTime = Math.max(0, g - acc);
        return;
      }
      acc += d;
    }
  };
  // Plein écran maison en CSS : l'API navigateur déclenche une barre d'adresse
  // Android (« Pour quitter le mode Plein écran… ») qu'on ne veut jamais montrer.
  const fullscreen = () => setMode((m) => (m === "full" ? "large" : "full"));
  const fmt = (s: number) => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, "0")}`;

  return <>
    {mode === "large" && <div className="fixed inset-0 z-40 bg-foreground/40" onClick={() => setMode("mini")} />}
    <div role="dialog" aria-label={tf("Vidéo explicative : {0}", [script.title])}
      className={cn("fixed z-50 flex flex-col overflow-hidden border bg-background shadow-2xl",
        mode === "mini" ? "bottom-3 right-3 w-[min(92vw,380px)] rounded-lg" : mode === "full" ? "inset-0 h-full w-full rounded-none border-0" : "left-1/2 top-1/2 w-[min(96vw,1100px)] -translate-x-1/2 -translate-y-1/2 rounded-xl")}>
      <audio ref={audioRef} onEnded={onEnded} onPause={() => setPlaying(false)} onPlay={() => setPlaying(true)} />
      <div className="flex items-center gap-2 border-b px-3 py-1.5">
        <span className="min-w-0 flex-1 truncate text-xs font-semibold">{script.title}</span>
        <span className="hidden text-[10px] uppercase tracking-wide text-muted-foreground sm:inline">{script.pageKind}</span>
        <Button size="icon" variant="ghost" className="size-7" onClick={() => setMode(mode === "mini" ? "large" : "mini")} aria-label={mode === "mini" ? tf("Agrandir") : tf("Réduire")}>{mode === "mini" ? <Maximize2 className="size-3.5" /> : <Minimize2 className="size-3.5" />}</Button>
        <Button size="icon" variant="ghost" className="size-7" onClick={fullscreen} aria-label={mode === "full" ? tf("Quitter le plein écran") : tf("Plein écran")}>{mode === "full" ? <Minimize2 className="size-3.5" /> : <Maximize className="size-3.5" />}</Button>
        <Button size="icon" variant="ghost" className="size-7" onClick={onClose} aria-label={tf("Fermer la vidéo")}><X className="size-3.5" /></Button>
      </div>
      <div className={cn("flex min-h-0 flex-1", mode !== "mini" && "flex-col lg:flex-row")}>
        <div className="relative aspect-video w-full min-w-0 flex-1 overflow-hidden bg-card [container-type:inline-size]">
          {!ready ? <div className="grid size-full place-items-center text-xs text-muted-foreground">{tf("Chargement de la vidéo…")}</div>
            : cur && <Stage key={activeScene} scene={cur} progress={spokenProgress} pageUrl={pageUrl} />}
        </div>
        {mode !== "mini" && <ol className="max-h-40 shrink-0 overflow-y-auto border-t p-2 text-xs lg:max-h-none lg:w-60 lg:border-l lg:border-t-0">
          {script.scenes.map((s, i) => <li key={i}><button onClick={() => go(i)} className={cn("flex w-full gap-2 rounded px-2 py-1.5 text-left hover:bg-muted", i === activeScene && "bg-muted font-semibold")}><span className="text-muted-foreground">{fmt(sceneOffset(i))}</span><span className="min-w-0 truncate">{s.visual.heading || tf("Partie {0}", [i + 1])}</span></button></li>)}
        </ol>}
      </div>
      {/* Sous-titre sous l'image : il ne recouvre jamais l'animation. */}
      {cur && <p className="shrink-0 border-t bg-muted px-3 py-1.5 text-center text-xs leading-snug text-foreground sm:text-sm">{subtitle(cur.narration, spokenProgress)}</p>}

      <div className="relative z-10 flex items-center gap-1 border-t bg-background px-2 py-1.5">
        <Button size="icon" variant="ghost" className="size-8" onClick={() => go(activeScene - 1)} disabled={activeScene === 0} aria-label={tf("Partie précédente")}><SkipBack className="size-4" /></Button>
        <Button size="icon" className="size-9 rounded-full" onClick={toggle} disabled={!ready} aria-label={playing ? tf("Pause") : tf("Lecture")}>{playing ? <Pause /> : <Play />}</Button>
        <Button size="icon" variant="ghost" className="size-8" onClick={() => go(activeScene + 1)} disabled={activeScene >= script.scenes.length - 1} aria-label={tf("Partie suivante")}><SkipForward className="size-4" /></Button>
        <input type="range" min={0} max={total || 1} step={0.1} value={continuous ? t : sceneOffset(activeScene) + t} onChange={(e) => seek(Number(e.target.value))} aria-label={tf("Position dans la vidéo")} className="min-w-0 flex-1" />
        <span className="w-16 text-right text-[10px] tabular-nums text-muted-foreground">{fmt(continuous ? t : sceneOffset(activeScene) + t)} / {fmt(total)}</span>
        <Button size="sm" variant="ghost" className="h-8 px-2 text-xs" onClick={() => setSpeed(SPEEDS[(SPEEDS.indexOf(speed) + 1) % SPEEDS.length] ?? 1)} aria-label={tf("Vitesse de lecture")}>{speed}×</Button>
        <Button size="icon" variant="ghost" className="size-8" onClick={() => go(0)} aria-label={tf("Recommencer")}><RotateCcw className="size-4" /></Button>
      </div>
    </div>
  </>;
}

// Sous-titre : la phrase en cours, estimée dans la narration de la scène.
function subtitle(text: string, p: number) {
  const parts = text.match(/[^.!?]+[.!?]*/g) ?? [text];
  const total = parts.reduce((a, s) => a + s.length, 0) || 1;
  let acc = 0;
  for (const s of parts) { acc += s.length; if (acc / total >= p) return s.trim(); }
  return parts[parts.length - 1]?.trim() ?? text;
}

function revealFractions(scene: ExplainerScene): number[] {
  const { items, anchors } = scene.visual;
  if (!items.length) return [];
  if (anchors?.length === items.length) return elementFractions(scene.narration, anchors);
  const inferred = elementFractions(scene.narration, items);
  if (inferred.some((fraction) => fraction > 0)) return inferred;
  return items.map((_, index) => 0.08 + (index / Math.max(1, items.length - 1)) * 0.72);
}

function Stage({ scene, progress, pageUrl }: { scene: ExplainerScene; progress: number; pageUrl: string | null }) {
  const v = scene.visual;
  const itemFractions = useMemo(() => revealFractions(scene), [scene]);
  const shown = itemFractions.filter((fraction) => progress >= fraction).length;
  const formulaFraction = useMemo(() => elementFractions(scene.narration, [v.formulaAnchor || v.formula || ""])[0] ?? 0, [scene.narration, v.formula, v.formulaAnchor]);
  const fs = "text-[clamp(10px,3cqi,22px)]";
  const Heading = <div className="relative w-fit">
    <h3 className="font-display text-[clamp(14px,5cqi,40px)] font-bold leading-tight">{v.heading}</h3>
    <svg viewBox="0 0 100 6" preserveAspectRatio="none" className="mt-1 h-[0.5cqi] min-h-1 w-full text-primary"><path d="M1 4 Q 30 1 55 3.5 T 99 2.5" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" pathLength={1} strokeDasharray={1} strokeDashoffset={Math.max(0, 1 - progress * 5)} /></svg>
  </div>;

  if (v.type === "page" && v.zone && pageUrl) {
    const z = v.zone;
    const zoom = Math.min(3, 0.8 / Math.max(z.w, z.h * 1.4));
    const k = 1 + (zoom - 1) * Math.min(1, progress * 3);
    const cx = z.x + z.w / 2, cy = z.y + z.h / 2;
    return <div className="pointer-events-none absolute inset-0 overflow-hidden bg-muted">
      <div className="absolute left-1/2 top-1/2 w-[60%] origin-center transition-transform duration-300" style={{ transform: `translate(-50%, -50%) scale(${k}) translate(${(0.5 - cx) * 100}%, ${(0.5 - cy) * 100}%)` }}>
        <img src={pageUrl} alt="" className="block w-full shadow" />
        <div className="absolute rounded-sm border-2 border-primary bg-primary/20" style={{ left: `${z.x * 100}%`, top: `${z.y * 100}%`, width: `${z.w * 100}%`, height: `${z.h * 100}%`, opacity: Math.min(1, progress * 4) }} />
      </div>
      {v.heading && <div className="absolute left-3 top-3 rounded bg-background/95 px-2 py-1 text-[clamp(10px,2.6cqi,18px)] font-semibold shadow">{v.heading}</div>}
    </div>;
  }

  if (v.type === "outro") {
    return <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center overflow-hidden p-[5cqi] text-center animate-in fade-in duration-500">
      {Heading}
      {/* Réplique exacte du bouton « Clario » de la barre du bas (taille, coins, couleurs, icône). */}
      <div className="absolute bottom-[max(0.375rem,env(safe-area-inset-bottom))] right-2 flex h-9 shrink-0 items-center gap-2 rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground shadow-lg" style={{ opacity: Math.min(1, progress * 3), transform: `scale(${0.7 + Math.min(1, progress * 3) * 0.3})`, transformOrigin: "bottom right" }}>
        <MessageCircleQuestion className="size-4" />{tf("Clario")}</div>
    </div>;
  }

  return <div className="pointer-events-none absolute inset-0 flex flex-col gap-[3cqi] overflow-hidden p-[5cqi] animate-in fade-in duration-500">
    {v.type === "title" && <div className="m-auto text-center">
      <p className="text-[clamp(9px,2.2cqi,14px)] font-semibold uppercase tracking-widest text-muted-foreground">{tf("Clario t’explique")}</p>
      <div className="mx-auto mt-2">{Heading}</div>
      {v.items.slice(0, shown).map((it, i) => <p key={i} className={cn("mt-2 text-muted-foreground animate-in fade-in slide-in-from-bottom-2", fs)}>{it}</p>)}
    </div>}
    {v.type !== "title" && Heading}
    {v.type === "formula" && v.formula && progress >= formulaFraction && <div className="max-w-full self-center rounded-lg border-2 border-dashed border-primary bg-background px-[4cqi] py-[2cqi] text-center animate-in zoom-in-95 duration-500">
      <MathFormula value={v.formula} className="text-[clamp(12px,4.5cqi,38px)] leading-tight" />
    </div>}
    {v.type === "compare" ? <div className="grid flex-1 grid-cols-2 gap-[2cqi]">
      {[0, 1].map((col) => <div key={col} className={cn("rounded-lg border p-[2cqi]", col ? "bg-accent/40" : "bg-secondary/50")}>
        {v.items.slice(0, shown).map((it, i) => <p key={i} className={cn("mb-[1.5cqi] animate-in fade-in slide-in-from-left-2", fs)}>{(it.split("|")[col] ?? "").trim()}</p>)}
      </div>)}
    </div> : v.type !== "title" && <ul className="space-y-[1.8cqi]">
      {v.items.slice(0, shown).map((it, i) => <li key={i} className={cn("flex items-start gap-[1.5cqi] animate-in fade-in slide-in-from-left-3 duration-500", fs)}>
        {v.type === "steps" ? <span className="grid size-[1.6em] shrink-0 place-items-center rounded-full bg-primary text-[0.8em] font-bold text-primary-foreground">{i + 1}</span>
          : <span className="mt-[0.45em] size-[0.5em] shrink-0 rounded-full bg-primary" />}
        <span className={cn(v.type === "example" && "font-hand text-[1.25em]")}>{it}</span>
      </li>)}
    </ul>}
  </div>;
}
