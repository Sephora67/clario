import { tf } from "@/lib/i18n";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useNavigate, useSearch } from "@tanstack/react-router";
import {
  ArrowDown, ArrowLeft, ArrowLeftRight, ArrowRight, ArrowUp, ArrowUpRight, Bookmark, BookmarkCheck, Check, Files,
  ChevronDown, ChevronLeft, ChevronRight, Circle, Copy, Diamond, Download, Eraser, FileImage,
  FilePlus2, FileText, FileUp, Hand, Headphones, Highlighter, Info, LayoutGrid, Loader2, Maximize2,
  Heart, Lasso, Menu, Minus, MoreHorizontal, MoveHorizontal, PaintBucket, Palette, PanelLeft,
  PanelLeftClose, Pen, Pentagon, Play, Plus, RectangleHorizontal,
  Brain, MessageCircleQuestion, Redo2, Ruler, Search, Settings2, Share2, Smile, Square, Star, Trash2, Triangle, Type,
  Undo2, Video, ZoomIn, PenTool, Pencil, PenLine, Move,

  TextSelect, X, ClipboardPaste,
} from "lucide-react";
import { toast } from "sonner";
import { refreshCredits } from "@/hooks/use-credits";
import { askText, askConfirm, askChoice } from "@/lib/dialogs";
import { getNotebookClip, setNotebookClip } from "@/lib/notebook-clipboard";
import PageShareDialog from "@/components/page-share-dialog";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem,
  DropdownMenuLabel, DropdownMenuRadioGroup, DropdownMenuRadioItem, DropdownMenuSeparator,
  DropdownMenuSub, DropdownMenuSubContent, DropdownMenuSubTrigger, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { ColorPalette } from "@/components/color-palette";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Switch } from "@/components/ui/switch";
import { cn } from "@/lib/utils";
import { addMedia, blankPage, loadPageImage, uploadPage, downloadBlob, getDoc, getDocFile, getDocState, getMedia, listDocs, listMedia, MEDIA_MAX, removeMedia, saveDoc, saveDocState, setAnimationPage, syncPendingStates, touchDoc, listDocAnimations, getAnimationAudio, type DocMeta, type DocState, type MediaItem } from "@/lib/library";
import { isOffline } from "@/lib/offline-store";
import { currentLocale } from "@/lib/i18n";
import type { SavedAnimation } from "@/lib/animation-types";
import { analyzePage, generateAudio, generateScript, saveAnimation, deleteAnimation } from "@/lib/animation.functions";
import type { AnimScript, PageAnalysis } from "@/lib/animation-types";
import AnimationPlayer from "@/components/animation-player";
import ExplainerPlayer from "@/components/explainer-player";
import DocChat, { type ChatSeed } from "@/components/doc-chat";
import { PageQuiz } from "@/components/page-quiz";
import { supabase } from "@/integrations/supabase/client";
import { generateExplainer, saveExplainer, deleteExplainerFiles } from "@/lib/explainer.functions";
import { isExplainer, type ExplainerScript } from "@/lib/explainer-types";

type ShapeTool = "line" | "arrow" | "doubleArrow" | "rectangle" | "roundedRectangle" | "ellipse" | "triangle" | "diamond" | "parallelogram" | "pentagon" | "star" | "heart";
type Tool = "pen" | "highlighter" | "text" | "eraser" | "ruler" | "select" | "lasso" | ShapeTool;
type ToolbarItem = Tool | "zoom" | "stylus";
type PenStyle = "plume" | "bille" | "crayon" | "plat" | "fin";
type PenConfig = { color: string; size: number };
type PenConfigs = Record<"plume" | "bille" | "crayon", PenConfig>;
type HighlighterConfigs = Record<"plat" | "fin", PenConfig>;
type ShapeColors = Record<ShapeTool, string>;
type EraserKind = "highlighter" | "pen" | "shape" | "text";
type ScrollDirection = "vertical" | "horizontal";
type FitMode = "width" | "page" | "custom";
type Pt = [number, number, number];
type StrokeMark = { id: string; type: Exclude<Tool, "text" | "eraser" | "select">; color: string; size: number; style?: PenStyle; fill?: string; pts: Pt[] };
type ImageMark = { id: string; type: "image"; x: number; y: number; w: number; h: number; path: string };
type TextRun = { text: string; color: string; size: number; font: TextFont };
type TextMark = { id: string; type: "text"; color: string; size: number; x: number; y: number; text: string; font?: string; runs?: TextRun[]; w?: number };
export type Mark = StrokeMark | ImageMark | TextMark;

// Images posées sur la page : chargées une fois depuis le compte, puis dessinées dans le canevas.
const imageCache = new Map<string, HTMLImageElement | "loading" | "error">();
const imageListeners = new Set<() => void>();
function loadMarkImage(path: string): Promise<HTMLImageElement | null> {
  const hit = imageCache.get(path);
  if (hit instanceof HTMLImageElement) return Promise.resolve(hit);
  if (hit === "error") return Promise.resolve(null);
  imageCache.set(path, "loading");
  return loadPageImage(path).then((url) => new Promise<HTMLImageElement | null>((resolve) => {
    const img = new Image(); img.onload = () => { imageCache.set(path, img); imageListeners.forEach((f) => f()); resolve(img); }; img.onerror = () => { imageCache.set(path, "error"); resolve(null); }; img.src = url;
  })).catch(() => { imageCache.set(path, "error"); return null; });
}
// Les deux styles de surligneur gardent l'icône de surligneur (distincte du stylo à bille); l'aperçu épais/fin les distingue.
const PEN_ICONS: Record<string, typeof Pen> = { plume: PenTool, bille: Pen, crayon: Pencil, plat: Highlighter, fin: Highlighter };
type TextFont = "main" | "moderne" | "elegante" | "machine";
const TEXT_FONTS: Record<TextFont, { label: string; css: string; weight: number }> = {
  main: { get label() { return tf("Manuscrite"); }, css: "Caveat, cursive", weight: 600 },
  moderne: { get label() { return tf("Moderne"); }, css: "Geist, Inter, sans-serif", weight: 500 },
  elegante: { get label() { return tf("Élégante"); }, css: "Fraunces, Georgia, serif", weight: 500 },
  machine: { get label() { return tf("Machine"); }, css: "ui-monospace, 'SFMono-Regular', Menlo, monospace", weight: 500 },
};
const fontOf = (f?: string) => TEXT_FONTS[(f as TextFont) in TEXT_FONTS ? (f as TextFont) : "main"];
const PAGE_WIDTH_POINTS = 595; // largeur A4 en points typographiques, comme dans Word/PDF
const TEXT_SIZE_MIN = 8;
const TEXT_SIZE_MAX = 72;
const clampTextSize = (v: number) => Math.max(TEXT_SIZE_MIN, Math.min(TEXT_SIZE_MAX, Math.round(v)));
const textPixels = (points: number, pageWidth: number) => points * pageWidth / PAGE_WIDTH_POINTS;
let measureCtx: CanvasRenderingContext2D | null = null;
const styleOf = (mark: Pick<TextMark, "color" | "size" | "font">) => ({ color: mark.color, size: clampTextSize(mark.size), font: (mark.font as TextFont) in TEXT_FONTS ? mark.font as TextFont : "main" as TextFont });
const runsOf = (mark: Pick<TextMark, "text" | "color" | "size" | "font" | "runs">): TextRun[] => mark.runs?.length ? mark.runs : [{ text: mark.text, ...styleOf(mark) }];
function mergeRuns(runs: TextRun[]) {
  return runs.filter((run) => run.text).reduce<TextRun[]>((out, run) => { const last = out.at(-1); if (last && last.color === run.color && last.size === run.size && last.font === run.font) last.text += run.text; else out.push({ ...run, size: clampTextSize(run.size) }); return out; }, []);
}
function applyRunStyle(runs: TextRun[], start: number, end: number, patch: Partial<Omit<TextRun, "text">>) {
  let at = 0; const next: TextRun[] = [];
  for (const run of runs) { const a = at; const b = at + run.text.length; at = b;
    if (end <= a || start >= b) { next.push(run); continue; }
    const left = Math.max(0, start - a); const right = Math.min(run.text.length, end - a);
    if (left > 0) next.push({ ...run, text: run.text.slice(0, left) });
    next.push({ ...run, ...patch, text: run.text.slice(left, right) });
    if (right < run.text.length) next.push({ ...run, text: run.text.slice(right) });
  }
  return mergeRuns(next);
}
function sliceRuns(runs: TextRun[], start: number, end: number) {
  let at = 0; const out: TextRun[] = [];
  for (const run of runs) { const a = at; const b = at + run.text.length; at = b; const left = Math.max(start, a); const right = Math.min(end, b); if (left < right) out.push({ ...run, text: run.text.slice(left - a, right - a) }); }
  return mergeRuns(out);
}
function reconcileRuns(previous: string, next: string, runs: TextRun[], fallback: Omit<TextRun, "text">) {
  let prefix = 0; while (prefix < previous.length && prefix < next.length && previous[prefix] === next[prefix]) prefix += 1;
  let suffix = 0; while (suffix < previous.length - prefix && suffix < next.length - prefix && previous[previous.length - 1 - suffix] === next[next.length - 1 - suffix]) suffix += 1;
  const inserted = next.slice(prefix, next.length - suffix); return mergeRuns([...sliceRuns(runs, 0, prefix), ...(inserted ? [{ text: inserted, ...fallback }] : []), ...sliceRuns(runs, previous.length - suffix, previous.length)]);
}
/** Largeur (fraction de la largeur de page) et hauteur de ligne (fraction de la largeur) d'une note texte. */
/** Retour à la ligne automatique quand la note a une largeur choisie (poignée d'angle) : on insère des sauts de ligne aux espaces. */
function flowRuns(m: Pick<TextMark, "text" | "size" | "font" | "color" | "runs" | "w">): TextRun[] {
  const runs = runsOf(m); if (!m.w || m.w <= 0) return runs;
  if (!measureCtx && typeof document !== "undefined") measureCtx = document.createElement("canvas").getContext("2d");
  const limit = m.w * 1000; let lineW = 0;
  return runs.map((run) => { const f = fontOf(run.font); const px = textPixels(run.size, 1000); if (measureCtx) measureCtx.font = `${f.weight} ${px}px ${f.css}`;
    const measure = (s: string) => measureCtx ? measureCtx.measureText(s).width : s.length * px * 0.5;
    let out = "";
    for (const token of run.text.split(/(\n|[ \t]+)/)) { if (!token) continue;
      if (token === "\n") { out += "\n"; lineW = 0; continue; }
      if (/^[ \t]+$/.test(token)) { if (lineW > 0) { out += token; lineW += measure(token); } continue; }
      const w = measure(token);
      if (lineW > 0 && lineW + w > limit) { out = out.replace(/[ \t]+$/, "") + "\n"; lineW = 0; }
      out += token; lineW += w;
    }
    return { ...run, text: out }; });
}
function textExtent(m: Pick<TextMark, "text" | "size" | "font" | "color" | "runs" | "w">) {
  if (!measureCtx && typeof document !== "undefined") measureCtx = document.createElement("canvas").getContext("2d");
  let lineWidth = 0; let maxWidth = 0; let lineHeight = textPixels(m.size, 1000); let maxLineHeight = lineHeight; let lines = 1;
  for (const run of flowRuns(m)) { const f = fontOf(run.font); const px = textPixels(run.size, 1000); maxLineHeight = Math.max(maxLineHeight, px); if (measureCtx) measureCtx.font = `${f.weight} ${px}px ${f.css}`;
    run.text.split("\n").forEach((part, i, parts) => { lineWidth += measureCtx ? measureCtx.measureText(part).width : part.length * px * 0.5; maxWidth = Math.max(maxWidth, lineWidth, px * 0.5); if (i < parts.length - 1) { lineWidth = 0; lines += 1; } });
  }
  lineHeight = maxLineHeight;
  return { w: maxWidth / 1000, line: lineHeight / 1000, lines };
}
/** Nettoie le Markdown d'une réponse collée et la découpe en blocs : une note par ligne, puce ou titre. */
function pasteBlocks(raw: string): { text: string; gap: boolean }[] {
  const out: { text: string; gap: boolean }[] = []; let gap = false;
  for (const line of raw.replace(/\r/g, "").split("\n")) {
    let t = line.trim();
    if (!t || /^(-{3,}|\*{3,}|_{3,})$/.test(t)) { gap = out.length > 0; continue; }
    t = t.replace(/^#{1,6}\s+/, "").replace(/^>\s?/, "").replace(/^[-*+]\s+/, "• ").replace(/\*\*(.+?)\*\*/g, "$1").replace(/__(.+?)__/g, "$1").replace(/(^|[^*])\*(?!\s)(.+?)\*/g, "$1$2").replace(/`([^`]+)`/g, "$1").replace(/\[([^\]]+)\]\([^)]+\)/g, "$1");
    out.push({ text: t, gap }); gap = false;
  }
  return out;
}
/** Point dans un polygone (règle pair-impair). */
function inPoly(x: number, y: number, poly: Pt[]) {
  let inside = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) { const a = poly[i]!; const b = poly[j]!; if ((a[1] > y) !== (b[1] > y) && x < (b[0] - a[0]) * (y - a[1]) / (b[1] - a[1]) + a[0]) inside = !inside; }
  return inside;
}

function TextSizePicker({ value, onChange }: { value: number; onChange: (value: number) => void }) {
  const current = clampTextSize(value);
  const [draftSize, setDraftSize] = useState(String(current));
  useEffect(() => { setDraftSize(String(current)); }, [current]);
  const step = (dir: 1 | -1) => onChange(clampTextSize(current + dir));
  // Saisie libre au clavier : validée à la sortie du champ ou avec Entrée, puis ramenée entre 8 et 72 pt.
  const commitDraft = () => { const n = Number(draftSize.replace(",", ".")); if (draftSize.trim() === "" || !Number.isFinite(n)) { setDraftSize(String(current)); return; } const next = clampTextSize(n); setDraftSize(String(next)); if (next !== current) onChange(next); };
  return <div className="mt-4"><div className="flex items-center justify-between"><span className="text-sm font-semibold">{tf("Taille")}</span><div className="flex items-center gap-1"><Button variant="outline" size="icon" className="size-8" aria-label={tf("Taille : diminuer")} disabled={current <= TEXT_SIZE_MIN} onClick={() => step(-1)}><Minus /></Button><label className="flex h-8 items-center border bg-background pr-1.5"><input type="text" inputMode="numeric" pattern="[0-9]*" value={draftSize} onChange={(e) => setDraftSize(e.target.value.replace(/[^0-9]/g, "").slice(0, 2))} onBlur={commitDraft} onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); commitDraft(); (e.target as HTMLInputElement).blur(); } }} onFocus={(e) => e.target.select()} className="h-full w-9 bg-transparent text-center text-sm font-semibold tabular-nums outline-none" aria-label={tf("Taille du texte en points")} /><span className="text-[10px] text-muted-foreground">{tf("pt")}</span></label><Button variant="outline" size="icon" className="size-8" aria-label={tf("Taille : augmenter")} disabled={current >= TEXT_SIZE_MAX} onClick={() => step(1)}><Plus /></Button></div></div></div>;
}

function ThicknessPicker({ label, value, onChange, min, max, presets }: { label: string; value: number; onChange: (v: number) => void; min: number; max: number; presets: number[] }) {
  const set = (v: number) => onChange(Math.max(min, Math.min(max, Math.round(v))));
  return <div className="mt-4"><div className="flex items-center justify-between"><span className="text-sm font-semibold">{label}</span><div className="flex items-center gap-1"><Button variant="outline" size="icon" className="size-8" aria-label={tf("{0} : diminuer", [label])} disabled={value <= min} onClick={() => set(value - 1)}><Minus /></Button><input type="number" inputMode="numeric" min={min} max={max} value={value} onChange={(e) => { const n = Number(e.target.value); if (Number.isFinite(n) && e.target.value !== "") set(n); }} className="h-8 w-12 border bg-background text-center text-sm font-semibold" aria-label={tf("{0} exacte", [label])} /><Button variant="outline" size="icon" className="size-8" aria-label={tf("{0} : augmenter", [label])} disabled={value >= max} onClick={() => set(value + 1)}><Plus /></Button></div></div>
    <input className="mt-2 w-full" type="range" min={min} max={max} value={value} onChange={(e) => set(Number(e.target.value))} aria-label={label} />
    <div className="mt-2 flex gap-2">{presets.map((n) => <Button key={n} variant={value === n ? "secondary" : "outline"} size="sm" className="h-9 flex-1 gap-1.5 px-1" onClick={() => set(n)} aria-label={`${label} ${n}`}><span className="block rounded-full bg-foreground" style={{ width: Math.min(16, 2 + n), height: Math.min(16, 2 + n) }} />{n}</Button>)}</div></div>;
}

const QUICK_COLORS = ["#2b2540", "#d64541", "#2e6fd8", "#1f9d55", "#e0a800", "#8e5bd0"];
const HIGHLIGHT_COLORS = ["#ffe94d", "#8ef0a0", "#7fd4ff", "#ff9ecb", "#ffb760", "#c9a8ff"];
const DEFAULT_PEN_CONFIGS: PenConfigs = {
  plume: { color: QUICK_COLORS[0] ?? "#2b2540", size: 3 },
  bille: { color: QUICK_COLORS[2] ?? "#2e6fd8", size: 2 },
  crayon: { color: QUICK_COLORS[1] ?? "#d64541", size: 4 },
};
const DEFAULT_HIGHLIGHTER_CONFIGS: HighlighterConfigs = {
  plat: { color: HIGHLIGHT_COLORS[0] ?? "#ffe94d", size: 6 },
  fin: { color: HIGHLIGHT_COLORS[1] ?? "#8ef0a0", size: 3 },
};
type EmojiItem = { char: string; name: string };
const EMOJI_CATEGORIES: { id: string; label: string; items: EmojiItem[] }[] = [
  { id: "visages", get label() { return tf("Émoticônes et personnes"); }, items: [
    { char: "😀", name: "sourire content heureux" }, { char: "😄", name: "rire joyeux" }, { char: "😁", name: "grand sourire" }, { char: "😂", name: "rire larmes" }, { char: "🙂", name: "léger sourire" }, { char: "😉", name: "clin d'œil" }, { char: "😍", name: "amoureux cœurs" }, { char: "🤩", name: "étoiles impressionné" }, { char: "😎", name: "cool lunettes" }, { char: "🤓", name: "intello lunettes studieux" }, { char: "🤔", name: "réfléchit pensif doute" }, { char: "🧐", name: "monocle analyse" }, { char: "😅", name: "sueur soulagé" }, { char: "😌", name: "apaisé calme" }, { char: "😴", name: "dort fatigue" }, { char: "🥱", name: "bâille ennui" }, { char: "😟", name: "inquiet souci" }, { char: "😢", name: "triste pleure" }, { char: "😭", name: "sanglot" }, { char: "😱", name: "peur panique" }, { char: "🤯", name: "esprit soufflé dingue" }, { char: "😤", name: "déterminé agacé" }, { char: "🥳", name: "fête célébration" }, { char: "🙃", name: "à l'envers ironie" },
    { char: "👍", name: "pouce oui d'accord" }, { char: "👎", name: "pouce bas non" }, { char: "👏", name: "applaudissements bravo" }, { char: "🙌", name: "mains levées hourra" }, { char: "🤝", name: "poignée de main accord" }, { char: "✍️", name: "écrire main" }, { char: "💪", name: "force courage muscle" }, { char: "🫡", name: "salut respect" }, { char: "🙏", name: "merci s'il te plaît" }, { char: "👀", name: "yeux regarder" }, { char: "🧠", name: "cerveau intelligence" }, { char: "🎓", name: "diplôme remise" },
  ] },
  { id: "animaux", get label() { return tf("Animaux et nature"); }, items: [
    { char: "🐶", name: "chien" }, { char: "🐱", name: "chat" }, { char: "🦊", name: "renard" }, { char: "🐻", name: "ours" }, { char: "🐼", name: "panda" }, { char: "🐨", name: "koala" }, { char: "🦁", name: "lion" }, { char: "🐯", name: "tigre" }, { char: "🐸", name: "grenouille" }, { char: "🐵", name: "singe" }, { char: "🦄", name: "licorne" }, { char: "🐝", name: "abeille" }, { char: "🦋", name: "papillon" }, { char: "🐢", name: "tortue" }, { char: "🐙", name: "pieuvre" }, { char: "🦉", name: "hibou chouette sage" },
    { char: "🌸", name: "fleur cerisier" }, { char: "🌻", name: "tournesol" }, { char: "🌷", name: "tulipe" }, { char: "🌱", name: "pousse plante" }, { char: "🌳", name: "arbre" }, { char: "🍀", name: "trèfle chance" }, { char: "🌈", name: "arc-en-ciel" }, { char: "☀️", name: "soleil" }, { char: "🌙", name: "lune" }, { char: "⭐", name: "étoile" }, { char: "✨", name: "étincelles magie" }, { char: "⚡", name: "éclair énergie" }, { char: "🔥", name: "feu chaud" }, { char: "❄️", name: "neige froid" }, { char: "🌊", name: "vague mer" }, { char: "☁️", name: "nuage" },
  ] },
  { id: "nourriture", get label() { return tf("Nourriture et boissons"); }, items: [
    { char: "☕", name: "café" }, { char: "🍵", name: "thé" }, { char: "🧃", name: "jus" }, { char: "🥤", name: "boisson gobelet" }, { char: "🍎", name: "pomme" }, { char: "🍌", name: "banane" }, { char: "🍓", name: "fraise" }, { char: "🍇", name: "raisin" }, { char: "🍊", name: "orange" }, { char: "🥐", name: "croissant" }, { char: "🍞", name: "pain" }, { char: "🧀", name: "fromage" }, { char: "🍕", name: "pizza" }, { char: "🍔", name: "burger" }, { char: "🍪", name: "biscuit cookie" }, { char: "🍫", name: "chocolat" }, { char: "🍰", name: "gâteau" }, { char: "🍩", name: "beignet donut" },
  ] },
  { id: "ecole", get label() { return tf("École et études"); }, items: [
    { char: "📚", name: "livres" }, { char: "📖", name: "livre ouvert lecture" }, { char: "📝", name: "note mémo écrire" }, { char: "✏️", name: "crayon" }, { char: "🖊️", name: "stylo" }, { char: "🖍️", name: "crayon de couleur" }, { char: "📐", name: "équerre géométrie" }, { char: "📏", name: "règle mesure" }, { char: "🧮", name: "abaque calcul" }, { char: "🔢", name: "chiffres nombres" }, { char: "🔬", name: "microscope science" }, { char: "🧪", name: "éprouvette chimie" }, { char: "🧬", name: "adn biologie" }, { char: "🌍", name: "globe géographie" }, { char: "🗺️", name: "carte" }, { char: "💻", name: "ordinateur portable" }, { char: "🖥️", name: "écran ordinateur" }, { char: "⌨️", name: "clavier" }, { char: "🖨️", name: "imprimante" }, { char: "📊", name: "graphique barres statistiques" }, { char: "📈", name: "courbe hausse" }, { char: "📉", name: "courbe baisse" }, { char: "🗂️", name: "dossiers classement" }, { char: "📁", name: "dossier" }, { char: "📌", name: "punaise épinglé" }, { char: "📎", name: "trombone" }, { char: "✂️", name: "ciseaux" }, { char: "🗒️", name: "bloc-notes" }, { char: "📅", name: "calendrier date" }, { char: "⏰", name: "réveil alarme" }, { char: "⏳", name: "sablier temps" }, { char: "🔍", name: "loupe recherche" }, { char: "💡", name: "ampoule idée" }, { char: "🎯", name: "cible objectif" }, { char: "🏆", name: "trophée victoire" }, { char: "🥇", name: "médaille premier" },
  ] },
  { id: "symboles", get label() { return tf("Symboles et signes"); }, items: [
    { char: "✅", name: "coche validé fait" }, { char: "☑️", name: "case cochée" }, { char: "✔️", name: "coche" }, { char: "❌", name: "croix faux" }, { char: "❗", name: "exclamation important" }, { char: "❓", name: "question" }, { char: "⚠️", name: "attention avertissement" }, { char: "🚫", name: "interdit" }, { char: "💯", name: "cent parfait" }, { char: "♾️", name: "infini" }, { char: "➕", name: "plus addition" }, { char: "➖", name: "moins soustraction" }, { char: "✖️", name: "multiplication" }, { char: "➗", name: "division" }, { char: "🟰", name: "égal" }, { char: "🔺", name: "triangle rouge" }, { char: "🔵", name: "cercle bleu" }, { char: "🟢", name: "cercle vert" }, { char: "🟡", name: "cercle jaune" }, { char: "🔴", name: "cercle rouge" }, { char: "▶️", name: "lecture play" }, { char: "⏸️", name: "pause" }, { char: "🔁", name: "répéter boucle" }, { char: "➡️", name: "flèche droite" }, { char: "⬅️", name: "flèche gauche" }, { char: "⬆️", name: "flèche haut" }, { char: "⬇️", name: "flèche bas" }, { char: "↔️", name: "flèche double" }, { char: "❤️", name: "cœur rouge" }, { char: "💛", name: "cœur jaune" }, { char: "💚", name: "cœur vert" }, { char: "💜", name: "cœur violet" }, { char: "🖤", name: "cœur noir" }, { char: "💤", name: "sommeil" }, { char: "💬", name: "bulle dialogue" }, { char: "🔔", name: "cloche rappel" },
  ] },
];
const DEFAULT_SHORTCUTS: ToolbarItem[] = ["pen", "highlighter", "eraser", "select", "text", "lasso", "stylus"];
const OLD_DEFAULT_SHORTCUTS = ["pen", "highlighter", "eraser", "select", "text", "zoom", "stylus"];
// Toutes les formes et lignes vivent dans un seul raccourci « Flèche » : une ancienne barre qui contenait
// plusieurs formes séparées est ramenée à ce seul bouton (sans doublon). L'ancienne barre par défaut reçoit le Lasso à la place du Zoom.
function normalizeShortcuts(raw: unknown): ToolbarItem[] {
  if (!Array.isArray(raw)) return DEFAULT_SHORTCUTS;
  const list = raw.filter((v): v is ToolbarItem => typeof v === "string" && v in TOOL_META_KEYS);
  if (list.length === OLD_DEFAULT_SHORTCUTS.length && list.every((v, i) => v === OLD_DEFAULT_SHORTCUTS[i])) return DEFAULT_SHORTCUTS;
  const out: ToolbarItem[] = [];
  for (const v of list) { const id: ToolbarItem = (SHAPE_TOOL_IDS as string[]).includes(v) ? "arrow" : v; if (!out.includes(id)) out.push(id); }
  return out;
}
const SHAPE_TOOL_IDS: string[] = ["line", "arrow", "doubleArrow", "rectangle", "roundedRectangle", "ellipse", "triangle", "diamond", "parallelogram", "pentagon", "star", "heart"];
const TOOL_META_KEYS: Record<string, true> = Object.fromEntries([...SHAPE_TOOL_IDS, "pen", "highlighter", "text", "eraser", "ruler", "select", "lasso", "zoom", "stylus"].map((k) => [k, true]));
const SHAPE_TOOLS: ShapeTool[] = ["line", "arrow", "doubleArrow", "rectangle", "roundedRectangle", "ellipse", "triangle", "diamond", "parallelogram", "pentagon", "star", "heart"];
const DEFAULT_SHAPE_COLORS = Object.fromEntries(SHAPE_TOOLS.map((shape) => [shape, QUICK_COLORS[0] ?? "#2b2540"])) as ShapeColors;
const uid = () => Math.random().toString(36).slice(2);
// Lissage du lasso : on retire les points qui ne changent pas la forme du tracé (Douglas-Peucker).
function simplifyPath(pts: Pt[], eps = 0.004): Pt[] {
  if (pts.length < 3) return pts;
  const keep = new Uint8Array(pts.length); keep[0] = 1; keep[pts.length - 1] = 1;
  const stack: [number, number][] = [[0, pts.length - 1]];
  const dist = (a: Pt, b: Pt, c: Pt) => { const dx = b[0] - a[0], dy = b[1] - a[1]; const len = Math.hypot(dx, dy) || 1e-9; return Math.abs((c[0] - a[0]) * dy - (c[1] - a[1]) * dx) / len; };
  while (stack.length) { const [i, j] = stack.pop()!; let maxD = 0; let at = -1; for (let k = i + 1; k < j; k++) { const p = pts[k]; if (!p) continue; const d = dist(pts[i]!, pts[j]!, p); if (d > maxD) { maxD = d; at = k; } } if (maxD > eps && at > 0) { keep[at] = 1; stack.push([i, at], [at, j]); } }
  return pts.filter((_, k) => keep[k]);
}

const TOOL_META: Record<ToolbarItem, { label: string; Icon: typeof Pen }> = {
  pen: { get label() { return tf("Stylo"); }, Icon: Pen }, highlighter: { get label() { return tf("Surligneur"); }, Icon: Highlighter },
  eraser: { get label() { return tf("Gomme"); }, Icon: Eraser }, arrow: { get label() { return tf("Formes"); }, Icon: ArrowUpRight },
  text: { get label() { return tf("Texte"); }, Icon: Type }, select: { get label() { return tf("Sélection"); }, Icon: TextSelect }, lasso: { get label() { return tf("Lasso"); }, Icon: Lasso }, ruler: { get label() { return tf("Règle"); }, Icon: Ruler },

  line: { get label() { return tf("Ligne"); }, Icon: Minus }, doubleArrow: { get label() { return tf("Double flèche"); }, Icon: ArrowLeftRight },
  rectangle: { get label() { return tf("Rectangle"); }, Icon: RectangleHorizontal }, roundedRectangle: { get label() { return tf("Rectangle arrondi"); }, Icon: Square }, ellipse: { get label() { return tf("Cercle"); }, Icon: Circle },
  triangle: { get label() { return tf("Triangle"); }, Icon: Triangle }, diamond: { get label() { return tf("Losange"); }, Icon: Diamond }, parallelogram: { get label() { return tf("Parallélogramme"); }, Icon: RectangleHorizontal },
  pentagon: { get label() { return tf("Pentagone"); }, Icon: Pentagon }, star: { get label() { return tf("Étoile"); }, Icon: Star }, heart: { get label() { return tf("Cœur"); }, Icon: Heart },
  zoom: { get label() { return tf("Zoom"); }, Icon: ZoomIn }, stylus: { get label() { return tf("Stylet seulement"); }, Icon: Hand },
};

async function renderPdf(file: Blob, onFirstPage?: (page: string) => void): Promise<string[]> {
  const pdfjs = await import("pdfjs-dist");
  const worker = await import("pdfjs-dist/build/pdf.worker.min.mjs?url");
  pdfjs.GlobalWorkerOptions.workerSrc = worker.default;
  const doc = await pdfjs.getDocument({ data: await file.arrayBuffer() }).promise;
  const out: string[] = [];
  for (let i = 1; i <= doc.numPages; i += 1) {
    const page = await doc.getPage(i);
    const viewport = page.getViewport({ scale: 2 });
    const canvas = document.createElement("canvas");
    canvas.width = viewport.width; canvas.height = viewport.height;
    const context = canvas.getContext("2d");
    if (!context) continue;
    await page.render({ canvasContext: context, viewport }).promise;
    const image = canvas.toDataURL("image/jpeg", 0.9); out.push(image); if (i === 1) onFirstPage?.(image);
  }
  return out;
}

// Texte réel de chaque page du PDF, pour la recherche de mots dans le cours.
type TextItemBox = { str: string; x: number; y: number; w: number; h: number; fs?: number };
async function extractPdfText(file: Blob): Promise<{ texts: string[]; items: TextItemBox[][] }> {
  try {
    const pdfjs = await import("pdfjs-dist");
    const worker = await import("pdfjs-dist/build/pdf.worker.min.mjs?url");
    pdfjs.GlobalWorkerOptions.workerSrc = worker.default;
    const doc = await pdfjs.getDocument({ data: await file.arrayBuffer() }).promise;
    const texts: string[] = []; const items: TextItemBox[][] = [];
    for (let i = 1; i <= doc.numPages; i += 1) {
      try {
        const page = await doc.getPage(i);
        const vp = page.getViewport({ scale: 1 });
        const content = await page.getTextContent();
        const boxes: TextItemBox[] = [];
        for (const raw of content.items) {
          const it = raw as { str?: string; transform?: number[]; width?: number };
          if (!it.str || !it.transform) continue;
          const t = pdfjs.Util.transform(vp.transform, it.transform) as number[];
          const fh = Math.hypot(t[2] ?? 0, t[3] ?? 0); const w = (it.width ?? 0) * vp.scale;
          if (!fh || !w) continue;
          boxes.push({ str: it.str, x: (t[4] ?? 0) / vp.width, y: ((t[5] ?? 0) - fh) / vp.height, w: w / vp.width, h: (fh * 1.15) / vp.height, fs: fh / vp.width });
        }
        items.push(boxes);
        texts.push(content.items.map((item) => (item as { str?: string }).str ?? "").join(" ").replace(/\s+/g, " ").toLowerCase());
      } catch { texts.push(""); items.push([]); }
    }
    return { texts, items };
  } catch { return { texts: [], items: [] }; }
}

type HlBox = { x: number; y: number; w: number; h: number };
// Boîtes de surlignage des occurrences recherchées (PDF + notes texte), en coordonnées 0–1 de la page.
function searchHighlights(q: string, items: TextItemBox[] | undefined, marks: Mark[], aspect = 1.414): HlBox[] {
  const query = q.trim().toLowerCase(); if (!query) return [];
  const out: HlBox[] = [];
  const ctx = typeof document !== "undefined" ? document.createElement("canvas").getContext("2d") : null;
  for (const it of items ?? []) {
    const low = it.str.toLowerCase(); let at = low.indexOf(query);
    if (ctx) ctx.font = "100px Helvetica, Arial, sans-serif";
    const full = ctx ? ctx.measureText(it.str).width : 0;
    while (at >= 0) {
      if (ctx && full > 0) { const k = Math.max(it.w, it.fs ? (full / 100) * it.fs : 0) / full; out.push({ x: it.x + ctx.measureText(it.str.slice(0, at)).width * k, y: it.y, w: ctx.measureText(it.str.slice(at, at + query.length)).width * k, h: it.h }); }
      else { const cw = it.w / Math.max(1, it.str.length); out.push({ x: it.x + at * cw, y: it.y, w: query.length * cw, h: it.h }); }
      at = low.indexOf(query, at + query.length);
    }
  }
  if (ctx) for (const m of marks) {
    if (m.type !== "text") continue;
    const W = 1000; const f = fontOf(m.font); const px = textPixels(m.size, W); ctx.font = `${f.weight} ${px}px ${f.css}`;
    m.text.split("\n").forEach((line, li) => {
      const low = line.toLowerCase(); let at = low.indexOf(query);
      while (at >= 0) { const x0 = ctx.measureText(line.slice(0, at)).width; const ww = ctx.measureText(line.slice(at, at + query.length)).width; out.push({ x: m.x + x0 / W, y: m.y + (li * px * 1.2 - px * 0.85) / (W * aspect), w: ww / W, h: (px * 1.1) / (W * aspect) }); at = low.indexOf(query, at + query.length); }
    });
  }
  return out;
}

function drawMark(ctx: CanvasRenderingContext2D, mark: Mark, width: number, height: number) {
  if (mark.type === "image") {
    const img = imageCache.get(mark.path);
    if (img instanceof HTMLImageElement) ctx.drawImage(img, mark.x * width, mark.y * height, mark.w * width, mark.h * height);
    else if (!img) void loadMarkImage(mark.path);
    return;
  }
  ctx.save(); ctx.lineCap = "round"; ctx.lineJoin = "round";
  if (mark.type === "text") {
    let x = mark.x * width; let y = mark.y * height; let lineHeight = textPixels(mark.size, width);
    for (const run of flowRuns(mark)) { const f = fontOf(run.font); const fontPx = textPixels(run.size, width); lineHeight = Math.max(lineHeight, fontPx); ctx.fillStyle = run.color; ctx.font = `${f.weight} ${fontPx}px ${f.css}`;
      run.text.split("\n").forEach((part, i, parts) => { ctx.fillText(part, x, y); x += ctx.measureText(part).width; if (i < parts.length - 1) { x = mark.x * width; y += lineHeight * 1.2; lineHeight = fontPx; } });
    }
    ctx.restore(); return;
  }
  if (mark.pts.length < 2) { ctx.restore(); return; }
  const first = mark.pts[0]; const last = mark.pts.at(-1);
  if (!first || !last) { ctx.restore(); return; }
  const [ax, ay, bx, by] = [first[0] * width, first[1] * height, last[0] * width, last[1] * height];
  const lineWidth = mark.size * width * (mark.type === "highlighter" ? 0.0035 : 0.0012);
  ctx.strokeStyle = mark.color; ctx.lineWidth = lineWidth;
  if (["rectangle", "roundedRectangle", "ellipse", "triangle", "diamond", "parallelogram", "pentagon", "star", "heart"].includes(mark.type)) {
    if (mark.fill && mark.fill !== "transparent") { ctx.fillStyle = mark.fill; ctx.globalAlpha = 0.22; }
    ctx.beginPath();
    const left = Math.min(ax, bx); const top = Math.min(ay, by); const w = Math.abs(bx - ax); const h = Math.abs(by - ay); const cx = left + w / 2; const cy = top + h / 2;
    if (mark.type === "rectangle") ctx.rect(ax, ay, bx - ax, by - ay);
    else if (mark.type === "roundedRectangle") ctx.roundRect(left, top, w, h, Math.min(w, h) * 0.16);
    else if (mark.type === "ellipse") ctx.ellipse(cx, cy, w / 2, h / 2, 0, 0, Math.PI * 2);
    else if (mark.type === "heart") { ctx.moveTo(cx, top + h); ctx.bezierCurveTo(left - w * 0.1, top + h * 0.55, left, top + h * 0.1, cx, top + h * 0.35); ctx.bezierCurveTo(left + w, top + h * 0.1, left + w * 1.1, top + h * 0.55, cx, top + h); }
    else {
      const points = mark.type === "triangle" ? [[0.5,0],[1,1],[0,1]] : mark.type === "diamond" ? [[0.5,0],[1,0.5],[0.5,1],[0,0.5]] : mark.type === "parallelogram" ? [[0.22,0],[1,0],[0.78,1],[0,1]] : Array.from({ length: mark.type === "star" ? 10 : 5 }, (_, i) => { const angle = -Math.PI / 2 + i * Math.PI * 2 / (mark.type === "star" ? 10 : 5); const radius = mark.type === "star" && i % 2 ? 0.22 : 0.5; return [0.5 + Math.cos(angle) * radius, 0.5 + Math.sin(angle) * radius]; });
      points.forEach((p, i) => { const x = left + (p?.[0] ?? 0) * w; const y = top + (p?.[1] ?? 0) * h; if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y); }); ctx.closePath();
    }
    if (mark.fill && mark.fill !== "transparent") ctx.fill(); ctx.globalAlpha = 1; ctx.stroke(); ctx.restore(); return;
  }
  if (mark.type === "line" || mark.type === "arrow" || mark.type === "doubleArrow" || mark.type === "ruler") {
    ctx.beginPath(); ctx.moveTo(ax, ay); ctx.lineTo(bx, by);
    if (mark.type === "arrow" || mark.type === "doubleArrow") {
      const angle = Math.atan2(by - ay, bx - ax); const head = Math.max(10, lineWidth * 5);
      ctx.moveTo(bx, by); ctx.lineTo(bx - head * Math.cos(angle - 0.5), by - head * Math.sin(angle - 0.5));
      ctx.moveTo(bx, by); ctx.lineTo(bx - head * Math.cos(angle + 0.5), by - head * Math.sin(angle + 0.5));
      if (mark.type === "doubleArrow") { ctx.moveTo(ax, ay); ctx.lineTo(ax + head * Math.cos(angle - 0.5), ay + head * Math.sin(angle - 0.5)); ctx.moveTo(ax, ay); ctx.lineTo(ax + head * Math.cos(angle + 0.5), ay + head * Math.sin(angle + 0.5)); }
    }
    ctx.stroke(); ctx.restore(); return;
  }
  const pts = mark.pts;
  const smoothPath = () => {
    ctx.beginPath(); ctx.moveTo(first[0] * width, first[1] * height);
    for (let i = 1; i < pts.length - 1; i += 1) {
      const p = pts[i]; const n = pts[i + 1]; if (!p || !n) continue;
      ctx.quadraticCurveTo(p[0] * width, p[1] * height, ((p[0] + n[0]) / 2) * width, ((p[1] + n[1]) / 2) * height);
    }
    ctx.lineTo(last[0] * width, last[1] * height);
  };
  if (mark.type === "highlighter") {
    // One single path so overlapping segments never stack into dark blobs.
    ctx.globalCompositeOperation = "multiply"; ctx.globalAlpha = 0.4;
    ctx.lineCap = mark.style === "fin" ? "round" : "butt"; ctx.lineJoin = "round";
    ctx.lineWidth = lineWidth; smoothPath(); ctx.stroke(); ctx.restore(); return;
  }
  if (mark.style === "bille" || mark.style === "crayon") {
    if (mark.style === "crayon") ctx.globalAlpha = 0.75;
    ctx.lineWidth = lineWidth * (mark.style === "crayon" ? 0.9 : 1); smoothPath(); ctx.stroke(); ctx.restore(); return;
  }
  // Fountain pen: pressure-varying width, drawn with smoothed midpoints and opaque ink.
  for (let i = 1; i < pts.length; i += 1) {
    const a = pts[i - 1]; const b = pts[i]; const c = pts[i + 1]; if (!a || !b) continue;
    const startX = i === 1 ? a[0] : (a[0] + b[0]) / 2; const startY = i === 1 ? a[1] : (a[1] + b[1]) / 2;
    const endX = c ? (b[0] + c[0]) / 2 : b[0]; const endY = c ? (b[1] + c[1]) / 2 : b[1];
    ctx.lineWidth = lineWidth * (0.45 + b[2] * 1.1);
    ctx.beginPath(); ctx.moveTo(startX * width, startY * height); ctx.quadraticCurveTo(b[0] * width, b[1] * height, endX * width, endY * height); ctx.stroke();
  }
  ctx.restore();
}

function hit(mark: Mark, x: number, y: number, eraserSize = 2) {
  const radius = 0.012 + eraserSize * 0.008;
  if (mark.type === "image") return x >= mark.x && x <= mark.x + mark.w && y >= mark.y && y <= mark.y + mark.h;
  if (mark.type === "text") { const b = markBox(mark); return x >= b.x - radius && x <= b.x + b.w + radius && y >= b.y - radius * 0.5 && y <= b.y + b.h + radius * 0.5; }
  return mark.pts.some((point) => Math.hypot(point[0] - x, point[1] - y) < radius);
}

type Box = { x: number; y: number; w: number; h: number };
type LassoSelection = { ids: string[]; box: Box };
function markBox(m: Mark): Box {
  if (m.type === "image") return { x: m.x, y: m.y, w: m.w, h: m.h };
  if (m.type === "text") { const t = textExtent(m); return { x: m.x, y: m.y - t.line * 0.85, w: t.w, h: t.line * (0.85 + Math.max(0, t.lines - 1) * 1.2 + 0.25) }; }
  const xs = m.pts.map((p) => p[0]); const ys = m.pts.map((p) => p[1]);
  const x = Math.min(...xs); const y = Math.min(...ys);
  return { x, y, w: Math.max(...xs) - x, h: Math.max(...ys) - y };
}
/** Sélection naturelle : l'objet est pris si son centre est entouré ou si l'essentiel de sa boîte l'est. */
function pickedBox(b: Box, lasso: Box): boolean {
  const cx = b.x + b.w / 2, cy = b.y + b.h / 2;
  if (cx >= lasso.x && cx <= lasso.x + lasso.w && cy >= lasso.y && cy <= lasso.y + lasso.h) return true;
  const ox = Math.max(0, Math.min(b.x + b.w, lasso.x + lasso.w) - Math.max(b.x, lasso.x));
  const oy = Math.max(0, Math.min(b.y + b.h, lasso.y + lasso.h) - Math.max(b.y, lasso.y));
  const area = b.w * b.h;
  return area > 0 ? (ox * oy) / area >= 0.35 : ox > 0 && oy > 0;
}
function unionBox(boxes: Box[]): Box | null {
  if (!boxes.length) return null;
  const x = Math.min(...boxes.map((b) => b.x)); const y = Math.min(...boxes.map((b) => b.y));
  return { x, y, w: Math.max(...boxes.map((b) => b.x + b.w)) - x, h: Math.max(...boxes.map((b) => b.y + b.h)) - y };
}
function shiftMark(m: Mark, dx: number, dy: number): Mark {
  if (m.type === "text" || m.type === "image") return { ...m, x: m.x + dx, y: m.y + dy };
  return { ...m, pts: m.pts.map((p) => [p[0] + dx, p[1] + dy, p[2]] as Pt) };
}

type PasteVariant = "moderne" | "main" | "marks";
/** Agrandit/réduit une note autour d'un point fixe (le coin opposé à la poignée tirée). */
function scaleAbout(m: Mark, ax: number, ay: number, factor: number): Mark {
  const sx = (x: number) => ax + (x - ax) * factor; const sy = (y: number) => ay + (y - ay) * factor;
  if (m.type === "text") return { ...m, x: sx(m.x), y: sy(m.y), size: Math.max(6, Math.min(72, m.size * factor)) };
  if (m.type === "image") return { ...m, x: sx(m.x), y: sy(m.y), w: m.w * factor, h: m.h * factor };
  return { ...m, size: Math.max(0.5, m.size * factor), pts: m.pts.map((p) => [sx(p[0]), sy(p[1]), p[2]] as Pt) };
}

/** Étire uniquement en largeur ou en hauteur (poignées médianes, images). */
function scaleAxes(m: Mark, ax: number, ay: number, fx: number, fy: number): Mark {
  const sx = (x: number) => ax + (x - ax) * fx; const sy = (y: number) => ay + (y - ay) * fy;
  if (m.type === "image") { const nx = sx(m.x), ny = sy(m.y), ex = sx(m.x + m.w), ey = sy(m.y + m.h); return { ...m, x: Math.min(nx, ex), y: Math.min(ny, ey), w: Math.abs(ex - nx), h: Math.abs(ey - ny) }; }
  if (m.type === "text") return { ...m, x: sx(m.x), y: sy(m.y) };
  return { ...m, pts: m.pts.map((p) => [sx(p[0]), sy(p[1]), p[2]] as Pt) };
}

function recolorMark(m: Mark, nextColor: string): Mark {
  if (m.type === "image") return m;
  return { ...m, color: nextColor };
}

/** Change le remplissage d'une forme géométrique (les traits libres et textes n'ont pas de fond). */
function refillMark(m: Mark, nextFill: string): Mark {
  if (m.type === "image" || m.type === "text" || !(SHAPE_TOOL_IDS as string[]).includes(m.type)) return m;
  return { ...m, fill: nextFill };
}


type TextEdit = { id?: string; x: number; y: number; text: string; runs: TextRun[]; w?: number };
function DrawingPage({ src, marks, tool, color, fill, size, penStyle, eraserModes, eraserSize, penOnly, rotation, textColor, textSize, textFont, onTextStyle, onChange, onApply, onHistory, onSelect, onInteract, lassoSel, setLassoSel, highlights, onLongPress, pasteTarget, clipKind, onPaste, onClosePaste }: {
  highlights?: { x: number; y: number; w: number; h: number }[];
  src: string; marks: Mark[]; tool: Tool; color: string; fill: string; size: number; penStyle: PenStyle; eraserModes: EraserKind[]; eraserSize: number; penOnly: boolean; rotation: number;
  textColor: string; textSize: number; textFont: TextFont; onTextStyle: (style: { color: string; size: number; font: TextFont }) => void;
  onChange: (marks: Mark[]) => void; onApply: (marks: Mark[]) => void; onHistory: () => void; onSelect: (box: { x: number; y: number; w: number; h: number }) => void;
  onInteract: () => void; lassoSel: LassoSelection | null; setLassoSel: (value: LassoSelection | null) => void;
  onLongPress: (x: number, y: number) => void; pasteTarget: { x: number; y: number } | null; clipKind: "text" | "marks" | null;
  onPaste: (x: number, y: number, variant: PasteVariant) => void; onClosePaste: () => void;
}) {

  // L'état d'édition est doublé d'une référence : une note n'est jamais validée deux fois (clic page + perte de focus).
  const [editing, setEditingState] = useState<TextEdit | null>(null); const editRef = useRef<TextEdit | null>(null);
  const setEditing = (value: TextEdit | null) => { editRef.current = value; setEditingState(value); };
  const editorRef = useRef<HTMLTextAreaElement>(null); const selectionRef = useRef({ start: 0, end: 0 });
  const rememberSelection = () => { const el = editorRef.current; if (el) selectionRef.current = { start: el.selectionStart, end: el.selectionEnd }; };
  const selecting = useRef(false); const wrap = useRef<HTMLDivElement>(null);
  const drag = useRef<{ id: number; start: Pt; ids: string[]; dx: number; dy: number; base: Record<string, Mark>; preview: Mark[] } | null>(null);
  const resize = useRef<{ id: number; ax: number; ay: number; left: boolean; top: boolean; axis: "both" | "x" | "y"; box: Box; ids: string[]; preview: Mark[]; next?: Box } | null>(null);
  const textGrip = useRef<{ id: number; mode: "move" | "width"; start: Pt; base: TextEdit } | null>(null);
  const [liveBox, setLiveBox] = useState<Box | null>(null);
  const lastPenAt = useRef(0);
  // Appui long pour coller : doigt ≈ 0,55 s, stylet ≈ 0,85 s (jamais par accident en écrivant).
  // Tout mouvement de plus de 6 px annule le chronomètre : balayage et dessin restent prioritaires.
  const pressTimer = useRef<number | null>(null); const pressStart = useRef<{ id: number; x: number; y: number; rect: DOMRect } | null>(null);
  const cancelLongPress = () => { if (pressTimer.current !== null) { clearTimeout(pressTimer.current); pressTimer.current = null; } pressStart.current = null; };
  const startLongPress = (event: React.PointerEvent) => {
    if (event.pointerType === "mouse" || tool === "text") return; // l'outil texte ouvre déjà sa bulle d'édition
    const rect = draft.current?.getBoundingClientRect(); if (!rect) return;
    pressStart.current = { id: event.pointerId, x: event.clientX, y: event.clientY, rect };
    const delay = event.pointerType === "pen" ? 850 : 550;
    pressTimer.current = window.setTimeout(() => {
      pressTimer.current = null; const s = pressStart.current; pressStart.current = null; if (!s) return;
      onLongPress((s.x - s.rect.left) / s.rect.width, (s.y - s.rect.top) / s.rect.height);
    }, delay);
  };
  const commitText = () => {
    const e = editRef.current; if (!e) return; editRef.current = null; setEditingState(null);
    const text = e.text.replace(/\s+$/, "").replace(/^\s*\n/, "");
    if (!text.trim()) { if (e.id) onChange(marks.filter((m) => m.id !== e.id)); return; }
    const trimmedRuns = text === e.text ? e.runs : reconcileRuns(e.text, text, e.runs, { color: textColor, size: textSize, font: textFont });
    const uniform = trimmedRuns.length === 1 ? trimmedRuns[0] : undefined;
    const mark: TextMark = { id: e.id ?? uid(), type: "text", color: uniform?.color ?? textColor, size: uniform?.size ?? textSize, x: e.x, y: e.y, text, font: uniform?.font ?? textFont, ...(trimmedRuns.length > 1 ? { runs: trimmedRuns } : {}), ...(e.w ? { w: e.w } : {}) };
    onChange(e.id && marks.some((m) => m.id === e.id) ? marks.map((m) => m.id === e.id ? mark : m) : [...marks, mark]);
  };
  const commitRef = useRef(commitText); commitRef.current = commitText;
  const keepEditing = useRef(false);
  // Un toucher hors de la note (barre du bas, volet, autre bouton) la valide aussitôt; la barre d'outils et le menu Texte la laissent ouverte.
  useEffect(() => {
    if (!editing) return;
    const onDown = (ev: PointerEvent) => {
      const t = ev.target as HTMLElement | null; if (!t) return;
      if (t.closest("[data-text-editor]")) return;
      if (t.closest("[data-keep-text]")) { keepEditing.current = true; return; }
      keepEditing.current = false;
      if (t === draft.current) return; // la page gère elle-même le toucher
      commitRef.current();
    };
    document.addEventListener("pointerdown", onDown, true); return () => document.removeEventListener("pointerdown", onDown, true);
  }, [editing]);
  useEffect(() => { if (tool !== "text") commitRef.current(); }, [tool]);
  useEffect(() => { editRef.current = null; setEditingState(null); }, [src]);
  const textAt = (x: number, y: number) => { const rect = draft.current?.getBoundingClientRect(); const ratio = rect && rect.height ? rect.width / rect.height : 0.77;
    return [...marks].reverse().find((m): m is TextMark => { if (m.type !== "text") return false; const t = textExtent(m); const lh = t.line * ratio; return x >= m.x - 0.01 && x <= m.x + t.w + 0.01 && y >= m.y - lh * 0.95 && y <= m.y + lh * (t.lines - 1) + lh * 0.3; }); };

  const committed = useRef<HTMLCanvasElement>(null); const draft = useRef<HTMLCanvasElement>(null);
  const current = useRef<StrokeMark | null>(null); const frame = useRef<number | null>(null);
  const paint = useCallback((canvas: HTMLCanvasElement | null, items: Mark[]) => {
    if (!canvas) return; const rect = canvas.getBoundingClientRect(); const dpr = window.devicePixelRatio || 1;
    const targetWidth = Math.max(1, Math.round(rect.width * dpr)); const targetHeight = Math.max(1, Math.round(rect.height * dpr));
    if (canvas.width !== targetWidth || canvas.height !== targetHeight) { canvas.width = targetWidth; canvas.height = targetHeight; }
    const context = canvas.getContext("2d"); if (!context) return; context.clearRect(0, 0, canvas.width, canvas.height);
    items.forEach((item) => drawMark(context, item, canvas.width, canvas.height));
  }, []);
  const editingId = editing?.id;
  const drawCommitted = useCallback(() => paint(committed.current, editingId ? marks.filter((m) => m.id !== editingId) : marks), [marks, paint, editingId]);
  const drawDraft = useCallback(() => paint(draft.current, current.current ? [current.current] : []), [paint]);
  useEffect(() => { const f = () => drawCommitted(); imageListeners.add(f); return () => { imageListeners.delete(f); }; }, [drawCommitted]);
  useEffect(() => {
    drawCommitted(); drawDraft(); const observer = new ResizeObserver(() => { drawCommitted(); drawDraft(); });
    if (committed.current) observer.observe(committed.current); return () => observer.disconnect();
  }, [drawCommitted, drawDraft]);
  const point = (event: React.PointerEvent): Pt => {
    const rect = draft.current?.getBoundingClientRect(); if (!rect) return [0, 0, 0.5];
    return [(event.clientX - rect.left) / rect.width, (event.clientY - rect.top) / rect.height, event.pointerType === "pen" ? event.pressure || 0.5 : 0.5];
  };
  const erasing = useRef(false); const rectRef = useRef<DOMRect | null>(null); const pointerId = useRef<number | null>(null);
  // Gomme multi-sélection : liste vide = « Effacer tout le trait » (tout, images comprises).
  const erasable = (mark: Mark) => {
    if (eraserModes.length === 0) return true;
    const kind: EraserKind | "image" = mark.type === "highlighter" ? "highlighter" : mark.type === "text" ? "text" : (SHAPE_TOOL_IDS as string[]).includes(mark.type) ? "shape" : mark.type === "image" ? "image" : "pen";
    return kind !== "image" && eraserModes.includes(kind);
  };
  const eraseAt = (x: number, y: number) => { const kept = marks.filter((mark) => !erasable(mark) || !hit(mark, x, y, eraserSize)); if (kept.length !== marks.length) onChange(kept); };
  const pan = useRef<{ id: number; x: number; y: number; el: HTMLElement | null } | null>(null);
  const scrollParent = (node: HTMLElement | null): HTMLElement | null => { let el = node?.parentElement ?? null; while (el) { const s = getComputedStyle(el); if (/(auto|scroll)/.test(s.overflowY + s.overflowX) && (el.scrollHeight > el.clientHeight || el.scrollWidth > el.clientWidth)) return el; el = el.parentElement; } return document.scrollingElement as HTMLElement | null; };
  const barrelOf = (event: { pointerType: string; buttons: number; button: number }) => event.pointerType === "pen" && ((event.buttons & 34) !== 0 || event.button === 5 || event.button === 2 || event.buttons > 1);
  const down = (event: React.PointerEvent) => {
    onInteract(); // referme aussitôt la fenêtre d'outil ouverte dès qu'on touche la page
    startLongPress(event);
    if (penOnly && event.pointerType !== "pen") { if (event.pointerType === "touch" && !pan.current) pan.current = { id: event.pointerId, x: event.clientX, y: event.clientY, el: scrollParent(draft.current) }; return; }
    if (pointerId.current !== null && pointerId.current !== event.pointerId) return; // ignore a second finger/palm mid-stroke
    event.preventDefault(); try { draft.current?.setPointerCapture(event.pointerId); } catch { /* ignore */ } rectRef.current = draft.current?.getBoundingClientRect() ?? null; const p = point(event);
    if (event.pointerType === "pen") lastPenAt.current = Date.now();
    const barrel = barrelOf(event); // bouton latéral ou gomme du stylet
    if (tool === "lasso" && !barrel) {
      pointerId.current = event.pointerId;
      const box = lassoSel?.box;
      if (lassoSel && lassoSel.ids.length > 0 && box && p[0] >= box.x && p[0] <= box.x + box.w && p[1] >= box.y && p[1] <= box.y + box.h) {
        onHistory();
        // On fige les positions d'origine : le déplacement est calculé par rapport à elles,
        // sinon chaque événement de mouvement cumule le décalage et la sélection s'envole.
        const base: Record<string, Mark> = {}; marks.forEach((m) => { if (lassoSel.ids.includes(m.id)) base[m.id] = m; });
        drag.current = { id: event.pointerId, start: p, ids: lassoSel.ids, dx: 0, dy: 0, base, preview: marks }; return; // glisser la sélection pour la déplacer
      }
      current.current = { id: uid(), type: "pen", color: "#2e6fd8", size: 2, style: "bille", pts: [p] }; // tracé du lasso (jamais enregistré)
      drawDraft(); return;
    }
    if (tool === "text" && !barrel) {
      const hitText = textAt(p[0], p[1]);
      if (editRef.current) { const wasId = editRef.current.id; commitText(); if (!hitText || hitText.id === wasId) return; } // toucher ailleurs ferme seulement la note en cours
      if (hitText) { const base = styleOf(hitText); onTextStyle(base); setEditing({ id: hitText.id, x: hitText.x, y: hitText.y, text: hitText.text, runs: runsOf(hitText), ...(hitText.w ? { w: hitText.w } : {}) }); }
      else setEditing({ x: p[0], y: Math.max(0.03, p[1]), text: "", runs: [] });
      return;
    }
    if (editRef.current) commitText();
    pointerId.current = event.pointerId;

    if (tool === "select" && !barrel) { selecting.current = true; current.current = { id: uid(), type: "rectangle", color: "#2e6fd8", fill: "rgba(46,111,216,0.12)", size: 2, pts: [p] }; drawDraft(); return; }
    if (tool === "eraser" || barrel) { erasing.current = true; eraseAt(p[0], p[1]); return; }
    current.current = { id: uid(), type: tool as StrokeMark["type"], color, fill, size, style: penStyle, pts: [p] };
    drawDraft();
  };

  const move = (event: React.PointerEvent) => {
    const press = pressStart.current; if (pressTimer.current !== null && press && press.id === event.pointerId && Math.hypot(event.clientX - press.x, event.clientY - press.y) > 6) cancelLongPress(); // le doigt bouge : c'est un balayage, jamais un appui long
    if (pan.current && pan.current.id === event.pointerId) { const d = pan.current; d.el?.scrollBy(d.x - event.clientX, d.y - event.clientY); d.x = event.clientX; d.y = event.clientY; return; }
    if (pointerId.current !== event.pointerId) return;
    if (event.pointerType === "pen") lastPenAt.current = Date.now();
    if (drag.current && drag.current.id === event.pointerId) {
      event.preventDefault(); const p = point(event); const d = drag.current;
      d.dx = p[0] - d.start[0]; d.dy = p[1] - d.start[1];
      d.preview = marks.map((m) => { if (!d.ids.includes(m.id)) return m; const origin = d.base[m.id]; return origin ? shiftMark(origin, d.dx, d.dy) : m; });
      paint(committed.current, d.preview);
      return;
    }
    const rect = rectRef.current; if (!rect) return;

    if (!erasing.current && barrelOf(event)) { // le bouton du stylet est enfoncé en cours de tracé : on gomme
      erasing.current = true; current.current = null; if (frame.current !== null) { cancelAnimationFrame(frame.current); frame.current = null; } drawDraft();
    }
    if (erasing.current) { event.preventDefault(); eraseAt((event.clientX - rect.left) / rect.width, (event.clientY - rect.top) / rect.height); return; }
    const mark = current.current; if (!mark) return; event.preventDefault();

    const events = event.nativeEvent.getCoalescedEvents?.() ?? [event.nativeEvent];
    for (const e of events.length ? events : [event.nativeEvent]) {
      const p: Pt = [(e.clientX - rect.left) / rect.width, (e.clientY - rect.top) / rect.height, e.pointerType === "pen" ? e.pressure || 0.5 : 0.5];
      if ([...SHAPE_TOOLS, "ruler"].includes(mark.type as ShapeTool)) mark.pts = [mark.pts[0] ?? p, p];
      else { const prev = mark.pts.at(-1); if (!prev || Math.hypot((p[0] - prev[0]) * rect.width, (p[1] - prev[1]) * rect.height) > 0.6) mark.pts.push(p); }
    }
    if (frame.current === null) frame.current = requestAnimationFrame(() => { frame.current = null; drawDraft(); });
  };
  const finish = (event: React.PointerEvent) => {
    cancelLongPress();
    if (pan.current?.id === event.pointerId) { pan.current = null; return; }
    if (pointerId.current !== event.pointerId) return; pointerId.current = null; erasing.current = false;
    if (drag.current) { const d = drag.current; drag.current = null; const box = lassoSel?.box; if (lassoSel && box) setLassoSel({ ids: d.ids, box: { ...box, x: box.x + d.dx, y: box.y + d.dy } }); onApply(d.preview); drawDraft(); return; }
    const mark = current.current; current.current = null; if (frame.current !== null) cancelAnimationFrame(frame.current); frame.current = null;
    if (mark && tool === "lasso") { // le lasso entoure : on sélectionne ce qui est à l'intérieur, sans rien dessiner
      drawDraft();
      const smooth = simplifyPath(mark.pts); // lissage du tracé avant la détection
      if (smooth.length >= 3) {
        const sx = Math.min(...smooth.map((q) => q[0])); const sy = Math.min(...smooth.map((q) => q[1]));
        const strokeBox = { x: sx, y: sy, w: Math.max(...smooth.map((q) => q[0])) - sx, h: Math.max(...smooth.map((q) => q[1])) - sy };
        // Comme un vrai lasso : un trait à main levée traversé par la boucle est coupé, seule la partie entourée est prise.
        const ids: string[] = []; const next: Mark[] = []; let split = false;
        for (const m of marks) {
          if (m.type === "pen" || m.type === "highlighter") {
            const flags = m.pts.map((q) => inPoly(q[0], q[1], smooth)); const count = flags.filter(Boolean).length;
            if (count === 0) { next.push(m); continue; }
            if (count === flags.length) { next.push(m); ids.push(m.id); continue; }
            split = true; let seg: Pt[] = []; let segIn = flags[0] ?? false;
            const flush = () => { if (seg.length >= 2) { const piece: StrokeMark = { ...m, id: uid(), pts: seg }; next.push(piece); if (segIn) ids.push(piece.id); } };
            m.pts.forEach((q, i) => { const f = flags[i] ?? false; if (f !== segIn) { const prev = seg.at(-1); flush(); seg = prev ? [prev] : []; segIn = f; } seg.push(q); }); flush();
            continue;
          }
          next.push(m); const b = markBox(m); if (inPoly(b.x + b.w / 2, b.y + b.h / 2, smooth) || pickedBox(b, strokeBox)) ids.push(m.id);
        }
        const found = next.filter((m) => ids.includes(m.id));
        if (split) { onHistory(); onApply(next); }
        if (found.length) setLassoSel({ ids, box: unionBox(found.map(markBox)) ?? strokeBox }); // le cadre pointillé épouse exactement la sélection
        else { setLassoSel(null); toast.info(tf("Rien dans le lasso — entoure au moins une note.")); }
      } else setLassoSel(null);
      return;
    }

    if (mark && selecting.current) { selecting.current = false; drawDraft(); const [a, b] = [mark.pts[0], mark.pts.at(-1)]; if (a && b && Math.abs(a[0] - b[0]) > 0.02 && Math.abs(a[1] - b[1]) > 0.01) onSelect({ x: Math.max(0, Math.min(a[0], b[0])), y: Math.max(0, Math.min(a[1], b[1])), w: Math.abs(a[0] - b[0]), h: Math.abs(a[1] - b[1]) }); return; }
    if (mark) {
      const isFree = mark.type === "pen" || mark.type === "highlighter";
      if (mark.pts.length === 1 && isFree && mark.pts[0]) { const [x, y, pr] = mark.pts[0]; mark.pts.push([x + 0.0008, y, pr]); } // a tap leaves a dot
      if (mark.pts.length > 1) { onChange([...marks, mark]); return; }
    }
    drawDraft();
  };
  const cancelled = (event: React.PointerEvent) => {
    cancelLongPress();
    if (pointerId.current !== event.pointerId || event.pointerType !== "pen") { finish(event); return; }
    // Bouton latéral enfoncé en plein tracé : le système annule le pointeur → on efface le trait au lieu de le valider.
    const mark = current.current; current.current = null; pointerId.current = null; erasing.current = false;
    if (frame.current !== null) { cancelAnimationFrame(frame.current); frame.current = null; }
    if (mark && mark.pts.length > 0 && !selecting.current) {
      const firstPt = mark.pts[0]; const lastPt = mark.pts.at(-1);
      if (firstPt && lastPt) onChange(marks.filter((m) => !erasable(m) || (!hit(m, lastPt[0], lastPt[1], eraserSize) && !hit(m, firstPt[0], firstPt[1], eraserSize))));
    }
    drawDraft();
  };
  const fontPx = textPixels(textSize, wrap.current?.clientWidth ?? 800); const fontDef = TEXT_FONTS[textFont];
  const applyEditingStyle = (patch: Partial<Omit<TextRun, "text">>) => {
    const e = editRef.current; if (!e) return; const { start, end } = selectionRef.current; const fallback = { color: textColor, size: textSize, font: textFont }; const baseRuns = e.runs.length ? e.runs : [{ text: e.text, ...fallback }];
    const nextRuns = start !== end ? applyRunStyle(baseRuns, Math.min(start, end), Math.max(start, end), patch) : baseRuns.map((run) => ({ ...run, ...patch }));
    const active = nextRuns.find((_, i) => { let before = 0; for (let n = 0; n < i; n += 1) before += nextRuns[n]?.text.length ?? 0; return Math.min(start, Math.max(0, e.text.length - 1)) < before + (nextRuns[i]?.text.length ?? 0); }) ?? nextRuns[0]; if (active) onTextStyle({ color: active.color, size: active.size, font: active.font }); setEditing({ ...e, runs: nextRuns });
    requestAnimationFrame(() => { const el = editorRef.current; if (!el) return; el.focus(); el.setSelectionRange(start, end); });
  };
  // Poignées du lasso : on tire un coin, le coin opposé reste fixe.
  const handleDown = (left: boolean, top: boolean, axis: "both" | "x" | "y" = "both") => (event: React.PointerEvent<HTMLDivElement>) => {
    if (!lassoSel) return; event.preventDefault(); event.stopPropagation(); onInteract();
    try { event.currentTarget.setPointerCapture(event.pointerId); } catch { /* ignore */ }
    const b = lassoSel.box; resize.current = { id: event.pointerId, ax: left ? b.x + b.w : b.x, ay: top ? b.y + b.h : b.y, left, top, axis, box: b, ids: lassoSel.ids, preview: marks };
  };
  const handleMove = (event: React.PointerEvent<HTMLDivElement>) => {
    const r = resize.current; if (!r || r.id !== event.pointerId) return; event.preventDefault(); const p = point(event);
    if (r.axis !== "both") { const fx = r.axis === "x" && r.box.w > 0.004 ? Math.min(6, Math.max(0.1, Math.abs(p[0] - r.ax) / r.box.w)) : 1; const fy = r.axis === "y" && r.box.h > 0.004 ? Math.min(6, Math.max(0.1, Math.abs(p[1] - r.ay) / r.box.h)) : 1;
      r.preview = marks.map((m) => r.ids.includes(m.id) ? scaleAxes(m, r.ax, r.ay, fx, fy) : m); paint(committed.current, r.preview);
      const w = r.box.w * fx; const h = r.box.h * fy; r.next = { x: r.left ? r.ax - w : r.box.x, y: r.top ? r.ay - h : r.box.y, w, h }; setLiveBox(r.next); return; }
    const fx = r.box.w > 0.004 ? Math.abs(p[0] - r.ax) / r.box.w : null; const fy = r.box.h > 0.004 ? Math.abs(p[1] - r.ay) / r.box.h : null;
    const f = Math.min(6, Math.max(0.15, fx !== null && fy !== null ? (fx + fy) / 2 : fx ?? fy ?? 1));
    r.preview = marks.map((m) => r.ids.includes(m.id) ? scaleAbout(m, r.ax, r.ay, f) : m); paint(committed.current, r.preview);
    const w = r.box.w * f; const h = r.box.h * f; r.next = { x: r.left ? r.ax - w : r.ax, y: r.top ? r.ay - h : r.ay, w, h }; setLiveBox(r.next);
  };
  const handleUp = (event: React.PointerEvent<HTMLDivElement>) => {
    const r = resize.current; if (!r || r.id !== event.pointerId) return; resize.current = null; const box = r.next; setLiveBox(null);
    if (!box) return; onHistory(); onApply(r.preview); setLassoSel({ ids: r.ids, box });
  };
  const shownBox = liveBox ?? lassoSel?.box;
  const onlyImages = !!lassoSel && lassoSel.ids.length > 0 && marks.filter((m) => lassoSel.ids.includes(m.id)).every((m) => m.type === "image");
  // Boîte de texte active : poignée de déplacement (haut gauche) et poignée de largeur (bas droite), sans passer par le lasso.
  const gripDown = (mode: "move" | "width") => (event: React.PointerEvent<HTMLDivElement>) => {
    const e = editRef.current; if (!e) return; event.preventDefault(); event.stopPropagation(); keepEditing.current = true;
    try { event.currentTarget.setPointerCapture(event.pointerId); } catch { /* ignore */ }
    textGrip.current = { id: event.pointerId, mode, start: point(event), base: { ...e, w: e.w ?? Math.max(0.2, 0.94 - e.x) } };
  };
  const gripMove = (event: React.PointerEvent<HTMLDivElement>) => {
    const g = textGrip.current; if (!g || g.id !== event.pointerId || !editRef.current) return; event.preventDefault(); const p = point(event);
    const dx = p[0] - g.start[0], dy = p[1] - g.start[1];
    if (g.mode === "move") setEditing({ ...editRef.current, x: Math.min(0.9, Math.max(0, g.base.x + dx)), y: Math.min(0.98, Math.max(0.02, g.base.y + dy)) });
    else setEditing({ ...editRef.current, w: Math.min(0.98 - g.base.x, Math.max(0.08, (g.base.w ?? 0.5) + dx)) });
  };
  const gripUp = (event: React.PointerEvent<HTMLDivElement>) => { if (textGrip.current?.id !== event.pointerId) return; textGrip.current = null; requestAnimationFrame(() => editorRef.current?.focus()); };
  const editW = editing ? (editing.w ? editing.w * 100 : Math.max(20, 96 - editing.x * 100)) : 0;

  return <div ref={wrap} data-page-surface className="relative w-full overflow-hidden border bg-card shadow-sm" style={{ transform: `rotate(${rotation}deg)` }}>
    <img src={src} alt={tf("Page du document")} className="block w-full select-none" draggable={false} />
    <canvas ref={committed} className="pointer-events-none absolute inset-0 size-full" />
    {highlights && highlights.length > 0 && <div className="pointer-events-none absolute inset-0" aria-hidden>{highlights.map((b, n) => <span key={n} className="absolute rounded-sm bg-school-yellow/60 mix-blend-multiply" style={{ left: `${b.x * 100}%`, top: `${b.y * 100}%`, width: `${b.w * 100}%`, height: `${b.h * 100}%` }} />)}</div>}
    <canvas ref={draft} className="absolute inset-0 size-full touch-none select-none" style={{ WebkitUserSelect: "none", WebkitTouchCallout: "none" } as React.CSSProperties} onContextMenu={(e) => { e.preventDefault(); if (Date.now() - lastPenAt.current < 1500) { const r = draft.current?.getBoundingClientRect(); if (r) { onHistory(); eraseAt((e.clientX - r.left) / r.width, (e.clientY - r.top) / r.height); } } }} onPointerDown={down} onPointerMove={move} onPointerUp={finish} onPointerCancel={cancelled} onLostPointerCapture={finish} />

    {tool === "lasso" && lassoSel && shownBox && <div className="pointer-events-none absolute border-2 border-dashed border-amber-strong bg-primary/15" style={{ left: `${shownBox.x * 100}%`, top: `${shownBox.y * 100}%`, width: `${shownBox.w * 100}%`, height: `${shownBox.h * 100}%` }}>
      {([[true, true], [false, true], [true, false], [false, false]] as const).map(([left, top]) => <div key={`${left}-${top}`} role="slider" aria-label={tf("Redimensionner depuis le coin {0} {1}", [top ? tf("haut") : tf("bas"), left ? tf("gauche") : tf("droit")])} aria-valuenow={Math.round(shownBox.w * 100)}
        onPointerDown={handleDown(left, top)} onPointerMove={handleMove} onPointerUp={handleUp} onPointerCancel={handleUp} onLostPointerCapture={handleUp}
        className={cn("pointer-events-auto absolute grid size-9 touch-none place-items-center -translate-x-1/2 -translate-y-1/2", left ? "left-0" : "left-full", top ? "top-0" : "top-full", left === top ? "cursor-nwse-resize" : "cursor-nesw-resize")}>
        <span className="size-4 rounded-full border-2 border-amber-strong bg-background shadow" /></div>)}
      {onlyImages && ([["x", true, false, "left-0 top-1/2"], ["x", false, false, "left-full top-1/2"], ["y", false, true, "left-1/2 top-0"], ["y", false, false, "left-1/2 top-full"]] as const).map(([axis, left, top, pos]) => <div key={`${axis}-${left}-${top}`} role="slider" aria-label={axis === "x" ? tf("Étirer en largeur") : tf("Étirer en hauteur")} aria-valuenow={Math.round((axis === "x" ? shownBox.w : shownBox.h) * 100)}
        onPointerDown={handleDown(left, top, axis)} onPointerMove={handleMove} onPointerUp={handleUp} onPointerCancel={handleUp} onLostPointerCapture={handleUp}
        className={cn("pointer-events-auto absolute grid size-9 touch-none place-items-center -translate-x-1/2 -translate-y-1/2", pos, axis === "x" ? "cursor-ew-resize" : "cursor-ns-resize")}>
        <span className={cn("rounded-full border-2 border-amber-strong bg-background shadow", axis === "x" ? "h-5 w-2.5" : "h-2.5 w-5")} /></div>)}
    </div>}

    {pasteTarget && <div className="absolute z-30" style={{ left: `${pasteTarget.x * 100}%`, top: `${pasteTarget.y * 100}%` }}>
      <div className="absolute left-2 top-2 flex items-center gap-1 rounded-xl border bg-card p-1.5 shadow-lg">
        {clipKind === "marks"
          ? <Button size="sm" variant="outline" className="gap-2" onClick={() => onPaste(pasteTarget.x, pasteTarget.y, "marks")}><ClipboardPaste />{tf("Coller la sélection")}</Button>
          : <><Button size="sm" variant="outline" className="gap-2" onClick={() => onPaste(pasteTarget.x, pasteTarget.y, "moderne")}><Type />{tf("Texte")}</Button><Button size="sm" variant="outline" style={{ fontFamily: TEXT_FONTS.main.css, fontWeight: TEXT_FONTS.main.weight }} onClick={() => onPaste(pasteTarget.x, pasteTarget.y, "main")}>{tf("Manuscrit")}</Button></>}
        <Button size="icon" variant="ghost" className="size-7" aria-label={tf("Fermer")} onClick={onClosePaste}><X className="size-4" /></Button>
      </div>
    </div>}


    {editing && <><div aria-hidden className="pointer-events-none absolute min-h-[1.2em] min-w-[8rem] whitespace-pre-wrap break-words" style={{ left: `${editing.x * 100}%`, top: `calc(${editing.y * 100}% - ${fontPx * 0.85}px)`, width: `${editW}%`, lineHeight: 1.2 }}>{editing.text ? runsOf({ text: editing.text, color: textColor, size: textSize, font: textFont, runs: editing.runs }).flatMap((run, runIndex) => run.text.split("\n").flatMap((part, partIndex, parts) => [<span key={`${runIndex}-${partIndex}`} style={{ color: run.color, fontFamily: fontOf(run.font).css, fontSize: `${textPixels(run.size, wrap.current?.clientWidth ?? 800)}px`, fontWeight: fontOf(run.font).weight }}>{part}</span>, ...(partIndex < parts.length - 1 ? [<br key={`br-${runIndex}-${partIndex}`} />] : [])])) : <span className="text-muted-foreground" style={{ font: `${fontDef.weight} ${fontPx}px/1.2 ${fontDef.css}` }}>{tf("Écris ici…")}</span>}</div><textarea ref={editorRef} autoFocus aria-label={tf("Note sur la page")} value={editing.text} data-text-editor onFocus={(e) => { if (selectionRef.current.start === 0 && selectionRef.current.end === 0) { const n = e.currentTarget.value.length; e.currentTarget.setSelectionRange(n, n); selectionRef.current = { start: n, end: n }; } }} onSelect={rememberSelection} onKeyUp={rememberSelection} onPointerUp={rememberSelection} onChange={(event) => { const fallback = { color: textColor, size: textSize, font: textFont }; const nextText = event.target.value; setEditing({ ...editing, text: nextText, runs: reconcileRuns(editing.text, nextText, editing.runs, fallback) }); }} onBlur={() => { if (keepEditing.current) { keepEditing.current = false; return; } commitText(); }} onKeyDown={(e) => { if (e.key === "Escape") commitText(); }} placeholder={tf("Écris ici…")} rows={Math.max(1, editing.text.split("\n").length)}
      className="absolute min-w-[8rem] resize-none border border-dashed border-primary bg-transparent p-0 text-transparent caret-foreground outline-none placeholder:text-muted-foreground" style={{ left: `${editing.x * 100}%`, top: `calc(${editing.y * 100}% - ${fontPx * 0.85}px)`, font: `${fontDef.weight} ${fontPx}px/1.2 ${fontDef.css}`, width: `${editW}%` }} />
      <div data-text-editor role="button" aria-label={tf("Déplacer la note")} onPointerDown={gripDown("move")} onPointerMove={gripMove} onPointerUp={gripUp} onPointerCancel={gripUp} className="absolute z-20 grid size-8 -translate-x-full -translate-y-full cursor-move touch-none place-items-center" style={{ left: `${editing.x * 100}%`, top: `calc(${editing.y * 100}% - ${fontPx * 0.85}px)` }}><Move className="size-4 rounded-full bg-background text-primary shadow" /></div>
      <div data-text-editor role="slider" aria-label={tf("Largeur de la note")} aria-valuenow={Math.round(editW)} onPointerDown={gripDown("width")} onPointerMove={gripMove} onPointerUp={gripUp} onPointerCancel={gripUp} className="absolute z-20 grid size-8 -translate-x-1/2 cursor-nwse-resize touch-none place-items-center" style={{ left: `${editing.x * 100 + editW}%`, top: `calc(${editing.y * 100}% + ${fontPx * (Math.max(1, editing.text.split("\n").length) * 1.2 - 0.85)}px)` }}><span className="size-3.5 rotate-45 border-b-2 border-r-2 border-primary bg-background" /></div>
      <div data-keep-text className={cn("absolute z-20 flex max-w-[calc(100%-0.5rem)] items-center gap-1 border bg-popover p-1 shadow-lg", editing.x > 0.62 && "-translate-x-full")} style={{ left: `${editing.x * 100}%`, top: `calc(${editing.y * 100}% + ${fontPx * Math.max(1.4, editing.text.split("\n").length * 1.2)}px)` }}>
        <Popover><PopoverTrigger asChild><Button variant="ghost" size="sm" className="h-8 min-w-0 gap-1 px-2" aria-label={tf("Police du texte")} onPointerDown={rememberSelection}><Type className="size-3.5" /><span className="hidden text-xs sm:inline">{tf("Police")}</span><ChevronDown className="size-3" /></Button></PopoverTrigger><PopoverContent data-keep-text side="bottom" align="start" className="w-44 p-1" onOpenAutoFocus={(e) => e.preventDefault()}>{(Object.keys(TEXT_FONTS) as TextFont[]).map((font) => <Button key={font} variant="ghost" className="h-9 w-full justify-start" style={{ fontFamily: TEXT_FONTS[font].css, fontWeight: TEXT_FONTS[font].weight }} onPointerDown={rememberSelection} onClick={() => applyEditingStyle({ font })}>{TEXT_FONTS[font].label}</Button>)}</PopoverContent></Popover>
        <Popover><PopoverTrigger asChild><Button variant="ghost" size="sm" className="h-8 min-w-0 gap-1 px-2" aria-label={tf("Couleur du texte")} onPointerDown={rememberSelection}><span className="size-4 rounded-full border" style={{ backgroundColor: textColor }} /><span className="hidden text-xs sm:inline">{tf("Couleur")}</span><ChevronDown className="size-3" /></Button></PopoverTrigger><PopoverContent data-keep-text side="bottom" align="center" className="w-72" onOpenAutoFocus={(e) => e.preventDefault()}><ColorPalette quick={QUICK_COLORS} value={textColor} onChange={(nextColor) => applyEditingStyle({ color: nextColor })} /></PopoverContent></Popover>
        <Popover><PopoverTrigger asChild><Button variant="ghost" size="sm" className="h-8 min-w-0 gap-1 px-2" aria-label={tf("Taille du texte")} onPointerDown={rememberSelection}><span className="text-xs font-semibold tabular-nums">{textSize}{" "}{tf("pt")}</span><ChevronDown className="size-3" /></Button></PopoverTrigger><PopoverContent data-keep-text side="bottom" align="end" className="w-64" onOpenAutoFocus={(e) => e.preventDefault()}><TextSizePicker value={textSize} onChange={(nextSize) => applyEditingStyle({ size: nextSize })} /></PopoverContent></Popover>
      </div></>}
  </div>;
}

// ---- Demander à Clario : analyse réelle de la page + animation ----
function AnalysisPanel(props: {
  docId: string;
  title: string;
  busy: "idle" | "analyzing" | "generating";
  analysis: PageAnalysis | null;
  selected: Record<number, boolean>;
  setSelected: React.Dispatch<React.SetStateAction<Record<number, boolean>>>;
  animations: SavedAnimation[];
  onAnalyze: () => void;
  onGenerate: () => void;
  onReplay: (anim: SavedAnimation) => void;
  onDelete: (anim: SavedAnimation) => void;
  onClear: () => void;
}) {
  const { docId, title, busy, analysis, selected, setSelected, animations } = props;
  const chosen = analysis ? analysis.animable.filter((_, i) => selected[i] ?? true) : [];
  return <div><div className="flex items-center gap-2"><MessageCircleQuestion className="size-5 text-amber-strong" /><h2 className="font-display text-lg font-bold tracking-tight">{tf("Demander à Clario")}</h2></div>
    <p className="mt-4 bg-muted p-3 text-xs leading-5 text-muted-foreground">{tf("Clario regarde la page ouverte")}{title ? tf(" de « {0} »", [title]) : ""}{" "}{tf("et prépare une courte vidéo où il t’explique vraiment les idées : intuition, formules, méthode, pièges. La vidéo s’ouvre dans une petite fenêtre que tu peux agrandir, et ta page reste intacte.")}</p>
    {!docId && <p className="mt-2 text-xs text-muted-foreground">{tf("Ouvre un de tes documents pour générer et enregistrer une vidéo.")}</p>}
    <Button className="mt-4 w-full" disabled={busy !== "idle" || !docId} onClick={props.onGenerate}>{busy === "generating" ? <><Loader2 className="animate-spin" />{tf("Clario prépare la vidéo… (≈ 30 s)")}</> : <><Play />{tf("Expliquer cette page en vidéo")}</>}</Button>
    <p className="mt-2.5 flex items-start gap-1.5 text-[11px] leading-4 text-muted-foreground"><span aria-hidden="true">💡</span>{tf("Tu peux fermer ce panneau à tout moment : la vidéo continue de se générer en arrière-plan et s’enregistrera automatiquement.")}</p>
    {void analysis}{void selected}{void setSelected}
    {docId && <div className="mt-5 border-t pt-4"><h3 className="text-xs font-bold uppercase tracking-wide text-muted-foreground">{tf("Vidéos de ce document")}</h3>
      {animations.length === 0 ? <p className="mt-2 text-xs text-muted-foreground">{tf("Les vidéos générées s’enregistrent ici et dans leur cours.")}</p> : <div className="mt-2 space-y-1">{animations.map((a) => <div key={a.id} className="grid grid-cols-[minmax(0,1fr)_auto_auto] items-center gap-1 border bg-card px-2 py-1.5 text-xs"><button className="truncate text-left font-semibold" onClick={() => props.onReplay(a)}><Play className="mr-1 inline size-3" />{a.title}</button><span className="text-muted-foreground">p.{a.page + 1}</span><Button variant="ghost" size="icon" className="size-7 text-destructive" aria-label={tf("Supprimer {0}", [a.title])} onClick={() => props.onDelete(a)}><Trash2 className="size-3.5" /></Button></div>)}</div>}
    </div>}
    <Button variant="ghost" className="mt-3 w-full" onClick={props.onClear}><Trash2 />{tf("Effacer les annotations")}</Button>
  </div>;
}

export default function Notebook() {
  const navigate = useNavigate(); const search = useSearch({ strict: false }) as { doc?: string };
  const [pageKeys, setPageKeys] = useState<string[]>([]); const [docId, setDocId] = useState(""); const [title, setTitle] = useState("Cahier");
  const [pages, setPages] = useState<string[]>([]); const [idx, setIdx] = useState(0);
  const [marks, setMarks] = useState<Record<number, Mark[]>>({}); const [rotations, setRotations] = useState<Record<number, number>>({});
  const [past, setPast] = useState<Record<number, Mark[]>[]>([]); const [future, setFuture] = useState<Record<number, Mark[]>[]>([]);
  const [selection, setSelection] = useState<{ image: string; text: string | null } | null>(null); const [chatOpen, setChatOpen] = useState(false); const [chatSeed, setChatSeed] = useState<ChatSeed | null>(null);
  const [chatMode, setChatMode] = useState<"chat" | "quiz">("chat"); const [quizImage, setQuizImage] = useState(""); const [quizPage, setQuizPage] = useState(0);
  const cropSelection = async (box: { x: number; y: number; w: number; h: number }) => {
    const src = pages[idx]; if (!src) return; const img = new Image(); img.src = src; await img.decode();
    const c = document.createElement("canvas"); const sw = box.w * img.naturalWidth; const sh = box.h * img.naturalHeight; const k = Math.min(1, 1400 / Math.max(sw, sh)); c.width = Math.round(sw * k); c.height = Math.round(sh * k);
    c.getContext("2d")?.drawImage(img, box.x * img.naturalWidth, box.y * img.naturalHeight, sw, sh, 0, 0, c.width, c.height);
    const image = c.toDataURL("image/jpeg", 0.85); setSelection({ image, text: null });
    try { const { data } = await supabase.auth.getSession(); const r = await fetch("/api/read-selection", { method: "POST", headers: { "Content-Type": "application/json", Authorization: `Bearer ${data.session?.access_token ?? ""}` }, body: JSON.stringify({ image }) });
      if (!r.ok) throw new Error(r.status === 402 ? tf("Crédits IA épuisés.") : r.status === 429 ? tf("Trop de demandes, réessaie dans un instant.") : tf("Lecture impossible")); const text = (await r.text()).trim();
      setSelection((cur) => cur?.image === image ? { image, text } : cur); } catch (e) { toast.error(e instanceof Error ? e.message : tf("Lecture impossible")); setSelection((cur) => cur?.image === image ? { image, text: "" } : cur); }
  };
  const askAboutSelection = () => { if (!selection) return; if (!docId) { toast.info(tf("Ouvre un de tes documents pour discuter avec Clario.")); return; }
    setChatSeed({ text: selection.text ? tf("Peux-tu m'expliquer ce passage : « {0} » ?", [selection.text]) : tf("Peux-tu m'expliquer ce passage ?"), image: selection.image, nonce: Date.now() }); setSelection(null); setChatMode("chat"); setChatOpen(true); };
  const openChat = () => { setChatSeed(null); setChatMode("chat"); setChatOpen(true); };
  // Menu système (Android/iOS) : « Copier » sur une sélection de texte alimente aussitôt le presse-papiers du cahier.
  useEffect(() => {
    const onCopy = () => { const sel = window.getSelection?.()?.toString?.().trim(); if (sel) setNotebookClip({ kind: "text", text: sel }); };
    document.addEventListener("copy", onCopy); return () => document.removeEventListener("copy", onCopy);
  }, []);
  const [tool, setTool] = useState<Tool>("pen"); const [fill, setFill] = useState("transparent");
  const [shapeSize, setShapeSize] = useState(3); const [penStyle, setPenStyle] = useState<PenStyle>("plume");
  const [penConfigs, setPenConfigs] = useState<PenConfigs>(DEFAULT_PEN_CONFIGS);
  const [shapeColors, setShapeColors] = useState<ShapeColors>(DEFAULT_SHAPE_COLORS);
  // Lu immédiatement au premier rendu : l'option « Stylet uniquement » doit rester mémorisée même sur mobile.
  const [penOnly, setPenOnly] = useState<boolean>(() => { try { return (JSON.parse(localStorage.getItem("clario-notebook-prefs") ?? "{}") as { penOnly?: boolean }).penOnly === true; } catch { return false; } });
  const [highlighterConfigs, setHighlighterConfigs] = useState<HighlighterConfigs>(DEFAULT_HIGHLIGHTER_CONFIGS); const [hlStyle, setHlStyle] = useState<PenStyle>("plat");
  const [eraserModes, setEraserModes] = useState<EraserKind[]>([]); const [eraserSize, setEraserSize] = useState(2); // liste vide = tout effacer
  const [zoom, setZoom] = useState(100); const [fit, setFit] = useState<FitMode>("width"); const [scrollDirection, setScrollDirection] = useState<ScrollDirection>("horizontal");
  const [loading, setLoading] = useState(false); const [panel, setPanel] = useState(false); const [customize, setCustomize] = useState(false);
  const [showPagesAside, setShowPagesAside] = useState(false); // toujours fermé à l'ouverture du cahier
  const [textColor, setTextColor] = useState(QUICK_COLORS[0] ?? "#2b2540"); const [textSize, setTextSize] = useState(12); const [textFont, setTextFont] = useState<TextFont>("main");
  const [selectingPages, setSelectingPages] = useState(false); const [selectedPages, setSelectedPages] = useState<number[]>([]);
  const [selectedElements, setSelectedElements] = useState<Record<number, boolean>>({}); const [bookmarks, setBookmarks] = useState<number[]>([]);
  const [shortcuts, setShortcuts] = useState<ToolbarItem[]>(() => { try { const saved = localStorage.getItem("clario-toolbar"); return saved ? normalizeShortcuts(JSON.parse(saved)) : DEFAULT_SHORTCUTS; } catch { return DEFAULT_SHORTCUTS; } }); // lu immédiatement : les outils ajoutés restent en place
  const fileRef = useRef<HTMLInputElement>(null); const docRef = useRef<HTMLInputElement>(null); const pageArea = useRef<HTMLDivElement>(null);
  const [emojiOpen, setEmojiOpen] = useState(false); const [emojiQuery, setEmojiQuery] = useState(""); const [emojiCat, setEmojiCat] = useState(EMOJI_CATEGORIES[0]?.id ?? "visages");
  const [lassoSel, setLassoSel] = useState<LassoSelection | null>(null); const [openPopover, setOpenPopover] = useState<string | null>(null);
  const [shareOpen, setShareOpen] = useState(false); const [shareBusy, setShareBusy] = useState(false);
  const [pageQuery, setPageQuery] = useState("");
  const [docText, setDocText] = useState<Record<number, string>>({});
  const [docItems, setDocItems] = useState<Record<number, TextItemBox[]>>({});
  useEffect(() => { setLassoSel(null); }, [tool, idx]);


  const prefsLoadedRef = useRef(false);
  useEffect(() => { try { const prefs = JSON.parse(localStorage.getItem("clario-notebook-prefs") ?? "{}") as { penOnly?: boolean; scrollDirection?: ScrollDirection; penStyle?: PenStyle; hlStyle?: PenStyle; eraserMode?: string; eraserModes?: EraserKind[]; eraserSize?: number; tool?: Tool; color?: string; hlColor?: string; size?: number; hlSize?: number; shapeSize?: number; penConfigs?: Partial<Record<keyof PenConfigs, Partial<PenConfig>>>; highlighterConfigs?: Partial<Record<keyof HighlighterConfigs, Partial<PenConfig>>>; shapeColors?: Partial<Record<ShapeTool, string>>; textColor?: string; textSize?: number; textSizeUnit?: string; textFont?: TextFont }; const hex = (v: unknown): v is string => typeof v === "string" && /^#[0-9a-f]{6}$/i.test(v); const num = (v: unknown, max: number): v is number => typeof v === "number" && v >= 1 && v <= max;
    const savedPenStyle = prefs.penStyle === "plume" || prefs.penStyle === "bille" || prefs.penStyle === "crayon" ? prefs.penStyle : "plume";
    const savedHlStyle = prefs.hlStyle === "plat" || prefs.hlStyle === "fin" ? prefs.hlStyle : "plat";
    const pens = structuredClone(DEFAULT_PEN_CONFIGS); (Object.keys(pens) as (keyof PenConfigs)[]).forEach((style) => { const item = prefs.penConfigs?.[style]; if (hex(item?.color)) pens[style].color = item.color; if (num(item?.size, 30)) pens[style].size = item.size; });
    if (!prefs.penConfigs) (Object.keys(pens) as (keyof PenConfigs)[]).forEach((style) => { if (hex(prefs.color)) pens[style].color = prefs.color; if (num(prefs.size, 30)) pens[style].size = prefs.size; });
    const highlighters = structuredClone(DEFAULT_HIGHLIGHTER_CONFIGS); (Object.keys(highlighters) as (keyof HighlighterConfigs)[]).forEach((style) => { const item = prefs.highlighterConfigs?.[style]; if (hex(item?.color)) highlighters[style].color = item.color; if (num(item?.size, 20)) highlighters[style].size = item.size; });
    if (!prefs.highlighterConfigs) (Object.keys(highlighters) as (keyof HighlighterConfigs)[]).forEach((style) => { if (hex(prefs.hlColor)) highlighters[style].color = prefs.hlColor; if (num(prefs.hlSize, 20)) highlighters[style].size = prefs.hlSize; });
    const shapes = { ...DEFAULT_SHAPE_COLORS }; SHAPE_TOOLS.forEach((shape) => { const savedColor = prefs.shapeColors?.[shape]; if (hex(savedColor)) shapes[shape] = savedColor; else if (!prefs.shapeColors && hex(prefs.color)) shapes[shape] = prefs.color; });
    setPenConfigs(pens); setHighlighterConfigs(highlighters); setShapeColors(shapes); if (num(prefs.shapeSize, 30)) setShapeSize(prefs.shapeSize); else if (num(prefs.size, 30)) setShapeSize(prefs.size);
    if (hex(prefs.textColor)) setTextColor(prefs.textColor); if (num(prefs.textSize, 72)) { const raw = prefs.textSizeUnit === "pt" ? prefs.textSize : prefs.textSize * 6; setTextSize(clampTextSize(raw)); } if (prefs.textFont && prefs.textFont in TEXT_FONTS) setTextFont(prefs.textFont); if (typeof prefs.penOnly === "boolean") setPenOnly(prefs.penOnly); if (prefs.scrollDirection === "horizontal" || prefs.scrollDirection === "vertical") setScrollDirection(prefs.scrollDirection); setPenStyle(savedPenStyle); setHlStyle(savedHlStyle); const modes: EraserKind[] = Array.isArray(prefs.eraserModes) ? prefs.eraserModes.filter((k): k is EraserKind => k === "highlighter" || k === "pen" || k === "shape" || k === "text") : prefs.eraserMode === "highlighter" ? ["highlighter"] : prefs.eraserMode === "pen" ? ["pen", "shape", "text"] : []; if (modes.length) setEraserModes(modes); if (typeof prefs.eraserSize === "number" && prefs.eraserSize > 0) setEraserSize(prefs.eraserSize); /* À chaque ouverture du cahier, le stylo est l’outil actif par défaut (le stylet seul reste mémorisé). */ } catch { /* keep defaults */ } finally { prefsLoadedRef.current = true; } }, []);

  useEffect(() => { localStorage.setItem("clario-toolbar", JSON.stringify(shortcuts)); }, [shortcuts]);
  const prefsSavedRef = useRef(false);
  useEffect(() => { if (!prefsLoadedRef.current) return; if (!prefsSavedRef.current) { prefsSavedRef.current = true; return; } try { localStorage.setItem("clario-notebook-prefs", JSON.stringify({ penOnly, scrollDirection, penStyle, hlStyle, eraserModes, eraserSize, tool, penConfigs, highlighterConfigs, shapeColors, shapeSize, textColor, textSize, textSizeUnit: "pt", textFont })); } catch { /* stockage indisponible */ } }, [penOnly, scrollDirection, penStyle, hlStyle, eraserModes, eraserSize, tool, penConfigs, highlighterConfigs, shapeColors, shapeSize, textColor, textSize, textFont]);
  const [recentOpen, setRecentOpen] = useState(false); const [recentDocs, setRecentDocs] = useState<DocMeta[]>([]);
  useEffect(() => { if (!recentOpen) return; let alive = true; void listDocs().then((docs) => { if (alive) setRecentDocs(docs.filter((d) => (d.kind === "PDF" || d.kind === "Image") && d.id !== docId).slice(0, 5)); }).catch(() => undefined); return () => { alive = false; }; }, [recentOpen, docId]);
  const stateRef = useRef<DocState>({}); const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null); const [saving, setSaving] = useState<"idle" | "saving" | "saved" | "error">("idle");
  const flush = useCallback(async (id: string) => { if (saveTimer.current) { clearTimeout(saveTimer.current); saveTimer.current = null; } if (!id) return; setSaving("saving"); try { const r = await saveDocState(id, stateRef.current); setSaving(r === "local" ? "saved" : "saved"); } catch { setSaving("error"); toast.error(tf("Enregistrement impossible — vérifie ta connexion.")); } }, []);
  const [offline, setOffline] = useState(isOffline);
  useEffect(() => { const on = () => { setOffline(false); if (stateRef.current && docId) void flush(docId).then(() => void syncPendingStates().then((n) => { if (n > 0) toast.success(tf("Retrouvé Internet — {0} page(s) synchronisée(s).", [String(n)])); })); }; const off = () => { setOffline(true); if (docId && saveTimer.current) void flush(docId); }; window.addEventListener("online", on); window.addEventListener("offline", off); return () => { window.removeEventListener("online", on); window.removeEventListener("offline", off); }; }, [docId, flush]);
  const persist = (patch: DocState) => { stateRef.current = { ...stateRef.current, ...patch }; if (!docId) return; const id = docId; if (saveTimer.current) clearTimeout(saveTimer.current); setSaving("saving"); saveTimer.current = setTimeout(() => void flush(id), 1200); };
  useEffect(() => { const id = docId; const onHide = () => { if (saveTimer.current) void flush(id); }; window.addEventListener("pagehide", onHide); document.addEventListener("visibilitychange", onHide); return () => { window.removeEventListener("pagehide", onHide); document.removeEventListener("visibilitychange", onHide); onHide(); }; }, [docId, flush]);
  useEffect(() => {
    let alive = true;
    const apply = (s: DocState) => { const cleaned: Record<number, Mark[]> = {}; Object.entries(s.marks ?? {}).forEach(([key, value]) => { cleaned[Number(key)] = (value as Mark[]).filter((mark): mark is Mark => Boolean(mark) && (mark as { type?: string }).type !== "sticker"); }); stateRef.current = s; setMarks(cleaned); setBookmarks(s.bookmarks ?? []); setRotations(s.rotations ?? {}); };
    if (!docId) apply({});
    else void getDocState(docId).then((s) => { if (alive) apply(s); }).catch(() => { if (alive) apply({}); });
    setPast([]); setFuture([]); setSaving("idle");
    return () => { alive = false; };
  }, [docId]);
  const saveMarks = (next: Record<number, Mark[]>) => { setMarks(next); persist({ marks: next }); };
  const commit = (next: Record<number, Mark[]>) => { setPast((value) => [...value.slice(-49), marks]); setFuture([]); saveMarks(next); };
  const setPageMarks = (next: Mark[]) => commit({ ...marks, [idx]: next });
  const undo = () => { const previous = past.at(-1); if (!previous) return; setFuture((value) => [marks, ...value]); setPast((value) => value.slice(0, -1)); saveMarks(previous); };
  const redo = () => { const next = future[0]; if (!next) return; setPast((value) => [...value, marks]); setFuture((value) => value.slice(1)); saveMarks(next); };

  const [docFolderId, setDocFolderId] = useState<string | null>(null);
  useEffect(() => {
    const id = search.doc; if (!id) { setDocId(""); setTitle(tf("Cahier")); setPages([]); setPageKeys([]); setIdx(0); setDocFolderId(null); setDocText({}); setPageQuery(""); setLoading(false); return; }
    let cancelled = false; setDocId(id); setTitle(tf("Ouverture…")); setPages([]); setPageKeys([]); setIdx(0); setDocText({}); setPageQuery(""); setLoading(true);
    void (async () => { try { const [blob, meta, st] = await Promise.all([getDocFile(id), getDoc(id), getDocState(id).catch(() => ({} as DocState))]); if (!blob) throw new Error(tf("missing")); if (!cancelled) { setTitle(meta?.name ?? tf("Document")); setDocFolderId(meta?.folderId ?? null); } const images = blob.type === "application/pdf" ? await renderPdf(blob, (first) => { if (!cancelled) { setPages([first]); setPageKeys(["o:0"]); setLoading(false); } }) : [URL.createObjectURL(blob)]; let keys = images.map((_, n) => `o:${n}`); let list = images;
      if (blob.type === "application/pdf" && !cancelled) void extractPdfText(blob).then(({ texts, items }) => { if (!cancelled && texts.length) { setDocText(Object.fromEntries(texts.map((t, n) => [n, t] as const))); setDocItems(Object.fromEntries(items.map((t, n) => [n, t] as const))); } });
      if (st.pages?.length) { const built = await Promise.all(st.pages.map(async (k) => k.startsWith("o:") ? images[Number(k.slice(2))] ?? null : await loadPageImage(k.slice(2)).catch(() => null))); keys = st.pages.filter((_, n) => built[n]); list = built.filter((x): x is string => Boolean(x)); }
      if (!cancelled) { setPages(list); setPageKeys(keys); setIdx(0); void touchDoc(id); } } catch { if (!cancelled) { setPages([]); toast.error(tf("Impossible d’ouvrir ce fichier. Essaie un PDF ou une image.")); } } finally { if (!cancelled) setLoading(false); } })();
    return () => { cancelled = true; };
  }, [search.doc]);

  // « Importer un fichier » : dans un cahier ouvert, ajoute les pages à la suite ; sinon crée un document.
  const importFile = async (file?: File) => { if (!file) return;
    if (!docId) { try { const id = await saveDoc(file, file.name.replace(/\.[^.]+$/, ""), null); navigate({ to: "/cahier", search: { doc: id } }); } catch { toast.error(tf("Impossible d’enregistrer ce fichier.")); } return; }
    if (!(file.type === "application/pdf" || file.type.startsWith("image/"))) { toast.error(tf("Choisis un PDF ou une image.")); return; }
    const tid = toast.loading(tf("Ajout des pages…"));
    try {
      const blobs: Blob[] = file.type === "application/pdf" ? await Promise.all((await renderPdf(file)).map((u) => fetch(u).then((r) => r.blob()))) : [file];
      const urls: string[] = []; const keys: string[] = [];
      for (const b of blobs) { keys.push(`s:${await uploadPage(docId, b)}`); urls.push(URL.createObjectURL(b)); }
      const start = pages.length; setPageList([...pages, ...urls], [...pageKeys, ...keys]); setIdx(start);
      toast.success(tf("{0} page{1} ajoutée{2} à la fin du cahier", [blobs.length, blobs.length > 1 ? tf("s") : "", blobs.length > 1 ? tf("s") : ""]), { id: tid });
    } catch { toast.error(tf("Impossible d’ajouter ces pages. Vérifie ta connexion."), { id: tid }); } };
  const [media, setMedia] = useState<MediaItem[]>([]); const [mediaUrls, setMediaUrls] = useState<Record<string, string>>({});
  useEffect(() => { if (!docId) { setMedia([]); setMediaUrls({}); return; } let alive = true; const made: string[] = []; void listMedia(docId).then((items) => { if (!alive) return; setMedia(items); return Promise.all(items.map(async (m) => { const b = await getMedia(m); if (!b) return null; const u = URL.createObjectURL(b); made.push(u); return [m.id, u] as const; })).then((rows) => { if (alive) setMediaUrls(Object.fromEntries(rows.filter(Boolean) as [string, string][])); }); }).catch(() => undefined); return () => { alive = false; made.forEach((u) => URL.revokeObjectURL(u)); }; }, [docId]);
  const importMedia = async (file?: File) => { if (!file) return; if (file.type.startsWith("video/") || file.type.startsWith("audio/")) { if (file.size > MEDIA_MAX) { toast.error(tf("Fichier trop lourd (50 Mo maximum).")); return; } if (!docId) { toast.error(tf("Importe ou crée d’abord un document pour y joindre un média.")); return; } try { const item = await addMedia(docId, file, idx); setMedia((v) => [...v, item]); setMediaUrls((v) => ({ ...v, [item.id]: URL.createObjectURL(file) })); toast.success(tf("{0} ajouté à la page {1}", [file.type.startsWith(tf("video/")) ? tf("Vidéo") : tf("Audio"), idx + 1])); } catch { toast.error(tf("Impossible d’envoyer ce média. Vérifie ta connexion.")); } return; }
    if (!file.type.startsWith("image/")) { toast.error(tf("Choisis une photo, une vidéo ou un fichier audio.")); return; }
    if (!docId) { toast.error(tf("Ouvre d’abord un document pour y poser une image.")); return; }
    try { const path = await uploadPage(docId, file); const img = await loadMarkImage(path); if (!img) throw new Error(tf("load"));
      const holder = animBoxRef.current; const ratio = holder && holder.clientWidth ? holder.clientHeight / holder.clientWidth : 1.3; const w = 0.45; const h = Math.min(0.8, (w * img.naturalHeight / img.naturalWidth) / ratio);
      const mark: ImageMark = { id: uid(), type: "image", x: (1 - w) / 2, y: Math.max(0.02, (1 - h) / 2), w, h, path };
      setPageMarks([...(marks[idx] ?? []), mark]); setTool("lasso"); setLassoSel({ ids: [mark.id], box: { x: mark.x, y: mark.y, w: mark.w, h: mark.h } }); toast.success(tf("Image posée sur la page — glisse-la pour la placer"));
    } catch { toast.error(tf("Impossible d’ajouter cette image. Vérifie ta connexion.")); } };
  const deleteMedia = async (id: string) => { const item = media.find((m) => m.id === id); if (!item) return; await removeMedia(item); setMedia((v) => v.filter((m) => m.id !== id)); };

  // ---- Demander à Clario : moteur d'animation sur le document ----
  const [analysis, setAnalysis] = useState<PageAnalysis | null>(null);
  const [animBusy, setAnimBusy] = useState<"idle" | "analyzing" | "generating">("idle");
  const [docAnims, setDocAnims] = useState<SavedAnimation[]>([]);
  const [playing, setPlaying] = useState<{ script: AnimScript; audioUrl: string } | null>(null);
  const [video, setVideo] = useState<ExplainerScript | null>(null);
  const animBoxRef = useRef<HTMLDivElement>(null);
  const [animBox, setAnimBox] = useState({ w: 0, h: 0 });
  useEffect(() => { if (!docId) { setDocAnims([]); return; } let alive = true; void listDocAnimations(docId).then((list) => { if (alive) setDocAnims(list); }).catch(() => undefined); return () => { alive = false; }; }, [docId]);
  useEffect(() => {
    if (!playing) return;
    const el = animBoxRef.current;
    if (!el) return;
    const measure = () => setAnimBox({ w: el.clientWidth, h: el.clientHeight });
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    measure();
    return () => ro.disconnect();
  }, [playing]);
  const runAnalysis = async () => {
    setAnimBusy("analyzing");
    try {
      const canvas = await renderPage(idx);
      if (!canvas) { toast.error(tf("Impossible de lire cette page.")); return; }
      const maxSide = 1600;
      const scale = Math.min(1, maxSide / Math.max(canvas.width, canvas.height));
      const out = canvas.width > maxSide || canvas.height > maxSide ? (() => { const c = document.createElement("canvas"); c.width = Math.round(canvas.width * scale); c.height = Math.round(canvas.height * scale); c.getContext("2d")?.drawImage(canvas, 0, 0, c.width, c.height); return c; })() : canvas;
      const image = out.toDataURL("image/jpeg", 0.85);
      const result = await analyzePage({ data: { image, hints: [] } });
      setAnalysis(result);
      if (!result.animable.length) toast.info(tf("Aucun élément animable repéré sur cette page."));
    } catch (error) { toast.error(error instanceof Error ? error.message : tf("L’analyse a échoué.")); }
    finally { setAnimBusy("idle"); }
  };
  const runGeneration = async () => {
    if (!docId) return;
    setAnimBusy("generating");
    try {
      const canvas = await renderPage(idx);
      if (!canvas) { toast.error(tf("Impossible de lire cette page.")); return; }
      const maxSide = 1600;
      const scale = Math.min(1, maxSide / Math.max(canvas.width, canvas.height));
      const out = scale < 1 ? (() => { const c = document.createElement("canvas"); c.width = Math.round(canvas.width * scale); c.height = Math.round(canvas.height * scale); c.getContext("2d")?.drawImage(canvas, 0, 0, c.width, c.height); return c; })() : canvas;
      const image = out.toDataURL("image/jpeg", 0.85);
      const script = await generateExplainer({ data: { documentId: docId, title: title || tf("Page de cours"), image, locale: currentLocale() } });
      const meta = await getDoc(docId).catch(() => undefined);
      await saveExplainer({ data: { documentId: docId, courseId: meta?.courseId ?? null, page: idx, script } });
      refreshCredits();
      setDocAnims(await listDocAnimations(docId).catch(() => []));
      toast.success(tf("Vidéo enregistrée : « {0} »", [script.title]));
      setPanel(false);
      setPlaying(null);
      setVideo(script);
    } catch (error) { toast.error(error instanceof Error ? error.message : tf("La génération a échoué.")); }
    finally { setAnimBusy("idle"); }
  };
  const replayAnimation = async (anim: SavedAnimation) => {
    if (isExplainer(anim.script)) { setPanel(false); setPlaying(null); if (Number.isInteger(anim.page) && anim.page >= 0 && anim.page < pages.length) setIdx(anim.page); setVideo(anim.script); return; }
    if (!anim.audioPath) { toast.error(tf("Cette animation n’a pas d’audio.")); return; }
    try {
      const audioUrl = await getAnimationAudio(anim.audioPath);
      if (!audioUrl) throw new Error(tf("Audio introuvable."));
      setPanel(false);
      setVideo(null);
      if (anim.page !== idx) { setIdx(anim.page); setTimeout(() => setPlaying({ script: anim.script as AnimScript, audioUrl }), 50); }
      else setPlaying({ script: anim.script as AnimScript, audioUrl });
    } catch { toast.error(tf("Impossible d’ouvrir cette animation.")); }
  };
  const removeAnimation = async (anim: SavedAnimation) => {
    try {
      if (isExplainer(anim.script)) await deleteExplainerFiles({ data: { id: anim.id } }); else await deleteAnimation({ data: { id: anim.id } });
      setDocAnims((list) => list.filter((a) => a.id !== anim.id));
    } catch { toast.error(tf("Suppression impossible.")); }
  };
  // Une ancienne animation sur la page s'arrête si on change de page.
  useEffect(() => { setPlaying(null); }, [idx]);

  const swipe = useRef<{ x: number; y: number; t: number } | null>(null);
  const pinch = useRef<{ distance: number; zoom: number } | null>(null);
  const dragPage = useRef<number | null>(null);
  const onSwipeStart = (e: React.TouchEvent) => { if (e.touches.length === 2) { const a = e.touches[0]; const b = e.touches[1]; if (a && b) pinch.current = { distance: Math.hypot(a.clientX - b.clientX, a.clientY - b.clientY), zoom: fit === "custom" ? zoom : 100 }; swipe.current = null; return; } const t = e.touches[0]; const target = e.target as HTMLElement; const onCanvas = target.tagName === "CANVAS"; const touch = t as Touch & { touchType?: string }; const isStylus = touch.touchType === "stylus"; const finger = !!t && !isStylus; if (!onCanvas && target.closest("[data-page-surface]")) { swipe.current = null; return; } // poignées, note ou sélection touchées : jamais de changement de page. Sur le canvas : aucun balayage quand le doigt dessine (pas de « Stylet uniquement »). Avec le stylet seul, le doigt balaye même sur la feuille ; le stylet, lui, ne fait jamais défiler.
    const allowCanvas = onCanvas && penOnly && finger;
    swipe.current = e.touches.length === 1 && t && (!onCanvas || allowCanvas) && (!isStylus || !penOnly) ? { x: t.clientX, y: t.clientY, t: Date.now() } : null; };
  const onPinchMove = (e: React.TouchEvent) => { if (e.touches.length !== 2 || !pinch.current) return; const a = e.touches[0]; const b = e.touches[1]; if (!a || !b) return; e.preventDefault(); const distance = Math.hypot(a.clientX - b.clientX, a.clientY - b.clientY); setFit("custom"); setZoom(Math.max(40, Math.min(250, Math.round(pinch.current.zoom * distance / pinch.current.distance)))); };
  const onSwipeEnd = (e: React.TouchEvent) => { if (pinch.current) { pinch.current = null; swipe.current = null; return; } const s0 = swipe.current; swipe.current = null; const t = e.changedTouches[0]; const el = pageArea.current; if (!s0 || !t || !el || Date.now() - s0.t > 700) return; const dx = t.clientX - s0.x, dy = t.clientY - s0.y; let dir = 0; if (scrollDirection === "horizontal") { if (Math.abs(dx) > 70 && Math.abs(dx) > Math.abs(dy) * 1.5) { const atEnd = el.scrollLeft + el.clientWidth >= el.scrollWidth - 4, atStart = el.scrollLeft <= 4; if (dx < 0 && atEnd) dir = 1; else if (dx > 0 && atStart) dir = -1; } } else if (Math.abs(dy) > 70 && Math.abs(dy) > Math.abs(dx) * 1.5) { const atEnd = el.scrollTop + el.clientHeight >= el.scrollHeight - 4, atStart = el.scrollTop <= 4; if (dy < 0 && atEnd) dir = 1; else if (dy > 0 && atStart) dir = -1; } const next = idx + dir; if (dir && next >= 0 && next < pages.length) { setIdx(next); requestAnimationFrame(() => { if (scrollDirection === "horizontal") el.scrollLeft = dir > 0 ? 0 : el.scrollWidth; else el.scrollTop = dir > 0 ? 0 : el.scrollHeight; }); } };
  const setPageList = (nextPages: string[], nextKeys: string[]) => { setPages(nextPages); setPageKeys(nextKeys); persist({ pages: nextKeys }); };
  // Ajoute la page juste après la page affichée (et non à la fin) : les annotations
  // et les vidéos des pages suivantes suivent automatiquement.
  const appendPage = async (blob: Blob, msg: string, seed?: Mark[]) => { if (!docId) { toast.info(tf("Importe d’abord un document.")); return; } let key = `l:${crypto.randomUUID()}`; try { key = `s:${await uploadPage(docId, blob)}`; } catch { toast.error(tf("Page non enregistrée — vérifie ta connexion.")); return; }
    const at = Math.min(pages.length, idx + 1);
    setPageList([...pages.slice(0, at), URL.createObjectURL(blob), ...pages.slice(at)], [...pageKeys.slice(0, at), key, ...pageKeys.slice(at)]);
    const shifted: Record<number, Mark[]> = {}; Object.entries(marks).forEach(([k, v]) => { const n = Number(k); shifted[n >= at ? n + 1 : n] = v; }); if (seed?.length) shifted[at] = seed; saveMarks(shifted);
    const movedAnims: { id: string; page: number }[] = []; setDocAnims(docAnims.map((a) => { if (a.page < at) return a; movedAnims.push({ id: a.id, page: a.page + 1 }); return { ...a, page: a.page + 1 }; }));
    movedAnims.forEach((m) => void setAnimationPage(m.id, m.page).catch(() => undefined));
    setIdx(at); toast.success(msg); };
  const addBlank = async () => { await appendPage(await blankPage(), tf("Page ajoutée")); };
  // Réponse de Clario → nouvelle page juste après la page affichée, avec le texte déjà posé dessus.
  const addChatPage = async (text: string, handwritten: boolean) => {
    if (!docId) { toast.info(tf("Ouvre d’abord un document.")); return; }
    const font: TextFont = handwritten ? "main" : "moderne";
    await appendPage(await blankPage(), tf("Réponse ajoutée sur une nouvelle page"), layoutBlocks(text, font, 0.08, 0.08));
    setChatOpen(false);
  };
  const duplicatePage = () => { const source = pages[idx]; if (!source) return; setPageList([...pages.slice(0, idx + 1), source, ...pages.slice(idx + 1)], [...pageKeys.slice(0, idx + 1), pageKeys[idx] ?? "o:0", ...pageKeys.slice(idx + 1)]); const currentMarks = marks[idx] ?? []; const shifted: Record<number, Mark[]> = {}; Object.entries(marks).forEach(([key, value]) => { const n = Number(key); shifted[n > idx ? n + 1 : n] = value; }); shifted[idx + 1] = structuredClone(currentMarks); saveMarks(shifted); const movedAnims: { id: string; page: number }[] = []; setDocAnims(docAnims.map((a) => { if (a.page <= idx) return a; movedAnims.push({ id: a.id, page: a.page + 1 }); return { ...a, page: a.page + 1 }; })); movedAnims.forEach((m) => void setAnimationPage(m.id, m.page).catch(() => undefined)); setIdx(idx + 1); toast.success(tf("Page dupliquée")); };
  const deletePage = async () => {
    if (pages.length === 1) { toast.error(tf("Le cahier doit conserver au moins une page.")); return; }
    const onThisPage = docAnims.filter((a) => a.page === idx);
    let animMode: "delete" | "unbind" | null = null;
    if (onThisPage.length) {
      const choice = await askChoice(tf("Cette page contient {0} explicative. Que veux-tu en faire ?", [onThisPage.length > 1 ? tf("des vidéos") : tf("une vidéo")]), [tf("Supprimer aussi la vidéo"), tf("La délier de la page")]);
      if (choice === null) return;
      animMode = choice === 0 ? "delete" : "unbind";
    }
    if (!await askConfirm(tf("Supprimer la page {0} ?", [idx + 1]))) return;
    setPageList(pages.filter((_, i) => i !== idx), pageKeys.filter((_, i) => i !== idx));
    const shifted: Record<number, Mark[]> = {}; Object.entries(marks).forEach(([key, value]) => { const n = Number(key); if (n !== idx) shifted[n > idx ? n - 1 : n] = value; }); saveMarks(shifted);
    const movedAnims: { id: string; page: number }[] = [];
    setDocAnims(docAnims.map((a) => {
      if (animMode !== "delete" && a.page === idx) return { ...a, page: -1 }; // déliée : reste dans le cahier, sans page
      if (a.page > idx) { movedAnims.push({ id: a.id, page: a.page - 1 }); return { ...a, page: a.page - 1 }; }
      return a;
    }));
    if (animMode === "delete") onThisPage.forEach((a) => void removeAnimation(a));
    movedAnims.forEach((m) => void setAnimationPage(m.id, m.page).catch(() => undefined));
    setIdx(Math.max(0, idx - 1));
  };
  const deletePages = async (indices: number[]) => {
    const targets = [...new Set(indices)].filter((i) => i >= 0 && i < pages.length).sort((a, b) => a - b);
    if (!targets.length) return;
    if (targets.length >= pages.length) { toast.error(tf("Le cahier doit conserver au moins une page.")); return; }
    const targetSet = new Set(targets); const linked = docAnims.filter((a) => targetSet.has(a.page));
    let animMode: "delete" | "unbind" | null = null;
    if (linked.length) {
      const choice = await askChoice(tf("{0} pages sélectionnées contiennent {1} explicative. Que veux-tu en faire ?", [targets.length, linked.length > 1 ? tf("des vidéos") : tf("une vidéo")]), [tf("Supprimer aussi les vidéos"), tf("Les délier des pages")]);
      if (choice === null) return;
      animMode = choice === 0 ? "delete" : "unbind";
    }
    if (!await askConfirm(tf("Supprimer {0} page{1} ?", [targets.length, targets.length > 1 ? tf("s") : ""]))) return;
    const nextPages = pages.filter((_, i) => !targetSet.has(i)); const nextKeys = pageKeys.filter((_, i) => !targetSet.has(i));
    const newIndex = (old: number) => old - targets.filter((removed) => removed < old).length;
    const nextMarks: Record<number, Mark[]> = {}; Object.entries(marks).forEach(([key, value]) => { const old = Number(key); if (!targetSet.has(old)) nextMarks[newIndex(old)] = value; });
    const nextBookmarks = bookmarks.filter((i) => !targetSet.has(i)).map(newIndex);
    setPageList(nextPages, nextKeys); saveMarks(nextMarks); setBookmarks(nextBookmarks); persist({ bookmarks: nextBookmarks });
    const movedAnims: { id: string; page: number }[] = [];
    setDocAnims(docAnims.flatMap((a) => {
      if (targetSet.has(a.page)) return animMode === "delete" ? [] : [{ ...a, page: -1 }];
      const page = newIndex(a.page); if (page !== a.page) movedAnims.push({ id: a.id, page }); return [{ ...a, page }];
    }));
    if (animMode === "delete") linked.forEach((a) => void removeAnimation(a));
    else if (animMode === "unbind") linked.forEach((a) => void setAnimationPage(a.id, -1).catch(() => undefined));
    movedAnims.forEach((m) => void setAnimationPage(m.id, m.page).catch(() => undefined));
    const first = targets[0] ?? 0; setIdx(Math.min(first, nextPages.length - 1)); setSelectedPages([]); setSelectingPages(false);
    toast.success(tf("{0} page{1}", [targets.length, targets.length > 1 ? tf("s supprimées") : tf(" supprimée")]));
  };
  // Déplace une page vers un autre rang : annotations et vidéos suivent leur page.
  const movePageTo = (from: number, to: number) => {
    if (from === to || from < 0 || to < 0 || from >= pages.length || to >= pages.length) return;
    const pw = pages.filter((_, i) => i !== from); const kw = pageKeys.filter((_, i) => i !== from);
    setPageList([...pw.slice(0, to), pages[from] ?? "", ...pw.slice(to)], [...kw.slice(0, to), pageKeys[from] ?? "o:0", ...kw.slice(to)]);
    const shifted: Record<number, Mark[]> = {}; Object.entries(marks).forEach(([key, value]) => { const n = Number(key); if (n === from) { shifted[to] = value; return; } if (n < from && n >= to) shifted[n + 1] = value; else if (n > from && n <= to) shifted[n - 1] = value; else shifted[n] = value; }); saveMarks(shifted);
    const movedAnims: { id: string; page: number }[] = [];
    setDocAnims(docAnims.map((a) => { let np = a.page; if (np === from) np = to; else if (np >= to && np < from) np += 1; else if (np <= to && np > from) np -= 1; if (np !== a.page) { movedAnims.push({ id: a.id, page: np }); return { ...a, page: np }; } return a; }));
    movedAnims.forEach((m) => void setAnimationPage(m.id, m.page).catch(() => undefined));
    setIdx(to);
  };
  const movePage = (pageIndex: number, delta: -1 | 1) => movePageTo(pageIndex, pageIndex + delta);
  const rotatePage = () => { const next = { ...rotations, [idx]: ((rotations[idx] ?? 0) + 90) % 360 }; setRotations(next); persist({ rotations: next }); };
  const toggleBookmark = () => { const next = bookmarks.includes(idx) ? bookmarks.filter((n) => n !== idx) : [...bookmarks, idx]; setBookmarks(next); persist({ bookmarks: next }); };
  const toggleBookmarkAt = (pageIndex: number) => { const next = bookmarks.includes(pageIndex) ? bookmarks.filter((n) => n !== pageIndex) : [...bookmarks, pageIndex]; setBookmarks(next); persist({ bookmarks: next }); };
  const insertText = (text: string) => setPageMarks([...(marks[idx] ?? []), { id: uid(), type: "text", color: textColor, size: 26, x: 0.15, y: 0.18, text }]);
  const insertEmoji = (char: string) => { setEmojiOpen(false); setPageMarks([...(marks[idx] ?? []), { id: uid(), type: "text", color: textColor, size: 26, x: 0.15, y: 0.18, text: char }]); };
  const reorderShortcut = (toolId: ToolbarItem, delta: -1 | 1) => setShortcuts((value) => { const from = value.indexOf(toolId); if (from < 0) return value; let to = from + delta; while (to >= 0 && to < value.length && !(value[to]! in TOOL_META && (value[to] === "arrow" || !SHAPE_TOOL_IDS.includes(value[to]!)))) to += delta; if (to < 0 || to >= value.length) return value; const next = [...value]; [next[from], next[to]] = [next[to]!, next[from]!]; return next; });
  const clearPage = () => { setPageMarks([]); toast.success(tf("Annotations effacées")); };
  const goToPage = async () => { const value = await askText(tf("Numéro de page (1 à {0}) :", [pages.length]), String(idx + 1)); const number = Number(value); if (Number.isInteger(number) && number >= 1 && number <= pages.length) setIdx(number - 1); else if (value) toast.error(tf("Numéro de page invalide")); };
  const safeName = async () => { const fresh = docId ? (await getDoc(docId).catch(() => undefined))?.name ?? title : title; if (fresh !== title) setTitle(fresh); return fresh.replace(/[\\/:*?"<>|]+/g, "-").trim() || "Cahier"; };
  const renderPage = async (i: number) => { const src = pages[i]; if (!src) return null; const image = new Image(); image.src = src; await image.decode(); const base = document.createElement("canvas"); base.width = image.naturalWidth; base.height = image.naturalHeight; const context = base.getContext("2d"); if (!context) return null; context.drawImage(image, 0, 0); const pageMarks = (stateRef.current.marks?.[i] as Mark[] | undefined) ?? marks[i] ?? []; await Promise.all(pageMarks.filter((m): m is ImageMark => m.type === "image").map((m) => loadMarkImage(m.path))); pageMarks.forEach((mark) => drawMark(context, mark, base.width, base.height)); const rot = (((rotations[i] ?? 0) % 360) + 360) % 360; if (!rot) return base; const out = document.createElement("canvas"); const swap = rot === 90 || rot === 270; out.width = swap ? base.height : base.width; out.height = swap ? base.width : base.height; const o = out.getContext("2d"); if (!o) return base; o.translate(out.width / 2, out.height / 2); o.rotate((rot * Math.PI) / 180); o.drawImage(base, -base.width / 2, -base.height / 2); return out; };
  const openQuiz = async () => {
    if (!docId) { toast.info(tf("Ouvre un de tes documents pour créer un quiz.")); return; }
    const page = idx; setQuizPage(page); setQuizImage(""); setChatSeed(null); setChatMode("quiz"); setChatOpen(true);
    try { const canvas = await renderPage(page); if (!canvas) throw new Error(); const scale = Math.min(1, 1600 / Math.max(canvas.width, canvas.height)); const out = scale < 1 ? (() => { const c = document.createElement("canvas"); c.width = Math.round(canvas.width * scale); c.height = Math.round(canvas.height * scale); c.getContext("2d")?.drawImage(canvas, 0, 0, c.width, c.height); return c; })() : canvas; setQuizImage(out.toDataURL("image/jpeg", 0.85)); }
    catch { toast.error(tf("Impossible de lire cette page.")); setChatMode("chat"); }
  };
  const exportImage = async (download = true) => {
    const canvas = await renderPage(idx); if (!canvas) return null; const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/png")); if (!blob) return null; if (download) { downloadBlob(blob, `${await safeName()}-page-${idx + 1}.png`); toast.success(tf("Page enregistrée en PNG")); } return blob;
  };
  const sharePage = async () => { const blob = await exportImage(false); if (!blob) return; const name = await safeName(); const file = new File([blob], `${name}-page-${idx + 1}.png`, { type: "image/png" }); if (navigator.share && navigator.canShare?.({ files: [file] })) await navigator.share({ title: name, files: [file] }); else { await exportImage(true); toast.info(tf("Le partage direct n’est pas disponible; l’image a été téléchargée.")); } };
  const exportPdf = async () => { const { jsPDF } = await import("jspdf"); const pdf = new jsPDF({ unit: "pt", format: "a4" }); for (let i = 0; i < pages.length; i += 1) { if (i > 0) pdf.addPage(); const canvas = await renderPage(i); if (!canvas) continue; const ratio = Math.min(555 / canvas.width, 802 / canvas.height); pdf.addImage(canvas.toDataURL("image/jpeg", 0.9), "JPEG", (595 - canvas.width * ratio) / 2, 20, canvas.width * ratio, canvas.height * ratio); } downloadBlob(pdf.output("blob"), `${await safeName()}.pdf`); toast.success(tf("Cahier exporté en PDF avec tes annotations")); };
  const sharePages = async (indices: number[]) => {
    setShareBusy(true);
    try {
      const name = await safeName();
      const canvases = (await Promise.all(indices.map((i) => renderPage(i)))).filter((c): c is HTMLCanvasElement => Boolean(c));
      if (!canvases.length) throw new Error(tf("render"));
      const files: File[] = [];
      if (canvases.length === 1) {
        const blob = await new Promise<Blob | null>((resolve) => canvases[0]!.toBlob(resolve, "image/png"));
        if (blob) files.push(new File([blob], `${name}-page-${indices[0]! + 1}.png`, { type: "image/png" }));
      } else {
        const { jsPDF } = await import("jspdf");
        const pdf = new jsPDF({ unit: "pt", format: "a4" });
        canvases.forEach((canvas, n) => { if (n > 0) pdf.addPage(); const ratio = Math.min(555 / canvas.width, 802 / canvas.height); pdf.addImage(canvas.toDataURL("image/jpeg", 0.9), "JPEG", (595 - canvas.width * ratio) / 2, 20, canvas.width * ratio, canvas.height * ratio); });
        const blob = pdf.output("blob");
        files.push(new File([blob], `${name}-${canvases.length}-pages.pdf`, { type: "application/pdf" }));
      }
      const file = files[0];
      if (!file) throw new Error(tf("render"));
      if (navigator.share && navigator.canShare?.({ files: [file] })) { await navigator.share({ title: name, files }); toast.success(tf("{0} page{1} partagée{2}", [canvases.length, canvases.length > 1 ? tf("s") : "", canvases.length > 1 ? tf("s") : ""])); setShareOpen(false); }
      else { files.forEach((f) => downloadBlob(f, f.name)); setShareOpen(false); toast.info(tf("Le partage direct n’est pas disponible; le fichier a été téléchargé.")); }
    } catch (e) { if ((e as Error).name !== "AbortError") toast.error(tf("Partage impossible — réessaie dans un instant.")); }
    finally { setShareBusy(false); }
  };
  const pageWidth = fit === "width" ? "min(100%, 760px)" : fit === "page" ? "min(100%, 680px)" : `${zoom}%`;
  const clipKind = getNotebookClip()?.kind ?? null;
  const lassoColor = (() => { if (!lassoSel) return ""; const m = (marks[idx] ?? []).find((x) => lassoSel.ids.includes(x.id) && x.type !== "image"); return m && m.type !== "image" ? m.color : ""; })();
  const recolorLasso = (nextColor: string) => { if (!lassoSel) return; setPageMarks((marks[idx] ?? []).map((m) => lassoSel.ids.includes(m.id) ? recolorMark(m, nextColor) : m)); };
  const lassoHasFill = !!lassoSel && (marks[idx] ?? []).some((m) => lassoSel.ids.includes(m.id) && (SHAPE_TOOL_IDS as string[]).includes(m.type));
  const lassoFill = (() => { if (!lassoSel) return "transparent"; const m = (marks[idx] ?? []).find((x) => lassoSel.ids.includes(x.id) && (SHAPE_TOOL_IDS as string[]).includes(x.type)); return m && "fill" in m && typeof m.fill === "string" && m.fill !== "transparent" ? m.fill : "transparent"; })();
  const refillLasso = (nextFill: string) => { if (!lassoSel) return; setPageMarks((marks[idx] ?? []).map((m) => lassoSel.ids.includes(m.id) ? refillMark(m, nextFill) : m)); };

  // Collage par appui long (doigt ≈ 0,55 s, stylet ≈ 0,85 s) ou via le menu … : la bulle propose
  // le bon format selon ce qui a été copié (texte du chat / presse-papiers, ou annotations au lasso).
  const [pasteTarget, setPasteTarget] = useState<{ x: number; y: number } | null>(null);
  useEffect(() => { setPasteTarget(null); }, [idx]);
  const showPasteBubble = (x: number, y: number) => setPasteTarget({ x: Math.min(Math.max(x, 0.04), 0.7), y: Math.min(Math.max(y, 0.03), 0.88) });
  const longPressPaste = (x: number, y: number) => {
    const clip = getNotebookClip();
    if (clip) { if (clip.kind === "marks" && !clip.marks.length) return; showPasteBubble(x, y); return; }
    navigator.clipboard?.readText?.().then((text) => { if (text.trim()) { setNotebookClip({ kind: "text", text }); showPasteBubble(x, y); } }).catch(() => { /* presse-papiers inaccessible : rien à coller */ });
  };
  // Une note par ligne/puce, empilées; poussées à gauche s'il manque de place à droite et remontées si elles dépassent en bas.
  const layoutBlocks = (raw: string, font: TextFont, x0: number, y0: number): TextMark[] => {
    const x = Math.min(x0, 0.5); const w = Math.max(0.3, 0.94 - x); const ratio = animBox.w > 0 && animBox.h > 0 ? animBox.w / animBox.h : 0.707;
    const color = font === "main" ? penConfig.color : textColor; const out: TextMark[] = [];
    let y = Math.min(Math.max(y0, 0.04), 0.94);
    for (const block of pasteBlocks(raw)) { const m: TextMark = { id: uid(), type: "text", color, size: textSize, x, y: 0, text: block.text, font, w }; const t = textExtent(m); const lh = t.line * ratio;
      if (out.length) y += (block.gap ? lh * 0.6 : lh * 0.3); else y = Math.max(y, lh * 0.9);
      m.y = y; y += lh * 1.2 * (t.lines - 1) + lh * 0.35; out.push(m); }
    const last = out.at(-1); if (last) { const overflow = y - 0.97; const room = (out[0]?.y ?? 0) - 0.04; const up = Math.min(Math.max(0, overflow), Math.max(0, room)); if (up > 0) out.forEach((m) => { m.y -= up; }); }
    return out;
  };
  const pasteTextAt = (x: number, y: number, font: TextFont) => {
    const clip = getNotebookClip(); if (!clip || clip.kind !== "text" || !clip.text.trim()) return;
    setPageMarks([...(marks[idx] ?? []), ...layoutBlocks(clip.text, font, Math.min(Math.max(x - 0.04, 0.02), 0.88), y)]);
    setPasteTarget(null); toast.success(tf("Collé sur la page"));
  };
  const pasteMarksAt = (x: number, y: number) => {
    const clip = getNotebookClip(); if (!clip || clip.kind !== "marks" || !clip.marks.length) return;
    const box = unionBox(clip.marks.map(markBox)) ?? { x: 0, y: 0, w: 0, h: 0 };
    const dx = x - (box.x + box.w / 2), dy = y - (box.y + box.h / 2);
    setPageMarks([...(marks[idx] ?? []), ...clip.marks.map((m) => ({ ...shiftMark(structuredClone(m), dx, dy), id: uid() }))]);
    setPasteTarget(null); toast.success(tf("Collé sur la page"));
  };
  const handlePasteChoice = (x: number, y: number, variant: PasteVariant) => { if (variant === "marks") pasteMarksAt(x, y); else pasteTextAt(x, y, variant); };
  const pasteFromMenu = () => {
    const clip = getNotebookClip();
    if (!clip) {
      navigator.clipboard?.readText?.().then((text) => {
        if (text.trim()) { setNotebookClip({ kind: "text", text }); showPasteBubble(0.3, 0.25); } else toast.info(tf("Rien à coller — copie d’abord du texte ou une sélection au lasso."));
      }).catch(() => toast.info(tf("Rien à coller — copie d’abord du texte ou une sélection au lasso.")));
      return;
    }
    showPasteBubble(0.3, 0.25);
  };

  const swatches = (list: string[], value: string, onPick: (c: string) => void) => <ColorPalette quick={list} value={value} onChange={onPick} />;
  const activePen = penStyle === "bille" || penStyle === "crayon" ? penStyle : "plume";
  const activeHighlighter = hlStyle === "fin" ? "fin" : "plat";
  const activeShape = SHAPE_TOOLS.includes(tool as ShapeTool) ? tool as ShapeTool : "arrow";
  const penConfig = penConfigs[activePen]; const highlighterConfig = highlighterConfigs[activeHighlighter]; const shapeColor = shapeColors[activeShape];
  const updatePenConfig = (patch: Partial<PenConfig>) => setPenConfigs((configs) => ({ ...configs, [activePen]: { ...configs[activePen], ...patch } }));
  const updateHighlighterConfig = (patch: Partial<PenConfig>) => setHighlighterConfigs((configs) => ({ ...configs, [activeHighlighter]: { ...configs[activeHighlighter], ...patch } }));
  const updateShapeColor = (nextColor: string) => setShapeColors((colors) => ({ ...colors, [activeShape]: nextColor }));
  const compactTrigger = (id: Tool, icon?: typeof Pen) => { const meta = TOOL_META[id]; const Icon = icon ?? (id === "pen" ? PEN_ICONS[penStyle] : id === "highlighter" ? PEN_ICONS[hlStyle] : undefined) ?? meta.Icon; return <Button variant={tool === id || (SHAPE_TOOLS.includes(tool as ShapeTool) && SHAPE_TOOLS.includes(id as ShapeTool)) ? "secondary" : "ghost"} size="icon" className="size-10 shrink-0" aria-label={meta.label} title={meta.label} onClick={() => setTool(id)}><Icon className={cn("size-5", id === "pen" && "text-amber-strong", id === "highlighter" && "text-school-yellow-strong")} /></Button>; };
  const toolButton = (id: ToolbarItem) => {
    if (id === "zoom") return <Popover key={id} open={openPopover === id} onOpenChange={(o) => setOpenPopover(o ? id : null)}><PopoverTrigger asChild><Button variant={fit === "custom" ? "secondary" : "ghost"} size="icon" className="size-10 shrink-0" aria-label={tf("Zoom")} title={tf("Zoom")}><ZoomIn /></Button></PopoverTrigger><PopoverContent align="center" className="w-72"><div className="flex items-center justify-between"><h3 className="font-display text-base font-bold">{tf("Zoom")}</h3><strong>{fit === "custom" ? zoom : fit === "width" ? tf("Largeur") : tf("Page")}</strong></div><input className="mt-4 w-full" type="range" min={40} max={250} step={5} value={zoom} onChange={(e) => { setFit("custom"); setZoom(Number(e.target.value)); }} aria-label={tf("Niveau de zoom")} /><div className="mt-3 grid grid-cols-2 gap-2"><Button variant="outline" size="sm" onClick={() => setFit("width")}>{tf("Largeur")}</Button><Button variant="outline" size="sm" onClick={() => setFit("page")}>{tf("Page entière")}</Button></div></PopoverContent></Popover>;
    if (id === "stylus") return <Button key={id} variant={penOnly ? "secondary" : "ghost"} size="icon" className="size-10 shrink-0" aria-label={penOnly ? tf("Dessin au stylet activé") : tf("Dessin au doigt et au stylet")} title={penOnly ? tf("Stylet uniquement") : tf("Doigt et stylet")} onClick={() => setPenOnly((value) => !value)}><Hand /></Button>;
    if (id === "pen") return <Popover key={id} open={openPopover === id} onOpenChange={(o) => setOpenPopover(o ? id : null)}><PopoverTrigger asChild>{compactTrigger(id)}</PopoverTrigger><PopoverContent align="center" className="w-72"><h3 className="font-display text-base font-bold">{tf("Stylo")}</h3><div className="mt-3 grid grid-cols-3 gap-2">{(["plume", "bille", "crayon"] as const).map((style) => <Button key={style} variant={penStyle === style ? "secondary" : "outline"} className="h-16 flex-col capitalize" onClick={() => { setPenStyle(style); setTool("pen"); }}>{(() => { const I = PEN_ICONS[style] ?? Pen; return <I />; })()}{tf(style.charAt(0).toUpperCase()+style.slice(1))}</Button>)}</div><div className="mt-4">{swatches(QUICK_COLORS, penConfig.color, (nextColor) => { updatePenConfig({ color: nextColor }); setTool("pen"); })}</div><ThicknessPicker label={tf("Épaisseur")} value={penConfig.size} onChange={(nextSize) => updatePenConfig({ size: nextSize })} min={1} max={30} presets={[1, 2, 4, 8]} /></PopoverContent></Popover>;
    if (id === "highlighter") return <Popover key={id} open={openPopover === id} onOpenChange={(o) => setOpenPopover(o ? id : null)}><PopoverTrigger asChild>{compactTrigger(id)}</PopoverTrigger><PopoverContent align="center" className="w-72"><h3 className="font-display text-base font-bold">{tf("Surligneur")}</h3><div className="mt-3 grid grid-cols-2 gap-2">{(["plat", "fin"] as const).map((style) => <Button key={style} variant={hlStyle === style ? "secondary" : "outline"} className="h-16 flex-col capitalize" onClick={() => { setHlStyle(style); setTool("highlighter"); }}><span className={cn("block w-12 opacity-70", style === "plat" ? "h-4" : "h-1 rounded-full")} style={{ backgroundColor: highlighterConfigs[style].color }} />{style === "plat" ? tf("Large") : tf("Fin")}</Button>)}</div><div className="mt-4">{swatches(HIGHLIGHT_COLORS, highlighterConfig.color, (nextColor) => { updateHighlighterConfig({ color: nextColor }); setTool("highlighter"); })}</div><ThicknessPicker label={tf("Épaisseur")} value={highlighterConfig.size} onChange={(nextSize) => updateHighlighterConfig({ size: nextSize })} min={1} max={20} presets={[2, 4, 6, 10]} /><div className="mt-3 h-8 border bg-card px-3 py-2"><span className="block h-full opacity-40" style={{ backgroundColor: highlighterConfig.color, height: Math.max(3, highlighterConfig.size * 2) }} /></div></PopoverContent></Popover>;
    if (id === "eraser") return <Popover key={id} open={openPopover === id} onOpenChange={(o) => setOpenPopover(o ? id : null)}><PopoverTrigger asChild>{compactTrigger(id)}</PopoverTrigger><PopoverContent align="center" className="w-80"><h3 className="font-display text-base font-bold">{tf("Gomme")}</h3><div className="mt-3 grid grid-cols-4 gap-2">{[1,2,3,5].map((value) => <Button key={value} variant={eraserSize === value ? "secondary" : "outline"} size="icon" className={cn("rounded-full", value === 1 ? "size-8" : value === 2 ? "size-10" : value === 3 ? "size-12" : "size-14")} aria-label={tf("Taille de gomme {0}", [value])} onClick={() => { setEraserSize(value); setTool("eraser"); }}><span className="sr-only">{value}</span></Button>)}</div><div className="mt-4 space-y-1 border-t pt-3">
            <label className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3 py-2 text-sm"><span>{tf("Effacer tout le trait")}</span><Switch checked={eraserModes.length === 0} onCheckedChange={(on) => { setEraserModes(on ? [] : ["highlighter", "pen", "shape", "text"]); setTool("eraser"); }} /></label>
            {([["highlighter","Effacer le surligneur"],["pen","Effacer le stylo / crayon"],["shape","Effacer les formes"],["text","Effacer le texte"]] as [EraserKind,string][]).map(([kind,label]) => <label key={kind} className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3 py-2 text-sm"><span>{tf(label)}</span><Switch checked={eraserModes.includes(kind)} onCheckedChange={(on) => { setTool("eraser"); setEraserModes((prev) => on ? [...prev, kind] : prev.filter((k) => k !== kind)); }} /></label>)}
          </div><Button variant="ghost" className="mt-2 w-full justify-start text-destructive" onClick={clearPage}><Trash2 />{tf("Effacer la page")}</Button></PopoverContent></Popover>;
    if (SHAPE_TOOLS.includes(id as ShapeTool)) { const ActiveIcon = TOOL_META[id].Icon; return <Popover key={id} open={openPopover === id} onOpenChange={(o) => setOpenPopover(o ? id : null)}><PopoverTrigger asChild>{compactTrigger(id, ActiveIcon)}</PopoverTrigger><PopoverContent align="center" className="w-72"><h3 className="font-display text-base font-bold">{tf("Formes")}</h3><div className="mt-3 grid grid-cols-4 gap-2">{SHAPE_TOOLS.map((shape) => { const ShapeIcon = TOOL_META[shape].Icon; return <Button key={shape} variant={tool === shape ? "secondary" : "ghost"} size="icon" className="size-11" title={TOOL_META[shape].label} aria-label={TOOL_META[shape].label} onClick={() => setTool(shape)}><ShapeIcon /></Button>; })}</div><div className="mt-4">{swatches(QUICK_COLORS, shapeColor, updateShapeColor)}</div><ThicknessPicker label={tf("Contour")} value={shapeSize} onChange={setShapeSize} min={1} max={30} presets={[1, 2, 4, 8]} /><div className="mt-3 grid gap-2 text-sm font-semibold">{tf("Remplissage")}<div className="flex flex-wrap items-center gap-1">
                <button type="button" aria-label={tf("Aucun remplissage")} aria-pressed={fill === "transparent"} title={tf("Aucun")} onClick={() => setFill("transparent")} className={cn("grid size-8 shrink-0 place-items-center rounded-full border-2", fill === "transparent" ? "border-foreground" : "border-transparent")}><span className="relative grid size-6 place-items-center overflow-hidden rounded-full border border-border bg-background"><span className="absolute h-px w-8 rotate-45 bg-destructive" /></span></button>
                {swatches(QUICK_COLORS, fill, setFill)}
              </div>
            </div></PopoverContent></Popover>; }
    if (id === "text") return <Popover key={id} open={openPopover === id} onOpenChange={(o) => setOpenPopover(o ? id : null)}><PopoverTrigger asChild>{compactTrigger(id)}</PopoverTrigger><PopoverContent data-keep-text align="center" className="w-80" onOpenAutoFocus={(e) => e.preventDefault()} onCloseAutoFocus={(e) => e.preventDefault()}><h3 className="font-display text-base font-bold">{tf("Texte")}</h3><p className="mt-1 text-xs text-muted-foreground">{tf("Touche la page pour écrire, ou touche une note pour la modifier.")}</p><div className="mt-3 grid grid-cols-2 gap-2">{(Object.keys(TEXT_FONTS) as TextFont[]).map((f) => <Button key={f} variant={textFont === f ? "secondary" : "outline"} className="h-12 flex-col gap-0" onClick={() => setTextFont(f)}><span style={{ fontFamily: TEXT_FONTS[f].css, fontWeight: TEXT_FONTS[f].weight }} className="text-lg leading-none">{tf("Aa")}</span><span className="text-[11px]">{TEXT_FONTS[f].label}</span></Button>)}</div><div className="mt-4">{swatches(QUICK_COLORS, textColor, setTextColor)}</div><TextSizePicker value={textSize} onChange={setTextSize} /></PopoverContent></Popover>;
    return <span key={id}>{compactTrigger(id)}</span>;
  };

  return <div className="flex h-dvh flex-col overflow-hidden bg-muted">
    <header className="flex items-center gap-1 border-b bg-background px-1.5 py-1 pt-[max(0.25rem,env(safe-area-inset-top))] sm:px-3">
      <div className="flex min-w-0 max-w-[32%] shrink items-center gap-1 lg:max-w-[26%]"><Button variant="ghost" size="icon" className="shrink-0" aria-label={docFolderId ? tf("Retour au dossier du document") : tf("Retour aux dossiers")} onClick={() => { if (docFolderId) navigate({ to: "/dossiers", search: { f: docFolderId } }); else navigate({ to: "/" }); }}><ArrowLeft /></Button><DropdownMenu open={recentOpen} onOpenChange={setRecentOpen}><DropdownMenuTrigger asChild><button type="button" className="flex min-w-0 items-center gap-1 rounded text-sm font-semibold outline-none focus-visible:ring-2 focus-visible:ring-ring" aria-label={tf("Document : {0}. Voir les documents récents", [title])}><span className="truncate">{title}</span><ChevronDown className="size-4 shrink-0 text-muted-foreground" /></button></DropdownMenuTrigger><DropdownMenuContent align="start" className="w-72"><DropdownMenuLabel>{tf("Documents récents")}</DropdownMenuLabel>{recentDocs.length === 0 ? <p className="px-2 py-3 text-xs text-muted-foreground">{tf("Aucun autre document récent.")}</p> : recentDocs.map((d) => <DropdownMenuItem key={d.id} onClick={() => { setRecentOpen(false); navigate({ to: "/cahier", search: { doc: d.id } }); }}><FileText /><span className="min-w-0 flex-1 truncate">{d.name}</span><span className="text-xs text-muted-foreground">{new Date(d.updatedAt).toLocaleDateString("fr-FR", { day: "numeric", month: "short" })}</span></DropdownMenuItem>)}<DropdownMenuSeparator /><DropdownMenuItem onClick={() => { setRecentOpen(false); navigate({ to: "/" }); }}><LayoutGrid />{tf("Tous mes dossiers")}</DropdownMenuItem></DropdownMenuContent></DropdownMenu>{docId && saving !== "idle" && <span className="hidden shrink-0 text-[11px] text-muted-foreground md:inline" aria-live="polite">{saving === "saving" ? tf("Enregistrement…") : saving === "saved" ? tf("Enregistré") : tf("Non enregistré")}</span>}{offline && <span className="shrink-0 rounded-full bg-primary/15 px-2 py-0.5 text-[11px] font-medium text-foreground" aria-live="polite">{tf("Hors ligne — enregistré sur cet appareil")}</span>}</div>
      <div className="flex min-w-0 flex-1 items-center justify-center gap-0.5 overflow-x-auto" role="toolbar" aria-label={tf("Outils")} data-keep-text>{shortcuts.map(toolButton)}<Button variant="ghost" size="icon" className="size-10 shrink-0" aria-label={tf("Personnaliser la barre")} onClick={() => setCustomize(true)}><MoreHorizontal /></Button></div>
      <div className="flex shrink-0 items-center gap-0.5"><Button variant="ghost" size="icon" aria-label={tf("Annuler l’action")} onClick={undo} disabled={!past.length}><Undo2 /></Button><Button variant="ghost" size="icon" aria-label={tf("Rétablir")} onClick={redo} disabled={!future.length}><Redo2 /></Button><Button variant="ghost" size="icon" className={cn(showPagesAside && "text-amber-strong")} aria-label={showPagesAside ? tf("Masquer les pages") : tf("Afficher les pages")} onClick={() => setShowPagesAside((value) => !value)}><PanelLeft /></Button>
        <DropdownMenu><DropdownMenuTrigger asChild><Button variant="ghost" size="icon" aria-label={tf("Plus d’options")}><MoreHorizontal /></Button></DropdownMenuTrigger><DropdownMenuContent align="end" className="w-72">
          <DropdownMenuLabel>{tf("Page")}</DropdownMenuLabel><DropdownMenuItem onClick={goToPage}><FileText />{tf("Aller à la page")}{" "}<span className="ml-auto text-xs text-muted-foreground">{idx + 1}/{pages.length}</span></DropdownMenuItem><DropdownMenuItem onClick={() => void addBlank()}><FilePlus2 />{tf("Ajouter une page")}</DropdownMenuItem><DropdownMenuItem onClick={duplicatePage}><Copy />{tf("Dupliquer la page")}</DropdownMenuItem><DropdownMenuItem onClick={rotatePage}><Redo2 />{tf("Faire pivoter la page")}</DropdownMenuItem><DropdownMenuItem onClick={toggleBookmark}>{bookmarks.includes(idx) ? <BookmarkCheck /> : <Bookmark />} {bookmarks.includes(idx) ? tf("Retirer le marque-page") : tf("Ajouter un marque-page")}</DropdownMenuItem><DropdownMenuItem className="text-destructive" onClick={deletePage}><Trash2 />{tf("Supprimer la page")}</DropdownMenuItem>
          <DropdownMenuItem onClick={pasteFromMenu}><Copy />{tf("Coller sur la page")}</DropdownMenuItem>
          <DropdownMenuSeparator /><DropdownMenuLabel>{tf("Partager et enregistrer")}</DropdownMenuLabel><DropdownMenuItem onClick={() => void exportImage(true)}><FileImage />{tf("Enregistrer la page en PNG")}</DropdownMenuItem><DropdownMenuItem onClick={() => void sharePage()}><Share2 />{tf("Partager la page")}</DropdownMenuItem><DropdownMenuItem onClick={() => { setShareOpen(true); }}><Files />{tf("Partager plusieurs pages…")}</DropdownMenuItem><DropdownMenuItem onClick={() => void exportPdf()}><Download />{tf("Exporter le cahier en PDF")}</DropdownMenuItem>
          <DropdownMenuItem onClick={() => docRef.current?.click()}><FilePlus2 />{tf("Importer un fichier")}<span className="ml-auto text-[10px] text-muted-foreground">{tf("pages")}</span></DropdownMenuItem><DropdownMenuItem onClick={() => fileRef.current?.click()}><FileUp />{tf("Importer un média")}<span className="ml-auto text-[10px] text-muted-foreground">{tf("sur la page")}</span></DropdownMenuItem><DropdownMenuItem onClick={() => setShowPagesAside(true)}><LayoutGrid />{tf("Afficher les pages")}</DropdownMenuItem><DropdownMenuItem onClick={openChat}><MessageCircleQuestion />{tf("Discuter avec Clario")}</DropdownMenuItem><DropdownMenuItem onClick={() => void openQuiz()}><Brain />{tf("Créer un quiz sur cette page")}</DropdownMenuItem><DropdownMenuItem onClick={() => setPanel(true)}><MessageCircleQuestion />{tf("Expliquer la page en vidéo")}</DropdownMenuItem>
          <DropdownMenuSeparator /><DropdownMenuLabel>{tf("Paramètres")}</DropdownMenuLabel><DropdownMenuSub><DropdownMenuSubTrigger><MoveHorizontal />{tf("Affichage de la page")}</DropdownMenuSubTrigger><DropdownMenuSubContent><DropdownMenuItem onClick={() => setFit("width")}><MoveHorizontal />{tf("Adapter à la largeur")}</DropdownMenuItem><DropdownMenuItem onClick={() => setFit("page")}><Maximize2 />{tf("Afficher la page entière")}</DropdownMenuItem><DropdownMenuItem onClick={() => { setFit("custom"); setZoom((value) => Math.max(40, value - 10)); }}><Minus />{tf("Réduire le zoom")}</DropdownMenuItem><DropdownMenuItem onClick={() => { setFit("custom"); setZoom((value) => Math.min(250, value + 10)); }}><Plus />{tf("Agrandir le zoom")}</DropdownMenuItem></DropdownMenuSubContent></DropdownMenuSub><DropdownMenuSub><DropdownMenuSubTrigger><MoveHorizontal />{tf("Direction du défilement")}</DropdownMenuSubTrigger><DropdownMenuSubContent><DropdownMenuRadioGroup value={scrollDirection} onValueChange={(value) => setScrollDirection(value as ScrollDirection)}><DropdownMenuRadioItem value="vertical">{tf("Vertical")}</DropdownMenuRadioItem><DropdownMenuRadioItem value="horizontal">{tf("Horizontal")}</DropdownMenuRadioItem></DropdownMenuRadioGroup></DropdownMenuSubContent></DropdownMenuSub><DropdownMenuItem onSelect={(event) => event.preventDefault()} onClick={() => setPenOnly((value) => !value)}><Hand /><span className="flex-1">{tf("Stylet uniquement")}</span><Switch checked={penOnly} aria-label={tf("Stylet uniquement")} /></DropdownMenuItem><DropdownMenuItem onClick={() => setCustomize(true)}><Settings2 />{tf("Personnaliser la barre")}</DropdownMenuItem><DropdownMenuItem onClick={() => toast.info(tf("{0} · {1} page(s) · annotations enregistrées dans ton compte", [title, pages.length]))}><Info />{tf("Informations du document")}</DropdownMenuItem>
        </DropdownMenuContent></DropdownMenu>
      </div>
    </header>

    <div className={cn("relative flex min-h-0 flex-1 flex-col", showPagesAside && "sm:grid sm:grid-cols-[240px_minmax(0,1fr)] sm:flex-row")}>
      {showPagesAside && <aside className="absolute inset-0 z-30 flex min-h-0 flex-col border-r bg-background shadow-xl sm:static sm:z-auto sm:w-auto sm:shadow-none" aria-label={tf("Pages")}><div className="flex shrink-0 items-center justify-between gap-1 border-b p-2"><Button variant={selectingPages ? "secondary" : "ghost"} size="sm" className="min-w-0 px-2 text-xs" onClick={() => { setSelectingPages((value) => !value); setSelectedPages([]); }}>{selectingPages ? tf("Annuler") : tf("Sélectionner")}</Button><Button variant="ghost" size="icon" className="size-8" onClick={() => setShowPagesAside(false)} aria-label={tf("Masquer les pages")}><PanelLeftClose className="size-4" /></Button></div><div className="shrink-0 border-b p-2"><label className="flex items-center gap-2 border bg-background px-3 py-1"><Search className="size-4 shrink-0 text-muted-foreground" /><input value={pageQuery} onChange={(e) => setPageQuery(e.target.value)} placeholder={tf("Rechercher un mot…")} className="h-9 min-w-0 flex-1 bg-transparent text-sm outline-none" />{pageQuery && <button type="button" aria-label={tf("Effacer la recherche")} onClick={() => setPageQuery("")}><X className="size-4 text-muted-foreground" /></button>}</label></div><div className="min-h-0 flex-1 overflow-y-auto p-2">{(() => { const q = pageQuery.trim().toLowerCase(); const shown = pages.map((src, pageIndex) => { const noteText = (marks[pageIndex] ?? []).filter((m) => m.type === "text").map((m) => (m as { text: string }).text).join(" ").toLowerCase(); const count = q ? ((docText[pageIndex] ?? "").split(q).length - 1) + ((noteText.split(q)).length - 1) : 0; return { src, pageIndex, count }; }).filter(({ pageIndex, count }) => !q || count > 0 || String(pageIndex + 1) === q || (q === "marque-page" && bookmarks.includes(pageIndex))); if (q && !shown.length) return <p className="p-4 text-center text-xs text-muted-foreground">{tf("Aucune page ne contient « {0} ».", [pageQuery])}</p>; return shown.map(({ src, pageIndex, count }) => { const checked = selectedPages.includes(pageIndex); return <div key={`${src}-${pageIndex}`} draggable={!selectingPages} onDragStart={(e) => { dragPage.current = pageIndex; e.dataTransfer.effectAllowed = "move"; }} onDragOver={(e) => e.preventDefault()} onDrop={(e) => { e.preventDefault(); const from = dragPage.current; dragPage.current = null; if (from !== null && from !== pageIndex) movePageTo(from, pageIndex); }} className="mb-3 text-center text-xs font-medium"><button type="button" onClick={() => selectingPages ? setSelectedPages((list) => list.includes(pageIndex) ? list.filter((n) => n !== pageIndex) : [...list, pageIndex]) : setIdx(pageIndex)} className="relative block w-full cursor-pointer"><span className={cn("relative block overflow-hidden border-2 bg-card p-1", idx === pageIndex ? "border-amber-strong" : "border-transparent", checked && "border-success")}><img src={src} alt={tf("Page {0}", [pageIndex + 1])} className="aspect-[3/4] w-full object-contain" draggable={false} />{bookmarks.includes(pageIndex) && <BookmarkCheck className="absolute right-1 top-1 size-4 fill-school-yellow text-school-yellow-strong" />}{selectingPages && <span className={cn("absolute left-1 top-1 grid size-6 place-items-center rounded-full border-2 bg-background", checked && "border-success bg-success text-success-foreground")}>{checked && <Check className="size-4" />}</span>}</span></button><div className="mt-1 flex items-center justify-between"><span>{tf("Page")}{" "}{pageIndex + 1}{q && count > 0 && <span className="ml-1 text-muted-foreground">· {count}×</span>}</span>{!selectingPages && <DropdownMenu><DropdownMenuTrigger asChild><Button variant="ghost" size="icon" className="size-7" aria-label={tf("Options de la page {0}", [pageIndex + 1])}><MoreHorizontal className="size-4" /></Button></DropdownMenuTrigger><DropdownMenuContent align="start"><DropdownMenuItem disabled={pageIndex === 0} onClick={() => movePage(pageIndex, -1)}><ArrowUp />{tf("Déplacer avant")}</DropdownMenuItem><DropdownMenuItem disabled={pageIndex === pages.length - 1} onClick={() => movePage(pageIndex, 1)}><ArrowDown />{tf("Déplacer après")}</DropdownMenuItem><DropdownMenuItem onClick={() => toggleBookmarkAt(pageIndex)}>{bookmarks.includes(pageIndex) ? <BookmarkCheck /> : <Bookmark />}{bookmarks.includes(pageIndex) ? tf("Retirer le marque-page") : tf("Ajouter un marque-page")}</DropdownMenuItem><DropdownMenuSeparator /><DropdownMenuItem className="text-destructive" onClick={() => void deletePages([pageIndex])}><Trash2 />{tf("Supprimer cette page")}</DropdownMenuItem></DropdownMenuContent></DropdownMenu>}</div></div>; }); })()}</div>{selectingPages && <div className="shrink-0 border-t p-2"><Button variant="destructive" size="sm" className="w-full px-2 text-xs" disabled={!selectedPages.length} onClick={() => void deletePages(selectedPages)}><Trash2 />{tf("Supprimer (")}{selectedPages.length})</Button></div>}</aside>}
      <section className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden"><input ref={fileRef} type="file" accept="image/*,video/*,audio/*" hidden onChange={(e) => { void importMedia(e.target.files?.[0]); e.target.value = ""; }} /><input ref={docRef} type="file" accept="*/*" hidden onChange={(e) => { void importFile(e.target.files?.[0]); e.target.value = ""; }} />
        <main ref={pageArea} onTouchStart={onSwipeStart} onTouchMove={onPinchMove} onTouchEnd={onSwipeEnd} className={cn("min-h-0 flex-1 overflow-auto p-2 sm:p-5", scrollDirection === "horizontal" && "overflow-x-auto")}><div className="grid min-h-full place-items-center">{pages[idx] ? <div ref={animBoxRef} style={{ width: pageWidth }} className="relative mx-auto transition-[width]"><DrawingPage src={pages[idx]} marks={marks[idx] ?? []} onChange={setPageMarks} tool={tool} color={tool === "highlighter" ? highlighterConfig.color : SHAPE_TOOLS.includes(tool as ShapeTool) ? shapeColor : penConfig.color} fill={fill} size={tool === "highlighter" ? highlighterConfig.size : SHAPE_TOOLS.includes(tool as ShapeTool) ? shapeSize : penConfig.size} penStyle={tool === "highlighter" ? hlStyle : penStyle} eraserModes={eraserModes} eraserSize={eraserSize} penOnly={penOnly} rotation={rotations[idx] ?? 0} onSelect={(box) => void cropSelection(box)} onApply={(next) => saveMarks({ ...marks, [idx]: next })} onHistory={() => setPast((value) => [...value.slice(-49), marks])} onInteract={() => { setOpenPopover(null); setPasteTarget(null); }} lassoSel={lassoSel} setLassoSel={setLassoSel} onLongPress={longPressPaste} pasteTarget={pasteTarget} clipKind={clipKind} onPaste={handlePasteChoice} onClosePaste={() => setPasteTarget(null)} textColor={textColor} textSize={textSize} textFont={textFont} onTextStyle={(st) => { setTextColor(st.color); setTextSize(st.size); setTextFont(st.font); }} highlights={searchHighlights(pageQuery, docItems[idx], marks[idx] ?? [], animBox.w > 0 ? animBox.h / animBox.w : 1.414)} />{playing && animBox.w > 0 && <AnimationPlayer script={playing.script} audioUrl={playing.audioUrl} pageWidth={animBox.w} pageHeight={animBox.h} onExit={() => setPlaying(null)} />}</div> : docId || loading ? <div className="text-sm font-semibold text-muted-foreground">{tf("Chargement de la première page…")}</div> : <div className="max-w-sm text-center"><FileUp className="mx-auto size-9 text-muted-foreground" /><h2 className="mt-3 font-display text-xl font-bold">{tf("Ouvre tes propres notes")}</h2><p className="mt-2 text-sm text-muted-foreground">{tf("Importe un PDF ou une image pour commencer à écrire et réviser.")}</p><Button className="mt-5" onClick={() => docRef.current?.click()}><FileUp />{tf("Importer un fichier")}</Button></div>}</div></main>
        {media.some((m) => m.page === idx) && <div className="flex shrink-0 gap-2 overflow-x-auto border-t bg-background p-2">{media.filter((m) => m.page === idx).map((m) => <div key={m.id} className="grid shrink-0 grid-cols-[minmax(0,1fr)_auto] items-center gap-1 rounded-md border bg-card p-1.5">{m.type.startsWith("video/") ? <video src={mediaUrls[m.id]} controls playsInline className="h-28 max-w-[260px] rounded-sm bg-muted" /> : <audio src={mediaUrls[m.id]} controls className="h-10 w-64" />}<Button size="icon" variant="ghost" className="size-8" aria-label={tf("Retirer {0}", [m.name])} onClick={() => void deleteMedia(m.id)}><Trash2 /></Button><small className="col-span-2 max-w-[260px] truncate text-xs text-muted-foreground">{m.name}</small></div>)}</div>}
        <footer className="grid shrink-0 grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-1 border-t bg-background px-2 py-1.5 pb-[max(0.375rem,env(safe-area-inset-bottom))]"><Button size="icon" variant="secondary" className="size-11 rounded-full" aria-label={tf("Vidéo explicative de la page")} title={tf("Vidéo explicative")} disabled={!docId} onClick={() => setPanel(true)}><Video className="size-6" /></Button><div className="mx-auto flex min-w-[9.5rem] items-center justify-center gap-1"><Button size="icon" variant="ghost" aria-label={tf("Page précédente")} disabled={idx === 0} onClick={() => setIdx(idx - 1)}><ChevronLeft /></Button><Button variant="ghost" className="min-w-[5.25rem] whitespace-nowrap px-2 text-xs" disabled={!pages.length} onClick={() => setShowPagesAside(true)}>{pages.length ? tf("Page {0} / {1}", [idx + 1, pages.length]) : tf("Aucun document")}</Button><Button size="icon" variant="ghost" aria-label={tf("Page suivante")} disabled={idx >= pages.length - 1} onClick={() => setIdx(idx + 1)}><ChevronRight /></Button></div><Button onClick={openChat}><MessageCircleQuestion />{tf("Clario")}</Button></footer>
      </section>
    </div>

    {video && <ExplainerPlayer key={video.title + video.scenes.length} script={video} onClose={() => setVideo(null)} />}
    {selection && <div className="fixed inset-x-2 bottom-20 z-40 mx-auto max-w-md border bg-card p-3 shadow-lg">
      <div className="flex items-start gap-3"><img src={selection.image} alt={tf("Extrait sélectionné")} className="max-h-16 max-w-24 border object-contain" /><p className="line-clamp-3 min-w-0 flex-1 text-xs text-muted-foreground">{selection.text === null ? tf("Lecture du passage…") : selection.text || tf("Aucun texte détecté.")}</p><Button variant="ghost" size="icon" className="size-7" aria-label={tf("Fermer")} onClick={() => setSelection(null)}><X className="size-4" /></Button></div>
      <div className="mt-2 grid grid-cols-3 gap-2"><Button size="sm" variant="outline" disabled={!selection.text} onClick={() => { void navigator.clipboard.writeText(selection.text ?? "").then(() => toast.success(tf("Texte copié"))); }}>{tf("Copier")}</Button>
        <Button size="sm" variant="outline" disabled={!selection.text} onClick={() => window.open(`https://www.google.com/search?q=${encodeURIComponent(selection.text ?? "")}`, "_blank", "noopener")}>{tf("Rechercher")}</Button>
        <Button size="sm" onClick={askAboutSelection}>{tf("Demander à Clario")}</Button></div></div>}
    {lassoSel && <div className="fixed inset-x-0 bottom-20 z-40 mx-auto flex w-fit items-center justify-center gap-2 rounded-full border bg-card p-2 shadow-lg">
      <Popover><PopoverTrigger asChild><Button variant="outline" className="gap-2 px-4" aria-label={tf("Changer la couleur du contour")} title={tf("Couleur")}><Palette />{tf("Couleur")}</Button></PopoverTrigger><PopoverContent side="top" className="w-72"><p className="mb-3 text-sm font-semibold">{tf("Couleur du contour")}</p>{swatches(QUICK_COLORS, lassoColor, recolorLasso)}</PopoverContent></Popover>
      {lassoHasFill && <Popover><PopoverTrigger asChild><Button variant="outline" className="gap-2 px-4" aria-label={tf("Changer le remplissage")} title={tf("Remplissage")}><PaintBucket />{tf("Remplissage")}</Button></PopoverTrigger><PopoverContent side="top" className="w-72"><p className="mb-3 text-sm font-semibold">{tf("Remplissage")}</p><Button variant="outline" size="sm" className={cn("mb-2 w-full justify-start", lassoFill === "transparent" && "border-foreground")} onClick={() => refillLasso("transparent")}>{lassoFill === "transparent" ? "✓ " : ""}{tf("Aucun (transparent)")}</Button>{swatches(QUICK_COLORS, lassoFill, refillLasso)}</PopoverContent></Popover>}
      <Button variant="outline" className="gap-2 px-4" aria-label={tf("Copier la sélection")} title={tf("Copier")} onClick={() => { const sel = (marks[idx] ?? []).filter((m) => lassoSel.ids.includes(m.id)); setNotebookClip({ kind: "marks", marks: structuredClone(sel) }); toast.success(tf("{0} élément{1} copié{2} — appuie longuement sur une page pour coller", [sel.length, sel.length > 1 ? tf("s") : "", sel.length > 1 ? tf("s") : ""])); setLassoSel(null); }}><Copy />{tf("Copier")}</Button>
      <Button variant="outline" className="gap-2 px-4 text-destructive" aria-label={tf("Supprimer la sélection")} title={tf("Supprimer")} onClick={() => { setPageMarks((marks[idx] ?? []).filter((m) => !lassoSel.ids.includes(m.id))); setLassoSel(null); }}><Trash2 />{tf("Supprimer")}</Button>
    </div>}
    <PageShareDialog open={shareOpen} onOpenChange={setShareOpen} pages={pages} bookmarks={bookmarks} currentIndex={idx} busy={shareBusy} onShare={(list) => void sharePages(list)} />
    <Sheet open={chatOpen} onOpenChange={setChatOpen}><SheetContent side="right" className="flex w-full flex-col p-4 sm:max-w-md"><SheetHeader className="sr-only"><SheetTitle>{tf("Demander à Clario")}</SheetTitle></SheetHeader>{docId && <div className="mb-3 grid shrink-0 grid-cols-2 border bg-muted p-1"><Button size="sm" variant={chatMode === "chat" ? "secondary" : "ghost"} onClick={() => setChatMode("chat")}><MessageCircleQuestion />{tf("Discussion")}</Button><Button size="sm" variant={chatMode === "quiz" ? "secondary" : "ghost"} onClick={() => void openQuiz()}><Brain />{tf("Quiz de la page")}</Button></div>}{!docId ? <p className="p-6 text-sm text-muted-foreground">{tf("Ouvre un de tes documents pour discuter avec Clario.")}</p> : chatMode === "quiz" ? (quizImage ? <PageQuiz key={`${docId}-${quizPage}`} documentId={docId} page={quizPage} title={title} image={quizImage} /> : <div className="grid flex-1 place-items-center text-sm text-muted-foreground"><Loader2 className="mr-2 inline size-4 animate-spin" />{tf("Lecture de la page…")}</div>) : <DocChat documentId={docId} seed={chatSeed} onAddToPage={(text, handwritten) => void addChatPage(text, handwritten)} />}</SheetContent></Sheet>
    <Sheet open={panel} onOpenChange={setPanel}><SheetContent side="bottom" className="max-h-[85dvh] overflow-y-auto"><SheetHeader><SheetTitle>{tf("Demander à Clario")}</SheetTitle></SheetHeader><AnalysisPanel docId={docId} title={title} busy={animBusy} analysis={analysis} selected={selectedElements} setSelected={setSelectedElements} animations={docAnims} onAnalyze={() => void runAnalysis()} onGenerate={() => void runGeneration()} onReplay={(a) => void replayAnimation(a)} onDelete={(a) => void removeAnimation(a)} onClear={clearPage} /></SheetContent></Sheet>
    <Sheet open={customize} onOpenChange={setCustomize}><SheetContent side="right" className="w-[min(92vw,420px)] overflow-y-auto"><SheetHeader><SheetTitle>{tf("Personnaliser la barre")}</SheetTitle></SheetHeader><p className="mt-2 text-sm text-muted-foreground">{tf("Choisis tes raccourcis et place-les dans l’ordre voulu. Un outil ne peut apparaître qu’une seule fois.")}</p>{(() => { const all = Object.keys(TOOL_META).filter((id) => id === "arrow" || !SHAPE_TOOL_IDS.includes(id)) as ToolbarItem[]; const metaOf = (id: ToolbarItem) => id === "arrow" ? { ...TOOL_META[id], label: tf("Formes") } : TOOL_META[id]; const inBar = shortcuts.filter((id) => all.includes(id)); const rest = all.filter((id) => !shortcuts.includes(id)); const row = (toolId: ToolbarItem) => { const meta = metaOf(toolId); const active = shortcuts.includes(toolId); const position = inBar.indexOf(toolId); const Icon = meta.Icon; return <div key={toolId} className="grid grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-3 border bg-card p-3"><Icon className="size-5" /><span className="text-sm font-semibold">{meta.label}</span><div className="flex items-center gap-1">{active && <><Button variant="ghost" size="icon" className="size-8" disabled={position === 0} onClick={() => reorderShortcut(toolId, -1)} aria-label={tf("Déplacer {0} avant", [meta.label])}><ArrowUp /></Button><Button variant="ghost" size="icon" className="size-8" disabled={position === inBar.length - 1} onClick={() => reorderShortcut(toolId, 1)} aria-label={tf("Déplacer {0} après", [meta.label])}><ArrowDown /></Button></>}<Button variant={active ? "secondary" : "outline"} size="sm" onClick={() => setShortcuts((value) => active ? value.filter((item) => item !== toolId) : [...value, toolId])}>{active ? tf("Retirer") : tf("Ajouter")}</Button></div></div>; }; return <><h3 className="mt-5 text-sm font-bold">{tf("Dans la barre (dans l’ordre)")}</h3><div className="mt-2 space-y-2">{inBar.map(row)}</div>{rest.length > 0 && <><h3 className="mt-5 text-sm font-bold">{tf("Outils disponibles")}</h3><div className="mt-2 space-y-2">{rest.map(row)}</div></>}</>; })()}<div className="mt-6"><h3 className="text-sm font-bold">{tf("Autres raccourcis")}</h3><div className="mt-2 grid grid-cols-2 gap-2"><Button variant="outline" onClick={toggleBookmark}><Bookmark />{tf("Favoris")}</Button><Button variant="outline" onClick={() => void addBlank()}><FilePlus2 />{tf("Ajouter page")}</Button><Button variant="outline" onClick={() => { setShowPagesAside(true); setCustomize(false); }}><LayoutGrid />{tf("Afficher les pages")}</Button><Button variant="outline" onClick={() => setEmojiOpen(true)}><Smile />{tf("Émoticônes")}</Button></div></div><Button className="mt-6 w-full" onClick={() => setCustomize(false)}>{tf("Terminé")}</Button></SheetContent></Sheet>
    <Sheet open={emojiOpen} onOpenChange={setEmojiOpen}><SheetContent side="bottom" className="flex h-[80dvh] flex-col"><SheetHeader><SheetTitle>{tf("Émoticônes")}</SheetTitle></SheetHeader>
      <div className="flex min-h-0 flex-1 flex-col overflow-hidden px-1 pb-2">
        <label className="flex shrink-0 items-center gap-2 border bg-background px-3"><Search className="size-4" /><input value={emojiQuery} onChange={(e) => setEmojiQuery(e.target.value)} placeholder={tf("Rechercher…")} className="h-10 min-w-0 flex-1 bg-transparent text-sm outline-none" /></label>
        {!emojiQuery && <div className="mt-3 flex shrink-0 gap-2 overflow-x-auto pb-1">{EMOJI_CATEGORIES.map((cat) => <Button key={cat.id} variant={emojiCat === cat.id ? "secondary" : "outline"} size="sm" className="shrink-0" onClick={() => setEmojiCat(cat.id)}>{cat.label}</Button>)}</div>}
        <div className="mt-3 min-h-0 flex-1 overflow-y-auto">
          {(() => { const query = emojiQuery.trim().toLowerCase();
            const cats = query ? EMOJI_CATEGORIES.map((cat) => ({ ...cat, items: cat.items.filter((item) => item.name.toLowerCase().includes(query) || item.char === emojiQuery.trim()) })).filter((cat) => cat.items.length) : EMOJI_CATEGORIES.filter((cat) => cat.id === emojiCat);
            if (!cats.length) return <p className="p-6 text-center text-sm text-muted-foreground">{tf("Aucun émoticône trouvé pour « {0} ».", [emojiQuery])}</p>;
            return cats.map((cat) => <div key={cat.id} className="mb-4"><p className="mb-2 text-xs font-bold uppercase tracking-wide text-muted-foreground">{query ? cat.label : ""}</p><div className="grid grid-cols-8 gap-1 sm:grid-cols-12">{cat.items.map((item) => <button key={item.name} onClick={() => insertEmoji(item.char)} className="grid aspect-square place-items-center rounded text-2xl transition-colors hover:bg-muted" title={item.name} aria-label={item.name}>{item.char}</button>)}</div></div>);
          })()}
        </div>
      </div>
      </SheetContent>
      </Sheet>
    {loading && <div className="fixed inset-0 z-50 grid place-items-center bg-background/80"><div className="border bg-card p-5 text-sm font-semibold shadow-lg"><FileUp className="mx-auto mb-2 animate-bounce" />{tf("Ouverture du document…")}</div></div>}
  </div>;
}