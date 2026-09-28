import { useEffect, useRef, useState } from "react";
import { BookOpen, Brain, Check, ChevronLeft, ChevronRight, CircleHelp, Lightbulb, ListChecks, RotateCcw, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { WhiteboardPlayer } from "@/components/whiteboard-player";
import type { LessonContent } from "@/lib/lesson-types";

type Tab = "resume" | "guide" | "corrige" | "quiz";

export function LessonView({ content, onBack }: { content: LessonContent; onBack: () => void }) {
  const [tab, setTab] = useState<Tab>("resume");
  const [scene, setScene] = useState(0);
  const [guideDone, setGuideDone] = useState(false);
  const playerControls = useRef<((i: number) => void) | null>(null);
  const tabsRef = useRef<HTMLDivElement>(null);
  useEffect(() => { window.scrollTo({ top: 0 }); }, []);
  // On mobile, bring the exercise area into view when switching tabs.
  useEffect(() => {
    if (tab !== "resume" && window.innerWidth < 1280) tabsRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  }, [tab]);

  return <main className="mx-auto max-w-[1440px] px-4 py-6 sm:px-6">
    <div className="mb-4 flex items-center justify-between gap-4">
      <Button variant="ghost" size="sm" onClick={onBack}><ChevronLeft /> Mes leçons</Button>
      <div className="min-w-0 text-right sm:text-center"><p className="truncate text-sm font-semibold">{content.title}</p><p className="truncate text-xs text-muted-foreground">{content.subject}</p></div>
    </div>
    <div className="grid gap-5 xl:grid-cols-[1fr_320px]">
      <section>
        <WhiteboardPlayer key={content.title} scenes={content.scenes} onSceneChange={setScene} controlsRef={playerControls} />
        <div ref={tabsRef} className="mt-5 scroll-mt-16 grid grid-cols-4 border-b" role="tablist">
          {([["resume", "Résumé", BookOpen], ["guide", "Guide", ListChecks], ["corrige", "Corrigé", Check], ["quiz", "Quiz", Brain]] as const).map(([id, label, Icon]) =>
            <button key={id} role="tab" aria-selected={tab === id} onClick={() => setTab(id)} className={cn("flex min-w-0 items-center justify-center gap-1 border-b-2 px-1 py-3 text-xs font-semibold sm:gap-2 sm:px-4 sm:text-sm", tab === id ? "border-school-yellow-strong text-foreground" : "border-transparent text-muted-foreground hover:text-foreground")}><Icon className="size-4 shrink-0" />{label}</button>)}
        </div>
        <div className="py-7">
          {tab === "resume" && <Summary content={content} />}
          {tab === "guide" && <Guide content={content} onDone={() => setGuideDone(true)} />}
          {tab === "corrige" && <Correction content={content} attempted={guideDone} />}
          {tab === "quiz" && <Quiz content={content} />}
        </div>
      </section>
      <aside className="h-fit rounded-2xl border bg-card shadow-sm xl:sticky xl:top-24">
        <div className="border-b p-5"><p className="font-semibold">Scènes de la leçon</p><p className="mt-1 text-xs text-muted-foreground">{content.scenes.length} scènes narrées</p></div>
        <ol>{content.scenes.map((s, i) => <li key={i} className={cn("flex gap-3 border-b p-4 last:border-0", scene === i && "bg-primary-soft")}>
          <button onClick={() => playerControls.current?.(i)} className="flex w-full flex-1 items-center gap-3 text-left" aria-label={`Aller à la scène ${i + 1} : ${s.title}`}>
            <span className={cn("grid size-7 shrink-0 place-items-center rounded-full text-xs font-bold", scene === i ? "bg-primary text-primary-foreground" : scene > i ? "bg-success-soft text-success-strong" : "bg-muted text-muted-foreground")}>{scene > i ? <Check className="size-3.5" /> : i + 1}</span>
            <p className="text-sm font-semibold">{s.title}</p>
          </button></li>)}</ol>
      </aside>
    </div>
  </main>;
}

function Summary({ content }: { content: LessonContent }) {
  const s = content.summary;
  return <div>
    <h2 className="font-display text-2xl font-bold">L’essentiel à retenir</h2>
    <p className="mt-2 max-w-3xl text-sm leading-6 text-muted-foreground">{s.intro}</p>
    <div className="mt-6 grid gap-3 md:grid-cols-3">{s.points.map((p) => <div key={p.title} className="rounded-2xl border bg-card p-5"><p className="font-semibold text-school-yellow-strong">{p.title}</p><p className="mt-2 text-sm leading-6 text-muted-foreground">{p.text}</p></div>)}</div>
    <div className="mt-6 rounded-2xl border-l-4 border-school-yellow-strong bg-school-yellow-soft p-5"><p className="font-semibold text-school-yellow-strong">La règle d’or</p><p className="mt-1 text-sm text-foreground">{s.rule}</p></div>
  </div>;
}

const norm = (s: string) => s.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[’']/g, "'").replace(/\s+/g, " ").trim();

function Guide({ content, onDone }: { content: LessonContent; onDone: () => void }) {
  const [step, setStep] = useState(0);
  const [answer, setAnswer] = useState("");
  const [state, setState] = useState<"idle" | "ok" | "no" | "hint">("idle");
  const [tries, setTries] = useState(0);
  const steps = content.guide;
  const cur = steps[step];
  const finished = step >= steps.length;
  useEffect(() => { if (finished) onDone(); }, [finished, onDone]);

  const check = () => {
    if (!cur) return;
    const a = norm(answer);
    const ok = a.length > 1 && cur.accepted.some((acc) => { const n = norm(acc); return a.includes(n) || (n.includes(a) && a.length >= 3); });
    setTries((t) => t + 1);
    setState(ok ? "ok" : "no");
  };
  const next = () => { setStep(step + 1); setAnswer(""); setState("idle"); setTries(0); };

  return <div>
    <p className="text-xs font-bold text-success-strong">MODE ENTRAÎNEMENT · SANS RÉPONSE</p>
    <h2 className="mt-2 font-display text-2xl font-bold">À toi de jouer, étape par étape</h2>
    <div className="mt-4 flex gap-1.5">{steps.map((_, i) => <span key={i} className={cn("h-2 flex-1 rounded-full", i < step ? "bg-school-green" : i === step ? "bg-school-yellow" : "bg-muted")} />)}</div>
    {finished ? <div className="mt-6 rounded-2xl border bg-success-soft p-6 text-center">
      <Check className="mx-auto size-8 text-success-strong" />
      <p className="mt-2 font-semibold">Bravo, tu as trouvé toute la méthode!</p>
      <p className="mt-1 text-sm text-muted-foreground">Applique-la maintenant aux chiffres de ton exercice, puis compare avec le corrigé.</p>
      <Button variant="outline" className="mt-4" onClick={() => { setStep(0); setState("idle"); }}><RotateCcw /> Recommencer</Button>
    </div> : cur && <div className="mt-6 rounded-2xl border bg-card p-6">
      <div className="flex items-center gap-3"><span className="step-number">{step + 1}</span><p className="font-semibold">{cur.title}</p></div>
      <p className="mt-4 text-sm leading-6">{cur.question}</p>
      <form className="mt-4 flex flex-col gap-2 sm:flex-row" onSubmit={(e) => { e.preventDefault(); if (state === "ok") next(); else check(); }}>
        <Input value={answer} onChange={(e) => { setAnswer(e.target.value); if (state === "no") setState("idle"); }} placeholder="Ta réponse…" disabled={state === "ok"} aria-label="Ta réponse" />
        {state === "ok" ? <Button type="submit">Étape suivante <ChevronRight /></Button> : <Button type="submit" disabled={!answer.trim()}>Vérifier</Button>}
      </form>
      {state === "ok" && <p className="mt-3 flex items-center gap-2 rounded-xl bg-success-soft p-3 text-sm text-success-strong"><Check className="size-4" /> Tu es sur la bonne voie!</p>}
      {state === "no" && <div className="mt-3 rounded-xl bg-coral-soft p-3 text-sm text-coral-foreground"><p className="flex items-center gap-2"><X className="size-4" /> Pas tout à fait. Réessaie!</p>
        {tries >= 1 && <p className="mt-2 flex gap-2"><Lightbulb className="size-4 shrink-0" /> Indice : {cur.hint}</p>}
        {tries >= 3 && <button className="mt-2 text-xs font-semibold underline" onClick={next}>Passer cette étape</button>}
      </div>}
      {state === "idle" && <button className="mt-3 flex items-center gap-1 text-xs font-semibold text-muted-foreground hover:text-foreground" onClick={() => { setTries(1); setState("no"); }}><CircleHelp className="size-3.5" /> J’ai besoin d’un indice</button>}
    </div>}
  </div>;
}

function Correction({ content, attempted }: { content: LessonContent; attempted: boolean }) {
  const [revealed, setRevealed] = useState(false);
  return <div>
    <h2 className="font-display text-2xl font-bold">Corrigé détaillé</h2>
    <p className="mt-2 max-w-2xl text-sm leading-6 text-muted-foreground">Compare ta démarche seulement après avoir essayé.</p>
    {revealed ? <ol className="mt-6 space-y-3">{content.correction.map((c) => <li key={c.title} className="rounded-2xl border bg-card p-5"><p className="font-semibold">{c.title}</p><p className="mt-2 whitespace-pre-line text-sm leading-6 text-muted-foreground">{c.detail}</p></li>)}</ol>
      : <div className="mt-6 rounded-2xl border bg-card p-8 text-center">
        <span className="mx-auto mb-4 grid size-12 place-items-center rounded-full bg-school-yellow-soft text-school-yellow-strong"><CircleHelp /></span>
        <p className="font-semibold">{attempted ? "Bravo pour ta tentative!" : "As-tu essayé le guide pas-à-pas?"}</p>
        <p className="mt-1 text-sm text-muted-foreground">{attempted ? "Tu peux maintenant comparer." : "Tu apprendras beaucoup plus en essayant d’abord."}</p>
        <Button className="mt-5" variant={attempted ? "default" : "outline"} onClick={() => setRevealed(true)}>Afficher le corrigé</Button>
      </div>}
  </div>;
}

function Quiz({ content }: { content: LessonContent }) {
  const [i, setI] = useState(0);
  const [choice, setChoice] = useState<number | null>(null);
  const [checked, setChecked] = useState(false);
  const [score, setScore] = useState(0);
  const qs = content.quiz;
  const q = qs[i];
  if (!q) return <div className="rounded-2xl border bg-card p-8 text-center">
    <p className="text-xs font-bold text-muted-foreground">RÉSULTAT</p>
    <p className="mt-2 font-display text-4xl font-bold">{score} / {qs.length}</p>
    <p className="mt-2 text-sm text-muted-foreground">{score === qs.length ? "Parfait, tu maîtrises la matière!" : score >= qs.length * 0.6 ? "Très bien! Revois les scènes des questions manquées." : "Regarde la vidéo encore une fois, puis réessaie."}</p>
    <Button className="mt-5" onClick={() => { setI(0); setScore(0); setChoice(null); setChecked(false); }}><RotateCcw /> Recommencer le quiz</Button>
  </div>;
  const right = choice === q.answer;
  return <div>
    <div className="flex items-start justify-between gap-4"><div><p className="text-xs font-bold text-school-purple">QUESTION {i + 1} SUR {qs.length}</p><h2 className="mt-2 max-w-2xl font-display text-2xl font-bold">{q.question}</h2></div><span className="grid size-11 shrink-0 place-items-center rounded-full bg-school-yellow-soft text-sm font-bold text-school-yellow-strong">{score}</span></div>
    <div className="mt-6 grid gap-3">{q.options.map((o, k) => <button key={k} disabled={checked} onClick={() => setChoice(k)} className={cn("flex items-center gap-4 rounded-2xl border p-4 text-left text-sm font-medium", choice === k && !checked && "border-school-yellow-strong bg-school-yellow-soft", checked && k === q.answer && "border-success bg-success-soft", checked && choice === k && k !== q.answer && "border-coral bg-coral-soft", !checked && choice !== k && "bg-card hover:border-school-yellow-strong/50")}><span className="grid size-7 shrink-0 place-items-center rounded-full border text-xs">{String.fromCharCode(65 + k)}</span>{o}</button>)}</div>
    {checked && <p className={cn("mt-4 rounded-xl p-4 text-sm", right ? "bg-success-soft text-success-strong" : "bg-coral-soft text-coral-foreground")}>{right ? "Exact! " : "Pas tout à fait. "}{q.explanation}</p>}
    <div className="mt-6 flex justify-end">{checked ? <Button onClick={() => { setI(i + 1); setChoice(null); setChecked(false); }}>{i + 1 < qs.length ? "Question suivante" : "Voir mon résultat"} <ChevronRight /></Button> : <Button disabled={choice === null} onClick={() => { setChecked(true); if (choice === q.answer) setScore(score + 1); }}>Vérifier ma réponse</Button>}</div>
  </div>;
}
