import { useRef, useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { ArrowLeft, ArrowRight, BookOpen, CheckSquare, Square, X, FilePlus2, FolderInput, FolderPlus, Grid2X2, List, MoreHorizontal, Palette, PenLine, Pencil, Plus, Search, Trash2, Upload } from "lucide-react";
import { toast } from "sonner";
import { askText, askConfirm } from "@/lib/dialogs";
import { AppShell } from "@/components/app-shell";
import { LocalImportBanner } from "@/components/local-import";
import { Button } from "@/components/ui/button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuSub, DropdownMenuSubContent, DropdownMenuSubTrigger, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { useLibrary } from "@/hooks/use-library";
import { useI18n } from "@/lib/i18n";
import { cn } from "@/lib/utils";
import { blankPage, createFolder, deleteDoc, deleteFolder, listCourses, listDocs, listFolders, moveDoc, moveDocs, renameDoc, renameFolder, saveDoc, setFolderCourse, setFolderParent, setFolderTone, TONES, type Course, type DocMeta, type Folder } from "@/lib/library";
import { ago, toneBg } from "@/lib/tones";

const fail = (e: unknown) => toast.error(e instanceof Error ? e.message : "Action impossible");

export function Dashboard({ folderId = null }: { folderId?: string | null }) {
  const { t } = useI18n();
  const navigate = useNavigate();
  const input = useRef<HTMLInputElement>(null);
  const [query, setQuery] = useState("");
  const [grid, setGrid] = useState(true);
  const [showAll, setShowAll] = useState(false);
  const [busy, setBusy] = useState(false);
  const [selecting, setSelecting] = useState(false);
  const [sel, setSel] = useState<Set<string>>(new Set());
  const toggle = (id: string) => setSel((s) => { const n = new Set(s); if (n.has(id)) n.delete(id); else n.add(id); return n; });
  const endSel = () => { setSelecting(false); setSel(new Set()); };
  const current = folderId;
  const setCurrent = (id: string | null) => void navigate({ to: "/dossiers", search: id ? { f: id } : {} });
  const { data: folders } = useLibrary<Folder[]>(listFolders, []);
  const { data: courses } = useLibrary<Course[]>(listCourses, []);
  const { data: docs, loading } = useLibrary<DocMeta[]>(listDocs, []);

  const q = query.toLowerCase();
  const folder = folders.find((f) => f.id === current);
  const shownFolders = folders.filter((f) => (q ? true : (f.parentId ?? null) === current) && f.name.toLowerCase().includes(q));
  const parent = folder?.parentId ? folders.find((f) => f.id === folder.parentId) : undefined;
  const descendants = (id: string): Set<string> => { const out = new Set<string>([id]); let grew = true; while (grew) { grew = false; for (const f of folders) if (f.parentId && out.has(f.parentId) && !out.has(f.id)) { out.add(f.id); grew = true; } } return out; };
  const fileCount = (id: string) => { const ids = descendants(id); return docs.filter((doc) => doc.folderId && ids.has(doc.folderId)).length; };
  const path = (f: Folder): string => { const p = f.parentId ? folders.find((x) => x.id === f.parentId) : undefined; return p ? `${path(p)} / ${f.name}` : f.name; };
  const bulkMove = (to: string | null) => void moveDocs([...sel], to).then(() => { toast.success(t("folders.moved", { n: sel.size })); endSel(); }, fail);
  const bulkDelete = async () => { if (!await askConfirm(t("folders.deleteBulkConfirm", { n: sel.size }))) return; void Promise.all([...sel].map((id) => deleteDoc(id))).then(() => { toast.success(t("folders.deleted")); endSel(); }, fail); };
  const filteredDocs = docs.filter((d) => (current ? d.folderId === current : q ? true : d.folderId === null) && d.name.toLowerCase().includes(q));
  const shownDocs = showAll || current ? filteredDocs : filteredDocs.slice(0, 8);

  const openDoc = (id: string) => navigate({ to: "/cahier", search: { doc: id } });
  const importFile = async (file: File | undefined) => {
    if (!file) return; setBusy(true);
    try { const id = await saveDoc(file, file.name.replace(/\.[^.]+$/, ""), current); if (/pdf|image/.test(file.type)) openDoc(id); else toast.success(t("folders.addedToLibrary")); }
    catch (e) { fail(e); } finally { setBusy(false); }
  };
  const newPage = async () => { setBusy(true); try { openDoc(await saveDoc(await blankPage(), t("notes.newNoteName"), current, "Page")); } catch (e) { fail(e); } finally { setBusy(false); } };
  const canNest = !folder?.parentId;
  const newFolder = async () => { if (!canNest) { toast.info(t("folders.maxTwoLevels")); return; } const n = await askText(t("folders.folderName")); if (n?.trim()) void createFolder(n.trim(), folder?.courseId ?? null, undefined, current).then(() => toast.success(t("folders.folderCreated")), fail); };

  return <AppShell section="folders">
    <main className="mx-auto max-w-[1500px] px-4 pb-24 pt-4 sm:px-6 lg:px-8 lg:py-8">
      <input ref={input} hidden type="file" accept="application/pdf,image/*,video/*,audio/*" onChange={(e) => { void importFile(e.target.files?.[0]); e.target.value = ""; }} />
      <LocalImportBanner />
      <div className="grid items-center gap-4 sm:grid-cols-[minmax(260px,600px)_auto] sm:justify-between">
        <label className="flex h-11 items-center gap-3 rounded-md border bg-card px-4 shadow-sm focus-within:ring-2 focus-within:ring-ring"><Search className="size-5 shrink-0 text-muted-foreground" /><input value={query} onChange={(e) => setQuery(e.target.value)} placeholder={t("folders.filterPlaceholder")} className="min-w-0 flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground" /></label>
        <div className="flex justify-end gap-2"><Button onClick={newFolder} disabled={!canNest}><FolderPlus />{t("folders.newFolder")}</Button><Button variant="outline" disabled={busy} onClick={() => input.current?.click()}><Upload />{busy ? t("common.uploading") : t("folders.import")}</Button></div>
      </div>

      <section className="mt-7">
        {folder ? <div className="mb-2 flex flex-wrap items-center gap-x-4 gap-y-1">
          {folder.courseId && courses.find((c) => c.id === folder.courseId) ? <button onClick={() => navigate({ to: "/cours/$id", params: { id: folder.courseId! } })} className="flex items-center gap-1 text-sm font-semibold text-amber-strong"><ArrowLeft className="size-4" />{t("folders.backToCourse", { name: courses.find((c) => c.id === folder.courseId)!.name })}</button> : null}
          {parent ? <button onClick={() => setCurrent(parent.id)} className="flex items-center gap-1 text-sm font-semibold text-amber-strong"><ArrowLeft className="size-4" />{t("folders.backTo", { name: parent.name })}</button> : null}
          <button onClick={() => setCurrent(null)} className="flex items-center gap-1 text-sm font-semibold text-muted-foreground hover:text-amber-strong"><ArrowLeft className="size-4" />{t("folders.allFolders")}</button>
        </div> : null}
        <h1 className="font-display text-3xl font-bold tracking-tight sm:text-4xl">{folder?.name ?? t("folders.title")}</h1>
        <p className="mt-1 text-sm text-muted-foreground sm:text-base">{folder ? t("folders.inFolderHint") : t("folders.tagline")}</p>
        <div className="mt-6 grid gap-3 md:grid-cols-2">
          <Card onClick={() => input.current?.click()} icon={<FilePlus2 />} tone="bg-primary-soft text-amber-strong" title={t("folders.importFiles")} sub={t("folders.importFilesSub")} />
          <Card onClick={() => void newPage()} icon={<PenLine />} tone="bg-school-purple-soft text-school-purple" title={t("folders.newPage")} sub={t("folders.newPageSub")} />
        </div>

      </section>

      {(!folder?.parentId || shownFolders.length > 0) && <section className="mt-8">
        <div className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3"><h2 className="font-display text-xl font-bold tracking-tight">{folder ? t("folders.subfolders") : t("folders.myFolders")}</h2><div className="flex items-center gap-2"><Button variant="ghost" size="icon" className={cn("size-8", grid && "bg-primary-soft text-amber-strong")} onClick={() => setGrid(true)} aria-label={t("folders.gridView")}><Grid2X2 /></Button><Button variant="ghost" size="icon" className={cn("size-8", !grid && "bg-primary-soft text-amber-strong")} onClick={() => setGrid(false)} aria-label={t("folders.listView")}><List /></Button></div></div>
        <div className={cn("mt-4 grid gap-3", grid ? "sm:grid-cols-2 xl:grid-cols-4" : "grid-cols-1")}>
          {shownFolders.map((f) => <div key={f.id} className="grid min-h-24 grid-cols-[minmax(0,1fr)_auto] items-center rounded-md border bg-card shadow-sm transition hover:border-amber-strong/50">
            <button onClick={() => setCurrent(f.id)} className="grid h-full grid-cols-[auto_minmax(0,1fr)] items-center gap-4 p-4 text-left"><span className={cn("relative h-11 w-14 rounded-md", toneBg[f.tone], "before:absolute before:-top-1 before:left-1 before:h-2 before:w-6 before:rounded-t-sm before:bg-inherit")} /><span className="min-w-0"><strong className="block text-sm leading-5">{f.name}</strong><small className="text-muted-foreground">{t("common.fileCount", { n: fileCount(f.id) })}{folders.some((x) => x.parentId === f.id) ? ` · ${t("common.folderCount", { n: folders.filter((x) => x.parentId === f.id).length })}` : ""}</small></span></button>
            <DropdownMenu><DropdownMenuTrigger asChild><Button variant="ghost" size="icon" className="mr-2 mt-2 self-start" aria-label={t("folders.options", { name: f.name })}><MoreHorizontal /></Button></DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onClick={async () => { const n = await askText(t("folders.newName"), f.name); if (n?.trim()) void renameFolder(f.id, n.trim()).catch(fail); }}><Pencil />{t("common.rename")}</DropdownMenuItem>
                <DropdownMenuSub><DropdownMenuSubTrigger><Palette />{t("common.color")}</DropdownMenuSubTrigger><DropdownMenuSubContent>{TONES.map((tone) => <DropdownMenuItem key={tone} onClick={() => void setFolderTone(f.id, tone).catch(fail)}><span className={cn("size-3 rounded-full", toneBg[tone])} />{t(`tone.${tone}`)}{f.tone === tone && " ✓"}</DropdownMenuItem>)}</DropdownMenuSubContent></DropdownMenuSub>
                <DropdownMenuSub><DropdownMenuSubTrigger><BookOpen />{t("folders.linkCourse")}</DropdownMenuSubTrigger><DropdownMenuSubContent><DropdownMenuItem disabled={!f.courseId} onClick={() => void setFolderCourse(f.id, null).catch(fail)}>{t("calendar.noCourse")}</DropdownMenuItem>{courses.map((c) => <DropdownMenuItem key={c.id} disabled={f.courseId === c.id} onClick={() => void setFolderCourse(f.id, c.id).catch(fail)}>{c.name}</DropdownMenuItem>)}</DropdownMenuSubContent></DropdownMenuSub>
                <DropdownMenuSub><DropdownMenuSubTrigger><FolderInput />{t("folders.moveTo")}</DropdownMenuSubTrigger><DropdownMenuSubContent className="max-h-72 overflow-y-auto"><DropdownMenuItem disabled={!f.parentId} onClick={() => void setFolderParent(f.id, null).catch(fail)}>{t("folders.root")}</DropdownMenuItem>{(() => { const bad = descendants(f.id); const hasChildren = folders.some((child) => child.parentId === f.id); return folders.filter((o) => !bad.has(o.id) && !o.parentId && !hasChildren).map((o) => <DropdownMenuItem key={o.id} disabled={f.parentId === o.id} onClick={() => void setFolderParent(f.id, o.id).catch(fail)}>{path(o)}</DropdownMenuItem>); })()}</DropdownMenuSubContent></DropdownMenuSub>
                <DropdownMenuItem className="text-destructive" onClick={async () => { if (await askConfirm(t("folders.deleteFolderConfirm", { name: f.name }))) void deleteFolder(f.id).catch(fail); }}><Trash2 />{t("common.delete")}</DropdownMenuItem>
              </DropdownMenuContent></DropdownMenu>
          </div>)}
          {canNest && <button onClick={newFolder} className="grid min-h-24 place-items-center rounded-md border border-dashed p-4 text-muted-foreground transition hover:border-amber-strong/50 hover:text-amber-strong"><span className="grid place-items-center gap-1 text-xs font-semibold"><span className="grid size-8 place-items-center rounded-full bg-primary-soft text-amber-strong"><Plus /></span>{t("folders.newFolder")}</span></button>}
        </div>
      </section>}

      <section className="mt-8">
        <div className="flex items-center justify-between"><h2 className="font-display text-xl font-bold tracking-tight">{folder ? t("common.files") : q ? t("folders.results") : t("folders.unsortedFiles")}</h2>{!folder && filteredDocs.length > 8 && <button onClick={() => setShowAll((v) => !v)} className="ml-auto mr-4 text-sm font-semibold text-amber-strong">{showAll ? t("common.seeLess") : t("common.seeMore")}</button>}{shownDocs.length > 0 && <Button variant="ghost" size="sm" onClick={() => selecting ? endSel() : setSelecting(true)}>{selecting ? <><X />{t("common.cancel")}</> : <><CheckSquare />{t("common.select")}</>}</Button>}</div>
        {loading ? <p className="mt-4 text-sm text-muted-foreground">{t("common.loading")}</p> : shownDocs.length === 0 ? <p className="mt-4 rounded-md border border-dashed p-6 text-center text-sm text-muted-foreground">{folder ? t("folders.noFilesInFolder") : q ? t("folders.noMatch") : t("folders.allSorted")}</p> :
        <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">{shownDocs.map((d) => <DocCard key={d.id} d={d} folders={folders} onOpen={() => selecting ? toggle(d.id) : openDoc(d.id)} selecting={selecting} selected={sel.has(d.id)} />)}</div>}
      </section>
      {selecting && <div className="fixed inset-x-0 bottom-4 z-40 mx-auto flex w-[min(96vw,560px)] flex-wrap items-center gap-2 rounded-md border bg-card p-2 shadow-lg">
        <span className="px-2 text-sm font-semibold">{t("common.selected", { n: sel.size })}</span>
        <Button variant="ghost" size="sm" onClick={() => setSel(sel.size === shownDocs.length ? new Set() : new Set(shownDocs.map((d) => d.id)))}>{sel.size === shownDocs.length ? t("common.deselectAll") : t("common.selectAll")}</Button>
        <div className="ml-auto flex gap-2">
          <DropdownMenu><DropdownMenuTrigger asChild><Button variant="outline" size="sm" disabled={!sel.size}><FolderInput />{t("common.move")}</Button></DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="max-h-72 overflow-y-auto"><DropdownMenuItem onClick={() => bulkMove(null)}>{t("common.noFolder")}</DropdownMenuItem>{folders.map((f) => <DropdownMenuItem key={f.id} onClick={() => bulkMove(f.id)}>{path(f)}</DropdownMenuItem>)}</DropdownMenuContent></DropdownMenu>
          <Button variant="destructive" size="sm" disabled={!sel.size} onClick={bulkDelete}><Trash2 />{t("common.delete")}</Button>
        </div>
      </div>}
    </main>
  </AppShell>;
}

export function DocCard({ d, folders, onOpen, selecting = false, selected = false }: { d: DocMeta; folders: Folder[]; onOpen: () => void; selecting?: boolean; selected?: boolean }) {
  const { t, locale } = useI18n();
  return <div className={cn("grid grid-cols-[minmax(0,1fr)_auto] rounded-md border bg-card shadow-sm transition hover:border-amber-strong/50", selected && "border-amber-strong ring-2 ring-amber-strong/30")}>
    <button onClick={onOpen} className={cn("grid gap-3 p-3 text-left", selecting ? "grid-cols-[auto_56px_minmax(0,1fr)]" : "grid-cols-[56px_minmax(0,1fr)]")}>{selecting && (selected ? <CheckSquare className="size-5 self-center text-amber-strong" /> : <Square className="size-5 self-center text-muted-foreground" />)}<span className="grid aspect-[3/4] place-items-center rounded-sm border bg-muted text-xs font-semibold text-muted-foreground">{d.kind}</span><span className="min-w-0 self-center"><strong className="block truncate text-sm">{d.name}</strong><small className="block text-muted-foreground">{folders.find((f) => f.id === d.folderId)?.name ?? t("common.noFolder")}</small><small className="block text-muted-foreground">{ago(d.updatedAt, locale, t)}</small></span></button>
    {selecting ? <span /> : <DropdownMenu><DropdownMenuTrigger asChild><Button variant="ghost" size="icon" className="m-1" aria-label={t("folders.options", { name: d.name })}><MoreHorizontal /></Button></DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuItem onClick={onOpen}><ArrowRight />{t("common.open")}</DropdownMenuItem>
        <DropdownMenuItem onClick={async () => { const n = await askText(t("folders.newName"), d.name); if (n?.trim()) void renameDoc(d.id, n.trim()).catch(fail); }}><Pencil />{t("common.rename")}</DropdownMenuItem>
        <DropdownMenuSeparator /><DropdownMenuLabel className="flex items-center gap-2 text-xs text-muted-foreground"><FolderInput className="size-3.5" />{t("folders.moveTo")}</DropdownMenuLabel>
        <DropdownMenuItem disabled={!d.folderId} onClick={() => void moveDoc(d.id, null).catch(fail)}>{t("common.noFolder")}</DropdownMenuItem>
        {folders.map((f) => <DropdownMenuItem key={f.id} disabled={d.folderId === f.id} onClick={() => void moveDoc(d.id, f.id).catch(fail)}>{f.name}</DropdownMenuItem>)}
        <DropdownMenuSeparator /><DropdownMenuItem className="text-destructive" onClick={async () => { if (await askConfirm(t("doc.deleteConfirm", { name: d.name }))) void deleteDoc(d.id).catch(fail); }}><Trash2 />{t("common.delete")}</DropdownMenuItem>
      </DropdownMenuContent></DropdownMenu>}
  </div>;
}

function Card({ onClick, icon, tone, title, sub }: { onClick: () => void; icon: React.ReactNode; tone: string; title: string; sub: string }) {
  return <button onClick={onClick} className="grid grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-4 rounded-md border bg-card p-4 text-left shadow-sm transition hover:border-amber-strong/50"><span className={cn("grid size-12 place-items-center rounded-md", tone)}>{icon}</span><span className="min-w-0"><strong className="block text-sm">{title}</strong><small className="text-muted-foreground">{sub}</small></span><ArrowRight className="size-4 text-muted-foreground" /></button>;
}
