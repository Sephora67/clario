import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { CheckSquare, FolderInput, PenLine, Search, Trash2, X } from "lucide-react";
import { toast } from "sonner";
import { askText, askConfirm } from "@/lib/dialogs";
import { AppShell } from "@/components/app-shell";
import { DocCard } from "@/components/dashboard";
import { Button } from "@/components/ui/button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { useLibrary } from "@/hooks/use-library";
import { useI18n } from "@/lib/i18n";
import { blankPage, deleteDoc, listCourses, listDocs, listFolders, moveDocs, saveDoc, setDocCourse } from "@/lib/library";

export const Route = createFileRoute("/_authenticated/notes")({
  head: () => ({ meta: [
    { title: "Notes — Clario" },
    { name: "description", content: "All your notebook pages, filterable by course." },
    { property: "og:title", content: "Notes — Clario" },
    { property: "og:description", content: "Your notebook pages in one place." },
    { property: "og:type", content: "website" }, { name: "twitter:card", content: "summary" },
  ] }),
  component: NotesPage,
});

const fail = (e: unknown) => toast.error((e as Error).message);

function NotesPage() {
  const { t } = useI18n();
  const navigate = useNavigate();
  const [course, setCourse] = useState(""); const [q, setQ] = useState("");
  const [selecting, setSelecting] = useState(false);
  const [sel, setSel] = useState<Set<string>>(new Set());
  const { data: docs, loading } = useLibrary(listDocs, []);
  const { data: courses } = useLibrary(listCourses, []);
  const { data: folders } = useLibrary(listFolders, []);
  const notes = docs.filter((d) => d.kind === "Page" && (!course || d.courseId === course) && d.name.toLowerCase().includes(q.toLowerCase()));
  const endSel = () => { setSelecting(false); setSel(new Set()); };
  const toggle = (id: string) => setSel((s) => { const n = new Set(s); if (!n.delete(id)) n.add(id); return n; });
  const create = async () => { try { const id = await saveDoc(await blankPage(), t("notes.newNoteName"), null, "Page", course || null); void navigate({ to: "/cahier", search: { doc: id } }); } catch (e) { toast.error((e as Error).message); } };
  return <AppShell section="notes">
    <main className="mx-auto max-w-[1300px] px-4 pb-24 pt-6 sm:px-6 lg:px-8 lg:py-10">
      <div className="flex flex-wrap items-end justify-between gap-3"><div><h1 className="font-display text-3xl font-bold tracking-tight sm:text-4xl">{t("notes.title")}</h1><p className="mt-1 text-muted-foreground">{t("notes.tagline")}</p></div><Button onClick={() => void create()}><PenLine />{t("notes.newNote")}</Button></div>
      <div className="mt-6 flex flex-wrap gap-3">
        <label className="flex h-10 min-w-60 flex-1 items-center gap-2 rounded-md border bg-card px-3"><Search className="size-4 text-muted-foreground" /><input value={q} onChange={(e) => setQ(e.target.value)} placeholder={t("notes.filterByTitle")} className="flex-1 bg-transparent text-sm outline-none" /></label>
        <select value={course} onChange={(e) => setCourse(e.target.value)} className="h-10 rounded-md border bg-card px-3 text-sm" aria-label={t("common.course")}><option value="">{t("notes.allCourses")}</option>{courses.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}</select>
        {notes.length > 0 && <Button variant="ghost" size="sm" onClick={() => selecting ? endSel() : setSelecting(true)}>{selecting ? <><X />{t("common.cancel")}</> : <><CheckSquare />{t("common.select")}</>}</Button>}
      </div>
      {loading ? <p className="mt-6 text-sm text-muted-foreground">{t("common.loading")}</p> : notes.length === 0 ? <p className="mt-6 rounded-md border border-dashed p-8 text-center text-sm text-muted-foreground">{t("notes.noMatch")}</p> :
        <div className="mt-6 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">{notes.map((d) => <DocCard key={d.id} d={d} folders={folders} onOpen={() => selecting ? toggle(d.id) : navigate({ to: "/cahier", search: { doc: d.id } })} selecting={selecting} selected={sel.has(d.id)} />)}</div>}
      {selecting && <div className="fixed inset-x-0 bottom-4 z-40 mx-auto flex w-[min(96vw,620px)] flex-wrap items-center gap-2 rounded-md border bg-card p-2 shadow-lg">
        <span className="px-2 text-sm font-semibold">{t("common.selected", { n: sel.size })}</span>
        <Button variant="ghost" size="sm" onClick={() => setSel(sel.size === notes.length ? new Set() : new Set(notes.map((d) => d.id)))}>{sel.size === notes.length ? t("common.deselectAll") : t("common.selectAll")}</Button>
        <div className="ml-auto flex gap-2">
          <DropdownMenu><DropdownMenuTrigger asChild><Button variant="outline" size="sm" disabled={!sel.size}><FolderInput />{t("common.move")}</Button></DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="max-h-72 overflow-y-auto"><DropdownMenuItem onClick={() => void moveDocs([...sel], null).then(() => { toast.success(t("notes.moved")); endSel(); }, fail)}>{t("common.noFolder")}</DropdownMenuItem>{folders.map((f) => <DropdownMenuItem key={f.id} onClick={() => void moveDocs([...sel], f.id).then(() => { toast.success(t("notes.moved")); endSel(); }, fail)}>{f.name}</DropdownMenuItem>)}</DropdownMenuContent></DropdownMenu>
          <DropdownMenu><DropdownMenuTrigger asChild><Button variant="outline" size="sm" disabled={!sel.size}>{t("common.courses")}</Button></DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="max-h-72 overflow-y-auto"><DropdownMenuItem onClick={() => void Promise.all([...sel].map((id) => setDocCourse(id, null))).then(() => { toast.success(t("notes.removedFromCourse")); endSel(); }, fail)}>{t("calendar.noCourse")}</DropdownMenuItem>{courses.map((c) => <DropdownMenuItem key={c.id} onClick={() => void Promise.all([...sel].map((id) => setDocCourse(id, c.id))).then(() => { toast.success(t("notes.linkedToCourse")); endSel(); }, fail)}>{c.name}</DropdownMenuItem>)}</DropdownMenuContent></DropdownMenu>
          <Button variant="destructive" size="sm" disabled={!sel.size} onClick={async () => { if (!await askConfirm(t("notes.deleteConfirm", { n: sel.size }))) return; void Promise.all([...sel].map((id) => deleteDoc(id))).then(() => { toast.success(t("notes.deleted")); endSel(); }, fail); }}><Trash2 />{t("common.delete")}</Button>
        </div>
      </div>}
    </main>
  </AppShell>;
}
