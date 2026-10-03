import { ICON_WASH, ICONS } from "@/lib/board-icons";
import { PROCEDURAL_ICON_CATALOG } from "@/lib/procedural-icon-catalog";
import { proceduralGraphic } from "@/lib/procedural-icon-renderer";
import type { Board, BoardElement } from "@/lib/lesson-types";
import { cn } from "@/lib/utils";
import { MathFormula } from "@/components/math-formula";
import { TeacherHost } from "./teacher-host";
import { resolveCharacter } from "@/lib/character-catalog";

const TONES = [
  { blob: "fill-school-yellow", border: "border-school-yellow-strong", soft: "bg-school-yellow-soft", softFill: "fill-school-yellow-soft", line: "stroke-school-yellow-strong" },
  { blob: "fill-school-green", border: "border-school-green", soft: "bg-school-green-soft", softFill: "fill-school-green-soft", line: "stroke-school-green" },
  { blob: "fill-school-purple", border: "border-school-purple", soft: "bg-school-purple-soft", softFill: "fill-school-purple-soft", line: "stroke-school-purple" },
];


type Placed = { el: BoardElement; i: number; x: number; y: number; w: number; n?: number; h?: number };

const GLYPH: Record<string, string> = {
  check: "✓", cross: "✗", question: "?", warning: "!", star: "★",
  plus: "+", minus: "−", equals: "=", percent: "%", up: "↑", down: "↓",
};

// Deterministic slots per layout archetype (percent of the 16:9 board).
function place(board: Board) {
  const content = board.elements.map((el, i) => ({ el, i })).filter((e) => e.el.kind !== "rule" && e.el.kind !== "host");
  const rule = board.elements.map((el, i) => ({ el, i })).find((e) => e.el.kind === "rule");
  const cy = rule ? 50 : 55;
  const items: Placed[] = [];
  const arrows: { from: Placed; to: Placed; vertical: boolean }[] = [];
  let divider = false;
  const n = content.length;

  if (board.layout === "comparison") {
    divider = true;
    const half = Math.ceil(n / 2);
    [0, 1].forEach((g) => {
      const col = content.filter((e, k) => (e.el.group ?? (k < half ? 0 : 1)) === g);
      const heads = col.filter((e) => e.el.kind !== "icon");
      const icons = col.filter((e) => e.el.kind === "icon");
      heads.forEach((e, k) => items.push({ ...e, x: 25 + 50 * g, y: 25 + k * 9, w: 42 }));
      const m = Math.max(1, icons.length);
      const w = Math.min(19, 40 / m);
      icons.forEach((e, k) => items.push({ ...e, x: 50 * g + 5 + (40 / m) * (k + 0.5), y: heads.length ? 58 + (heads.length - 1) * 4 : cy, w }));
    });
  } else if (board.layout === "hierarchy" && n > 1) {
    const top: Placed = { ...content[0]!, x: 50, y: 30, w: 17 };
    items.push(top);
    const rest = content.slice(1);
    const w = Math.min(19, 84 / rest.length);
    rest.forEach((e, k) => {
      const p = { ...e, x: 8 + (84 / rest.length) * (k + 0.5), y: 67, w };
      items.push(p);
      arrows.push({ from: top, to: p, vertical: true });
    });
  } else if (board.layout === "timeline" && n > 1) {
    // One baseline, items alternating above and below it. Flow is carried by
    // chevron ticks on the baseline (rendered in the SVG layer), not arrows.
    content.forEach((e, k) => {
      const above = k % 2 === 0;
      items.push({ ...e, x: 8 + (84 / n) * (k + 0.5), y: above ? 30 : 70, w: Math.min(19, 84 / n) });
    });

  } else if (board.layout === "cycle" && n > 1) {
    // Items on a circle with curved loop arrows.
    const R = 27;
    content.forEach((e, k) => {
      const ang = -Math.PI / 2 + (2 * Math.PI * k) / n;
      items.push({ ...e, x: 50 + R * Math.cos(ang), y: 55 + R * 0.9 * Math.sin(ang), w: 19, n: k + 1 });
    });
  } else if (board.layout === "chart" && n > 0) {
    const bars = content.filter((e) => e.el.kind !== "text");
    const max = Math.max(...bars.map((e) => e.el.value ?? 1), 1e-9);
    bars.forEach((e, k) => {
      const w = Math.min(16, 84 / bars.length);
      const h = Math.max(6, ((e.el.value ?? max) / max) * 42);
      items.push({ ...e, x: 8 + (84 / bars.length) * (k + 0.5), y: 72 - h / 2, w, h });
    });
  } else {
    const w = Math.min(21, 86 / Math.max(1, n));
    content.forEach((e, k) => {
      const p: Placed = { ...e, x: 7 + (86 / n) * (k + 0.5), y: cy, w, ...(board.layout === "steps" ? { n: k + 1 } : {}) };
      const prev = items[items.length - 1];
      items.push(p);
      if (prev && (board.layout === "pipeline" || board.layout === "steps")) arrows.push({ from: prev, to: p, vertical: false });
    });
  }
  return { items, arrows, divider, rule };
}


export function WhiteboardBoard({ board, visible, paused }: { board: Board; visible: boolean[]; paused: boolean }) {
  const { items, arrows, divider, rule } = place(board);
  const shown = (i: number) => visible[i] === true;
  // When the closing teacher is on the board, the diagram steps aside so she gets the spotlight.
  const outro = board.elements.some((el, i) => el.kind === "host" && el.group === 1 && shown(i));

  return (
    <div className={cn("wb-root @container absolute inset-0 text-whiteboard-ink", paused && "wb-paused")}>
      {/* Heading written by hand at the top */}
      <div className="absolute left-[4%] top-[5%] max-w-[80%]">
        <p className="wb-write font-hand text-[3.6cqw] font-bold leading-tight">{board.heading}</p>
        <svg viewBox="0 0 100 4" preserveAspectRatio="none" className="mt-[0.3cqw] h-[0.9cqw] w-full overflow-visible">
          <path d="M1 2 Q30 0.5 55 2.2 T99 1.6" pathLength={1} className="wb-stroke stroke-school-yellow-strong" fill="none" strokeWidth={1.4} strokeLinecap="round" style={{ animationDelay: "0.6s" }} />
        </svg>
      </div>

      <svg viewBox="0 0 160 90" className={cn("pointer-events-none absolute inset-0 size-full", outro && "opacity-0 transition-opacity duration-500")} fill="none" strokeLinecap="round" strokeLinejoin="round">

        {divider && <path d="M80 22 V70" pathLength={1} className="wb-stroke stroke-current" strokeWidth={0.5} strokeDasharray="1" />}
        {board.layout === "timeline" && <path d="M5 45 H155" pathLength={1} className="wb-stroke stroke-current" strokeWidth={0.7} strokeDasharray="2 1.2" />}
        {board.layout === "timeline" && items.map((p, k) => {
          const next = items[k + 1];
          if (!next || !shown(p.i) || !shown(next.i)) return null;
          const mx = (p.x * 1.6 + next.x * 1.6) / 2;
          return (
            <g key={`t${k}`} className="stroke-current" transform={`translate(${mx} 45)`}>
              <path d="M-1.6 -2 L0.6 0 L-1.6 2" pathLength={1} className="wb-stroke" strokeWidth={0.9} />
            </g>
          );
        })}

        {board.layout === "chart" && <path d="M4 64.8 H156" pathLength={1} className="wb-stroke stroke-current" strokeWidth={0.8} />}
        {board.layout === "cycle" && items.length > 1 && items.map((p, k) => {
          const next = items[(k + 1) % items.length]!;
          if (!shown(p.i) || !shown(next.i)) return null;
          const x1 = p.x * 1.6, y1 = p.y * 0.9, x2 = next.x * 1.6, y2 = next.y * 0.9;
          const mx = (x1 + x2) / 2, my = (y1 + y2) / 2;
          const ang = Math.atan2(y2 - y1, x2 - x1);
          const cx = mx + 7 * Math.cos(ang + Math.PI / 2), cyy = my + 7 * Math.sin(ang + Math.PI / 2);
          const r = 17;
          const sA = Math.atan2(cyy - y1, cx - x1), eA = Math.atan2(cyy - y2, cx - x2);
          const sx = x1 + r * Math.cos(sA), sy = y1 + r * Math.sin(sA);
          const ex = x2 + r * Math.cos(eA), ey = y2 + r * Math.sin(eA);
          return (
            <g key={`c${k}`} className={TONES[k % 3]!.line}>
              <path d={`M${sx} ${sy} Q${cx} ${cyy} ${ex} ${ey}`} pathLength={1} className="wb-stroke" strokeWidth={0.9} />
              <path d={arrowHead(ex, ey, Math.atan2(ey - cyy, ex - cx))} pathLength={1} className="wb-stroke" strokeWidth={0.9} style={{ animationDelay: "0.45s" }} />
            </g>
          );
        })}
        {arrows.filter((a) => shown(a.to.i)).map((a, k) => {

          const r = (p: Placed) => (p.w / 2) * 1.6 * 0.72;
          let d: string, head: string;
          if (a.vertical) {
            const x1 = a.from.x * 1.6, y1 = a.from.y * 0.9 + 11, x2 = a.to.x * 1.6, y2 = a.to.y * 0.9 - 12;
            d = `M${x1} ${y1} Q${(x1 + x2) / 2} ${(y1 + y2) / 2 + 3} ${x2} ${y2}`;
            const ang = Math.atan2(y2 - y1, x2 - x1);
            head = arrowHead(x2, y2, ang);
          } else {
            const x1 = a.from.x * 1.6 + r(a.from), x2 = a.to.x * 1.6 - r(a.to), y = a.to.y * 0.9 - 3;
            d = `M${x1} ${y} Q${(x1 + x2) / 2} ${y - 3} ${x2} ${y}`;
            head = arrowHead(x2, y, 0);
          }
          return (
            <g key={k} className={TONES[k % 3]!.line}>
              <path d={d} pathLength={1} className="wb-stroke" strokeWidth={0.9} />
              <path d={head} pathLength={1} className="wb-stroke" strokeWidth={0.9} style={{ animationDelay: "0.45s" }} />
            </g>
          );
        })}
      </svg>

      {items.filter((p) => shown(p.i)).map((p) => (
        <Item key={p.i} p={p} tone={p.i % 3} gone={outro} />
      ))}

      {board.elements.map((el, i) => {
        if (el.kind !== "host" || !shown(i)) return null;

        const wave = el.group !== 1;
        // The greeting leaves exactly when the first step starts being drawn.
        const gone = wave && items.some((p) => p.i > i && shown(p.i));


        return <TeacherHost key={`h${i}`} pose={wave ? "wave" : "thumbs"} text={el.text} gone={gone} />;
      })}

      {rule && shown(rule.i) && (
        <div className={cn("wb-pop absolute bottom-[5%] left-1/2 w-[82%] -translate-x-1/2 rounded-[1.4cqw] border-[0.25cqw] border-dashed px-[2cqw] py-[1cqw] text-center", TONES[0]!.border, TONES[0]!.soft, outro && "opacity-0 transition-opacity duration-500")}>

          <p className="wb-write font-hand text-[2.6cqw] font-bold leading-tight" style={{ animationDelay: "0.15s" }}>{rule.el.text}</p>
        </div>
      )}
    </div>
  );
}

function arrowHead(x: number, y: number, ang: number) {
  const s = 3;
  const a1 = ang + Math.PI * 0.8, a2 = ang - Math.PI * 0.8;
  return `M${x + s * Math.cos(a1)} ${y + s * Math.sin(a1)} L${x} ${y} L${x + s * Math.cos(a2)} ${y + s * Math.sin(a2)}`;
}

const WASH = { y: "fill-school-yellow", g: "fill-school-green", p: "fill-school-purple", w: "fill-white" } as const;

function Item({ p, tone, gone }: { p: Placed; tone: number; gone?: boolean }) {
  const t = TONES[tone]!;
  const wrap = cn("absolute -translate-x-1/2 -translate-y-1/2 text-center", gone && "wb-item-gone");
  const style = { left: `${p.x}%`, top: `${p.y}%`, width: `${p.w}%` };
  if (p.h !== undefined) {
    // Chart bar: grows up from the baseline (y=72 in board units), height is
    // a percentage of the board height — sized by the element's value.
    return (
      <div className="absolute" style={{ left: `${p.x}%`, bottom: "28%", width: `${Math.min(p.w, 14)}%`, height: `${p.h}%`, transform: "translateX(-50%)" }}>
        <div className={cn("wb-pop absolute bottom-0 left-1/2 w-[64%] -translate-x-1/2 rounded-t-[0.9cqw] border-[0.22cqw] border-b-0", t.border, t.soft)} style={{ height: "100%" }} />
        {p.el.text && <p className="wb-write absolute bottom-full left-1/2 mb-[0.3cqw] w-[140%] -translate-x-1/2 text-center font-hand text-[1.9cqw] font-bold leading-tight">{p.el.text}</p>}
      </div>
    );
  }

  if (p.el.kind === "badge") {
    const glyph = GLYPH[p.el.symbol ?? "check"] ?? "★";
    const bt = p.el.symbol === "warning" ? TONES[0]! : t; // warnings read best in the yellow tone

    return (
      <div className={wrap} style={style}>
        <div className={cn("wb-pop mx-auto grid aspect-square w-[58%] place-items-center rounded-full border-[0.28cqw]", bt.border, bt.soft)}>
          <span className="font-hand text-[5cqw] font-bold leading-none">{glyph}</span>
        </div>
        {p.el.text && <p className="wb-write mt-[0.5cqw] font-hand text-[2cqw] font-bold leading-tight">{p.el.text}</p>}
      </div>
    );
  }
  if (p.el.kind === "callout") {
    return (
      <div className={wrap} style={{ ...style, width: `${Math.max(p.w, 24)}%` }}>
        <div className={cn("wb-pop relative rounded-[1.2cqw] border-[0.25cqw] px-[1.4cqw] py-[1cqw]", t.border, t.soft)}>
          <p className="wb-write font-hand text-[2.2cqw] font-bold leading-tight">{p.el.text}</p>
          <svg viewBox="0 0 20 14" className="absolute left-[20%] top-full w-[3cqw] overflow-visible" fill="none">
            <path d="M1 0 L7 12 L13 1.5 Z" className={t.softFill} stroke="none" />
            <path d="M1 0 L7 12 L13 1.5" className={t.line} strokeWidth={1.4} strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </div>
      </div>
    );
  }

  if (p.el.kind === "illustration") {
    if (!p.el.svg) return null;
    // Approved library drawing: rendered as-is (its own style), mirrored to
    // face the middle when it sits on the right half of the board.
    return (
      <div className={wrap} style={style}>
        <div
          className={cn("wb-pop mx-auto w-[92%] overflow-visible [&>svg]:mx-auto [&>svg]:h-auto [&>svg]:w-full", p.x > 50 && "-scale-x-100")}
          style={{ animationDelay: "0.15s" }}
          dangerouslySetInnerHTML={{ __html: p.el.svg }}
        />
        {p.el.text && <p className="wb-write mt-[0.4cqw] font-hand text-[2cqw] font-bold leading-tight" style={{ animationDelay: "0.4s" }}>{p.el.text}</p>}
      </div>
    );
  }
  if (p.el.kind === "character") {
    const { paths } = resolveCharacter(p.el.role, p.el.pose);
    // Illustrations always face the middle of the board: anything placed on the
    // right half is mirrored horizontally so it looks toward the explanation.
    const mirrored = p.x > 50;
    return (
      <div className={wrap} style={style}>
        <svg viewBox="0 0 100 100" className={cn("mx-auto w-[58%] overflow-visible", mirrored && "-scale-x-100")} fill="none" strokeLinecap="round" strokeLinejoin="round">

          <circle cx="50" cy="56" r="36" className={cn("wb-blob opacity-40", t.blob)} />
          {paths.map((d, k) => (
            <path key={k} d={d} pathLength={1} className="wb-stroke stroke-current" strokeWidth={3.2} style={{ animationDelay: `${k * 0.1}s` }} />
          ))}
        </svg>
        {p.el.text && <p className="wb-write mt-[0.4cqw] font-hand text-[2cqw] font-bold leading-tight" style={{ animationDelay: `${0.2 + paths.length * 0.08}s` }}>{p.el.text}</p>}
      </div>
    );
  }
  if (p.el.kind === "icon" && p.el.asset) {
    const catalogItem = PROCEDURAL_ICON_CATALOG.find((item) => item.key === p.el.asset);
    const legacyIcon = p.el.asset in ICONS ? p.el.asset as keyof typeof ICONS : null;
    if (!catalogItem && !legacyIcon) return null;
    const graphic = catalogItem ? proceduralGraphic(catalogItem) : { paths: ICONS[legacyIcon as keyof typeof ICONS], washes: ICON_WASH[legacyIcon as keyof typeof ICONS] ?? [] };
    const paths = graphic.paths;
    return (
      <div className={wrap} style={style}>

        <svg viewBox={graphic.viewBox ?? "0 0 100 100"} className="mx-auto w-[72%] overflow-visible" fill="none" strokeLinecap="round" strokeLinejoin="round">
          {!graphic.viewBox && <circle cx="58" cy="56" r="34" className={cn("wb-blob opacity-50", t.blob)} />}
          {graphic.washes.map((w, k) => (
            <path key={`w${k}`} d={w.d} className={cn("wb-wash", WASH[w.tone])} style={{ animationDelay: `${0.2 + paths.length * 0.14 + k * 0.08}s` }} />
          ))}
          {paths.map((d, k) => (
            <g key={k}>
              <path d={d} pathLength={1} className="wb-stroke stroke-current" strokeWidth={graphic.viewBox ? 1.8 : 3.6} style={{ animationDelay: `${k * 0.14}s` }} />
              <path d={d} pathLength={1} transform={graphic.viewBox ? "translate(0.2 0.15)" : "translate(1.1 0.8) rotate(0.8 50 50)"} className="wb-stroke stroke-current opacity-35" strokeWidth={graphic.viewBox ? 0.7 : 1.4} style={{ animationDelay: `${k * 0.14 + 0.08}s` }} />
            </g>
          ))}
        </svg>
        {p.n && <span className={cn("wb-pop absolute left-[4%] top-0 grid size-[3cqw] place-items-center rounded-full border-[0.2cqw] font-hand text-[1.8cqw] font-bold", t.border, t.soft)}>{p.n}</span>}
        {p.el.text && <p className="wb-write mt-[0.6cqw] font-hand text-[2cqw] font-bold leading-tight" style={{ animationDelay: `${0.25 + paths.length * 0.1}s` }}>{p.el.text}</p>}
      </div>
    );
  }
  if (p.el.kind === "formula") {
    return (
      <div className={wrap} style={{ ...style, width: `${Math.max(p.w, 26)}%` }}>


        <div className={cn("wb-pop rounded-[1.2cqw] border-[0.25cqw] px-[1.2cqw] py-[1cqw]", t.border, t.soft)}>
          <MathFormula value={p.el.text} className="wb-write text-[2.8cqw] font-bold leading-tight" />
        </div>
      </div>
    );
  }
  return (
    <div className={wrap} style={style}>

      <p className="wb-write font-hand text-[2.6cqw] font-bold leading-tight">{p.el.text}</p>
      <svg viewBox="0 0 100 4" preserveAspectRatio="none" className="mx-auto mt-[0.3cqw] h-[0.8cqw] w-[70%] overflow-visible">
        <path d="M2 2 Q50 0 98 2" pathLength={1} className={cn("wb-stroke", t.line)} fill="none" strokeWidth={1.6} strokeLinecap="round" style={{ animationDelay: "0.5s" }} />
      </svg>
    </div>
  );
}
