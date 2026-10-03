import { Link, useNavigate } from "@tanstack/react-router";
import { ArrowRight, CalendarDays, GraduationCap, NotebookPen, Plus } from "lucide-react";
import { AppShell } from "@/components/app-shell";
import { AvatarFace } from "@/components/avatar";
import { LocalImportBanner } from "@/components/local-import";
import { Button } from "@/components/ui/button";
import { useLibrary } from "@/hooks/use-library";
import { getProfile, listCourses, listDocs, listEvents, type Course, type CalendarEvent, type DocMeta } from "@/lib/library";
import { useI18n } from "@/lib/i18n";
import { ago, fmtDateTime, localeTag, statusClass, toneBg } from "@/lib/tones";
import { cn } from "@/lib/utils";

function weekNumber(d: Date) { const t = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate())); const day = t.getUTCDay() || 7; t.setUTCDate(t.getUTCDate() + 4 - day); const y = new Date(Date.UTC(t.getUTCFullYear(), 0, 1)); return Math.ceil(((t.getTime() - y.getTime()) / 86400000 + 1) / 7); }

export function Home() {
  const navigate = useNavigate();
  const { t, locale } = useI18n();
  const { data: profile } = useLibrary(getProfile, null);
  const { data: courses, loading } = useLibrary<Course[]>(listCourses, []);
  const { data: events } = useLibrary<CalendarEvent[]>(listEvents, []);
  const { data: docs } = useLibrary<DocMeta[]>(listDocs, []);
  const now = new Date();
  const hour = now.getHours();
  const hello = hour < 5 || hour >= 18 ? t("home.goodEvening") : t("home.goodMorning");
  const active = courses.filter((c) => !c.archived);
  const upcoming = events.filter((e) => !e.done && new Date(e.startsAt) >= new Date(now.getTime() - 3600_000)).slice(0, 5);
  const notes = docs.filter((d) => d.kind === "PDF" || d.kind === "Image" || d.kind === "Page").slice(0, 4);
  const avg = active.length ? Math.round(active.reduce((s, c) => s + c.progress, 0) / active.length) : 0;

  return <AppShell section="dashboard">
    <main className="mx-auto max-w-[1300px] px-4 pb-24 pt-6 sm:px-6 lg:px-8 lg:py-10">
      <LocalImportBanner />
      <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">{now.toLocaleDateString(localeTag(locale), { weekday: "long", day: "numeric", month: "long", year: "numeric" })} · {t("home.week", { n: weekNumber(now) })}</p>
      <h1 className="mt-2 flex items-center gap-3 font-display text-3xl font-bold tracking-tight sm:text-4xl"><span className="size-14 shrink-0 overflow-hidden rounded-full sm:size-16"><AvatarFace avatar={profile?.avatar} name={profile?.displayName} /></span><span>{hello}{profile?.displayName ? `, ${profile.displayName}` : ""}</span></h1>
      <p className="mt-1 text-muted-foreground">{upcoming.length ? t("home.upcomingCount", { n: upcoming.length }) : t("home.noUpcoming")}</p>

      <div className="mt-8 grid gap-6 lg:grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)]">
        <section className="rounded-md border bg-card p-5">
          <div className="flex items-center justify-between"><h2 className="font-display text-xl font-bold">{t("home.myCourses")}</h2><Link to="/cours" className="text-sm font-semibold text-amber-strong">{t("common.seeAll")}</Link></div>
          {loading ? <p className="mt-4 text-sm text-muted-foreground">{t("common.loading")}</p> : active.length === 0 ? <div className="mt-4 rounded-md border border-dashed p-6 text-center text-sm text-muted-foreground">{t("home.noCoursesYet")}<Button size="sm" className="mt-3 flex mx-auto" onClick={() => navigate({ to: "/cours" })}><Plus />{t("home.createCourse")}</Button></div> :
            <ul className="mt-4 divide-y">{active.slice(0, 6).map((c) => <li key={c.id}><Link to="/cours/$id" params={{ id: c.id }} className="grid grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-3 py-3"><span className={cn("size-3 rounded-full", toneBg[c.tone])} /><span className="min-w-0"><strong className="block truncate text-sm">{c.name}</strong><span className="mt-1 block h-1.5 w-full max-w-48 overflow-hidden rounded-full bg-muted"><span className="block h-full bg-amber-strong" style={{ width: `${c.progress}%` }} /></span></span><span className={cn("rounded px-2 py-0.5 text-xs font-semibold", statusClass[c.status])}>{t(`status.${c.status}`)}</span></Link></li>)}</ul>}
        </section>
        <div className="space-y-6">
          <section className="rounded-md border bg-card p-5">
            <div className="flex items-center justify-between"><h2 className="font-display text-xl font-bold">{t("home.upcoming")}</h2><Link to="/calendrier" className="text-sm font-semibold text-amber-strong">{t("home.calendar")}</Link></div>
            {upcoming.length === 0 ? <p className="mt-4 text-sm text-muted-foreground">{t("home.nothingPlanned")}</p> :
              <ul className="mt-3 space-y-2">{upcoming.map((e) => <li key={e.id} className="flex items-start gap-3 text-sm"><CalendarDays className="mt-0.5 size-4 shrink-0 text-amber-strong" /><span className="min-w-0"><strong className="block truncate">{e.title}</strong><span className="text-xs text-muted-foreground">{fmtDateTime(e.startsAt, locale)}{e.courseId ? ` · ${courses.find((c) => c.id === e.courseId)?.name ?? ""}` : ""}</span></span></li>)}</ul>}
          </section>
          <section className="rounded-md border bg-card p-5">
            <h2 className="font-display text-xl font-bold">{t("home.globalProgress")}</h2>
            <p className="mt-2 font-display text-4xl font-bold">{avg}%</p>
            <p className="text-sm text-muted-foreground">{t("home.averageOf", { n: active.length, v: courses.filter((c) => c.status === "valide").length })}</p>
          </section>
        </div>
      </div>

      <section className="mt-8">
        <div className="flex items-center justify-between"><h2 className="font-display text-xl font-bold">{t("home.latestNotes")}</h2><Link to="/notes" className="text-sm font-semibold text-amber-strong">{t("home.allNotes")}</Link></div>
        {notes.length === 0 ? <p className="mt-4 rounded-md border border-dashed p-6 text-center text-sm text-muted-foreground">{t("home.noNotesYet")} <Link to="/dossiers" className="font-semibold text-amber-strong">{t("home.importDoc")}</Link></p> :
          <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">{notes.map((d) => <Link key={d.id} to="/cahier" search={{ doc: d.id }} className="flex items-center gap-3 rounded-md border bg-card p-4 transition hover:border-amber-strong/50"><NotebookPen className="size-5 text-muted-foreground" /><span className="min-w-0 flex-1"><strong className="block truncate text-sm">{d.name}</strong><small className="text-muted-foreground">{ago(d.updatedAt, locale, t)}</small></span><ArrowRight className="size-4 text-muted-foreground" /></Link>)}</div>}
      </section>
      {courses.length === 0 && docs.length === 0 && <p className="mt-8 flex items-center gap-2 text-sm text-muted-foreground"><GraduationCap className="size-4" />{t("home.startHint")}</p>}
    </main>
  </AppShell>;
}

