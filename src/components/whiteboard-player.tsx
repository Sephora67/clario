import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Maximize2, Pause, Play, RotateCcw, RotateCw, SkipBack, SkipForward, Volume2, VolumeX } from "lucide-react";
import { Button } from "@/components/ui/button";
import { WhiteboardBoard } from "@/components/whiteboard-board";
import type { LessonScene } from "@/lib/lesson-types";
import { elementFractions, fracToTime, timeToFrac, wordFractions, type Speech } from "@/lib/scene-timing";
import { analyzeSpeech } from "@/lib/speech-analysis";

const FALLBACK_SECONDS = 18;
// Elements start drawing slightly before their word, so they are on the board as it is said.
const EARLY_S = 0.15;

// Hold after the voice stops: longer after an exclamation or a dense scene, short otherwise.
function tailFor(s: LessonScene | undefined, isLast: boolean) {
  if (!s) return 0.5;
  if (isLast) return 1.5;
  const t = s.narration.trim();
  if (t.endsWith("!") || t.endsWith("?")) return 0.9;
  return t.split(/\s+/).length > 45 ? 0.8 : 0.5;
}

export function WhiteboardPlayer({ scenes, captionsOn = true, onSceneChange, controlsRef }: { scenes: LessonScene[]; captionsOn?: boolean; onSceneChange?: (i: number) => void; controlsRef?: React.MutableRefObject<((i: number) => void) | null | undefined> }) {
  const [index, setIndex] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [started, setStarted] = useState(false);
  const [muted, setMuted] = useState(false);
  const [rate, setRate] = useState(1);
  const [t, setT] = useState(0);
  const [durations, setDurations] = useState<number[]>(() => scenes.map(() => FALLBACK_SECONDS));
  const [speech, setSpeech] = useState<Record<number, Speech | null>>({});
  const audioRef = useRef<HTMLAudioElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const holdRef = useRef<number | undefined>(undefined);
  const timerStart = useRef<number | null>(null);
  const tRef = useRef(0);
  const pendingSeek = useRef<number | null>(null);
  const requested = useRef(new Set<number>());
  const scene = scenes[index] ?? scenes[0]!;
  const duration = durations[index] ?? FALLBACK_SECONDS;
  const isLast = index === scenes.length - 1;

  useEffect(() => { onSceneChange?.(index); }, [index, onSceneChange]);

  // Measure where the voice really speaks (current + next scene).
  useEffect(() => {
    [index, index + 1].forEach((i) => {
      const url = scenes[i]?.audio;
      if (!url || requested.current.has(i)) return;
      requested.current.add(i);
      void analyzeSpeech(url).then((sp) => {
        setSpeech((prev) => ({ ...prev, [i]: sp }));
        if (sp) setDurations((prev) => prev.map((v, k) => (k === i ? sp.duration : v)));
      });
    });
  }, [index, scenes]);

  const goTo = useCallback((i: number, autoplay = true) => {
    window.clearTimeout(holdRef.current);
    const next = Math.max(0, Math.min(scenes.length - 1, i));
    tRef.current = 0; timerStart.current = null; setT(0); setIndex(next);
    if (autoplay) { setPlaying(true); setStarted(true); }
  }, [scenes.length]);

  const finish = useCallback(() => {
    window.clearTimeout(holdRef.current);
    holdRef.current = window.setTimeout(() => {
      if (!isLast) goTo(index + 1); else setPlaying(false);
    }, tailFor(scene, isLast) * 1000);
  }, [goTo, index, isLast, scene]);

  // Let the lesson view (scene sidebar) jump to a scene.
  useEffect(() => {
    if (controlsRef) controlsRef.current = (i: number) => goTo(i);
    return () => { if (controlsRef) controlsRef.current = null; };
  }, [controlsRef, goTo]);

  // Load the scene audio
  useEffect(() => {
    const a = audioRef.current; if (!a) return;
    if (scene.audio) {
      a.src = scene.audio; a.load();
      const s = pendingSeek.current; pendingSeek.current = null;
      if (s !== null) { const set = () => { a.currentTime = s; }; if (a.readyState >= 1) set(); else a.addEventListener("loadedmetadata", set, { once: true }); }
    } else a.removeAttribute("src");
  }, [scene.audio]);

  // When the student leaves the app (tab suspended) and comes back, resume cleanly.
  useEffect(() => {
    const onVis = () => {
      if (document.visibilityState !== "visible" || !playing) return;
      const a = audioRef.current;
      if (a && scene.audio && !a.ended) { a.currentTime = tRef.current; a.play().catch(() => {}); }
    };
    document.addEventListener("visibilitychange", onVis);
    return () => document.removeEventListener("visibilitychange", onVis);
  }, [playing, scene.audio]);

  // Playback speed applies to both the voice and the drawing clock.
  useEffect(() => {
    if (audioRef.current) audioRef.current.playbackRate = rate;
  }, [rate, index]);

  const skip = (delta: number) => {
    const d = durations[index] ?? FALLBACK_SECONDS;
    const target = Math.max(0, Math.min(d - 0.3, tRef.current + delta));
    window.clearTimeout(holdRef.current);
    tRef.current = target; timerStart.current = null; setT(target); setStarted(true);
    const a = audioRef.current;
    if (scene.audio && a) a.currentTime = target;
  };

  useEffect(() => {
    const a = audioRef.current;
    if (!playing) window.clearTimeout(holdRef.current);
    if (!a || !scene.audio) return;
    if (playing) { if (a.ended) finish(); else a.play().catch(() => {}); } else a.pause();
  }, [playing, index, scene.audio, finish]);

  useEffect(() => {
    if (!playing) { timerStart.current = null; return; }
    let raf = 0;
    const tick = (now: number) => {
      const a = audioRef.current;
      if (scene.audio && a) {
        // Self-heal: retry if the browser refused or interrupted playback.
        if (a.paused && !a.ended && a.readyState >= 2) a.play().catch(() => {});
        tRef.current = a.currentTime;
      } else {
        if (timerStart.current === null) timerStart.current = now - (tRef.current / rate) * 1000;
        tRef.current = ((now - timerStart.current) / 1000) * rate;
        if (tRef.current >= duration) { tRef.current = duration; setT(duration); finish(); return; }
      }
      setT(tRef.current);
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [playing, index, scene.audio, duration, finish, rate]);

  useEffect(() => () => window.clearTimeout(holdRef.current), []);

  const sp = speech[index];
  const timeline: Speech = useMemo(() => sp ?? { duration, segments: [[0, duration]] }, [sp, duration]);
  const times = useMemo(
    () => scene.board ? elementFractions(scene.narration, scene.board.elements.map((e) => e.anchor)).map((f) => Math.max(0, fracToTime(f, timeline) - EARLY_S)) : [],
    [scene, timeline],
  );
  const visible = times.map((tm) => started && t >= tm);

  // Captions follow the voice, pausing when the narrator pauses.
  const words = scene.narration.trim().split(/\s+/);
  const wf = useMemo(() => wordFractions(scene.narration), [scene.narration]);
  const spokenFrac = started ? timeToFrac(t, timeline) : 0;
  const spoken = wf.filter((f) => f <= spokenFrac + 0.005).length;

  const before = durations.slice(0, index).reduce((s, v) => s + v, 0);
  const total = durations.reduce((s, v) => s + v, 0) || 1;
  const current = before + Math.min(t, duration);

  const seek = (e: React.MouseEvent<HTMLDivElement>) => {
    const r = e.currentTarget.getBoundingClientRect();
    const target = ((e.clientX - r.left) / r.width) * total;
    let acc = 0;
    for (let i = 0; i < durations.length; i++) {
      const d = durations[i] ?? FALLBACK_SECONDS;
      if (target < acc + d || i === durations.length - 1) {
        const off = Math.max(0, Math.min(d - 0.2, target - acc));
        window.clearTimeout(holdRef.current);
        tRef.current = off; timerStart.current = null; setT(off); setStarted(true);
        if (i !== index) { pendingSeek.current = off; setIndex(i); }
        else if (audioRef.current && scene.audio) audioRef.current.currentTime = off;
        break;
      }
      acc += d;
    }
  };

  return (
    <div ref={containerRef} className="overflow-hidden rounded-2xl border bg-card shadow-xl">
      <div className="wb-root relative aspect-video overflow-hidden bg-whiteboard">
        <div key={index} className="board-enter absolute inset-0">
          {scene.board ? (
            <WhiteboardBoard board={scene.board} visible={visible} paused={!playing} />
          ) : scene.image ? (
            <>
              <img src={scene.image} alt={`Tableau blanc : ${scene.title}`} className="absolute inset-0 size-full object-cover" />
              <div className="absolute left-[3%] top-[3%] rounded-lg bg-whiteboard/85 px-2 py-0.5 font-hand text-sm font-bold text-whiteboard-ink sm:text-2xl">{index + 1}. {scene.title}</div>
            </>
          ) : (
            <p className="absolute inset-0 grid place-items-center font-hand text-3xl text-whiteboard-ink">{scene.title}</p>
          )}
        </div>
        {!playing && !started && (
          <button onClick={() => { setPlaying(true); setStarted(true); }} className="absolute inset-0 z-30 grid place-items-center bg-foreground/10" aria-label="Lancer la leçon">
            <span className="grid size-16 place-items-center rounded-full bg-primary text-primary-foreground shadow-xl sm:size-20"><Play className="ml-1 size-8" /></span>
          </button>
        )}
      </div>

      {captionsOn && (
        <div className="flex min-h-16 items-center justify-center border-t bg-caption-bar px-4 py-3" aria-live="polite">
          <p className="max-w-3xl text-center text-xs font-semibold leading-5 text-caption-bar-foreground sm:text-sm">
            {words.map((w, i) => <span key={i} className={i < spoken ? "text-caption-bar-foreground" : "text-muted-foreground/50"}>{w} </span>)}
          </p>
        </div>
      )}

      <div className="bg-player p-3 text-player-foreground">
        <div className="relative mb-3 h-2 cursor-pointer rounded-full bg-player-muted" onClick={seek}>
          <div className="h-full rounded-full bg-school-yellow-strong" style={{ width: `${(current / total) * 100}%` }} />
          {durations.slice(0, -1).map((_, i) => { const at = durations.slice(0, i + 1).reduce((s, v) => s + v, 0); return <span key={i} className="absolute top-0 h-full w-0.5 bg-player" style={{ left: `${(at / total) * 100}%` }} />; })}
        </div>
        <div className="flex items-center gap-1 sm:gap-2">
          <Button size="icon" variant="ghost" onClick={() => goTo(index - 1)} aria-label="Scène précédente" className="text-player-foreground hover:bg-player-muted"><SkipBack /></Button>
          <Button size="icon" variant="ghost" onClick={() => skip(-10)} aria-label="Reculer de 10 secondes" className="text-player-foreground hover:bg-player-muted"><RotateCcw /></Button>
          <Button size="icon" variant="ghost" onClick={() => { setPlaying(!playing); setStarted(true); }} aria-label={playing ? "Pause" : "Lecture"} className="text-player-foreground hover:bg-player-muted">{playing ? <Pause /> : <Play />}</Button>
          <Button size="icon" variant="ghost" onClick={() => skip(10)} aria-label="Avancer de 10 secondes" className="text-player-foreground hover:bg-player-muted"><RotateCw /></Button>
          <Button size="icon" variant="ghost" onClick={() => goTo(index + 1)} aria-label="Scène suivante" className="text-player-foreground hover:bg-player-muted"><SkipForward /></Button>
          <Button size="icon" variant="ghost" onClick={() => { setMuted(!muted); if (audioRef.current) audioRef.current.muted = !muted; }} aria-label={muted ? "Activer le son" : "Couper le son"} className="text-player-foreground hover:bg-player-muted">{muted ? <VolumeX /> : <Volume2 />}</Button>
          <span className="text-xs tabular-nums">{fmt(current)} / {fmt(total)}</span>
          <span className="ml-auto hidden text-xs font-semibold sm:inline">Scène {index + 1} / {scenes.length}</span>
          <Button size="sm" variant="ghost" onClick={() => setRate(rate === 0.75 ? 1 : rate === 1 ? 1.25 : rate === 1.25 ? 1.5 : 0.75)} aria-label={`Vitesse de lecture ${rate}×, cliquer pour changer`} className="min-w-12 rounded-full px-2 text-xs font-bold tabular-nums text-player-foreground hover:bg-player-muted">{rate}×</Button>
          <Button size="icon" variant="ghost" aria-label="Plein écran" onClick={() => containerRef.current?.requestFullscreen?.()} className="text-player-foreground hover:bg-player-muted"><Maximize2 /></Button>
        </div>
      </div>

      <audio ref={audioRef} preload="auto"
        onLoadedMetadata={(e) => { const d = e.currentTarget.duration; if (d && !Number.isNaN(d)) setDurations((prev) => prev.map((v, i) => (i === index ? d : v))); }}
        onEnded={() => finish()} />
    </div>
  );
}

function fmt(s: number) { const v = Math.max(0, Math.floor(s)); return `${Math.floor(v / 60)}:${String(v % 60).padStart(2, "0")}`; }
