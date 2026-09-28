import { useEffect, useRef, useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { ArrowLeft, ArrowRight, BookOpen, FilePlus2, FolderInput, FolderPlus, Grid2X2, List, MoreHorizontal, PenLine, Pencil, Plus, Search, Trash2, Upload } from "lucide-react";
import { toast } from "sonner";
import { AppShell } from "@/components/app-shell";
import { Button } from "@/components/ui/button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";
import { blankPage, createFolder, deleteDoc, deleteFolder, listDocs, listFolders, moveDoc, renameDoc, renameFolder, saveDoc, type DocMeta, type Folder } from "@/lib/library";

const folderTone: Record<string, string> = { purple: "bg-folder-purple", pink: "bg-folder-pink", blue: "bg-folder-blue", green: "bg-folder-green", coral: "bg-folder-coral", yellow: "bg-folder-yellow", violet: "bg-folder-violet" };

function ago(t: number) {
  const m = Math.round((Date.now() - t) / 60000);
  if (m < 1) return "À l'instant"; if (m < 60) return `Il y a ${m} min`;
  const h = Math.round(m / 60); if (h < 24) return `Il y a ${h} h`;
  const d = Math.round(h / 24); return d === 1 ? "Hier" : `Il y a ${d} jours`;
}

export function Dashboard() {
  const navigate = useNavigate();
  const input = useRef<HTMLInputElement>(null);
  const [query, setQuery] = useState("");
  const [grid, setGrid] = useState(true);
  const [showAll, setShowAll] = useState(false);
  const [current, setCurrent] = useState<string | null>(null);
  const [folders, setFolders] = useState<Folder[]>([]);
  const [docs, setDocs] = useState<DocMeta[]>([]);

  useEffect(() => {
    const load = () => { setFolders(listFolders()); setDocs(listDocs()); };
    load(); window.addEventListener("clario-library", load); return () => window.removeEventListener("clario-library", load);
  }, []);

  const q = query.toLowerCase();
  const folder = folders.find((f) => f.id === current);
  const shownFolders = folders.filter((f) => f.name.toLowerCase().includes(q));
  const filteredDocs = docs.filter((d) => (current ? d.folderId === current : true) && d.name.toLowerCase().includes(q));
  const shownDocs = showAll || current ? filteredDocs : filteredDocs.slice(0, 8);

  const openDoc = (id: string) => navigate({ to: "/cahier", search: { doc: id } });
  const importFile = async (file: File | undefined) => {
    if (!file) return;
    try { openDoc(await saveDoc(file, file.name.replace(/\.[^.]+$/, ""), current)); }
    catch { toast.error("Impossible d'enregistrer ce fichier sur cet appareil."); }
  };
  const newPage = async () => openDoc(await saveDoc(await blankPage(), "Nouvelle page", current, "Page"));
  const newFolder = () => { const n = window.prompt("Nom du dossier :"); if (n?.trim()) { createFolder(n.trim()); toast.success("Dossier créé"); } };

  return <AppShell section="Dossiers">
    <main className="mx-auto max-w-[1500px] px-4 pb-24 pt-4 sm:px-6 lg:px-8 lg:py-8">
      <input ref={input} hidden type="file" accept="application/pdf,image/*" onChange={(e) => { void importFile(e.target.files?.[0]); e.target.value = ""; }} />
      <div className="grid items-center gap-4 sm:grid-cols-[minmax(260px,600px)_auto] sm:justify-between">
        <label className="flex h-11 items-center gap-3 rounded-md border bg-card px-4 shadow-sm focus-within:ring-2 focus-within:ring-ring"><Search className="size-5 shrink-0 text-muted-foreground" /><input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Rechercher un dossier ou un fichier…" className="min-w-0 flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground" /></label>
        <div className="flex justify-end gap-2"><Button onClick={newFolder}><FolderPlus />Nouveau dossier</Button><Button variant="outline" onClick={() => input.current?.click()}><Upload />Importer</Button></div>
      </div>

      <section className="mt-7">
        {folder ? <button onClick={() => setCurrent(null)} className="mb-2 flex items-center gap-1 text-sm font-semibold text-amber-strong"><ArrowLeft className="size-4" />Tous les dossiers</button> : null}
        <h1 className="font-display text-3xl font-bold tracking-tight sm:text-4xl">{folder?.name ?? "Dossiers"}</h1>
        <p className="mt-1 text-sm text-muted-foreground sm:text-base">{folder ? "Les fichiers importés ici seront rangés dans ce dossier." : "Organise tes notes et documents par matière."}</p>
        <div className="mt-6 grid gap-3 md:grid-cols-3">
          <Card onClick={() => input.current?.click()} icon={<FilePlus2 />} tone="bg-primary-soft text-amber-strong" title="Importer des fichiers" sub="PDF ou images" />
          <Card onClick={() => void newPage()} icon={<PenLine />} tone="bg-school-purple-soft text-school-purple" title="Créer une nouvelle page" sub="Commence avec une page blanche" />
          <Card onClick={() => navigate({ to: "/cahier" })} icon={<BookOpen />} tone="bg-school-green-soft text-school-green-strong" title="Explorer un exemple" sub="Essaie les outils sur une page modèle" />
        </div>
      </section>

      {!folder && <section className="mt-8">
        <div className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3"><h2 className="font-display text-xl font-bold tracking-tight">Mes dossiers</h2><div className="flex items-center gap-2"><Button variant="ghost" size="icon" className={cn("size-8", grid && "bg-primary-soft text-amber-strong")} onClick={() => setGrid(true)} aria-label="Vue grille"><Grid2X2 /></Button><Button variant="ghost" size="icon" className={cn("size-8", !grid && "bg-primary-soft text-amber-strong")} onClick={() => setGrid(false)} aria-label="Vue liste"><List /></Button></div></div>
        <div className={cn("mt-4 grid gap-3", grid ? "sm:grid-cols-2 xl:grid-cols-4" : "grid-cols-1")}>
          {shownFolders.map((f) => <div key={f.id} className="grid min-h-24 grid-cols-[minmax(0,1fr)_auto] items-center rounded-md border bg-card shadow-sm transition hover:border-amber-strong/50">
            <button onClick={() => setCurrent(f.id)} className="grid h-full grid-cols-[auto_minmax(0,1fr)] items-center gap-4 p-4 text-left"><span className={cn("relative h-11 w-14 rounded-md", folderTone[f.tone], "before:absolute before:-top-1 before:left-1 before:h-2 before:w-6 before:rounded-t-sm before:bg-inherit")} /><span className="min-w-0"><strong className="block text-sm leading-5">{f.name}</strong><small className="text-muted-foreground">{docs.filter((d) => d.folderId === f.id).length} fichier(s)</small></span></button>
            <DropdownMenu><DropdownMenuTrigger asChild><Button variant="ghost" size="icon" className="mr-2 self-start mt-2" aria-label={`Options ${f.name}`}><MoreHorizontal /></Button></DropdownMenuTrigger>
              <DropdownMenuContent align="end"><DropdownMenuItem onClick={() => { const n = window.prompt("Nouveau nom :", f.name); if (n?.trim()) renameFolder(f.id, n.trim()); }}><Pencil />Renommer</DropdownMenuItem><DropdownMenuItem className="text-destructive" onClick={() => { if (window.confirm(`Supprimer « ${f.name} » ? Les fichiers restent dans Fichiers récents.`)) deleteFolder(f.id); }}><Trash2 />Supprimer</DropdownMenuItem></DropdownMenuContent></DropdownMenu>
          </div>)}
          <button onClick={newFolder} className="grid min-h-24 place-items-center rounded-md border border-dashed p-4 text-muted-foreground transition hover:border-amber-strong/50 hover:text-amber-strong"><span className="grid place-items-center gap-1 text-xs font-semibold"><span className="grid size-8 place-items-center rounded-full bg-primary-soft text-amber-strong"><Plus /></span>Nouveau dossier</span></button>
        </div>
      </section>}

      <section className="mt-8">
        <div className="flex items-center justify-between"><h2 className="font-display text-xl font-bold tracking-tight">{folder ? "Fichiers" : "Fichiers récents"}</h2>{!folder && filteredDocs.length > 8 && <button onClick={() => setShowAll((v) => !v)} className="text-sm font-semibold text-amber-strong">{showAll ? "Voir moins" : "Voir tout"}</button>}</div>
        {shownDocs.length === 0 ? <p className="mt-4 rounded-md border border-dashed p-6 text-center text-sm text-muted-foreground">Aucun fichier pour l'instant. Importe un PDF ou une photo de tes notes.</p> :
        <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">{shownDocs.map((d) => <div key={d.id} className="grid grid-cols-[minmax(0,1fr)_auto] rounded-md border bg-card shadow-sm transition hover:border-amber-strong/50">
          <button onClick={() => openDoc(d.id)} className="grid grid-cols-[56px_minmax(0,1fr)] gap-3 p-3 text-left"><span className="grid aspect-[3/4] place-items-center rounded-sm border bg-muted text-xs font-semibold text-muted-foreground">{d.kind}</span><span className="min-w-0 self-center"><strong className="block truncate text-sm">{d.name}</strong><small className="block text-muted-foreground">{folders.find((f) => f.id === d.folderId)?.name ?? "Sans dossier"}</small><small className="block text-muted-foreground">{ago(d.updatedAt)}</small></span></button>
          <DropdownMenu><DropdownMenuTrigger asChild><Button variant="ghost" size="icon" className="m-1" aria-label={`Options ${d.name}`}><MoreHorizontal /></Button></DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={() => openDoc(d.id)}><ArrowRight />Ouvrir</DropdownMenuItem>
              <DropdownMenuItem onClick={() => { const n = window.prompt("Nouveau nom :", d.name); if (n?.trim()) renameDoc(d.id, n.trim()); }}><Pencil />Renommer</DropdownMenuItem>
              <DropdownMenuSeparator /><DropdownMenuLabel className="flex items-center gap-2 text-xs text-muted-foreground"><FolderInput className="size-3.5" />Déplacer vers</DropdownMenuLabel>
              {folders.map((f) => <DropdownMenuItem key={f.id} disabled={d.folderId === f.id} onClick={() => moveDoc(d.id, f.id)}>{f.name}</DropdownMenuItem>)}
              <DropdownMenuSeparator /><DropdownMenuItem className="text-destructive" onClick={() => { if (window.confirm(`Supprimer « ${d.name} » et ses annotations ?`)) void deleteDoc(d.id); }}><Trash2 />Supprimer</DropdownMenuItem>
            </DropdownMenuContent></DropdownMenu>
        </div>)}</div>}
      </section>
    </main>
  </AppShell>;
}

function Card({ onClick, icon, tone, title, sub }: { onClick: () => void; icon: React.ReactNode; tone: string; title: string; sub: string }) {
  return <button onClick={onClick} className="grid grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-4 rounded-md border bg-card p-4 text-left shadow-sm transition hover:border-amber-strong/50"><span className={cn("grid size-12 place-items-center rounded-md", tone)}>{icon}</span><span className="min-w-0"><strong className="block text-sm">{title}</strong><small className="text-muted-foreground">{sub}</small></span><ArrowRight className="size-4 text-muted-foreground" /></button>;
}
