import { tf } from "@/lib/i18n";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { CheckSquare, FolderInput, Trash2, Upload, X } from "lucide-react";
import { toast } from "sonner";
import { askText, askConfirm } from "@/lib/dialogs";
import { AppShell } from "@/components/app-shell";
import { DocCard } from "@/components/dashboard";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { useLibrary } from "@/hooks/use-library";
import { useI18n } from "@/lib/i18n";
import { deleteDoc, fileUrl, listDocs, listFolders, MEDIA_MAX, moveDocs, saveDoc, type DocMeta } from "@/lib/library";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/bibliotheque")({
  head: () => ({ meta: [
    { title: tf("Library — Clario") },
    { name: "description", content: "All your documents, PDFs, images, videos and audio recordings in one place." },
    { property: "og:title", content: "Library — Clario" },
    { property: "og:description", content: "Your study resources brought together." },
    { property: "og:type", content: "website" }, { name: "twitter:card", content: "summary" },
  ] }),
  component: LibraryPage,
});

const FILTER_KEYS = ["All", "PDF", "Image", "Video", "Audio"] as const;
const fail = (e: unknown) => toast.error((e as Error).message);

function LibraryPage() {
  const { t } = useI18n();
  const navigate = useNavigate();
  const input = useRef<HTMLInputElement>(null);
  const [filter, setFilter] = useState<(typeof FILTER_KEYS)[number]>("All");
  const [busy, setBusy] = useState(false);
  const [preview, setPreview] = useState<DocMeta | null>(null);
  const [url, setUrl] = useState<string | null>(null);
  const [selecting, setSelecting] = useState(false);
  const [sel, setSel] = useState<Set<string>>(new Set());
  const { data: docs, loading } = useLibrary(listDocs, []);
  const { data: folders } = useLibrary(listFolders, []);
  useEffect(() => { setUrl(null); if (preview) void fileUrl(preview.storagePath).then(setUrl); }, [preview]);
  const media = docs.filter((d) => d.kind !== "Page");
  const kindOf = (d: DocMeta) => d.kind === "Vidéo" ? "Video" : d.kind === "Audio" ? "Audio" : d.kind;
  const shown = media.filter((d) => filter === "All" || kindOf(d) === filter);
  const endSel = () => { setSelecting(false); setSel(new Set()); };
  const toggle = (id: string) => setSel((s) => { const n = new Set(s); if (!n.delete(id)) n.add(id); return n; });
  const upload = async (files: FileList | null) => {
    if (!files?.length) return; setBusy(true);
    for (const f of Array.from(files)) { if (f.size > MEDIA_MAX) { toast.error(t("library.sizeLimit", { name: f.name })); continue; } try { await saveDoc(f, f.name.replace(/\.[^.]+$/, ""), null); } catch (e) { toast.error((e as Error).message); } }
    setBusy(false); toast.success(t("library.importDone"));
  };
  const open = (d: DocMeta) => (d.kind === "Vidéo" || d.kind === "Audio" ? setPreview(d) : navigate({ to: "/cahier", search: { doc: d.id } }));
  return <AppShell section="library">
    <main className="mx-auto max-w-[1300px] px-4 pb-24 pt-6 sm:px-6 lg:px-8 lg:py-10">
      <input ref={input} hidden multiple type="file" accept="application/pdf,image/*,video/*,audio/*" onChange={(e) => { void upload(e.target.files); e.target.value = ""; }} />
      <div className="flex flex-wrap items-end justify-between gap-3"><div><h1 className="font-display text-3xl font-bold tracking-tight sm:text-4xl">{t("library.title")}</h1><p className="mt-1 text-muted-foreground">{t("library.count", { n: media.length })}</p></div><Button disabled={busy} onClick={() => input.current?.click()}><Upload />{busy ? t("common.uploading") : t("library.importMedia")}</Button></div>
      <div className="mt-6 flex flex-wrap items-center gap-2">{FILTER_KEYS.map((f) => <button key={f} onClick={() => setFilter(f)} className={cn("rounded-md border px-3 py-1.5 text-sm", filter === f ? "border-amber-strong bg-primary-soft font-semibold text-amber-strong" : "bg-card text-muted-foreground")}>{t(`library.filter${f}`)}</button>)}
        {shown.length > 0 && <Button variant="ghost" size="sm" className="ml-auto" onClick={() => selecting ? endSel() : setSelecting(true)}>{selecting ? <><X />{t("common.cancel")}</> : <><CheckSquare />{t("common.select")}</>}</Button>}</div>
      {loading ? <p className="mt-6 text-sm text-muted-foreground">{t("common.loading")}</p> : shown.length === 0 ? <p className="mt-6 rounded-md border border-dashed p-8 text-center text-sm text-muted-foreground">{t("library.noResources")}</p> :
        <div className="mt-6 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">{shown.map((d) => <div key={d.id} className="space-y-1"><DocCard d={d} folders={folders} onOpen={() => selecting ? toggle(d.id) : open(d)} selecting={selecting} selected={sel.has(d.id)} />{!selecting && <button className="px-1 text-xs font-semibold text-amber-strong" onClick={() => setPreview(d)}>{t("library.preview")}</button>}</div>)}</div>}
      {selecting && <div className="fixed inset-x-0 bottom-4 z-40 mx-auto flex w-[min(96vw,560px)] flex-wrap items-center gap-2 rounded-md border bg-card p-2 shadow-lg">
        <span className="px-2 text-sm font-semibold">{t("common.selected", { n: sel.size })}</span>
        <Button variant="ghost" size="sm" onClick={() => setSel(sel.size === shown.length ? new Set() : new Set(shown.map((d) => d.id)))}>{sel.size === shown.length ? t("common.deselectAll") : t("common.selectAll")}</Button>
        <div className="ml-auto flex gap-2">
          <DropdownMenu><DropdownMenuTrigger asChild><Button variant="outline" size="sm" disabled={!sel.size}><FolderInput />{t("common.move")}</Button></DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="max-h-72 overflow-y-auto"><DropdownMenuItem onClick={() => void moveDocs([...sel], null).then(() => { toast.success(t("library.moved")); endSel(); }, fail)}>{t("common.noFolder")}</DropdownMenuItem>{folders.map((f) => <DropdownMenuItem key={f.id} onClick={() => void moveDocs([...sel], f.id).then(() => { toast.success(t("library.moved")); endSel(); }, fail)}>{f.name}</DropdownMenuItem>)}</DropdownMenuContent></DropdownMenu>
          <Button variant="destructive" size="sm" disabled={!sel.size} onClick={async () => { if (!await askConfirm(t("library.deleteConfirm", { n: sel.size }))) return; void Promise.all([...sel].map((id) => deleteDoc(id))).then(() => { toast.success(t("folders.deleted")); endSel(); }, fail); }}><Trash2 />{t("common.delete")}</Button>
        </div>
      </div>}
    </main>
    <Dialog open={!!preview} onOpenChange={(v) => !v && setPreview(null)}>
      <DialogContent className="sm:max-w-3xl">
        <DialogTitle>{preview?.name}</DialogTitle>
        {!url ? <p className="text-sm text-muted-foreground">{t("library.loadingPreview")}</p> :
          preview?.kind === "Vidéo" ? <video src={url} controls className="max-h-[70vh] w-full" /> :
          preview?.kind === "Audio" ? <audio src={url} controls className="w-full" /> :
          preview?.kind === "PDF" ? <iframe src={url} title={preview.name} className="h-[70vh] w-full rounded border" /> :
          <img src={url} alt={preview?.name} className="max-h-[70vh] w-full object-contain" />}
        {preview && preview.kind !== "Vidéo" && preview.kind !== "Audio" && <Button onClick={() => { const d = preview; setPreview(null); void navigate({ to: "/cahier", search: { doc: d.id } }); }}>{t("library.openInNotebook")}</Button>}
      </DialogContent>
    </Dialog>
  </AppShell>;
}
