import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { Archive, Plus } from "lucide-react";
import { toast } from "sonner";
import { askText, askConfirm } from "@/lib/dialogs";
import { AppShell } from "@/components/app-shell";
import { Button } from "@/components/ui/button";
import { useLibrary } from "@/hooks/use-library";
import { useI18n } from "@/lib/i18n";
import { createCourse, listCourses, listDocs, type Course, type DocMeta } from "@/lib/library";
import { statusClass, toneBg } from "@/lib/tones";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/cours/")({
  head: () => ({ meta: [
    { title: "Courses — Clario" },
    { name: "description", content: "Create and track your university courses: status, progress, notes and files." },
    { property: "og:title", content: "Courses — Clario" },
    { property: "og:description", content: "All your courses and their progress." },
    { property: "og:type", content: "website" }, { name: "twitter:card", content: "summary" },
  ] }),
  component: CoursesPage,
});

function CoursesPage() {
  const { t } = useI18n();
  const navigate = useNavigate();
  const [archived, setArchived] = useState(false);
  const { data: courses, loading } = useLibrary<Course[]>(listCourses, []);
  const { data: docs } = useLibrary<DocMeta[]>(listDocs, []);
  const shown = courses.filter((c) => c.archived === archived);
  const add = async () => { const n = await askText(t("courses.courseName")); if (!n?.trim()) return; try { const id = await createCourse(n.trim()); void navigate({ to: "/cours/$id", params: { id } }); } catch (e) { toast.error((e as Error).message); } };
  return <AppShell section="courses">
    <main className="mx-auto max-w-[1300px] px-4 pb-24 pt-6 sm:px-6 lg:px-8 lg:py-10">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div><h1 className="font-display text-3xl font-bold tracking-tight sm:text-4xl">{t("courses.title")}</h1><p className="mt-1 text-muted-foreground">{t("courses.activeCount", { n: courses.filter((c) => !c.archived).length })}</p></div>
        <div className="flex gap-2"><Button variant="outline" onClick={() => setArchived((v) => !v)}><Archive />{archived ? t("courses.activeCourses") : t("courses.archives")}</Button><Button onClick={() => void add()}><Plus />{t("courses.newCourse")}</Button></div>
      </div>
      {loading ? <p className="mt-6 text-sm text-muted-foreground">{t("common.loading")}</p> : shown.length === 0 ? <p className="mt-6 rounded-md border border-dashed p-8 text-center text-sm text-muted-foreground">{archived ? t("courses.noArchived") : t("courses.noneYet")}</p> :
        <div className="mt-6 grid gap-3 sm:grid-cols-2 xl:grid-cols-3">{shown.map((c) => <Link key={c.id} to="/cours/$id" params={{ id: c.id }} className="rounded-md border bg-card p-5 transition hover:border-amber-strong/50">
          <div className="flex items-center gap-3"><span className={cn("size-3 rounded-full", toneBg[c.tone])} /><strong className="min-w-0 flex-1 truncate font-display text-lg">{c.name}</strong><span className={cn("rounded px-2 py-0.5 text-xs font-semibold", statusClass[c.status])}>{t(`status.${c.status}`)}</span></div>
          {c.description && <p className="mt-2 line-clamp-2 text-sm text-muted-foreground">{c.description}</p>}
          <div className="mt-4 flex items-center gap-3 text-xs text-muted-foreground"><span className="h-1.5 flex-1 overflow-hidden rounded-full bg-muted"><span className="block h-full bg-amber-strong" style={{ width: `${c.progress}%` }} /></span>{c.progress}% · {t("common.fileCount", { n: docs.filter((d) => d.courseId === c.id).length })}</div>
        </Link>)}</div>}
    </main>
  </AppShell>;
}
