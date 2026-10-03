import { tf } from "@/lib/i18n";
import { useCallback, useEffect, useRef, useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { Check, ChevronRight, FileText, GraduationCap, Loader2, LogOut, MonitorPlay, Moon, Play, Plus, Shield, Sparkles, Sun, Trash2, UploadCloud } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { useAuth } from "@/hooks/use-auth";
import { supabase } from "@/integrations/supabase/client";
import { LessonView } from "@/components/lesson-view";
import { demoLesson } from "@/lib/demo-lesson";
import type { LessonContent } from "@/lib/lesson-types";
import { deleteLesson, generateLesson, generateSceneMedia, getLesson, listLessons } from "@/lib/lessons.functions";
import { amIAdmin } from "@/lib/illustrations.functions";
import scene1 from "@/assets/board/scene-1.jpg";

type ThemeMode = "system" | "light" | "dark";
type Depth = "essentiel" | "standard" | "approfondi" | "examen";
type Screen = { kind: "library" } | { kind: "lesson"; content: LessonContent } | { kind: "generating"; files: File[]; lessonId?: string };
type Row = { id: string; title: string; subject: string; status: string; progress: number; created_at: string };

const MAX_FILES = 6;
const MAX_TOTAL_MB = 25;
const DEPTHS: Array<{ id: Depth; label: string; desc: string }> = [
  { id: "essentiel", get label() { return tf("Essentiel"); }, get desc() { return tf("Concepts principaux"); } },
  { id: "standard", get label() { return tf("Standard"); }, get desc() { return tf("Concepts + exemples"); } },
  { id: "approfondi", get label() { return tf("Approfondi"); }, get desc() { return tf("Raisonnement détaillé"); } },
  { id: "examen", get label() { return tf("Examen"); }, get desc() { return tf("Méthodes et pièges"); } },
];

// A lesson generation can be interrupted when the browser suspends the tab
// (student switching apps). Retry a few times instead of showing "Load failed".
const INTERRUPTED = /load failed|networkerror|failed to fetch|the operation was aborted|network request failed/i;
async function retry<T>(fn: () => Promise<T>, tries = 4): Promise<T> {
  let last: unknown;
  for (let n = 0; n < tries; n++) {
    try { return await fn(); } catch (e) {
      last = e;
      const msg = e instanceof Error ? e.message : "";
      if (!(INTERRUPTED.test(msg) || msg === "")) throw e;
      if (n < tries - 1) await new Promise((r) => setTimeout(r, 1500 * (n + 1)));
    }
  }
  throw last;
}

function ThemeControl() {
  const [mode, setMode] = useState<ThemeMode>("system");
  useEffect(() => {
    const saved = window.localStorage.getItem("lecon-theme") as ThemeMode | null;
    setMode(saved === "light" || saved === "dark" ? saved : "system");
  }, []);
  useEffect(() => {
    const query = window.matchMedia("(prefers-color-scheme: dark)");
    const apply = () => document.documentElement.classList.toggle("dark", mode === "dark" || (mode === "system" && query.matches));
    apply();
    query.addEventListener("change", apply);
    window.localStorage.setItem("lecon-theme", mode);
    return () => query.removeEventListener("change", apply);
  }, [mode]);
  const cycle = () => setMode((c) => (c === "system" ? "light" : c === "light" ? "dark" : "system"));
  const Icon = mode === "dark" ? Moon : mode === "light" ? Sun : MonitorPlay;
  return <Button variant="ghost" size="sm" onClick={cycle} aria-label={tf("Thème : {0}", [mode])} className="gap-2 text-muted-foreground"><Icon className="size-4" /><span className="hidden sm:inline">{mode === "system" ? tf("Auto") : mode === "light" ? tf("Clair") : tf("Sombre")}</span></Button>;
}

export function LessonStudio() {
  const [screen, setScreen] = useState<Screen>({ kind: "library" });
  const { user } = useAuth();
  const navigate = useNavigate();
  const fetchLesson = useServerFn(getLesson);
  const checkAdmin = useServerFn(amIAdmin);
  const [isAdmin, setIsAdmin] = useState(false);
  useEffect(() => {
    if (!user) { setIsAdmin(false); return; }
    checkAdmin().then((r) => setIsAdmin(r.admin)).catch(() => setIsAdmin(false));
  }, [user, checkAdmin]);
  const [opening, setOpening] = useState<string | null>(null);
  const home = useCallback(() => { setScreen({ kind: "library" }); window.scrollTo({ top: 0 }); }, []);

  const openLesson = async (id: string, status: string) => {
    if (status !== "ready") { setScreen({ kind: "generating", files: [], lessonId: id }); return; }
    setOpening(id);
    try { const r = await fetchLesson({ data: { id } }); setScreen({ kind: "lesson", content: r.content }); }
    finally { setOpening(null); }
  };

  return <div className="min-h-screen bg-background text-foreground">
    <header className="school-header sticky top-0 z-40 border-b bg-background/95">
      <div className="mx-auto flex h-16 max-w-[1440px] items-center gap-4 px-4 sm:px-6">
        <button onClick={home} className="flex items-center gap-3" aria-label={tf("Accueil")}><span className="grid size-9 place-items-center rounded-xl bg-primary text-primary-foreground"><GraduationCap className="size-5" /></span><span className="font-display text-lg font-bold">{tf("Clario")}</span></button>
        <div className="ml-auto flex items-center gap-2">
          <Button variant="secondary" size="sm" onClick={() => navigate({ to: "/cahier" })}>{tf("Mon cahier")}</Button>
          <ThemeControl />
          {user ? <>
            {isAdmin && <Button variant="ghost" size="sm" className="gap-2 text-muted-foreground" onClick={() => navigate({ to: "/admin" })}><Shield className="size-4" /><span className="hidden sm:inline">{tf("Admin")}</span></Button>}
            <span className="hidden size-9 place-items-center rounded-full bg-accent text-sm font-semibold text-accent-foreground sm:grid">{(user.email ?? "?").slice(0, 2).toUpperCase()}</span>
            <Button variant="ghost" size="icon" aria-label={tf("Se déconnecter")} onClick={() => supabase.auth.signOut()}><LogOut /></Button>
          </> : <Button size="sm" onClick={() => navigate({ to: "/auth" })}>{tf("Se connecter")}</Button>}
        </div>
      </div>
    </header>
    {screen.kind === "library" && <Library signedIn={!!user} name={user?.email?.split("@")[0]} onDemo={() => setScreen({ kind: "lesson", content: demoLesson })} onOpen={openLesson} opening={opening}
      onFiles={(files) => { if (!user) { navigate({ to: "/auth" }); return; } setScreen({ kind: "generating", files }); }} />}
    {screen.kind === "lesson" && <LessonView content={screen.content} onBack={home} />}
    {screen.kind === "generating" && <Generating files={screen.files} lessonId={screen.lessonId} onBack={home} onReady={(content) => setScreen({ kind: "lesson", content })} />}
  </div>;
}

function Library({ signedIn, name, onDemo, onOpen, onFiles, opening }: { signedIn: boolean; name?: string | undefined; onDemo: () => void; onOpen: (id: string, status: string) => void; onFiles: (f: File[]) => void; opening: string | null }) {
  const fileRef = useRef<HTMLInputElement>(null);
  const list = useServerFn(listLessons);
  const remove = useServerFn(deleteLesson);
  const [rows, setRows] = useState<Row[] | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [dragging, setDragging] = useState(false);
  const [picked, setPicked] = useState<File[]>([]);
  const [confirmId, setConfirmId] = useState<string | null>(null);
  const [minutes, setMinutes] = useState<number | null>(5);
  const [depth, setDepth] = useState<Depth>("standard");
  useEffect(() => { if (signedIn) list().then(setRows).catch(() => { setRows([]); setErr(tf("Impossible de charger vos leçons.")); }); else setRows([]); }, [signedIn, list]);

  const add = (list: FileList | null) => {
    if (!list?.length) return;
    const next = [...picked];
    for (const f of Array.from(list)) {
      if (next.length >= MAX_FILES) { setErr(`Vous avez ajouté ${next.length + Array.from(list).length} fichiers. Le maximum est ${MAX_FILES}. Retirez-en pour continuer.`); break; }
      const ok = /\.(pdf|txt|md|png|jpe?g|webp)$/i.test(f.name);
      if (!ok) { setErr("Formats acceptés : PDF, texte, Markdown ou photo (JPG, PNG). Astuce : exporte ton PowerPoint ou ton Word en PDF."); continue; }
      if (f.size > 20 * 1024 * 1024) { setErr(`« ${f.name} » dépasse 20 Mo. Essaie une version plus légère.`); continue; }
      if (next.some((x) => x.name === f.name && x.size === f.size)) continue;
      next.push(f);
    }
    const total = next.reduce((n, f) => n + f.size, 0);
    if (total > MAX_TOTAL_MB * 1024 * 1024) { setErr(`Total trop lourd (${Math.round(total / 1048576)} Mo). Le maximum est ${MAX_TOTAL_MB} Mo pour tous les documents.`); return; }
    setErr(null); setPicked(next);
  };
  const start = () => { if (picked.length) onFiles(picked); };
  const totalMb = (picked.reduce((n, f) => n + f.size, 0) / 1048576).toFixed(1);

  return <main className="mx-auto max-w-[1440px] px-4 py-8 sm:px-6 lg:py-12">
    <section className="mb-8">
      <p className="mb-2 text-sm font-semibold text-school-yellow-strong">{name ? tf("BONJOUR, {0}", [name.toUpperCase()]) : tf("BIENVENUE")}</p>
      <h1 className="font-display text-3xl font-bold sm:text-4xl">{tf("Qu’allons-nous apprendre?")}</h1>
      <p className="mt-2 max-w-2xl text-muted-foreground">{tf("Dépose tes notes : Clario écrit le script, dessine la leçon au tableau blanc, la raconte à voix haute et prépare ton guide et ton quiz.")}</p>
    </section>

    <section className="grid gap-6 lg:grid-cols-[1.4fr_1fr]">
      <div className="rounded-3xl border-2 border-dashed border-school-yellow bg-school-yellow-soft p-6 sm:p-8">
        <button onClick={() => fileRef.current?.click()} onDragOver={(e) => { e.preventDefault(); setDragging(true); }} onDragLeave={() => setDragging(false)} onDrop={(e) => { e.preventDefault(); setDragging(false); add(e.dataTransfer.files); }}
          className={cn("group flex w-full items-center gap-5 rounded-2xl p-4 text-left transition-colors", dragging && "bg-school-yellow")}>
          <input ref={fileRef} type="file" accept=".pdf,.txt,.md,.png,.jpg,.jpeg,.webp" multiple className="hidden" onChange={(e) => { add(e.target.files); e.target.value = ""; }} />
          <span className="grid size-14 shrink-0 place-items-center rounded-2xl bg-primary text-primary-foreground transition-transform group-hover:-translate-y-1"><UploadCloud className="size-6" /></span>
          <span>
            <h2 className="font-display text-xl font-bold sm:text-2xl">{tf("Ajouter mes documents de cours")}</h2>
            <p className="mt-1 text-sm leading-6 text-muted-foreground">{tf("Jusqu’à")}{" "}{MAX_FILES}{" "}{tf("fichiers : PDF, texte ou photos de notes.")}{" "}{signedIn ? "" : tf("Connecte-toi pour créer tes propres leçons.")}</p>
            <span className="mt-2 inline-flex items-center gap-2 text-sm font-semibold text-school-yellow-strong">{tf("Choisir des fichiers")}{" "}<ChevronRight className="size-4" /></span>
          </span>
        </button>

        {picked.length > 0 && <div className="mt-5 rounded-2xl border bg-card p-4">
          <p className="text-xs font-bold text-muted-foreground">{picked.length}{" "}{tf("FICHIER")}{picked.length > 1 ? "S" : ""} · {totalMb}{" "}{tf("MO ·")}{" "}{minutes ?? tf("IA")}{" "}{tf("MIN")}</p>
          <ul className="mt-3 space-y-2">{picked.map((f, i) => <li key={`${f.name}-${i}`} className="flex items-center gap-2 text-sm">
            <FileText className="size-4 shrink-0 text-school-green" /><span className="min-w-0 flex-1 truncate font-medium">{f.name}</span>
            <button aria-label={tf("Retirer {0}", [f.name])} className="text-muted-foreground hover:text-coral-foreground" onClick={() => setPicked(picked.filter((_, k) => k !== i))}><Plus className="size-4 rotate-45" /></button>
          </li>)}</ul>

          <div className="mt-5">
            <p className="text-xs font-bold text-muted-foreground">{tf("DURÉE DE LA VIDÉO")}</p>
            <div className="mt-2 grid grid-cols-5 gap-1.5">{([["Auto", null], ["3", 3], ["5", 5], ["8", 8], ["10", 10]] as const).map(([label, m]) =>
              <button key={label} onClick={() => setMinutes(m)} className={cn("rounded-xl border px-1 py-2 text-xs font-semibold", minutes === m ? "border-school-yellow-strong bg-school-yellow text-foreground" : "bg-background text-muted-foreground hover:border-school-yellow-strong/50")}>{label}{m ? tf(" min") : ""}</button>)}</div>
            <p className="mt-1.5 text-xs text-muted-foreground">{minutes === null ? tf("L’IA ajuste la durée à la quantité de matière.") : minutes <= 3 ? tf("L’essentiel, va droit au but.") : minutes >= 8 ? tf("Explication détaillée avec exemples et calculs.") : tf("Concepts et exemples, rythme standard.")}</p>
          </div>

          <div className="mt-4">
            <p className="text-xs font-bold text-muted-foreground">{tf("NIVEAU D’EXPLICATION")}</p>
            <div className="mt-2 grid grid-cols-2 gap-1.5 sm:grid-cols-4">{DEPTHS.map((d) =>
              <button key={d.id} onClick={() => setDepth(d.id)} className={cn("rounded-xl border px-2 py-2 text-left", depth === d.id ? "border-school-yellow-strong bg-school-yellow" : "bg-background hover:border-school-yellow-strong/50")}>
                <span className="block text-xs font-semibold">{d.label}</span><span className="block text-[11px] leading-4 text-muted-foreground">{d.desc}</span></button>)}</div>
          </div>

          <Button className="mt-5 w-full" onClick={start}><Sparkles className="size-4" />{" "}{tf("Générer ma leçon (")}{picked.length}{" "}{tf("fichier")}{picked.length > 1 ? "s" : ""})</Button>
        </div>}
      </div>
      <button onClick={onDemo} className="block w-full overflow-hidden rounded-3xl border bg-card text-left shadow-sm">
        <span className="relative block"><img src={scene1} alt={tf("Aperçu tableau blanc")} width={1280} height={720} className="aspect-video w-full object-cover" />
          <span className="absolute inset-0 grid place-items-center"><span className="grid size-16 place-items-center rounded-full bg-primary text-primary-foreground shadow-xl"><Play className="ml-1 size-7" /></span></span></span>
        <span className="block p-5"><span className="block text-[11px] font-bold text-school-purple">{tf("LEÇON EXEMPLE")}</span><span className="mt-1 block font-display text-lg font-bold">{demoLesson.title}</span><span className="mt-1 block text-sm text-muted-foreground">{tf("10 scènes au tableau blanc, narrées · Guide, corrigé et quiz")}</span></span>
      </button>
    </section>
    {err && <p className="mt-4 rounded-xl bg-coral-soft p-3 text-sm text-coral-foreground">{err}</p>}

    {signedIn && <section className="mt-12">
      <h2 className="font-display text-2xl font-bold">{tf("Mes leçons")}</h2>
      {rows === null ? <div className="mt-5 grid gap-4 md:grid-cols-2 xl:grid-cols-3">{[0, 1, 2].map((i) => <div key={i} className="animate-pulse rounded-3xl border bg-card p-5"><div className="h-3 w-16 rounded bg-muted" /><div className="mt-3 h-5 w-3/4 rounded bg-muted" /><div className="mt-6 h-9 w-32 rounded-xl bg-muted" /></div>)}</div> :
        rows.length === 0 ? <p className="mt-3 text-sm text-muted-foreground">{tf("Aucune leçon pour l’instant. Dépose tes premières notes!")}</p> :
        <div className="mt-5 grid gap-4 md:grid-cols-2 xl:grid-cols-3">{rows.map((r, i) => <article key={r.id} className={cn("rounded-3xl border-t-4 bg-card p-5 shadow-sm", i % 2 ? "border-school-purple" : "border-school-green")}>
          <p className="text-[11px] font-bold uppercase text-school-yellow-strong">{r.subject}</p>
          <h3 className="mt-1 min-h-12 font-display text-lg font-bold leading-6">{r.title}</h3>
          <div className="mt-4 flex items-center gap-2">
            <Button size="sm" onClick={() => onOpen(r.id, r.status)} disabled={opening === r.id}>{opening === r.id ? <Loader2 className="animate-spin" /> : <Play />} {r.status === "ready" ? tf("Regarder") : tf("Terminer la création")}</Button>
            <Button size="icon" variant="ghost" aria-label={tf("Supprimer")} className="ml-auto" onClick={() => setConfirmId(r.id)}><Trash2 /></Button>
          </div>
        </article>)}</div>}
      {confirmId && <div className="fixed inset-0 z-50 grid place-items-center bg-foreground/40 p-4" role="dialog" aria-modal="true" aria-label={tf("Confirmer la suppression")}>
        <div className="w-full max-w-sm rounded-3xl border bg-card p-6 shadow-xl">
          <p className="font-display text-lg font-bold">{tf("Supprimer cette leçon?")}</p>
          <p className="mt-2 text-sm text-muted-foreground">{tf("Cette action est définitive : la leçon et sa narration seront perdues.")}</p>
          <div className="mt-5 flex justify-end gap-2">
            <Button variant="outline" onClick={() => setConfirmId(null)}>{tf("Annuler")}</Button>
            <Button className="bg-coral text-coral-foreground hover:bg-coral/90" onClick={async () => { const id = confirmId; setConfirmId(null); if (!id) return; await remove({ data: { id } }); setRows((prev) => (prev ?? []).filter((x) => x.id !== id)); }}>{tf("Supprimer")}</Button>
          </div>
        </div>
      </div>}
    </section>}
  </main>;
}

function readFile(file: File): Promise<{ name: string; text: string | null; base64: string | null; mediaType: string | null }> {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onerror = () => reject(new Error(tf("Lecture du fichier impossible.")));
    if (/\.pdf$/i.test(file.name)) {
      r.onload = () => resolve({ name: file.name, text: null, base64: String(r.result).split(",")[1] ?? "", mediaType: "application/pdf" });
      r.readAsDataURL(file);
    } else if (/\.(png|jpe?g|webp)$/i.test(file.name)) {
      r.onload = () => resolve({ name: file.name, text: null, base64: String(r.result).split(",")[1] ?? "", mediaType: file.type || "image/jpeg" });
      r.readAsDataURL(file);
    } else {
      r.onload = () => resolve({ name: file.name, text: String(r.result).slice(0, 80000), base64: null, mediaType: null });
      r.readAsText(file);
    }
  });
}

function Generating({ files, lessonId, onBack, onReady }: { files: File[]; lessonId?: string | undefined; onBack: () => void; onReady: (c: LessonContent) => void }) {
  const gen = useServerFn(generateLesson);
  const media = useServerFn(generateSceneMedia);
  const fetchLesson = useServerFn(getLesson);
  const [phase, setPhase] = useState<"read" | "script" | "media" | "done">(lessonId ? "media" : "read");
  const [done, setDone] = useState(0);
  const [total, setTotal] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const started = useRef(false);

  useEffect(() => {
    if (started.current) return; started.current = true;
    (async () => {
      try {
        let id = lessonId; let count = 0;
        if (!id && files.length) {
          setPhase("read");
          const inputs = await Promise.all(files.map(readFile));
          setPhase("script");
          const r = await retry(() => gen({ data: { files: inputs, minutes: null, depth: "standard" } }));
          id = r.id; count = r.sceneCount;
        }
        if (!id) return;
        const current = await retry(() => fetchLesson({ data: { id } }));
        count = current.content.scenes.length; setTotal(count); setPhase("media");
        const todo = current.content.scenes.map((s, i) => ({ i, need: !(s.image || s.board) || !s.audio })).filter((x) => x.need).map((x) => x.i);
        setDone(count - todo.length);
        // Scenes are independent: run 3 at a time instead of one by one.
        const CONCURRENCY = 3;
        for (let start = 0; start < todo.length; start += CONCURRENCY) {
          await Promise.all(todo.slice(start, start + CONCURRENCY).map(async (i) => {
            await retry(() => media({ data: { lessonId: id, index: i } }));
            setDone((d) => d + 1);
          }));
        }
        const final = await retry(() => fetchLesson({ data: { id } }));
        setPhase("done"); onReady(final.content);
      } catch (e) {
        const msg = e instanceof Error ? e.message : "Une erreur est survenue.";
        setError(INTERRUPTED.test(msg)
          ? tf("La connexion a été interrompue (changement d’application ou réseau). Aucune scène n’est perdue : reprends la création depuis « Mes leçons ».")
          : msg);
      }
    })();
  }, [files, lessonId, gen, media, fetchLesson, onReady]);

  const steps = [
    { key: "read", label: tf("Lecture de tes notes") },
    { key: "script", label: tf("Écriture du script, du guide et du quiz") },
    { key: "media", label: total ? tf("Dessin et narration des scènes ({0}/{1})", [done, total]) : tf("Dessin et narration des scènes") },
  ];
  const order = ["read", "script", "media", "done"];
  return <main className="mx-auto max-w-xl px-4 py-16">
    <div className="rounded-3xl border bg-card p-8 shadow-sm">
      <Sparkles className="size-8 text-school-yellow-strong" />
      <h1 className="mt-3 font-display text-2xl font-bold">{tf("Ta leçon se prépare…")}</h1>
      <p className="mt-1 text-sm text-muted-foreground">{files.length === 1 ? files[0]!.name : files.length > 1 ? tf("{0} documents", [files.length]) : tf("Reprise de la création")}{" "}{tf("· garde cette page ouverte.")}</p>
      <ol className="mt-6 space-y-4">{steps.map((s) => { const idx = order.indexOf(s.key); const cur = order.indexOf(phase); const state = cur > idx ? "done" : cur === idx ? "now" : "todo"; return <li key={s.key} className="flex items-center gap-3 text-sm">
        <span className={cn("grid size-7 place-items-center rounded-full", state === "done" ? "bg-success-soft text-success-strong" : state === "now" ? "bg-school-yellow text-primary-foreground" : "bg-muted text-muted-foreground")}>{state === "done" ? <Check className="size-4" /> : state === "now" && !error ? <Loader2 className="size-4 animate-spin" /> : <FileText className="size-3.5" />}</span>
        <span className={cn(state === "todo" && "text-muted-foreground")}>{s.label}</span></li>; })}</ol>
      {total > 0 && <div className="mt-5 h-2 overflow-hidden rounded-full bg-muted"><div className="h-full bg-school-green transition-all" style={{ width: `${(done / total) * 100}%` }} /></div>}
      {error && <div className="mt-6 rounded-xl bg-coral-soft p-4 text-sm text-coral-foreground">{error}<p className="mt-1 text-xs">{tf("Ta leçon est sauvegardée : tu pourras reprendre la création depuis « Mes leçons ».")}</p></div>}
      <Button variant="outline" className="mt-6" onClick={onBack}><Plus className="rotate-45" />{" "}{tf("Retour à mes leçons")}</Button>
    </div>
  </main>;
}
