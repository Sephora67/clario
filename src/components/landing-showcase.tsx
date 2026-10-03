import showcase3d from "@/assets/clario-showcase-3d.png.asset.json";
import { CalendarDays, FileText, Highlighter, Pause, PenLine, Play, Sparkles, Volume2 } from "lucide-react";
import type { ReactNode } from "react";
import { useI18n } from "@/lib/i18n";

const T = {
  en: {
    title: "One notebook for your whole semester",
    sub: "Courses, notes, narrated videos and deadlines — everything lives together in Clario.",
    cal: "October", exam: "Micro midterm", lab: "Psych lab report", quiz: "Stats quiz",
    eco: "ECO 1101 — Consumer choice", ex: "Exercise 3", exQ: "Find the equilibrium price when Qd = 120 − 2P and Qs = 3P − 30.",
    video: "Clario video", vKey: "Set supply equal to demand", vKey2: "P* = 30, Q* = 60",
    hi: "Hi Sam", courses: "My courses", upcoming: "Upcoming", recent: "Recent notes",
    psy: "PSY 1100 — Memory", psyL: ["Working memory holds ~7 items", "Encoding → storage → retrieval", "Spacing beats cramming"],
    lesson: "Narrated lesson", lessonT: "How neurons talk", step: "Step 2 of 4 · Synapse",
    days: ["M", "T", "W", "T", "F", "S", "S"],
  },
  fr: {
    title: "Un seul cahier pour toute ta session",
    sub: "Cours, notes, vidéos narrées et échéances — tout vit ensemble dans Clario.",
    cal: "Octobre", exam: "Intra de micro", lab: "Rapport de labo psy", quiz: "Quiz de stats",
    eco: "ECO 1101 — Choix du consommateur", ex: "Exercice 3", exQ: "Trouve le prix d'équilibre si Qd = 120 − 2P et Qo = 3P − 30.",
    video: "Vidéo Clario", vKey: "Égaliser l'offre et la demande", vKey2: "P* = 30, Q* = 60",
    hi: "Salut Sam", courses: "Mes cours", upcoming: "À venir", recent: "Notes récentes",
    psy: "PSY 1100 — La mémoire", psyL: ["La mémoire de travail retient ~7 éléments", "Encodage → stockage → rappel", "Espacer vaut mieux que bachoter"],
    lesson: "Leçon narrée", lessonT: "Comment les neurones communiquent", step: "Étape 2 sur 4 · Synapse",
    days: ["L", "M", "M", "J", "V", "S", "D"],
  },
};
type Txt = typeof T.en;

function Tablet({ children, className = "", delay = "0s" }: { children: ReactNode; className?: string; delay?: string }) {
  return <div className={className}><div className="showcase-float" style={{ animationDelay: delay }}>
    <div className="rounded-[1.4rem] bg-foreground p-[7px] shadow-[0_30px_60px_-25px_color-mix(in_oklab,var(--foreground)_45%,transparent)]">
      <div className="relative aspect-[4/3] overflow-hidden rounded-[1rem] bg-card text-[9px] leading-tight text-foreground">{children}</div>
    </div>
  </div></div>;
}

function Calendar({ x }: { x: Txt }) {
  const ev: Record<number, string> = { 8: "bg-school-yellow", 14: "bg-school-purple", 21: "bg-school-green", 22: "bg-school-yellow" };
  return <div className="flex h-full flex-col p-3">
    <div className="mb-2 flex items-center gap-1.5 font-semibold"><CalendarDays className="size-3" />{x.cal} 2026</div>
    <div className="grid grid-cols-7 gap-0.5 text-center text-muted-foreground">{x.days.map((d, i) => <span key={i}>{d}</span>)}</div>
    <div className="mt-1 grid flex-1 grid-cols-7 gap-0.5">
      {Array.from({ length: 28 }, (_, i) => <div key={i} className={`rounded p-0.5 text-[8px] ${i + 1 === 14 ? "bg-school-yellow-soft font-bold" : ""}`}>
        {i + 1}{ev[i + 1] && <div className={`mt-0.5 h-1 rounded-full ${ev[i + 1]}`} />}
      </div>)}
    </div>
    <div className="mt-2 space-y-1">
      <div className="rounded bg-school-purple-soft px-1.5 py-1">14 · {x.exam}</div>
      <div className="rounded bg-school-green-soft px-1.5 py-1">21 · {x.lab}</div>
    </div>
  </div>;
}

function Notebook({ x }: { x: Txt }) {
  return <div className="grid h-full grid-cols-[1.4fr_1fr]">
    <div className="relative border-r p-3">
      <div className="mb-1 flex items-center gap-1 text-muted-foreground"><FileText className="size-3" />{x.eco}</div>
      <p className="font-semibold">{x.ex}</p>
      <p className="mt-1"><span className="bg-school-green/50">{x.exQ}</span></p>
      <svg viewBox="0 0 120 80" className="mt-2 w-full">
        <line x1="10" y1="72" x2="115" y2="72" stroke="currentColor" strokeWidth="1" />
        <line x1="10" y1="72" x2="10" y2="5" stroke="currentColor" strokeWidth="1" />
        <path d="M15 10 L105 68" stroke="var(--school-purple)" strokeWidth="2" fill="none" />
        <path d="M15 66 L105 12" stroke="var(--school-green)" strokeWidth="2" fill="none" />
        <circle cx="60" cy="39" r="3" fill="var(--school-yellow-strong)" />
        <path d="M58 44 q8 10 20 8" stroke="var(--school-coral)" strokeWidth="1.2" fill="none" strokeLinecap="round" />
      </svg>
      <p className="font-[Caveat,cursive] text-[11px] text-school-purple">P* = 30 ✓</p>
      <div className="absolute bottom-2 left-2 flex gap-1 rounded-full border bg-background px-1.5 py-1"><PenLine className="size-2.5" /><Highlighter className="size-2.5" /></div>
    </div>
    <div className="flex flex-col bg-school-purple-soft/50 p-2">
      <p className="font-semibold">{x.video}</p>
      <div className="mt-1 grid aspect-video place-items-center rounded-md bg-school-yellow-soft"><Sparkles className="size-4 text-school-yellow-strong" /></div>
      <div className="mt-1.5 flex items-center gap-1"><Pause className="size-2.5" /><div className="h-1 flex-1 rounded-full bg-muted"><div className="h-1 w-3/5 rounded-full bg-school-purple" /></div><Volume2 className="size-2.5" /></div>
      <ul className="mt-2 space-y-1">
        <li className="rounded bg-card px-1.5 py-1">1 · {x.vKey}</li>
        <li className="rounded bg-card px-1.5 py-1">2 · {x.vKey2}</li>
      </ul>
    </div>
  </div>;
}

function Dashboard({ x }: { x: Txt }) {
  const courses = [["ECO 1101", "bg-school-yellow-soft"], ["PSY 1100", "bg-school-purple-soft"], ["STA 1010", "bg-school-green-soft"]];
  return <div className="grid h-full grid-cols-[2.2rem_1fr]">
    <div className="flex flex-col items-center gap-2 bg-muted/60 pt-3">{[0, 1, 2, 3].map((i) => <span key={i} className={`size-3 rounded ${i === 0 ? "bg-school-yellow" : "bg-border"}`} />)}</div>
    <div className="p-3">
      <p className="font-[Instrument_Serif] text-[15px]">{x.hi} 👋</p>
      <p className="mt-2 font-semibold">{x.courses}</p>
      <div className="mt-1 grid grid-cols-3 gap-1">{courses.map(([n, c]) => <div key={n} className={`rounded-md p-1.5 ${c}`}><FileText className="mb-1 size-3" />{n}</div>)}</div>
      <p className="mt-2 font-semibold">{x.upcoming}</p>
      <div className="mt-1 space-y-1">
        <div className="flex justify-between rounded border px-1.5 py-1"><span>{x.exam}</span><span className="text-muted-foreground">14/10</span></div>
        <div className="flex justify-between rounded border px-1.5 py-1"><span>{x.quiz}</span><span className="text-muted-foreground">22/10</span></div>
      </div>
    </div>
  </div>;
}

function Psych({ x }: { x: Txt }) {
  return <div className="h-full bg-[repeating-linear-gradient(transparent_0_13px,var(--border)_13px_14px)] p-3">
    <p className="font-semibold">{x.psy}</p>
    <ul className="mt-2 space-y-1.5 font-[Caveat,cursive] text-[12px]">
      {x.psyL.map((l, i) => <li key={l}><span className={i === 1 ? "bg-school-yellow/60" : ""}>• {l}</span></li>)}
    </ul>
    <svg viewBox="0 0 100 40" className="mt-2 w-3/4">
      {[15, 50, 85].map((cx, i) => <g key={cx}><rect x={cx - 13} y="10" width="26" height="16" rx="5" fill={["var(--school-purple-soft)", "var(--school-yellow-soft)", "var(--school-green-soft)"][i]} stroke="currentColor" strokeWidth=".6" />{i < 2 && <path d={`M${cx + 14} 18 h8`} stroke="currentColor" strokeWidth=".8" />}</g>)}
    </svg>
  </div>;
}

function Lesson({ x }: { x: Txt }) {
  return <div className="flex h-full flex-col bg-school-green-soft/50 p-3">
    <p className="text-muted-foreground">{x.lesson}</p>
    <p className="font-semibold">{x.lessonT}</p>
    <div className="relative mt-2 flex-1 rounded-md bg-card">
      <svg viewBox="0 0 120 60" className="absolute inset-0 h-full w-full">
        <circle cx="30" cy="30" r="12" fill="var(--school-purple-soft)" stroke="var(--school-purple)" />
        <path d="M42 30 H75" stroke="var(--school-purple)" strokeWidth="2" />
        <circle cx="90" cy="30" r="12" fill="var(--school-yellow-soft)" stroke="var(--school-yellow-strong)" />
        {[0, 1, 2].map((i) => <circle key={i} className="showcase-pulse" style={{ animationDelay: `${i * 0.4}s` }} cx={56 + i * 6} cy="30" r="1.8" fill="var(--school-green)" />)}
      </svg>
    </div>
    <div className="mt-2 flex items-center gap-1.5"><Play className="size-2.5" /><div className="h-1 flex-1 rounded-full bg-muted"><div className="h-1 w-2/5 rounded-full bg-school-green" /></div><span className="text-muted-foreground">{x.step}</span></div>
  </div>;
}

export function LandingShowcase() {
  const { locale } = useI18n();
  const x = T[locale];
  return <section className="overflow-hidden bg-school-yellow-soft/50">
    <div className="mx-auto max-w-6xl px-4 py-16 sm:px-6">
      <div className="mx-auto max-w-2xl text-center">
        <h2 className="font-[Instrument_Serif] text-4xl font-normal sm:text-5xl">{x.title}</h2>
        <p className="mt-3 font-[Work_Sans] text-muted-foreground">{x.sub}</p>
      </div>
      <div className="mx-auto mt-10 max-w-5xl">
        <img src={showcase3d.url} alt={x.title} width={1536} height={1024} loading="lazy" decoding="async"
          className="showcase-float h-auto w-full select-none rounded-[2rem] drop-shadow-[0_30px_40px_rgba(60,40,10,0.12)]" />
      </div>
    </div>
  </section>;
}
