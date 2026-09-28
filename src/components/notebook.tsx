import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Link, useNavigate, useSearch } from "@tanstack/react-router";
import {
  ArrowDown, ArrowLeft, ArrowLeftRight, ArrowRight, ArrowUp, ArrowUpRight, Bookmark, BookmarkCheck,
  CheckCircle2, ChevronLeft, ChevronRight, Circle, Copy, Diamond, Download, Eraser, FileImage,
  FilePlus2, FileText, FileUp, Hand, Headphones, Highlighter, Info, LayoutGrid, Maximize2,
  Heart, Menu, Minus, MoreHorizontal, MoveHorizontal, Palette, PanelLeft,
  PanelLeftClose, Pen, Pentagon, Play, Plus, RectangleHorizontal,
  MessageCircleQuestion, Redo2, Ruler, Search, Settings2, Share2, Smile, Square, Star, Trash2, Triangle, Type,
  Undo2,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu, DropdownMenuCheckboxItem, DropdownMenuContent, DropdownMenuItem,
  DropdownMenuLabel, DropdownMenuRadioGroup, DropdownMenuRadioItem, DropdownMenuSeparator,
  DropdownMenuSub, DropdownMenuSubContent, DropdownMenuSubTrigger, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Switch } from "@/components/ui/switch";
import { cn } from "@/lib/utils";
import { addMedia, blankPage, downloadBlob, getDoc, getDocFile, getMedia, listMedia, MEDIA_MAX, removeMedia, saveDoc, touchDoc, type MediaItem } from "@/lib/library";
import samplePage from "@/assets/board/scene-1.jpg";

type ShapeTool = "line" | "arrow" | "doubleArrow" | "rectangle" | "roundedRectangle" | "ellipse" | "triangle" | "diamond" | "parallelogram" | "pentagon" | "star" | "heart";
type Tool = "pen" | "highlighter" | "text" | "eraser" | "ruler" | ShapeTool;
type PenStyle = "plume" | "bille" | "crayon" | "plat" | "fin";
type EraserMode = "stroke" | "highlighter" | "pen";
type ScrollDirection = "vertical" | "horizontal";
type FitMode = "width" | "page" | "custom";
type Pt = [number, number, number];
type StrokeMark = { id: string; type: Exclude<Tool, "text" | "eraser">; color: string; size: number; style?: PenStyle; fill?: string; pts: Pt[] };
type Mark = StrokeMark | { id: string; type: "text"; color: string; size: number; x: number; y: number; text: string };

const QUICK_COLORS = ["#2b2540", "#d64541", "#2e6fd8", "#1f9d55", "#e0a800", "#8e5bd0"];
const HIGHLIGHT_COLORS = ["#ffe94d", "#8ef0a0", "#7fd4ff", "#ff9ecb", "#ffb760", "#c9a8ff"];
type EmojiItem = { char: string; name: string };
const EMOJI_CATEGORIES: { id: string; label: string; items: EmojiItem[] }[] = [
  { id: "visages", label: "Émoticônes et personnes", items: [
    { char: "😀", name: "sourire content heureux" }, { char: "😄", name: "rire joyeux" }, { char: "😁", name: "grand sourire" }, { char: "😂", name: "rire larmes" }, { char: "🙂", name: "léger sourire" }, { char: "😉", name: "clin d'œil" }, { char: "😍", name: "amoureux cœurs" }, { char: "🤩", name: "étoiles impressionné" }, { char: "😎", name: "cool lunettes" }, { char: "🤓", name: "intello lunettes studieux" }, { char: "🤔", name: "réfléchit pensif doute" }, { char: "🧐", name: "monocle analyse" }, { char: "😅", name: "sueur soulagé" }, { char: "😌", name: "apaisé calme" }, { char: "😴", name: "dort fatigue" }, { char: "🥱", name: "bâille ennui" }, { char: "😟", name: "inquiet souci" }, { char: "😢", name: "triste pleure" }, { char: "😭", name: "sanglot" }, { char: "😱", name: "peur panique" }, { char: "🤯", name: "esprit soufflé dingue" }, { char: "😤", name: "déterminé agacé" }, { char: "🥳", name: "fête célébration" }, { char: "🙃", name: "à l'envers ironie" },
    { char: "👍", name: "pouce oui d'accord" }, { char: "👎", name: "pouce bas non" }, { char: "👏", name: "applaudissements bravo" }, { char: "🙌", name: "mains levées hourra" }, { char: "🤝", name: "poignée de main accord" }, { char: "✍️", name: "écrire main" }, { char: "💪", name: "force courage muscle" }, { char: "🫡", name: "salut respect" }, { char: "🙏", name: "merci s'il te plaît" }, { char: "👀", name: "yeux regarder" }, { char: "🧠", name: "cerveau intelligence" }, { char: "🎓", name: "diplôme remise" },
  ] },
  { id: "animaux", label: "Animaux et nature", items: [
    { char: "🐶", name: "chien" }, { char: "🐱", name: "chat" }, { char: "🦊", name: "renard" }, { char: "🐻", name: "ours" }, { char: "🐼", name: "panda" }, { char: "🐨", name: "koala" }, { char: "🦁", name: "lion" }, { char: "🐯", name: "tigre" }, { char: "🐸", name: "grenouille" }, { char: "🐵", name: "singe" }, { char: "🦄", name: "licorne" }, { char: "🐝", name: "abeille" }, { char: "🦋", name: "papillon" }, { char: "🐢", name: "tortue" }, { char: "🐙", name: "pieuvre" }, { char: "🦉", name: "hibou chouette sage" },
    { char: "🌸", name: "fleur cerisier" }, { char: "🌻", name: "tournesol" }, { char: "🌷", name: "tulipe" }, { char: "🌱", name: "pousse plante" }, { char: "🌳", name: "arbre" }, { char: "🍀", name: "trèfle chance" }, { char: "🌈", name: "arc-en-ciel" }, { char: "☀️", name: "soleil" }, { char: "🌙", name: "lune" }, { char: "⭐", name: "étoile" }, { char: "✨", name: "étincelles magie" }, { char: "⚡", name: "éclair énergie" }, { char: "🔥", name: "feu chaud" }, { char: "❄️", name: "neige froid" }, { char: "🌊", name: "vague mer" }, { char: "☁️", name: "nuage" },
  ] },
  { id: "nourriture", label: "Nourriture et boissons", items: [
    { char: "☕", name: "café" }, { char: "🍵", name: "thé" }, { char: "🧃", name: "jus" }, { char: "🥤", name: "boisson gobelet" }, { char: "🍎", name: "pomme" }, { char: "🍌", name: "banane" }, { char: "🍓", name: "fraise" }, { char: "🍇", name: "raisin" }, { char: "🍊", name: "orange" }, { char: "🥐", name: "croissant" }, { char: "🍞", name: "pain" }, { char: "🧀", name: "fromage" }, { char: "🍕", name: "pizza" }, { char: "🍔", name: "burger" }, { char: "🍪", name: "biscuit cookie" }, { char: "🍫", name: "chocolat" }, { char: "🍰", name: "gâteau" }, { char: "🍩", name: "beignet donut" },
  ] },
  { id: "ecole", label: "École et études", items: [
    { char: "📚", name: "livres" }, { char: "📖", name: "livre ouvert lecture" }, { char: "📝", name: "note mémo écrire" }, { char: "✏️", name: "crayon" }, { char: "🖊️", name: "stylo" }, { char: "🖍️", name: "crayon de couleur" }, { char: "📐", name: "équerre géométrie" }, { char: "📏", name: "règle mesure" }, { char: "🧮", name: "abaque calcul" }, { char: "🔢", name: "chiffres nombres" }, { char: "🔬", name: "microscope science" }, { char: "🧪", name: "éprouvette chimie" }, { char: "🧬", name: "adn biologie" }, { char: "🌍", name: "globe géographie" }, { char: "🗺️", name: "carte" }, { char: "💻", name: "ordinateur portable" }, { char: "🖥️", name: "écran ordinateur" }, { char: "⌨️", name: "clavier" }, { char: "🖨️", name: "imprimante" }, { char: "📊", name: "graphique barres statistiques" }, { char: "📈", name: "courbe hausse" }, { char: "📉", name: "courbe baisse" }, { char: "🗂️", name: "dossiers classement" }, { char: "📁", name: "dossier" }, { char: "📌", name: "punaise épinglé" }, { char: "📎", name: "trombone" }, { char: "✂️", name: "ciseaux" }, { char: "🗒️", name: "bloc-notes" }, { char: "📅", name: "calendrier date" }, { char: "⏰", name: "réveil alarme" }, { char: "⏳", name: "sablier temps" }, { char: "🔍", name: "loupe recherche" }, { char: "💡", name: "ampoule idée" }, { char: "🎯", name: "cible objectif" }, { char: "🏆", name: "trophée victoire" }, { char: "🥇", name: "médaille premier" },
  ] },
  { id: "symboles", label: "Symboles et signes", items: [
    { char: "✅", name: "coche validé fait" }, { char: "☑️", name: "case cochée" }, { char: "✔️", name: "coche" }, { char: "❌", name: "croix faux" }, { char: "❗", name: "exclamation important" }, { char: "❓", name: "question" }, { char: "⚠️", name: "attention avertissement" }, { char: "🚫", name: "interdit" }, { char: "💯", name: "cent parfait" }, { char: "♾️", name: "infini" }, { char: "➕", name: "plus addition" }, { char: "➖", name: "moins soustraction" }, { char: "✖️", name: "multiplication" }, { char: "➗", name: "division" }, { char: "🟰", name: "égal" }, { char: "🔺", name: "triangle rouge" }, { char: "🔵", name: "cercle bleu" }, { char: "🟢", name: "cercle vert" }, { char: "🟡", name: "cercle jaune" }, { char: "🔴", name: "cercle rouge" }, { char: "▶️", name: "lecture play" }, { char: "⏸️", name: "pause" }, { char: "🔁", name: "répéter boucle" }, { char: "➡️", name: "flèche droite" }, { char: "⬅️", name: "flèche gauche" }, { char: "⬆️", name: "flèche haut" }, { char: "⬇️", name: "flèche bas" }, { char: "↔️", name: "flèche double" }, { char: "❤️", name: "cœur rouge" }, { char: "💛", name: "cœur jaune" }, { char: "💚", name: "cœur vert" }, { char: "💜", name: "cœur violet" }, { char: "🖤", name: "cœur noir" }, { char: "💤", name: "sommeil" }, { char: "💬", name: "bulle dialogue" }, { char: "🔔", name: "cloche rappel" },
  ] },
];
const DEFAULT_SHORTCUTS: Tool[] = ["pen", "highlighter", "eraser", "arrow", "text"];
const SHAPE_TOOLS: ShapeTool[] = ["line", "arrow", "doubleArrow", "rectangle", "roundedRectangle", "ellipse", "triangle", "diamond", "parallelogram", "pentagon", "star", "heart"];
const uid = () => Math.random().toString(36).slice(2);

const TOOL_META: Record<Tool, { label: string; Icon: typeof Pen }> = {
  pen: { label: "Stylo", Icon: Pen }, highlighter: { label: "Surligneur", Icon: Highlighter },
  eraser: { label: "Gomme", Icon: Eraser }, arrow: { label: "Flèche", Icon: ArrowUpRight },
  text: { label: "Texte", Icon: Type }, ruler: { label: "Règle", Icon: Ruler },
  line: { label: "Ligne", Icon: Minus }, doubleArrow: { label: "Double flèche", Icon: ArrowLeftRight },
  rectangle: { label: "Rectangle", Icon: RectangleHorizontal }, roundedRectangle: { label: "Rectangle arrondi", Icon: Square }, ellipse: { label: "Cercle", Icon: Circle },
  triangle: { label: "Triangle", Icon: Triangle }, diamond: { label: "Losange", Icon: Diamond }, parallelogram: { label: "Parallélogramme", Icon: RectangleHorizontal },
  pentagon: { label: "Pentagone", Icon: Pentagon }, star: { label: "Étoile", Icon: Star }, heart: { label: "Cœur", Icon: Heart },
};

async function renderPdf(file: Blob): Promise<string[]> {
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
    out.push(canvas.toDataURL("image/jpeg", 0.9));
  }
  return out;
}

function drawMark(ctx: CanvasRenderingContext2D, mark: Mark, width: number, height: number) {
  ctx.save(); ctx.lineCap = "round"; ctx.lineJoin = "round";
  if (mark.type === "text") {
    ctx.fillStyle = mark.color; ctx.font = `600 ${mark.size * width * 0.004}px Caveat, cursive`;
    mark.text.split("\n").forEach((line, i) => ctx.fillText(line, mark.x * width, mark.y * height + i * mark.size * width * 0.004));
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
  if (mark.type === "text") return Math.abs(mark.x - x) < Math.max(0.1, radius) && Math.abs(mark.y - y) < Math.max(0.05, radius);
  return mark.pts.some((point) => Math.hypot(point[0] - x, point[1] - y) < radius);
}

function DrawingPage({ src, marks, tool, color, fill, size, penStyle, eraserMode, eraserSize, penOnly, rotation, onChange, onPen }: {
  src: string; marks: Mark[]; tool: Tool; color: string; fill: string; size: number; penStyle: PenStyle; eraserMode: EraserMode; eraserSize: number; penOnly: boolean; rotation: number;
  onChange: (marks: Mark[]) => void; onPen: () => void;
}) {
  const committed = useRef<HTMLCanvasElement>(null); const draft = useRef<HTMLCanvasElement>(null);
  const current = useRef<StrokeMark | null>(null); const frame = useRef<number | null>(null);
  const paint = useCallback((canvas: HTMLCanvasElement | null, items: Mark[]) => {
    if (!canvas) return; const rect = canvas.getBoundingClientRect(); const dpr = window.devicePixelRatio || 1;
    const targetWidth = Math.max(1, Math.round(rect.width * dpr)); const targetHeight = Math.max(1, Math.round(rect.height * dpr));
    if (canvas.width !== targetWidth || canvas.height !== targetHeight) { canvas.width = targetWidth; canvas.height = targetHeight; }
    const context = canvas.getContext("2d"); if (!context) return; context.clearRect(0, 0, canvas.width, canvas.height);
    items.forEach((item) => drawMark(context, item, canvas.width, canvas.height));
  }, []);
  const drawCommitted = useCallback(() => paint(committed.current, marks), [marks, paint]);
  const drawDraft = useCallback(() => paint(draft.current, current.current ? [current.current] : []), [paint]);
  useEffect(() => {
    drawCommitted(); drawDraft(); const observer = new ResizeObserver(() => { drawCommitted(); drawDraft(); });
    if (committed.current) observer.observe(committed.current); return () => observer.disconnect();
  }, [drawCommitted, drawDraft]);
  const point = (event: React.PointerEvent): Pt => {
    const rect = draft.current?.getBoundingClientRect(); if (!rect) return [0, 0, 0.5];
    return [(event.clientX - rect.left) / rect.width, (event.clientY - rect.top) / rect.height, event.pointerType === "pen" ? event.pressure || 0.5 : 0.5];
  };
  const erasing = useRef(false); const rectRef = useRef<DOMRect | null>(null); const pointerId = useRef<number | null>(null);
  const erasable = (mark: Mark) => eraserMode === "stroke" || (eraserMode === "highlighter" ? mark.type === "highlighter" : mark.type !== "highlighter");
  const eraseAt = (x: number, y: number) => { const kept = marks.filter((mark) => !erasable(mark) || !hit(mark, x, y, eraserSize)); if (kept.length !== marks.length) onChange(kept); };
  const pan = useRef<{ id: number; x: number; y: number; el: HTMLElement | null } | null>(null);
  const scrollParent = (node: HTMLElement | null): HTMLElement | null => { let el = node?.parentElement ?? null; while (el) { const s = getComputedStyle(el); if (/(auto|scroll)/.test(s.overflowY + s.overflowX) && (el.scrollHeight > el.clientHeight || el.scrollWidth > el.clientWidth)) return el; el = el.parentElement; } return document.scrollingElement as HTMLElement | null; };
  const down = (event: React.PointerEvent) => {
    if (event.pointerType === "pen") onPen();
    if (penOnly && event.pointerType !== "pen") { if (event.pointerType === "touch" && !pan.current) pan.current = { id: event.pointerId, x: event.clientX, y: event.clientY, el: scrollParent(draft.current) }; return; }
    if (pointerId.current !== null && pointerId.current !== event.pointerId) return; // ignore a second finger/palm mid-stroke
    event.preventDefault(); try { draft.current?.setPointerCapture(event.pointerId); } catch { /* ignore */ } rectRef.current = draft.current?.getBoundingClientRect() ?? null; const p = point(event);
    if (tool === "text") { const text = window.prompt("Votre note :"); if (text?.trim()) onChange([...marks, { id: uid(), type: "text", color, size: size * 6, x: p[0], y: p[1], text: text.trim() }]); return; }
    pointerId.current = event.pointerId;
    if (tool === "eraser") { erasing.current = true; eraseAt(p[0], p[1]); return; }
    current.current = { id: uid(), type: tool, color, fill, size, style: penStyle, pts: [p] };
    drawDraft();
  };
  const move = (event: React.PointerEvent) => {
    if (pan.current && pan.current.id === event.pointerId) { const d = pan.current; d.el?.scrollBy(d.x - event.clientX, d.y - event.clientY); d.x = event.clientX; d.y = event.clientY; return; }
    if (pointerId.current !== event.pointerId) return;
    const rect = rectRef.current; if (!rect) return;
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
    if (pan.current?.id === event.pointerId) { pan.current = null; return; }
    if (pointerId.current !== event.pointerId) return; pointerId.current = null; erasing.current = false;
    const mark = current.current; current.current = null; if (frame.current !== null) cancelAnimationFrame(frame.current); frame.current = null;
    if (mark) {
      const isFree = mark.type === "pen" || mark.type === "highlighter";
      if (mark.pts.length === 1 && isFree && mark.pts[0]) { const [x, y, pr] = mark.pts[0]; mark.pts.push([x + 0.0008, y, pr]); } // a tap leaves a dot
      if (mark.pts.length > 1) { onChange([...marks, mark]); return; }
    }
    drawDraft();
  };
  return <div className="relative w-full overflow-hidden border bg-card shadow-sm" style={{ transform: `rotate(${rotation}deg)` }}>
    <img src={src} alt="Page du document" className="block w-full select-none" draggable={false} />
    <canvas ref={committed} className="pointer-events-none absolute inset-0 size-full" />
    <canvas ref={draft} className="absolute inset-0 size-full touch-none select-none" style={{ WebkitUserSelect: "none", WebkitTouchCallout: "none" } as React.CSSProperties} onPointerDown={down} onPointerMove={move} onPointerUp={finish} onPointerCancel={finish} onLostPointerCapture={finish} />
  </div>;
}

const DETECTED = ["Titre de la page", "Définition principale", "Méthode", "Formule", "Exemple avec calcul", "Résultat"];
function AnalysisPanel({ selected, setSelected, onClear }: { selected: Record<number, boolean>; setSelected: React.Dispatch<React.SetStateAction<Record<number, boolean>>>; onClear: () => void }) {
  const soon = () => toast.info("L’analyse fiable et la narration arrivent à l’étape suivante. Tes choix sont conservés.");
  return <div><div className="flex items-center gap-2"><MessageCircleQuestion className="size-5 text-amber-strong" /><h2 className="font-display text-lg font-bold tracking-tight">Demander à Clario</h2></div>
    <p className="mt-4 bg-muted p-3 text-xs leading-5 text-muted-foreground">Choisis les éléments de cette page que Clario pourra expliquer ou animer.</p>
    <div className="mt-4 flex items-center gap-2 text-xs font-semibold"><CheckCircle2 className="size-4 text-success-strong" />Éléments animables ({DETECTED.length})</div>
    <div className="mt-2 space-y-1">{DETECTED.map((label, i) => <label key={label} className="grid grid-cols-[auto_minmax(0,1fr)] items-center gap-2 border bg-card px-2 py-2 text-xs"><input type="checkbox" checked={selected[i] ?? true} onChange={(e) => setSelected((value) => ({ ...value, [i]: e.target.checked }))} /><span>{label}</span></label>)}</div>
    <div className="mt-5 flex items-center gap-2 text-xs font-semibold"><Info className="size-4 text-school-coral" />Éléments non animables</div><p className="mt-2 bg-muted p-3 text-[11px] leading-4 text-muted-foreground">Les notes manuscrites illisibles restent sur la page sans être interprétées.</p>
    <Button className="mt-4 w-full" onClick={soon}><Play />Générer l’animation</Button><Button variant="outline" className="mt-2 w-full" onClick={soon}><Headphones />Générer uniquement l’audio</Button><Button variant="ghost" className="mt-2 w-full" onClick={onClear}><Trash2 />Effacer les annotations</Button>
  </div>;
}

export default function Notebook() {
  const navigate = useNavigate(); const search = useSearch({ strict: false }) as { doc?: string };
  const [docId, setDocId] = useState("exemple"); const [title, setTitle] = useState("Page d’exemple");
  const [pages, setPages] = useState<string[]>([samplePage]); const [idx, setIdx] = useState(0);
  const [marks, setMarks] = useState<Record<number, Mark[]>>({}); const [rotations, setRotations] = useState<Record<number, number>>({});
  const [past, setPast] = useState<Record<number, Mark[]>[]>([]); const [future, setFuture] = useState<Record<number, Mark[]>[]>([]);
  const [tool, setTool] = useState<Tool>("pen"); const [color, setColor] = useState(QUICK_COLORS[0] ?? "#3d2f5c"); const [fill, setFill] = useState("transparent");
  const [size, setSize] = useState(3); const [penStyle, setPenStyle] = useState<PenStyle>("plume"); const [penOnly, setPenOnly] = useState(false);
  const [hlColor, setHlColor] = useState(HIGHLIGHT_COLORS[0] ?? "#ffe94d"); const [hlSize, setHlSize] = useState(6); const [hlStyle, setHlStyle] = useState<PenStyle>("plat");
  const [eraserMode, setEraserMode] = useState<EraserMode>("stroke"); const [eraserSize, setEraserSize] = useState(2);
  const [zoom, setZoom] = useState(100); const [fit, setFit] = useState<FitMode>("width"); const [scrollDirection, setScrollDirection] = useState<ScrollDirection>("vertical");
  const [loading, setLoading] = useState(false); const [panel, setPanel] = useState(false); const [pagesPanel, setPagesPanel] = useState(false); const [customize, setCustomize] = useState(false);
  const [showPagesAside, setShowPagesAside] = useState(true);
  const [selectedElements, setSelectedElements] = useState<Record<number, boolean>>({}); const [bookmarks, setBookmarks] = useState<number[]>([]); const [pageQuery, setPageQuery] = useState("");
  const [shortcuts, setShortcuts] = useState<Tool[]>(DEFAULT_SHORTCUTS); const [clips, setClips] = useState<string[]>([]); const fileRef = useRef<HTMLInputElement>(null); const photoRef = useRef<HTMLInputElement>(null); const pageArea = useRef<HTMLDivElement>(null);
  const [emojiOpen, setEmojiOpen] = useState(false); const [emojiQuery, setEmojiQuery] = useState(""); const [emojiCat, setEmojiCat] = useState(EMOJI_CATEGORIES[0]?.id ?? "visages");

  useEffect(() => { try { const saved = localStorage.getItem("clario-toolbar"); const savedClips = localStorage.getItem("clario-clips"); if (saved) setShortcuts(JSON.parse(saved) as Tool[]); if (savedClips) setClips(JSON.parse(savedClips) as string[]); } catch { /* keep defaults */ } }, []);
  useEffect(() => { localStorage.setItem("clario-toolbar", JSON.stringify(shortcuts)); }, [shortcuts]);
  useEffect(() => { localStorage.setItem("clario-clips", JSON.stringify(clips)); }, [clips]);
  useEffect(() => { try { const saved = localStorage.getItem("clario-panels"); if (saved) { const value = JSON.parse(saved) as { pages?: boolean }; if (typeof value.pages === "boolean") setShowPagesAside(value.pages); } } catch { /* keep defaults */ } }, []);
  useEffect(() => { localStorage.setItem("clario-panels", JSON.stringify({ pages: showPagesAside })); }, [showPagesAside]);
  useEffect(() => {
    try { const loaded = JSON.parse(localStorage.getItem(`clario-notes:${docId}`) ?? "{}") as Record<number, unknown[]>; const cleaned: Record<number, Mark[]> = {}; Object.entries(loaded).forEach(([key, value]) => { cleaned[Number(key)] = (value as Mark[]).filter((mark): mark is Mark => Boolean(mark) && (mark as { type?: string }).type !== "sticker"); }); setMarks(cleaned); setBookmarks(JSON.parse(localStorage.getItem(`clario-bookmarks:${docId}`) ?? "[]")); setRotations(JSON.parse(localStorage.getItem(`clario-rotations:${docId}`) ?? "{}")); } catch { setMarks({}); setBookmarks([]); setRotations({}); }
    setPast([]); setFuture([]);
  }, [docId]);
  const saveMarks = (next: Record<number, Mark[]>) => { setMarks(next); localStorage.setItem(`clario-notes:${docId}`, JSON.stringify(next)); };
  const commit = (next: Record<number, Mark[]>) => { setPast((value) => [...value.slice(-49), marks]); setFuture([]); saveMarks(next); };
  const setPageMarks = (next: Mark[]) => commit({ ...marks, [idx]: next });
  const undo = () => { const previous = past.at(-1); if (!previous) return; setFuture((value) => [marks, ...value]); setPast((value) => value.slice(0, -1)); saveMarks(previous); };
  const redo = () => { const next = future[0]; if (!next) return; setPast((value) => [...value, marks]); setFuture((value) => value.slice(1)); saveMarks(next); };

  useEffect(() => {
    const id = search.doc; if (!id) { setDocId("exemple"); setTitle("Page d’exemple"); setPages([samplePage]); setIdx(0); return; }
    let cancelled = false; setLoading(true);
    void (async () => { try { const blob = await getDocFile(id); if (!blob) throw new Error("missing"); const images = blob.type === "application/pdf" ? await renderPdf(blob) : [URL.createObjectURL(blob)]; if (!cancelled) { setPages(images); setIdx(0); setTitle(getDoc(id)?.name ?? "Document"); setDocId(id); touchDoc(id); } } catch { toast.error("Impossible d’ouvrir ce fichier. Essaie un PDF ou une image."); } finally { if (!cancelled) setLoading(false); } })();
    return () => { cancelled = true; };
  }, [search.doc]);

  const importFile = async (file?: File) => { if (!file) return; try { const id = await saveDoc(file, file.name.replace(/\.[^.]+$/, ""), null); navigate({ to: "/cahier", search: { doc: id } }); } catch { toast.error("Impossible d’enregistrer ce fichier."); } };
  const [media, setMedia] = useState<MediaItem[]>([]); const [mediaUrls, setMediaUrls] = useState<Record<string, string>>({});
  useEffect(() => { if (!docId) return; const items = listMedia(docId); setMedia(items); let alive = true; const made: string[] = []; void Promise.all(items.map(async (m) => { const b = await getMedia(m.id); if (!b) return null; const u = URL.createObjectURL(b); made.push(u); return [m.id, u] as const; })).then((rows) => { if (alive) setMediaUrls(Object.fromEntries(rows.filter(Boolean) as [string, string][])); }); return () => { alive = false; made.forEach((u) => URL.revokeObjectURL(u)); }; }, [docId]);
  const importMedia = async (file?: File) => { if (!file) return; if (file.type.startsWith("video/") || file.type.startsWith("audio/")) { if (file.size > MEDIA_MAX) { toast.error("Fichier trop lourd (50 Mo maximum)."); return; } try { const item = await addMedia(docId, file, idx); setMedia((v) => [...v, item]); setMediaUrls((v) => ({ ...v, [item.id]: URL.createObjectURL(file) })); toast.success(`${file.type.startsWith("video/") ? "Vidéo" : "Audio"} ajouté à la page ${idx + 1}`); } catch { toast.error("Impossible d’enregistrer ce média sur cet appareil."); } return; } await importFile(file); };
  const deleteMedia = async (id: string) => { await removeMedia(docId, id); setMedia((v) => v.filter((m) => m.id !== id)); };
  const swipe = useRef<{ x: number; y: number; t: number } | null>(null);
  const onSwipeStart = (e: React.TouchEvent) => { const t = e.touches[0]; const onCanvas = (e.target as HTMLElement).tagName === "CANVAS"; swipe.current = e.touches.length === 1 && t && (penOnly || !onCanvas || !["pen", "highlighter", "eraser", "arrow", "shape", "ruler"].includes(tool)) ? { x: t.clientX, y: t.clientY, t: Date.now() } : null; };
  const onSwipeEnd = (e: React.TouchEvent) => { const s0 = swipe.current; swipe.current = null; const t = e.changedTouches[0]; const el = pageArea.current; if (!s0 || !t || !el || Date.now() - s0.t > 700) return; const dx = t.clientX - s0.x, dy = t.clientY - s0.y; let dir = 0; if (scrollDirection === "horizontal") { if (Math.abs(dx) > 70 && Math.abs(dx) > Math.abs(dy) * 1.5) { const atEnd = el.scrollLeft + el.clientWidth >= el.scrollWidth - 4, atStart = el.scrollLeft <= 4; if (dx < 0 && atEnd) dir = 1; else if (dx > 0 && atStart) dir = -1; } } else if (Math.abs(dy) > 70 && Math.abs(dy) > Math.abs(dx) * 1.5) { const atEnd = el.scrollTop + el.clientHeight >= el.scrollHeight - 4, atStart = el.scrollTop <= 4; if (dy < 0 && atEnd) dir = 1; else if (dy > 0 && atStart) dir = -1; } const next = idx + dir; if (dir && next >= 0 && next < pages.length) { setIdx(next); requestAnimationFrame(() => { if (scrollDirection === "horizontal") el.scrollLeft = dir > 0 ? 0 : el.scrollWidth; else el.scrollTop = dir > 0 ? 0 : el.scrollHeight; }); } };
  const addBlank = async () => { const blob = await blankPage(); const url = URL.createObjectURL(blob); setPages((value) => [...value, url]); setIdx(pages.length); toast.success("Page ajoutée"); };
  const addPhoto = async (file?: File) => { if (!file) return; setPages((value) => [...value, URL.createObjectURL(file)]); setIdx(pages.length); toast.success("Photo ajoutée"); };
  const duplicatePage = () => { const source = pages[idx]; if (!source) return; setPages((value) => [...value.slice(0, idx + 1), source, ...value.slice(idx + 1)]); const currentMarks = marks[idx] ?? []; const shifted: Record<number, Mark[]> = {}; Object.entries(marks).forEach(([key, value]) => { const n = Number(key); shifted[n > idx ? n + 1 : n] = value; }); shifted[idx + 1] = structuredClone(currentMarks); saveMarks(shifted); setIdx(idx + 1); toast.success("Page dupliquée"); };
  const deletePage = () => { if (pages.length === 1) { toast.error("Le cahier doit conserver au moins une page."); return; } if (!window.confirm(`Supprimer la page ${idx + 1} ?`)) return; setPages((value) => value.filter((_, i) => i !== idx)); const shifted: Record<number, Mark[]> = {}; Object.entries(marks).forEach(([key, value]) => { const n = Number(key); if (n !== idx) shifted[n > idx ? n - 1 : n] = value; }); saveMarks(shifted); setIdx(Math.max(0, idx - 1)); };
  const movePage = (pageIndex: number, delta: -1 | 1) => { const target = pageIndex + delta; if (target < 0 || target >= pages.length) return; setPages((value) => { const next = [...value]; [next[pageIndex], next[target]] = [next[target] ?? "", next[pageIndex] ?? ""]; return next; }); const nextMarks = { ...marks, [pageIndex]: marks[target] ?? [], [target]: marks[pageIndex] ?? [] }; saveMarks(nextMarks); setIdx(target); };
  const rotatePage = () => { const next = { ...rotations, [idx]: ((rotations[idx] ?? 0) + 90) % 360 }; setRotations(next); localStorage.setItem(`clario-rotations:${docId}`, JSON.stringify(next)); };
  const toggleBookmark = () => { const next = bookmarks.includes(idx) ? bookmarks.filter((n) => n !== idx) : [...bookmarks, idx]; setBookmarks(next); localStorage.setItem(`clario-bookmarks:${docId}`, JSON.stringify(next)); };
  const toggleBookmarkAt = (pageIndex: number) => { const next = bookmarks.includes(pageIndex) ? bookmarks.filter((n) => n !== pageIndex) : [...bookmarks, pageIndex]; setBookmarks(next); localStorage.setItem(`clario-bookmarks:${docId}`, JSON.stringify(next)); };
  const insertText = (text: string) => setPageMarks([...(marks[idx] ?? []), { id: uid(), type: "text", color, size: 26, x: 0.15, y: 0.18, text }]);
  const insertEmoji = (char: string) => { setEmojiOpen(false); setPageMarks([...(marks[idx] ?? []), { id: uid(), type: "text", color, size: 26, x: 0.15, y: 0.18, text: char }]); };
  const saveClip = () => { const text = window.prompt("Texte du clip réutilisable :"); if (!text?.trim()) return; setClips((value) => value.includes(text.trim()) ? value : [...value, text.trim()]); toast.success("Clip enregistré"); };
  const reorderShortcut = (toolId: Tool, delta: -1 | 1) => setShortcuts((value) => { const from = value.indexOf(toolId); const to = from + delta; if (from < 0 || to < 0 || to >= value.length) return value; const next = [...value]; [next[from], next[to]] = [next[to] ?? toolId, next[from] ?? toolId]; return next; });
  const clearPage = () => { setPageMarks([]); toast.success("Annotations effacées"); };
  const goToPage = () => { const value = window.prompt(`Numéro de page (1 à ${pages.length}) :`, String(idx + 1)); const number = Number(value); if (Number.isInteger(number) && number >= 1 && number <= pages.length) setIdx(number - 1); else if (value) toast.error("Numéro de page invalide"); };
  const exportImage = async (download = true) => {
    const src = pages[idx]; if (!src) return null; const image = new Image(); image.src = src; await image.decode(); const canvas = document.createElement("canvas"); canvas.width = image.naturalWidth; canvas.height = image.naturalHeight; const context = canvas.getContext("2d"); if (!context) return null; context.drawImage(image, 0, 0); (marks[idx] ?? []).forEach((mark) => drawMark(context, mark, canvas.width, canvas.height)); const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/png")); if (!blob) return null; if (download) { downloadBlob(blob, `${title}-page-${idx + 1}.png`); toast.success("Page enregistrée en PNG"); } return blob;
  };
  const sharePage = async () => { const blob = await exportImage(false); if (!blob) return; const file = new File([blob], `${title}-page-${idx + 1}.png`, { type: "image/png" }); if (navigator.share && navigator.canShare?.({ files: [file] })) await navigator.share({ title, files: [file] }); else { await exportImage(true); toast.info("Le partage direct n’est pas disponible; l’image a été téléchargée."); } };
  const exportPdf = async () => { const { jsPDF } = await import("jspdf"); const pdf = new jsPDF({ unit: "pt", format: "a4" }); for (let i = 0; i < pages.length; i += 1) { if (i > 0) pdf.addPage(); const image = new Image(); image.src = pages[i] ?? ""; await image.decode(); const canvas = document.createElement("canvas"); canvas.width = image.naturalWidth; canvas.height = image.naturalHeight; const context = canvas.getContext("2d"); if (!context) continue; context.drawImage(image, 0, 0); (marks[i] ?? []).forEach((mark) => drawMark(context, mark, canvas.width, canvas.height)); const ratio = Math.min(555 / canvas.width, 802 / canvas.height); pdf.addImage(canvas.toDataURL("image/jpeg", 0.9), "JPEG", (595 - canvas.width * ratio) / 2, 20, canvas.width * ratio, canvas.height * ratio); } downloadBlob(pdf.output("blob"), `${title}.pdf`); toast.success("Cahier exporté en PDF"); };
  const visiblePages = useMemo(() => pages.map((src, i) => ({ src, i })).filter(({ i }) => !pageQuery || String(i + 1).includes(pageQuery) || (bookmarks.includes(i) && "marque-page".includes(pageQuery.toLowerCase()))), [pages, pageQuery, bookmarks]);
  const pageWidth = fit === "width" ? "100%" : fit === "page" ? "min(100%, 760px)" : `${zoom}%`;

  const swatches = (list: string[], value: string, onPick: (c: string) => void) => <div className="flex flex-wrap items-center gap-2">{list.map((swatch, i) => <Button key={swatch} variant="ghost" size="icon" aria-label={`Couleur ${i + 1}`} onClick={() => onPick(swatch)} className={cn("size-8 rounded-full border-2 p-1", value === swatch ? "border-foreground" : "border-transparent")}><span className="size-5 rounded-full" style={{ backgroundColor: swatch }} /></Button>)}<label className="relative grid size-8 cursor-pointer place-items-center rounded-full border" title="Couleur personnalisée"><span className="size-5 rounded-full border" style={{ backgroundColor: value }} /><input type="color" value={value} onChange={(e) => onPick(e.target.value)} className="absolute inset-0 cursor-pointer opacity-0" aria-label="Couleur personnalisée" /></label></div>;
  const colorChoices = swatches(QUICK_COLORS, color, setColor);
  const compactTrigger = (id: Tool, icon?: typeof Pen) => { const meta = TOOL_META[id]; const Icon = icon ?? meta.Icon; return <Button variant={tool === id || (SHAPE_TOOLS.includes(tool as ShapeTool) && SHAPE_TOOLS.includes(id as ShapeTool)) ? "secondary" : "ghost"} size="icon" className="size-10 shrink-0" aria-label={meta.label} title={meta.label} onClick={() => setTool(id)}><Icon className={cn("size-5", id === "pen" && "text-amber-strong", id === "highlighter" && "text-school-yellow-strong")} /></Button>; };
  const toolButton = (id: Tool) => {
    if (id === "pen") return <Popover key={id}><PopoverTrigger asChild>{compactTrigger(id)}</PopoverTrigger><PopoverContent align="center" className="w-72"><h3 className="font-display text-base font-bold">Stylo</h3><div className="mt-3 grid grid-cols-3 gap-2">{(["plume", "bille", "crayon"] as PenStyle[]).map((style) => <Button key={style} variant={penStyle === style ? "secondary" : "outline"} className="h-16 flex-col capitalize" onClick={() => { setPenStyle(style); setTool("pen"); }}><Pen />{style}</Button>)}</div><div className="mt-4">{colorChoices}</div><label className="mt-4 grid gap-2 text-sm font-semibold">Épaisseur <input type="range" min={1} max={16} value={size} onChange={(e) => setSize(Number(e.target.value))} /></label></PopoverContent></Popover>;
    if (id === "highlighter") return <Popover key={id}><PopoverTrigger asChild>{compactTrigger(id)}</PopoverTrigger><PopoverContent align="center" className="w-72"><h3 className="font-display text-base font-bold">Surligneur</h3><div className="mt-3 grid grid-cols-2 gap-2">{(["plat", "fin"] as PenStyle[]).map((style) => <Button key={style} variant={hlStyle === style ? "secondary" : "outline"} className="h-16 flex-col capitalize" onClick={() => { setHlStyle(style); setHlSize(style === "plat" ? 6 : 3); setTool("highlighter"); }}><span className={cn("block w-10 opacity-60", style === "plat" ? "h-3" : "h-1.5 rounded-full")} style={{ backgroundColor: hlColor }} />{style}</Button>)}</div><div className="mt-4">{swatches(HIGHLIGHT_COLORS, hlColor, (c) => { setHlColor(c); setTool("highlighter"); })}</div><label className="mt-4 grid gap-2 text-sm font-semibold">Épaisseur <input type="range" min={1} max={12} value={hlSize} onChange={(e) => setHlSize(Number(e.target.value))} /></label><div className="mt-3 h-8 border bg-card px-3 py-2"><span className="block h-full opacity-40" style={{ backgroundColor: hlColor, height: Math.max(3, hlSize * 2) }} /></div></PopoverContent></Popover>;
    if (id === "eraser") return <Popover key={id}><PopoverTrigger asChild>{compactTrigger(id)}</PopoverTrigger><PopoverContent align="center" className="w-80"><h3 className="font-display text-base font-bold">Gomme</h3><div className="mt-3 grid grid-cols-4 gap-2">{[1,2,3,5].map((value) => <Button key={value} variant={eraserSize === value ? "secondary" : "outline"} size="icon" className={cn("rounded-full", value === 1 ? "size-8" : value === 2 ? "size-10" : value === 3 ? "size-12" : "size-14")} aria-label={`Taille de gomme ${value}`} onClick={() => { setEraserSize(value); setTool("eraser"); }}><span className="sr-only">{value}</span></Button>)}</div><div className="mt-4 space-y-1 border-t pt-3">{([['stroke','Effacer tout le trait'],['highlighter','Effacer le surligneur uniquement'],['pen','Effacer le crayon uniquement']] as [EraserMode,string][]).map(([mode,label]) => <label key={mode} className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3 py-2 text-sm"><span>{label}</span><Switch checked={eraserMode === mode} onCheckedChange={() => { setEraserMode(mode); setTool("eraser"); }} /></label>)}</div><Button variant="ghost" className="mt-2 w-full justify-start text-destructive" onClick={clearPage}><Trash2 />Effacer la page</Button></PopoverContent></Popover>;
    if (SHAPE_TOOLS.includes(id as ShapeTool)) { const ActiveIcon = TOOL_META[id].Icon; return <Popover key={id}><PopoverTrigger asChild>{compactTrigger(id, ActiveIcon)}</PopoverTrigger><PopoverContent align="center" className="w-72"><h3 className="font-display text-base font-bold">Formes et lignes</h3><div className="mt-3 grid grid-cols-4 gap-2">{SHAPE_TOOLS.map((shape) => { const ShapeIcon = TOOL_META[shape].Icon; return <Button key={shape} variant={tool === shape ? "secondary" : "ghost"} size="icon" className="size-11" title={TOOL_META[shape].label} aria-label={TOOL_META[shape].label} onClick={() => setTool(shape)}><ShapeIcon /></Button>; })}</div><div className="mt-4">{colorChoices}</div><label className="mt-4 grid gap-2 text-sm font-semibold">Contour <input type="range" min={1} max={16} value={size} onChange={(e) => setSize(Number(e.target.value))} /></label><label className="mt-3 grid gap-2 text-sm font-semibold">Remplissage<select value={fill} onChange={(e) => setFill(e.target.value)} className="h-10 border bg-background px-2"><option value="transparent">Aucun</option>{QUICK_COLORS.map((value, i) => <option key={value} value={value}>Couleur {i + 1}</option>)}</select></label></PopoverContent></Popover>; }
    if (id === "text") return <Popover key={id}><PopoverTrigger asChild>{compactTrigger(id)}</PopoverTrigger><PopoverContent align="center" className="w-80"><h3 className="font-display text-base font-bold">Texte</h3><p className="mt-1 text-xs text-muted-foreground">Touche la page pour écrire une note, ou insère un clip enregistré.</p><div className="mt-3">{colorChoices}</div><label className="mt-4 grid gap-2 text-sm font-semibold">Taille <input type="range" min={1} max={16} value={size} onChange={(e) => setSize(Number(e.target.value))} /></label><div className="mt-4 border-t pt-3"><div className="flex items-center justify-between"><h4 className="text-sm font-bold">Clips enregistrés</h4><Button variant="ghost" size="sm" onClick={saveClip}><Plus />Nouveau</Button></div>{clips.length === 0 ? <p className="mt-2 text-xs text-muted-foreground">Aucun clip pour l’instant. Crée-en un pour le réutiliser sur tes pages.</p> : <div className="mt-2 space-y-1">{clips.map((clip) => <div key={clip} className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-1 border bg-card px-2 py-1.5"><button className="truncate text-left text-xs" title="Insérer sur la page" onClick={() => { setPageMarks([...(marks[idx] ?? []), { id: uid(), type: "text", color, size: size * 6, x: 0.15, y: 0.18, text: clip }]); toast.success("Clip inséré sur la page"); }}>{clip}</button><Button variant="ghost" size="icon" className="size-7 text-destructive" aria-label={`Supprimer le clip ${clip}`} onClick={() => setClips((value) => value.filter((item) => item !== clip))}><Trash2 className="size-3.5" /></Button></div>)}</div>}</div></PopoverContent></Popover>;
    return <span key={id}>{compactTrigger(id)}</span>;
  };

  return <div className="flex h-dvh flex-col overflow-hidden bg-muted">
    <header className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-2 border-b bg-background px-2 py-2 pt-[max(0.5rem,env(safe-area-inset-top))] sm:px-4">
      <div className="flex min-w-0 items-center gap-2"><Button asChild variant="ghost" size="icon" className="shrink-0" aria-label="Retour aux dossiers"><Link to="/"><ArrowLeft /></Link></Button><h1 className="truncate text-sm font-semibold">{title}</h1><span className="hidden text-xs text-muted-foreground sm:inline">{idx + 1} / {pages.length}</span></div>
      <div className="flex shrink-0 items-center gap-1"><Button variant="ghost" size="icon" aria-label="Annuler" onClick={undo} disabled={!past.length}><Undo2 /></Button><Button variant="ghost" size="icon" aria-label="Rétablir" onClick={redo} disabled={!future.length}><Redo2 /></Button><Button variant="ghost" size="icon" aria-label="Multivue des pages" onClick={() => setPagesPanel(true)}><LayoutGrid /></Button><Button variant="ghost" size="icon" className={cn("hidden lg:inline-flex", showPagesAside && "text-amber-strong")} aria-label={showPagesAside ? "Masquer les pages" : "Afficher les pages"} onClick={() => setShowPagesAside((value) => !value)}><PanelLeft /></Button>
        <DropdownMenu><DropdownMenuTrigger asChild><Button variant="ghost" size="icon" aria-label="Plus d’options"><MoreHorizontal /></Button></DropdownMenuTrigger><DropdownMenuContent align="end" className="w-72">
          <DropdownMenuLabel>Page</DropdownMenuLabel><DropdownMenuItem onClick={goToPage}><FileText />Aller à la page <span className="ml-auto text-xs text-muted-foreground">{idx + 1}/{pages.length}</span></DropdownMenuItem><DropdownMenuItem onClick={() => void addBlank()}><FilePlus2 />Ajouter une page</DropdownMenuItem><DropdownMenuItem onClick={duplicatePage}><Copy />Dupliquer la page</DropdownMenuItem><DropdownMenuItem onClick={rotatePage}><Redo2 />Faire pivoter la page</DropdownMenuItem><DropdownMenuItem onClick={toggleBookmark}>{bookmarks.includes(idx) ? <BookmarkCheck /> : <Bookmark />} {bookmarks.includes(idx) ? "Retirer le marque-page" : "Ajouter un marque-page"}</DropdownMenuItem><DropdownMenuItem className="text-destructive" onClick={deletePage}><Trash2 />Supprimer la page</DropdownMenuItem>
          <DropdownMenuSeparator /><DropdownMenuLabel>Partager et enregistrer</DropdownMenuLabel><DropdownMenuItem onClick={() => void exportImage(true)}><FileImage />Enregistrer la page en PNG</DropdownMenuItem><DropdownMenuItem onClick={() => void sharePage()}><Share2 />Partager la page</DropdownMenuItem><DropdownMenuItem onClick={() => void exportPdf()}><Download />Exporter le cahier en PDF</DropdownMenuItem>
          <DropdownMenuSeparator /><DropdownMenuLabel>Cahier</DropdownMenuLabel><DropdownMenuItem onClick={() => fileRef.current?.click()}><FileUp />Importer un média</DropdownMenuItem><DropdownMenuItem onClick={() => photoRef.current?.click()}><FileImage />Ajouter une photo</DropdownMenuItem><DropdownMenuItem onClick={() => setPagesPanel(true)}><LayoutGrid />Multivue des pages</DropdownMenuItem><DropdownMenuItem onClick={() => setPanel(true)}><MessageCircleQuestion />Demander à Clario</DropdownMenuItem>
          <DropdownMenuSeparator /><DropdownMenuLabel>Paramètres</DropdownMenuLabel><DropdownMenuSub><DropdownMenuSubTrigger><MoveHorizontal />Affichage de la page</DropdownMenuSubTrigger><DropdownMenuSubContent><DropdownMenuItem onClick={() => setFit("width")}><MoveHorizontal />Adapter à la largeur</DropdownMenuItem><DropdownMenuItem onClick={() => setFit("page")}><Maximize2 />Afficher la page entière</DropdownMenuItem><DropdownMenuItem onClick={() => { setFit("custom"); setZoom((value) => Math.max(40, value - 10)); }}><Minus />Réduire le zoom</DropdownMenuItem><DropdownMenuItem onClick={() => { setFit("custom"); setZoom((value) => Math.min(250, value + 10)); }}><Plus />Agrandir le zoom</DropdownMenuItem></DropdownMenuSubContent></DropdownMenuSub><DropdownMenuSub><DropdownMenuSubTrigger><MoveHorizontal />Direction du défilement</DropdownMenuSubTrigger><DropdownMenuSubContent><DropdownMenuRadioGroup value={scrollDirection} onValueChange={(value) => setScrollDirection(value as ScrollDirection)}><DropdownMenuRadioItem value="vertical">Vertical</DropdownMenuRadioItem><DropdownMenuRadioItem value="horizontal">Horizontal</DropdownMenuRadioItem></DropdownMenuRadioGroup></DropdownMenuSubContent></DropdownMenuSub><DropdownMenuCheckboxItem checked={penOnly} onCheckedChange={(value) => setPenOnly(Boolean(value))}><Hand />Stylet seulement</DropdownMenuCheckboxItem><DropdownMenuItem onClick={() => setCustomize(true)}><Settings2 />Personnaliser la barre</DropdownMenuItem><DropdownMenuItem onClick={() => toast.info(`${title} · ${pages.length} page(s) · annotations enregistrées sur cet appareil`)}><Info />Informations du document</DropdownMenuItem>
        </DropdownMenuContent></DropdownMenu>
      </div>
    </header>

    <div className={cn("grid min-h-0 flex-1", showPagesAside ? "lg:grid-cols-[132px_minmax(0,1fr)]" : "lg:grid-cols-[minmax(0,1fr)]")}>
      {showPagesAside && <aside className="hidden overflow-y-auto border-r bg-background p-3 lg:block" aria-label="Pages"><div className="mb-3 grid grid-cols-[1fr_auto] gap-1"><Button variant="outline" size="sm" onClick={() => void addBlank()}><Plus />Page</Button><Button variant="ghost" size="icon" onClick={() => setShowPagesAside(false)} aria-label="Masquer les pages"><PanelLeftClose /></Button></div>{pages.map((src, pageIndex) => <button key={`${src}-${pageIndex}`} onClick={() => setIdx(pageIndex)} className="mb-3 block w-full text-center text-xs font-medium"><span className={cn("relative block overflow-hidden border-2 bg-card p-1", idx === pageIndex ? "border-amber-strong" : "border-transparent")}><img src={src} alt={`Page ${pageIndex + 1}`} className="aspect-[3/4] w-full object-cover" />{bookmarks.includes(pageIndex) && <BookmarkCheck className="absolute right-1 top-1 size-4 fill-school-yellow text-school-yellow-strong" />}</span><span className="mt-1 block">{pageIndex + 1}</span></button>)}</aside>}
      <section className="flex min-w-0 flex-col overflow-hidden"><input ref={fileRef} type="file" accept="application/pdf,image/*,video/*,audio/*" hidden onChange={(e) => { void importMedia(e.target.files?.[0]); e.target.value = ""; }} /><input ref={photoRef} type="file" accept="image/*" hidden onChange={(e) => { void addPhoto(e.target.files?.[0]); e.target.value = ""; }} />
        <div className="flex min-h-14 shrink-0 items-center justify-center gap-1 overflow-x-auto border-b bg-background px-2 py-1.5">{shortcuts.map(toolButton)}<DropdownMenu><DropdownMenuTrigger asChild><Button variant="ghost" size="icon" className="size-10 shrink-0" aria-label="Autres outils"><MoreHorizontal /></Button></DropdownMenuTrigger><DropdownMenuContent align="center"><DropdownMenuItem onClick={() => setCustomize(true)}><Settings2 />Personnaliser la barre</DropdownMenuItem><DropdownMenuItem onClick={() => setTool("ruler")}><Ruler />Règle</DropdownMenuItem><DropdownMenuItem onClick={() => setTool("rectangle")}><Square />Formes</DropdownMenuItem><DropdownMenuItem onClick={() => setEmojiOpen(true)}><Smile />Émoticônes</DropdownMenuItem><DropdownMenuItem onClick={saveClip}><Copy />Nouveau clip</DropdownMenuItem></DropdownMenuContent></DropdownMenu>
        </div>
        <main ref={pageArea} onTouchStart={onSwipeStart} onTouchEnd={onSwipeEnd} className={cn("min-h-0 flex-1 overflow-auto p-2 sm:p-5", scrollDirection === "horizontal" && "overflow-x-auto")}><div className="grid min-h-full place-items-center"><div style={{ width: pageWidth }} className="mx-auto transition-[width]"><DrawingPage src={pages[idx] ?? samplePage} marks={marks[idx] ?? []} onChange={setPageMarks} tool={tool} color={tool === "highlighter" ? hlColor : color} fill={fill} size={tool === "highlighter" ? hlSize : size} penStyle={tool === "highlighter" ? hlStyle : penStyle} eraserMode={eraserMode} eraserSize={eraserSize} penOnly={penOnly} rotation={rotations[idx] ?? 0} onPen={() => setPenOnly(true)} /></div></div></main>
        {media.some((m) => m.page === idx) && <div className="flex shrink-0 gap-2 overflow-x-auto border-t bg-background p-2">{media.filter((m) => m.page === idx).map((m) => <div key={m.id} className="grid shrink-0 grid-cols-[minmax(0,1fr)_auto] items-center gap-1 rounded-md border bg-card p-1.5">{m.type.startsWith("video/") ? <video src={mediaUrls[m.id]} controls playsInline className="h-28 max-w-[260px] rounded-sm bg-muted" /> : <audio src={mediaUrls[m.id]} controls className="h-10 w-64" />}<Button size="icon" variant="ghost" className="size-8" aria-label={`Retirer ${m.name}`} onClick={() => void deleteMedia(m.id)}><Trash2 /></Button><small className="col-span-2 max-w-[260px] truncate text-xs text-muted-foreground">{m.name}</small></div>)}</div>}
        <footer className="grid shrink-0 grid-cols-[auto_auto_auto_minmax(0,1fr)] items-center gap-1 border-t bg-background px-2 py-1.5 pb-[max(0.375rem,env(safe-area-inset-bottom))]"><Button size="icon" variant="ghost" aria-label="Page précédente" disabled={idx === 0} onClick={() => setIdx(idx - 1)}><ChevronLeft /></Button><Button variant="ghost" className="text-xs" onClick={() => setPagesPanel(true)}>Page {idx + 1} / {pages.length}</Button><Button size="icon" variant="ghost" aria-label="Page suivante" disabled={idx >= pages.length - 1} onClick={() => setIdx(idx + 1)}><ChevronRight /></Button><Button className="justify-self-end" onClick={() => setPanel(true)}><MessageCircleQuestion />Clario</Button></footer>
      </section>
    </div>

    <Sheet open={panel} onOpenChange={setPanel}><SheetContent side="bottom" className="max-h-[85dvh] overflow-y-auto"><SheetHeader><SheetTitle>Demander à Clario</SheetTitle></SheetHeader><AnalysisPanel selected={selectedElements} setSelected={setSelectedElements} onClear={clearPage} /></SheetContent></Sheet>
    <Sheet open={pagesPanel} onOpenChange={setPagesPanel}><SheetContent side="bottom" className="h-[88dvh] overflow-y-auto"><SheetHeader><SheetTitle>Pages du cahier</SheetTitle></SheetHeader><div className="mt-4 grid grid-cols-[minmax(0,1fr)_auto] gap-2"><label className="flex items-center gap-2 border bg-background px-3"><Search className="size-4" /><input value={pageQuery} onChange={(e) => setPageQuery(e.target.value)} placeholder="Rechercher une page…" className="h-10 min-w-0 flex-1 bg-transparent outline-none" /></label><Button onClick={() => void addBlank()}><Plus />Page</Button></div><div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-5 lg:grid-cols-7">{visiblePages.map(({ src, i }) => <div key={`${src}-${i}`} className={cn("border bg-card p-2", i === idx && "border-amber-strong")}><button className="relative block w-full" onClick={() => { setIdx(i); setPagesPanel(false); }}><img src={src} alt={`Page ${i + 1}`} className="aspect-[3/4] w-full object-cover" />{bookmarks.includes(i) && <BookmarkCheck className="absolute right-1 top-1 size-5 fill-school-yellow text-school-yellow-strong" />}</button><div className="mt-2 grid grid-cols-[minmax(0,1fr)_auto] items-center"><span className="text-xs font-semibold">Page {i + 1}</span><DropdownMenu><DropdownMenuTrigger asChild><Button variant="ghost" size="icon" className="size-7"><MoreHorizontal /></Button></DropdownMenuTrigger><DropdownMenuContent align="end"><DropdownMenuItem disabled={i === 0} onClick={() => movePage(i, -1)}><ArrowUp />Déplacer avant</DropdownMenuItem><DropdownMenuItem disabled={i === pages.length - 1} onClick={() => movePage(i, 1)}><ArrowDown />Déplacer après</DropdownMenuItem><DropdownMenuItem onClick={() => toggleBookmarkAt(i)}><Bookmark />Marque-page</DropdownMenuItem></DropdownMenuContent></DropdownMenu></div></div>)}</div></SheetContent></Sheet>
    <Sheet open={customize} onOpenChange={setCustomize}><SheetContent side="right" className="w-[min(92vw,420px)] overflow-y-auto"><SheetHeader><SheetTitle>Personnaliser la barre</SheetTitle></SheetHeader><p className="mt-2 text-sm text-muted-foreground">Choisis tes raccourcis et place-les dans l’ordre voulu. Un outil ne peut apparaître qu’une seule fois.</p><div className="mt-5 space-y-2">{Object.entries(TOOL_META).map(([id, meta]) => { const toolId = id as Tool; const active = shortcuts.includes(toolId); const position = shortcuts.indexOf(toolId); const Icon = meta.Icon; return <div key={id} className="grid grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-3 border bg-card p-3"><Icon className="size-5" /><span className="text-sm font-semibold">{meta.label}</span><div className="flex items-center gap-1">{active && <><Button variant="ghost" size="icon" className="size-8" disabled={position === 0} onClick={() => reorderShortcut(toolId, -1)} aria-label={`Déplacer ${meta.label} avant`}><ArrowUp /></Button><Button variant="ghost" size="icon" className="size-8" disabled={position === shortcuts.length - 1} onClick={() => reorderShortcut(toolId, 1)} aria-label={`Déplacer ${meta.label} après`}><ArrowDown /></Button></>}<Button variant={active ? "secondary" : "outline"} size="sm" onClick={() => setShortcuts((value) => active ? value.filter((item) => item !== toolId) : [...value, toolId])}>{active ? "Retirer" : "Ajouter"}</Button></div></div>; })}</div><div className="mt-6"><h3 className="text-sm font-bold">Autres raccourcis</h3><div className="mt-2 grid grid-cols-2 gap-2"><Button variant="outline" onClick={toggleBookmark}><Bookmark />Favoris</Button><Button variant="outline" onClick={() => void addBlank()}><FilePlus2 />Ajouter page</Button><Button variant="outline" onClick={() => setPagesPanel(true)}><LayoutGrid />Multivue</Button><Button variant="outline" onClick={() => setEmojiOpen(true)}><Smile />Émoticônes</Button><Button variant="outline" onClick={saveClip}><Copy />Nouveau clip</Button></div></div><Button className="mt-6 w-full" onClick={() => setCustomize(false)}>Terminé</Button></SheetContent></Sheet>
    <Sheet open={emojiOpen} onOpenChange={setEmojiOpen}><SheetContent side="bottom" className="flex h-[80dvh] flex-col"><SheetHeader><SheetTitle>Émoticônes</SheetTitle></SheetHeader>
      <div className="flex min-h-0 flex-1 flex-col overflow-hidden px-1 pb-2">
        <label className="flex shrink-0 items-center gap-2 border bg-background px-3"><Search className="size-4" /><input value={emojiQuery} onChange={(e) => setEmojiQuery(e.target.value)} placeholder="Rechercher…" className="h-10 min-w-0 flex-1 bg-transparent text-sm outline-none" /></label>
        {!emojiQuery && <div className="mt-3 flex shrink-0 gap-2 overflow-x-auto pb-1">{EMOJI_CATEGORIES.map((cat) => <Button key={cat.id} variant={emojiCat === cat.id ? "secondary" : "outline"} size="sm" className="shrink-0" onClick={() => setEmojiCat(cat.id)}>{cat.label}</Button>)}</div>}
        <div className="mt-3 min-h-0 flex-1 overflow-y-auto">
          {(() => { const query = emojiQuery.trim().toLowerCase();
            const cats = query ? EMOJI_CATEGORIES.map((cat) => ({ ...cat, items: cat.items.filter((item) => item.name.toLowerCase().includes(query) || item.char === emojiQuery.trim()) })).filter((cat) => cat.items.length) : EMOJI_CATEGORIES.filter((cat) => cat.id === emojiCat);
            if (!cats.length) return <p className="p-6 text-center text-sm text-muted-foreground">Aucun émoticône trouvé pour « {emojiQuery} ».</p>;
            return cats.map((cat) => <div key={cat.id} className="mb-4"><p className="mb-2 text-xs font-bold uppercase tracking-wide text-muted-foreground">{query ? cat.label : ""}</p><div className="grid grid-cols-8 gap-1 sm:grid-cols-12">{cat.items.map((item) => <button key={item.name} onClick={() => insertEmoji(item.char)} className="grid aspect-square place-items-center rounded text-2xl transition-colors hover:bg-muted" title={item.name} aria-label={item.name}>{item.char}</button>)}</div></div>);
          })()}
        </div>
      </div>
      </SheetContent>
    </Sheet>
    {loading && <div className="fixed inset-0 z-50 grid place-items-center bg-background/80"><div className="border bg-card p-5 text-sm font-semibold shadow-lg"><FileUp className="mx-auto mb-2 animate-bounce" />Ouverture du document…</div></div>}
  </div>;
}