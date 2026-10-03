import { tf } from "@/lib/i18n";
import { useEffect, useState } from "react";
import { Check, Plus, X } from "lucide-react";
import { cn } from "@/lib/utils";

const STORAGE_KEY = "clario-custom-colors";
const EVENT = "clario-custom-colors-changed";

function hslToHex(h: number, s: number, l: number) {
  const a = s * Math.min(l, 1 - l);
  const f = (n: number) => { const k = (n + h / 30) % 12; const c = l - a * Math.max(-1, Math.min(k - 3, 9 - k, 1)); return Math.round(c * 255).toString(16).padStart(2, "0"); };
  return `#${f(0)}${f(8)}${f(4)}`;
}

// Grille de nuances unies (aucun dégradé) : 12 teintes × 5 clartés + une rangée de gris.
const HUES = [0, 20, 38, 50, 75, 120, 160, 190, 210, 235, 270, 310];
const LIGHTS = [0.3, 0.42, 0.55, 0.72, 0.86];
export const COLOR_GRID: string[][] = [
  ["#000000", "#2b2540", "#4a4458", "#6e6a78", "#9a96a3", "#c4c1cc", "#e3e1e8", "#ffffff"],
  ...LIGHTS.map((l) => HUES.map((h) => hslToHex(h, l > 0.8 ? 0.85 : 0.68, l))),
];

function readCustom(): string[] { try { const v = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? "[]"); return Array.isArray(v) ? v.filter((c) => typeof c === "string" && /^#[0-9a-f]{6}$/i.test(c)).slice(0, 16) : []; } catch { return []; } }

export function useCustomColors() {
  const [colors, setColors] = useState<string[]>(readCustom);
  useEffect(() => { const sync = () => setColors(readCustom()); window.addEventListener(EVENT, sync); window.addEventListener("storage", sync); return () => { window.removeEventListener(EVENT, sync); window.removeEventListener("storage", sync); }; }, []);
  const save = (next: string[]) => { try { localStorage.setItem(STORAGE_KEY, JSON.stringify(next)); } catch { /* stockage indisponible */ } setColors(next); window.dispatchEvent(new Event(EVENT)); };
  return { colors, add: (c: string) => save([c.toLowerCase(), ...colors.filter((x) => x.toLowerCase() !== c.toLowerCase())].slice(0, 16)), remove: (c: string) => save(colors.filter((x) => x !== c)) };
}

function Dot({ color, active, onClick, label }: { color: string; active: boolean; onClick: () => void; label: string }) {
  return <button type="button" aria-label={label} aria-pressed={active} title={color} onClick={onClick}
    className={cn("grid size-8 shrink-0 place-items-center rounded-full border-2 transition-transform active:scale-95", active ? "border-foreground" : "border-transparent")}>
    <span className="grid size-6 place-items-center rounded-full border border-border" style={{ backgroundColor: color }}>{active && <Check className="size-3.5 text-background mix-blend-difference" />}</span>
  </button>;
}

/** Palette intégrée à Clario : couleurs rapides, couleurs enregistrées et grille de nuances. Jamais la fenêtre native du téléphone. */
export function ColorPalette({ quick, value, onChange }: { quick: string[]; value: string; onChange: (c: string) => void }) {
  const { colors: custom, add, remove } = useCustomColors();
  const [open, setOpen] = useState(false); const [draft, setDraft] = useState(value); const [hex, setHex] = useState(value);
  const [editMine, setEditMine] = useState(false);
  const same = (a: string, b: string) => a.toLowerCase() === b.toLowerCase();
  const pickDraft = (c: string) => { setDraft(c); setHex(c); onChange(c); };
  return <div className="space-y-3">
    <div className="flex flex-wrap items-center gap-1">{quick.map((c, i) => <Dot key={c} color={c} active={same(value, c)} label={tf("Couleur {0}", [i + 1])} onClick={() => onChange(c)} />)}
      <button type="button" aria-label={tf("Plus de couleurs")} aria-expanded={open} onClick={() => { setOpen((o) => !o); setDraft(value); setHex(value); }} className={cn("grid size-8 place-items-center rounded-full border-2 border-dashed", open ? "border-foreground" : "border-border")}><Plus className="size-4" /></button></div>
    {custom.length > 0 && <div><div className="mb-1 flex items-center justify-between"><span className="text-xs font-semibold text-muted-foreground">{tf("Mes couleurs")}</span><button type="button" className="text-xs font-semibold text-muted-foreground underline" onClick={() => setEditMine((v) => !v)}>{editMine ? tf("Terminé") : tf("Modifier")}</button></div>
      <div className="flex flex-wrap gap-1">{custom.map((c) => <span key={c} className="relative"><Dot color={c} active={same(value, c)} label={tf("Ma couleur {0}", [c])} onClick={() => onChange(c)} />{editMine && <button type="button" aria-label={tf("Retirer {0}", [c])} onClick={() => remove(c)} className="absolute -right-1 -top-1 grid size-4 place-items-center rounded-full bg-foreground text-background"><X className="size-3" /></button>}</span>)}</div></div>}
    {open && <div className="border-t pt-3">
      <div className="grid gap-[3px]" style={{ gridTemplateColumns: "repeat(12, minmax(0, 1fr))" }}>
        {COLOR_GRID[0]?.map((c) => <button key={c} type="button" aria-label={tf("Nuance {0}", [c])} onClick={() => pickDraft(c)} className={cn("col-span-1 aspect-square rounded-sm border", same(draft, c) ? "ring-2 ring-foreground ring-offset-1" : "border-border")} style={{ backgroundColor: c }} />)}
        {Array.from({ length: 12 - (COLOR_GRID[0]?.length ?? 0) }).map((_, i) => <span key={`pad-${i}`} />)}
        {COLOR_GRID.slice(1).flat().map((c, i) => <button key={`${c}-${i}`} type="button" aria-label={tf("Nuance {0}", [c])} onClick={() => pickDraft(c)} className={cn("aspect-square rounded-sm", same(draft, c) && "ring-2 ring-foreground ring-offset-1")} style={{ backgroundColor: c }} />)}
      </div>
      <div className="mt-3 flex items-center gap-2"><span className="size-8 shrink-0 rounded-full border" style={{ backgroundColor: draft }} />
        <input value={hex} onChange={(e) => { const v = e.target.value.trim(); setHex(v); const full = /^#?[0-9a-f]{6}$/i.test(v) ? (v.startsWith("#") ? v : `#${v}`) : null; if (full) pickDraft(full.toLowerCase()); }} aria-label={tf("Code couleur")} className="h-8 min-w-0 flex-1 border bg-background px-2 font-mono text-xs uppercase" maxLength={7} />
        <button type="button" onClick={() => { add(draft); onChange(draft); setOpen(false); }} className="h-8 shrink-0 rounded-md bg-primary px-3 text-xs font-semibold text-primary-foreground">{tf("Enregistrer")}</button></div>
    </div>}
  </div>;
}
