import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { ChevronLeft, ChevronRight, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { askText, askConfirm } from "@/lib/dialogs";
import { AppShell } from "@/components/app-shell";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogFooter, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { useLibrary } from "@/hooks/use-library";
import { useI18n } from "@/lib/i18n";
import { deleteEvent, listCourses, listEvents, saveEvent, type CalendarEvent } from "@/lib/library";
import { localeTag, toneBg } from "@/lib/tones";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/calendrier")({
  validateSearch: (s: Record<string, unknown>): { course?: string } => (typeof s["course"] === "string" ? { course: s["course"] } : {}),
  head: () => ({ meta: [
    { title: "Calendar — Clario" },
    { name: "description", content: "Deadlines, exams and assignments with automatic reminders." },
    { property: "og:title", content: "Calendar — Clario" },
    { property: "og:description", content: "Your deadlines and study reminders." },
    { property: "og:type", content: "website" }, { name: "twitter:card", content: "summary" },
  ] }),
  component: CalendarPage,
});

const pad = (n: number) => String(n).padStart(2, "0");
const localInput = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
const sameDay = (a: Date, b: Date) => a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();

function CalendarPage() {
  const { t, locale } = useI18n();
  const { course: courseParam } = Route.useSearch();
  const { data: events } = useLibrary(listEvents, []);
  const { data: courses } = useLibrary(listCourses, []);
  const [month, setMonth] = useState(() => { const d = new Date(); return new Date(d.getFullYear(), d.getMonth(), 1); });
  const [view, setView] = useState<"month" | "week">("month");
  const [selected, setSelected] = useState(new Date());
  const [draft, setDraft] = useState<Draft | null>(null);
  const [today, setToday] = useState(new Date());
  useEffect(() => { const i = setInterval(() => setToday(new Date()), 60_000); return () => clearInterval(i); }, []);
  const REMINDERS = [
    { v: "", l: t("calendar.noReminder") }, { v: "0", l: t("calendar.atTime") }, { v: "15", l: t("calendar.min15") },
    { v: "60", l: t("calendar.h1") }, { v: "1440", l: t("calendar.day1") }, { v: "10080", l: t("calendar.week1") },
  ];

  const newDraft = (day: Date): Draft => { const d = new Date(day); d.setHours(9, 0, 0, 0); return { title: "", notes: "", courseId: courseParam ?? "", when: localInput(d), remind: "60", done: false }; };
  useEffect(() => { if (courseParam) setDraft(newDraft(new Date())); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, [courseParam]);
  const edit = (e: CalendarEvent) => setDraft({ id: e.id, title: e.title, notes: e.notes, courseId: e.courseId ?? "", when: localInput(new Date(e.startsAt)), remind: e.remindMinutes == null ? "" : String(e.remindMinutes), done: e.done });
  const save = async () => {
    if (!draft?.title.trim()) { toast.error(t("calendar.needTitle")); return; }
    const when = new Date(draft.when); if (Number.isNaN(when.getTime())) { toast.error(t("calendar.badDate")); return; }
    try { await saveEvent({ id: draft.id, title: draft.title.trim(), notes: draft.notes, courseId: draft.courseId || null, startsAt: when.toISOString(), remindMinutes: draft.remind === "" ? null : Number(draft.remind), done: draft.done }); toast.success(draft.id ? t("calendar.eventEdited") : t("calendar.eventAdded")); setDraft(null); }
    catch (e) { toast.error((e as Error).message); }
    if (draft.remind !== "" && "Notification" in window && Notification.permission === "default") void Notification.requestPermission();
  };

  const days = useMemo(() => {
    if (view === "week") { const s = new Date(selected); s.setDate(s.getDate() - ((s.getDay() + 6) % 7)); return Array.from({ length: 7 }, (_, i) => new Date(s.getFullYear(), s.getMonth(), s.getDate() + i)); }
    const start = new Date(month); start.setDate(1 - ((start.getDay() + 6) % 7));
    return Array.from({ length: 42 }, (_, i) => new Date(start.getFullYear(), start.getMonth(), start.getDate() + i));
  }, [month, view, selected]);
  const on = (d: Date) => events.filter((e) => sameDay(new Date(e.startsAt), d));
  const color = (e: CalendarEvent) => toneBg[courses.find((c) => c.id === e.courseId)?.tone ?? "yellow"];
  const shift = (n: number) => { if (view === "month") setMonth(new Date(month.getFullYear(), month.getMonth() + n, 1)); else { const s = new Date(selected); s.setDate(s.getDate() + 7 * n); setSelected(s); setMonth(new Date(s.getFullYear(), s.getMonth(), 1)); } };
  const dayEvents = on(selected);
  const dayNames = locale === "fr" ? ["Lun", "Mar", "Mer", "Jeu", "Ven", "Sam", "Dim"] : ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

  return <AppShell section="calendar">
    <main className="mx-auto max-w-[1300px] px-4 pb-24 pt-6 sm:px-6 lg:px-8 lg:py-10">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div><h1 className="font-display text-3xl font-bold tracking-tight sm:text-4xl">{t("calendar.title")}</h1><p className="mt-1 text-muted-foreground">{t("calendar.today")} {today.toLocaleDateString(localeTag(locale), { weekday: "long", day: "numeric", month: "long" })}</p></div>
        <Button onClick={() => setDraft(newDraft(selected))}><Plus />{t("calendar.newEvent")}</Button>
      </div>
      <div className="mt-6 flex flex-wrap items-center gap-2">
        <Button variant="outline" size="icon" aria-label={t("calendar.prev")} onClick={() => shift(-1)}><ChevronLeft /></Button>
        <Button variant="outline" size="icon" aria-label={t("calendar.next")} onClick={() => shift(1)}><ChevronRight /></Button>
        <Button variant="ghost" onClick={() => { const d = new Date(); setSelected(d); setMonth(new Date(d.getFullYear(), d.getMonth(), 1)); }}>{t("calendar.todayBtn")}</Button>
        <strong className="ml-2 font-display text-lg capitalize">{view === "month" ? month.toLocaleDateString(localeTag(locale), { month: "long", year: "numeric" }) : t("calendar.weekOf", { date: days[0]!.toLocaleDateString(localeTag(locale), { day: "numeric", month: "long" }) })}</strong>
        <div className="ml-auto flex rounded-md border p-0.5">{(["month", "week"] as const).map((v) => <button key={v} onClick={() => setView(v)} className={cn("rounded px-3 py-1 text-sm capitalize", view === v ? "bg-primary-soft font-semibold text-amber-strong" : "text-muted-foreground")}>{v === "month" ? (locale === "fr" ? "mois" : "month") : (locale === "fr" ? "semaine" : "week")}</button>)}</div>
      </div>
      <div className="mt-4 grid gap-6 lg:grid-cols-[minmax(0,1fr)_320px]">
        <div className="overflow-hidden rounded-md border bg-card">
          <div className="grid grid-cols-7 border-b text-center text-xs font-semibold text-muted-foreground">{dayNames.map((d) => <div key={d} className="py-2">{d}</div>)}</div>
          <div className="grid grid-cols-7">{days.map((d) => { const evs = on(d); const out = view === "month" && d.getMonth() !== month.getMonth(); return <button key={d.toISOString()} onClick={() => setSelected(d)} onDoubleClick={() => setDraft(newDraft(d))} className={cn("min-h-20 border-b border-r p-1.5 text-left align-top text-xs sm:min-h-24", view === "week" && "min-h-48", out && "text-muted-foreground/50", sameDay(d, selected) && "bg-primary-soft/60")}>
            <span className={cn("grid size-6 place-items-center rounded-full", sameDay(d, today) && "bg-amber-strong font-bold text-primary-foreground")}>{d.getDate()}</span>
            <span className="mt-1 block space-y-0.5">{evs.slice(0, view === "week" ? 8 : 3).map((e) => <span key={e.id} className={cn("block truncate rounded px-1 py-0.5 text-[10px] text-foreground", color(e), e.done && "line-through opacity-60")}>{new Date(e.startsAt).toLocaleTimeString(localeTag(locale), { hour: "2-digit", minute: "2-digit" })} {e.title}</span>)}{evs.length > 3 && view === "month" && <span className="block text-[10px] text-muted-foreground">+{evs.length - 3}</span>}</span>
          </button>; })}</div>
        </div>
        <aside className="self-start rounded-md border bg-card p-5">
          <h2 className="font-display text-lg font-bold capitalize">{selected.toLocaleDateString(localeTag(locale), { weekday: "long", day: "numeric", month: "long" })}</h2>
          {dayEvents.length === 0 ? <p className="mt-3 text-sm text-muted-foreground">{t("calendar.nothingThatDay")}</p> : <ul className="mt-3 space-y-2">{dayEvents.map((e) => <li key={e.id}><button onClick={() => edit(e)} className="flex w-full items-start gap-3 rounded-md border p-3 text-left text-sm hover:border-amber-strong/50"><span className={cn("mt-1 size-2.5 shrink-0 rounded-full", color(e))} /><span className="min-w-0"><strong className={cn("block", e.done && "line-through")}>{e.title}</strong><span className="text-xs text-muted-foreground">{new Date(e.startsAt).toLocaleTimeString(localeTag(locale), { hour: "2-digit", minute: "2-digit" })}{e.remindMinutes != null && ` · ${t("calendar.reminderOn")}`}</span></span></button></li>)}</ul>}
          <Button variant="outline" className="mt-4 w-full" onClick={() => setDraft(newDraft(selected))}><Plus />{t("calendar.addThisDay")}</Button>
        </aside>
      </div>
    </main>
    <Dialog open={!!draft} onOpenChange={(v) => !v && setDraft(null)}>
      <DialogContent>
        <DialogTitle>{draft?.id ? t("calendar.editEvent") : t("calendar.newEventTitle")}</DialogTitle>
        {draft && <div className="space-y-3">
          <Input autoFocus placeholder={t("calendar.titlePlaceholder")} value={draft.title} onChange={(e) => setDraft({ ...draft, title: e.target.value })} />
          <label className="block text-sm">{t("calendar.dateTime")}<Input type="datetime-local" value={draft.when} onChange={(e) => setDraft({ ...draft, when: e.target.value })} className="mt-1" /></label>
          <label className="block text-sm">{t("calendar.reminder")}<select value={draft.remind} onChange={(e) => setDraft({ ...draft, remind: e.target.value })} className="mt-1 h-9 w-full rounded-md border bg-card px-2">{REMINDERS.map((r) => <option key={r.v} value={r.v}>{r.l}</option>)}</select></label>
          <label className="block text-sm">{t("common.course")}<select value={draft.courseId} onChange={(e) => setDraft({ ...draft, courseId: e.target.value })} className="mt-1 h-9 w-full rounded-md border bg-card px-2"><option value="">{t("calendar.noCourse")}</option>{courses.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}</select></label>
          <Textarea placeholder={t("calendar.notes")} value={draft.notes} onChange={(e) => setDraft({ ...draft, notes: e.target.value })} />
          {draft.id && <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={draft.done} onChange={(e) => setDraft({ ...draft, done: e.target.checked })} />{t("calendar.done")}</label>}
        </div>}
        <DialogFooter className="gap-2">
          {draft?.id && <Button variant="ghost" className="mr-auto text-destructive" onClick={async () => { if (draft.id && await askConfirm(t("calendar.deleteEventConfirm"))) void deleteEvent(draft.id).then(() => { setDraft(null); toast.success(t("calendar.eventDeleted")); }); }}><Trash2 />{t("common.delete")}</Button>}
          <Button variant="outline" onClick={() => setDraft(null)}>{t("common.cancel")}</Button><Button onClick={() => void save()}>{t("common.save")}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  </AppShell>;
}

type Draft = { id?: string; title: string; notes: string; courseId: string; when: string; remind: string; done: boolean };
