import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { Archive, ArchiveRestore, ArrowLeft, CalendarPlus, CheckSquare, FilePlus2, FolderInput, FolderPlus, Link2, MoreHorizontal, Palette, PenLine, Pencil, Play, Square, Trash2, Upload, X } from "lucide-react";
import { toast } from "sonner";
import { askText, askConfirm } from "@/lib/dialogs";
import { AppShell } from "@/components/app-shell";
import { DocCard } from "@/components/dashboard";
import { Button } from "@/components/ui/button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSub, DropdownMenuSubContent, DropdownMenuSubTrigger, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { useLibrary } from "@/hooks/use-library";
import { useI18n } from "@/lib/i18n";
import { blankPage, createFolder, deleteCourse, deleteDoc, deleteFolder, getCourse, listDocs, listEvents, listFolders, listCourseAnimations, moveDocs, renameFolder, saveDoc, setDocCourse, setFolderTone, TONES, updateCourse, type Course, type CourseStatus } from "@/lib/library";
import { fmtDateTime, toneBg } from "@/lib/tones";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/cours/$id")({
  head: () => ({ meta: [
    { title: "Course — Clario" },
    { name: "description", content: "Notes, files, deadlines and progress of a course." },
    { property: "og:title", content: "Course — Clario" },
    { property: "og:description", content: "The detail of a Clario course." },
    { property: "og:type", content: "website" }, { name: "twitter:card", content: "summary" },
  ] }),
  component: CoursePage,
});

const fail = (e: unknown) => toast.error(e instanceof Error ? e.message : "Action impossible");

function CoursePage() {
  const { t, locale } = useI18n();
  const { id } = Route.useParams();
  const navigate = useNavigate();
  const input = useRef<HTMLInputElement>(null);
  const { data: course, loading } = useLibrary<Course | undefined>(() => getCourse(id), undefined, [id]);
  const { data: docs } = useLibrary(listDocs, []);
  const { data: folders } = useLibrary(listFolders, []);
  const { data: events } = useLibrary(listEvents, []);
  const { data: anims } = useLibrary(() => listCourseAnimations(id), [], [id]);
  const [name, setName] = useState(""); const [desc, setDesc] = useState("");
  const [selecting, setSelecting] = useState(false);
  const [sel, setSel] = useState<Set<string>>(new Set());
  const toggle = (docId: string) => setSel((s) => { const n = new Set(s); if (n.has(docId)) n.delete(docId); else n.add(docId); return n; });
  const endSel = () => { setSelecting(false); setSel(new Set()); };
  useEffect(() => { if (course) { setName(course.name); setDesc(course.description); } }, [course]);

  if (loading) return <AppShell section="courses"><p className="p-8 text-muted-foreground">{t("common.loading")}</p></AppShell>;
  if (!course) return <AppShell section="courses"><div className="p-8"><p>{t("courses.gone")}</p><Link to="/cours" className="mt-3 inline-block font-semibold text-amber-strong">{t("courses.backToCourses")}</Link></div></AppShell>;

  const mine = docs.filter((d) => d.courseId === id && !d.folderId);
  const others = docs.filter((d) => d.courseId !== id);
  const evs = events.filter((e) => e.courseId === id);
  const folderFileCount = (folderId: string) => { const ids = new Set([folderId, ...folders.filter((folder) => folder.parentId === folderId).map((folder) => folder.id)]); return docs.filter((doc) => doc.folderId && ids.has(doc.folderId)).length; };
  const upd = (p: Parameters<typeof updateCourse>[1]) => void updateCourse(id, p).catch(fail);
  const importFile = async (file?: File) => { if (!file) return; try { await saveDoc(file, file.name.replace(/\.[^.]+$/, ""), null, undefined, id); toast.success(t("courses.addedToCourse")); } catch (e) { fail(e); } };
  const newNote = async () => { try { const doc = await saveDoc(await blankPage(), t("courses.newNoteName", { name: course.name }), null, "Page", id); void navigate({ to: "/cahier", search: { doc } }); } catch (e) { fail(e); } };

  return <AppShell section="courses">
    <main className="mx-auto max-w-[1300px] px-4 pb-24 pt-6 sm:px-6 lg:px-8 lg:py-10">
      <input ref={input} hidden type="file" accept="application/pdf,image/*,video/*,audio/*" onChange={(e) => { void importFile(e.target.files?.[0]); e.target.value = ""; }} />
      <Link to="/cours" className="flex items-center gap-1 text-sm font-semibold text-amber-strong"><ArrowLeft className="size-4" />{t("courses.backToAll")}</Link>
      <div className="mt-3 grid gap-6 lg:grid-cols-[minmax(0,1fr)_320px]">
        <div>
          <Input value={name} onChange={(e) => setName(e.target.value)} onBlur={() => name.trim() && name !== course.name && upd({ name: name.trim() })} className="h-auto border-0 px-0 font-display text-3xl font-bold shadow-none focus-visible:ring-0 sm:text-4xl" aria-label={t("courses.nameAria")} />
          <Textarea value={desc} onChange={(e) => setDesc(e.target.value)} onBlur={() => desc !== course.description && upd({ description: desc })} placeholder={t("courses.descPlaceholder")} className="mt-2 min-h-16" />
          <div className="mt-4 flex flex-wrap gap-2"><Button onClick={() => void newNote()}><PenLine />{t("courses.newNote")}</Button><Button variant="outline" onClick={() => input.current?.click()}><Upload />{t("courses.addFile")}</Button><Button variant="outline" onClick={() => navigate({ to: "/calendrier", search: { course: id } })}><CalendarPlus />{t("courses.addDeadline")}</Button></div>

          <h2 className="mt-8 font-display text-xl font-bold">{t("courses.courseFolders")}</h2>
          <div className="mt-3 grid gap-3 sm:grid-cols-2">
            {folders.filter((f) => f.courseId === id && !folders.some((p) => p.id === f.parentId && p.courseId === id)).map((f) => <div key={f.id} className="grid grid-cols-[minmax(0,1fr)_auto] items-center rounded-md border bg-card shadow-sm transition hover:border-amber-strong/50">
              <button onClick={() => navigate({ to: "/dossiers", search: { f: f.id } })} className="flex items-center gap-3 p-3 text-left"><span className={cn("relative h-9 w-11 rounded-md", toneBg[f.tone], "before:absolute before:-top-1 before:left-1 before:h-2 before:w-5 before:rounded-t-sm before:bg-inherit")} /><span className="min-w-0"><strong className="block truncate text-sm">{f.name}</strong><small className="text-muted-foreground">{t("common.fileCount", { n: folderFileCount(f.id) })}</small></span></button>
              <DropdownMenu><DropdownMenuTrigger asChild><Button variant="ghost" size="icon" className="mr-1" aria-label={t("folders.options", { name: f.name })}><MoreHorizontal /></Button></DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuItem onClick={async () => { const n = await askText(t("folders.newName"), f.name); if (n?.trim()) void renameFolder(f.id, n.trim()).catch(fail); }}><Pencil />{t("common.rename")}</DropdownMenuItem>
                  <DropdownMenuSub><DropdownMenuSubTrigger><Palette />{t("common.color")}</DropdownMenuSubTrigger><DropdownMenuSubContent>{TONES.map((tone) => <DropdownMenuItem key={tone} onClick={() => void setFolderTone(f.id, tone).catch(fail)}><span className={cn("size-3 rounded-full", toneBg[tone])} />{t(`tone.${tone}`)}{f.tone === tone && " ✓"}</DropdownMenuItem>)}</DropdownMenuSubContent></DropdownMenuSub>
                  <DropdownMenuItem className="text-destructive" onClick={async () => { if (await askConfirm(t("courses.folderDeleteConfirm", { name: f.name }))) void deleteFolder(f.id).catch(fail); }}><Trash2 />{t("common.delete")}</DropdownMenuItem>
                </DropdownMenuContent></DropdownMenu>
            </div>)}
            <button onClick={async () => { const n = await askText(t("folders.folderName")); if (n?.trim()) void createFolder(n.trim(), id).then(() => toast.success(t("folders.folderCreated")), fail); }} className="flex items-center gap-3 rounded-md border border-dashed p-3 text-muted-foreground transition hover:border-amber-strong/50 hover:text-amber-strong"><span className="grid size-9 place-items-center rounded-full bg-primary-soft text-amber-strong"><FolderPlus className="size-4" /></span><span className="text-sm font-semibold">{t("folders.newFolder")}</span></button>
          </div>

          <div className="mt-8 flex items-center justify-between"><h2 className="font-display text-xl font-bold">{t("courses.unsorted")}</h2>{mine.length > 0 && <Button variant="ghost" size="sm" onClick={() => selecting ? endSel() : setSelecting(true)}>{selecting ? <><X />{t("common.cancel")}</> : <><CheckSquare />{t("common.select")}</>}</Button>}</div>
          {mine.length === 0 ? <p className="mt-3 rounded-md border border-dashed p-6 text-center text-sm text-muted-foreground"><FilePlus2 className="mx-auto mb-2 size-5" />{t("courses.noLooseFiles")}</p> :
            <div className="mt-3 grid gap-3 sm:grid-cols-2">{mine.map((d) => <div key={d.id} className="relative"><DocCard d={d} folders={folders} onOpen={() => selecting ? toggle(d.id) : navigate({ to: "/cahier", search: { doc: d.id } })} selecting={selecting} selected={sel.has(d.id)} />{!selecting && <button onClick={() => void setDocCourse(d.id, null).catch(fail)} className="absolute bottom-2 right-3 text-[11px] text-muted-foreground hover:text-destructive">{t("courses.removeFromCourse")}</button>}</div>)}</div>}
          {selecting && <div className="fixed inset-x-0 bottom-4 z-40 mx-auto flex w-[min(96vw,560px)] flex-wrap items-center gap-2 rounded-md border bg-card p-2 shadow-lg">
            <span className="px-2 text-sm font-semibold">{t("common.selected", { n: sel.size })}</span>
            <Button variant="ghost" size="sm" onClick={() => setSel(sel.size === mine.length ? new Set() : new Set(mine.map((d) => d.id)))}>{sel.size === mine.length ? t("common.deselectAll") : t("common.selectAll")}</Button>
            <div className="ml-auto flex gap-2">
              <DropdownMenu><DropdownMenuTrigger asChild><Button variant="outline" size="sm" disabled={!sel.size}><FolderInput />{t("common.move")}</Button></DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="max-h-72 overflow-y-auto"><DropdownMenuItem onClick={() => void moveDocs([...sel], null).then(() => { toast.success(t("library.moved")); endSel(); }, fail)}>{t("common.noFolder")}</DropdownMenuItem>{folders.map((f) => <DropdownMenuItem key={f.id} onClick={() => void moveDocs([...sel], f.id).then(() => { toast.success(t("library.moved")); endSel(); }, fail)}>{f.name}</DropdownMenuItem>)}</DropdownMenuContent></DropdownMenu>
              <Button variant="outline" size="sm" disabled={!sel.size} onClick={() => void Promise.all([...sel].map((docId) => setDocCourse(docId, null))).then(() => { toast.success(t("courses.removedFromCourse")); endSel(); }, fail)}>{t("courses.removeFromCourse")}</Button>
              <Button variant="destructive" size="sm" disabled={!sel.size} onClick={async () => { if (!await askConfirm(t("folders.deleteBulkConfirm", { n: sel.size }))) return; void Promise.all([...sel].map((docId) => deleteDoc(docId))).then(() => { toast.success(t("folders.deleted")); endSel(); }, fail); }}><Trash2 />{t("common.delete")}</Button>
            </div>
          </div>}
          {others.length > 0 && <label className="mt-4 flex items-center gap-2 text-sm text-muted-foreground"><Link2 className="size-4" />{t("courses.linkExisting")}
            <select className="h-9 min-w-0 flex-1 rounded-md border bg-card px-2 text-foreground" value="" onChange={(e) => e.target.value && void setDocCourse(e.target.value, id).catch(fail)}><option value="">{t("common.choose")}</option>{others.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}</select></label>}

          <h2 className="mt-8 font-display text-xl font-bold">{t("courses.anims")}</h2>
          {anims.length === 0 ? <p className="mt-3 text-sm text-muted-foreground">{t("courses.noAnims")}</p> : <ul className="mt-3 space-y-2">{anims.map((a) => { const doc = docs.find((d) => d.id === a.documentId); return <li key={a.id} className="flex items-center justify-between gap-3 rounded-md border bg-card px-4 py-3 text-sm"><span className="min-w-0 truncate"><strong>{a.title}</strong> <span className="text-muted-foreground">· {doc?.name ?? "Document"} · {t("common.page")} {a.page + 1}</span></span><Button size="sm" variant="outline" onClick={() => navigate({ to: "/cahier", search: { doc: a.documentId } })}><Play />{t("courses.review")}</Button></li>; })}</ul>}

          <h2 className="mt-8 font-display text-xl font-bold">{t("courses.deadlines")}</h2>
          {evs.length === 0 ? <p className="mt-3 text-sm text-muted-foreground">{t("courses.noDeadlines")}</p> : <ul className="mt-3 space-y-2">{evs.map((e) => <li key={e.id} className={cn("rounded-md border bg-card px-4 py-3 text-sm", e.done && "opacity-60 line-through")}><strong>{e.title}</strong> <span className="text-muted-foreground">· {fmtDateTime(e.startsAt, locale)}</span></li>)}</ul>}
        </div>
        <aside className="space-y-4 rounded-md border bg-card p-5 self-start">
          <div><p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">{t("courses.status")}</p><div className="mt-2 flex flex-wrap gap-2">{(["en_cours", "a_reviser", "valide"] as CourseStatus[]).map((s) => <Button key={s} size="sm" variant={course.status === s ? "default" : "outline"} onClick={() => upd({ status: s, ...(s === "valide" ? { progress: 100 } : {}) })}>{t(`status.${s}`)}</Button>)}</div></div>
          <div><p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">{t("courses.progress", { n: course.progress })}</p><input type="range" min={0} max={100} step={5} defaultValue={course.progress} key={course.progress} onPointerUp={(e) => upd({ progress: Number((e.target as HTMLInputElement).value) })} onKeyUp={(e) => upd({ progress: Number((e.target as HTMLInputElement).value) })} className="mt-2 w-full accent-[var(--amber-strong)]" aria-label={t("courses.progressAria")} /></div>
          <div><p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">{t("common.color")}</p><div className="mt-2 flex flex-wrap gap-2">{TONES.map((tone) => <button key={tone} aria-label={t(`tone.${tone}`)} onClick={() => upd({ tone })} className={cn("size-7 rounded-full border-2", toneBg[tone], course.tone === tone ? "border-foreground" : "border-transparent")} />)}</div></div>
          <div className="flex flex-col gap-2 border-t pt-4">
            <Button variant="outline" onClick={() => upd({ archived: !course.archived })}>{course.archived ? <><ArchiveRestore />{t("courses.unarchive")}</> : <><Archive />{t("courses.archive")}</>}</Button>
            <Button variant="ghost" className="text-destructive" onClick={async () => { if (await askConfirm(t("courses.deleteCourseConfirm", { name: course.name }))) void deleteCourse(id).then(() => navigate({ to: "/cours" }), fail); }}><Trash2 />{t("courses.deleteCourse")}</Button>
          </div>
        </aside>
      </div>
    </main>
  </AppShell>;
}
