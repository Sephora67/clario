import { ICONS, ICON_WASH, SEMANTIC_ICON_NODES, type IconName, type SemanticIconNode, type Wash } from "./board-icons";
import type { ProceduralIconEntry } from "./procedural-icon-catalog";

export type ProceduralGraphic = { paths: string[]; washes: Wash[]; viewBox?: string };

const circle = (x: number, y: number, r: number) =>
  `M${x - r} ${y} a${r} ${r} 0 1 0 ${r * 2} 0 a${r} ${r} 0 1 0 ${-r * 2} 0`;

function semanticNodePath([tag, attributes]: SemanticIconNode): string | null {
  const scale = (value: string | number | undefined) => Number(value ?? 0);
  if (tag === "path" && typeof attributes["d"] === "string") return attributes["d"];
  if (tag === "circle") return circle(scale(attributes["cx"]), scale(attributes["cy"]), scale(attributes["r"]));
  if (tag === "line") return `M${scale(attributes["x1"])} ${scale(attributes["y1"])} L${scale(attributes["x2"])} ${scale(attributes["y2"])}`;
  if (tag === "polyline" || tag === "polygon") {
    const points = String(attributes["points"] ?? "").trim().split(/\s+/).map((point) => point.split(",").map(Number));
    if (!points.length || points.some((point) => point.length !== 2 || point.some(Number.isNaN))) return null;
    return points.map(([x, y], index) => `${index ? "L" : "M"}${Number(x) * (100 / 24)} ${Number(y) * (100 / 24)}`).join(" ") + (tag === "polygon" ? " Z" : "");
  }
  if (tag === "rect") {
    const x = scale(attributes["x"]), y = scale(attributes["y"]), width = scale(attributes["width"]), height = scale(attributes["height"]);
    return `M${x} ${y} H${x + width} V${y + height} H${x} Z`;
  }
  if (tag === "ellipse") {
    const cx = scale(attributes["cx"]), cy = scale(attributes["cy"]), rx = scale(attributes["rx"]), ry = scale(attributes["ry"]);
    return `M${cx - rx} ${cy} a${rx} ${ry} 0 1 0 ${rx * 2} 0 a${rx} ${ry} 0 1 0 ${-rx * 2} 0`;
  }
  return null;
}

const templates: Record<string, ProceduralGraphic> = {
  book: { paths: ["M50 22 Q30 13 10 20 V80 Q32 74 50 84 Q68 74 90 80 V20 Q70 13 50 22 Z", "M50 22 V84"], washes: [{ d: "M50 22 Q30 13 10 20 V80 Q32 74 50 84 Z", tone: "p" }, { d: "M50 22 Q70 13 90 20 V80 Q68 74 50 84 Z", tone: "g" }] },
  document: { paths: ["M24 10 H65 L78 23 V90 H24 Z", "M65 10 V23 H78", "M34 40 H67 M34 54 H67 M34 68 H58"], washes: [{ d: "M24 10 H65 L78 23 V90 H24 Z", tone: "w" }, { d: "M65 10 V23 H78 Z", tone: "p" }] },
  writing: { paths: ["M18 76 L68 26 L80 38 L30 88 L12 92 Z", "M68 26 L75 19 L87 31 L80 38", "M18 76 L30 88"], washes: [{ d: "M18 76 L68 26 L80 38 L30 88 Z", tone: "y" }, { d: "M68 26 L75 19 L87 31 L80 38 Z", tone: "p" }] },
  device: { paths: ["M18 18 H82 V66 H18 Z", "M8 82 H92 L82 68 H18 Z", "M40 75 H60"], washes: [{ d: "M18 18 H82 V66 H18 Z", tone: "p" }, { d: "M24 24 H76 V60 H24 Z", tone: "w" }, { d: "M8 82 H92 L82 68 H18 Z", tone: "g" }] },
  money: { paths: ["M12 27 H88 V73 H12 Z", circle(50, 50, 13), "M20 37 H29 M71 63 H80"], washes: [{ d: "M12 27 H88 V73 H12 Z", tone: "g" }, { d: circle(50, 50, 13), tone: "y" }] },
  building: { paths: ["M18 88 V28 L50 10 L82 28 V88 Z", "M8 88 H92", "M30 40 H42 V52 H30 Z M58 40 H70 V52 H58 Z", "M42 88 V67 H58 V88"], washes: [{ d: "M18 88 V28 L50 10 L82 28 V88 Z", tone: "p" }, { d: "M42 88 V67 H58 V88 Z", tone: "g" }] },
  person: { paths: [circle(50, 27, 13), "M23 88 Q25 51 50 51 Q75 51 77 88", "M35 64 L16 73 M65 64 L84 73"], washes: [{ d: circle(50, 27, 13), tone: "y" }, { d: "M23 88 Q25 51 50 51 Q75 51 77 88 Z", tone: "p" }] },
  vehicle: { paths: ["M12 35 H70 V72 H12 Z", "M70 48 H82 L92 61 V72 H70", circle(29, 76, 8), circle(76, 76, 8)], washes: [{ d: "M12 35 H70 V72 H12 Z", tone: "y" }, { d: "M70 48 H82 L92 61 V72 H70 Z", tone: "p" }] },
  math: { paths: [circle(50, 50, 38), "M28 50 H72", "M50 28 V72"], washes: [{ d: circle(50, 50, 38), tone: "p" }, { d: circle(50, 50, 29), tone: "w" }] },
  shape: { paths: ["M50 9 L91 84 H9 Z", "M28 67 H72", circle(50, 52, 17)], washes: [{ d: "M50 9 L91 84 H9 Z", tone: "y" }, { d: circle(50, 52, 17), tone: "g" }] },
  science: { paths: [circle(50, 50, 8), "M12 50 C22 22 78 22 88 50 C78 78 22 78 12 50", "M31 17 C61 14 78 65 62 85 C32 88 15 37 31 17", "M69 17 C39 14 22 65 38 85 C68 88 85 37 69 17"], washes: [{ d: circle(50, 50, 8), tone: "y" }] },
  lab: { paths: ["M34 10 H66", "M42 10 V48 L22 84 Q20 90 29 90 H71 Q80 90 78 84 L58 48 V10", "M31 70 Q50 60 69 70"], washes: [{ d: "M31 70 Q50 60 69 70 L78 84 Q80 90 71 90 H29 Q20 90 22 84 Z", tone: "g" }] },
  body: { paths: ["M49 13 C27 5 14 26 24 43 C10 57 25 82 45 73 C55 91 82 78 75 59 C93 45 79 18 60 25 C60 16 55 13 49 13 Z", "M49 18 V76 M32 31 Q49 39 66 28 M31 58 Q48 48 68 61"], washes: [{ d: "M49 13 C27 5 14 26 24 43 C10 57 25 82 45 73 C55 91 82 78 75 59 C93 45 79 18 60 25 C60 16 55 13 49 13 Z", tone: "p" }] },
  nature: { paths: ["M50 90 V45", "M50 57 C22 54 16 28 18 14 C39 15 53 31 50 57", "M50 68 C76 65 86 43 82 27 C63 29 49 43 50 68"], washes: [{ d: "M50 57 C22 54 16 28 18 14 C39 15 53 31 50 57 Z", tone: "g" }, { d: "M50 68 C76 65 86 43 82 27 C63 29 49 43 50 68 Z", tone: "y" }] },
  tech: { paths: ["M20 20 H80 V80 H20 Z", "M32 32 H68 V68 H32 Z", "M8 36 H20 M8 52 H20 M8 68 H20 M80 36 H92 M80 52 H92 M80 68 H92", "M36 8 V20 M52 8 V20 M68 8 V20 M36 80 V92 M52 80 V92 M68 80 V92"], washes: [{ d: "M20 20 H80 V80 H20 Z", tone: "p" }, { d: "M32 32 H68 V68 H32 Z", tone: "g" }] },
  arrow: { paths: ["M12 50 H82", "M66 32 L84 50 L66 68"], washes: [{ d: "M10 43 H66 V32 L84 50 L66 68 V57 H10 Z", tone: "y" }] },
  diagram: { paths: ["M8 18 H38 V40 H8 Z", "M62 18 H92 V40 H62 Z", "M35 67 H65 V89 H35 Z", "M23 40 V54 H50 V67 M77 40 V54 H50"], washes: [{ d: "M8 18 H38 V40 H8 Z", tone: "y" }, { d: "M62 18 H92 V40 H62 Z", tone: "g" }, { d: "M35 67 H65 V89 H35 Z", tone: "p" }] },
  chart: { paths: ["M12 88 H92 M12 88 V12", "M22 88 V64 H35 V88 M44 88 V43 H57 V88 M66 88 V25 H79 V88", "M20 53 Q42 45 51 31 T82 18"], washes: [{ d: "M22 88 V64 H35 V88 Z", tone: "p" }, { d: "M44 88 V43 H57 V88 Z", tone: "g" }, { d: "M66 88 V25 H79 V88 Z", tone: "y" }] },
  emotion: { paths: [circle(50, 50, 38), circle(37, 42, 3), circle(63, 42, 3), "M32 62 Q50 78 68 62"], washes: [{ d: circle(50, 50, 38), tone: "y" }] },
  badge: { paths: [circle(50, 50, 38), "M31 51 L44 65 L71 35"], washes: [{ d: circle(50, 50, 38), tone: "g" }] },
  callout: { paths: ["M10 15 H90 V69 H43 L27 86 L30 69 H10 Z", "M25 34 H75 M25 49 H62"], washes: [{ d: "M10 15 H90 V69 H43 L27 86 L30 69 H10 Z", tone: "p" }] },
  concept: { paths: [circle(50, 50, 34), "M50 16 V4 M50 96 V84 M16 50 H4 M96 50 H84", "M34 50 L45 61 L68 36"], washes: [{ d: circle(50, 50, 34), tone: "y" }] },
  education: { paths: ["M15 36 L50 17 L85 36 L50 55 Z", "M27 43 V67 Q50 82 73 67 V43", "M85 36 V66"], washes: [{ d: "M15 36 L50 17 L85 36 L50 55 Z", tone: "p" }, { d: "M27 43 V67 Q50 82 73 67 V43 Z", tone: "y" }] },
};

const distinctGraphics: Record<string, ProceduralGraphic> = {
  desk: { paths: ["M10 38 H90 V55 H10 Z", "M18 55 V90 M82 55 V90", "M28 55 V72 H72 V55"], washes: [{ d: "M10 38 H90 V55 H10 Z", tone: "y" }, { d: "M28 55 V72 H72 V55 Z", tone: "p" }] },
  chair: { paths: ["M27 12 H73 V58 H27 Z", "M22 58 H78 V72 H22 Z", "M30 72 V91 M70 72 V91", "M27 25 Q50 18 73 25"], washes: [{ d: "M27 12 H73 V58 H27 Z", tone: "p" }, { d: "M22 58 H78 V72 H22 Z", tone: "g" }] },
  blackboard: { paths: ["M10 16 H90 V70 H10 Z", "M5 78 H95", "M20 78 V90 M80 78 V90", "M23 34 H70 M23 48 H58"], washes: [{ d: "M10 16 H90 V70 H10 Z", tone: "g" }] },
  whiteboard: { paths: ["M10 16 H90 V70 H10 Z", "M5 78 H95", "M20 78 V90 M80 78 V90", "M24 35 Q42 28 68 37", "M27 51 H61"], washes: [{ d: "M10 16 H90 V70 H10 Z", tone: "w" }, { d: "M24 35 Q42 28 68 37", tone: "p" }] },
  classroom: { paths: ["M8 12 H92 V50 H8 Z", "M12 88 H88", "M18 64 H42 V75 H18 Z M58 64 H82 V75 H58 Z", "M24 75 V88 M36 75 V88 M64 75 V88 M76 75 V88"], washes: [{ d: "M8 12 H92 V50 H8 Z", tone: "g" }, { d: "M18 64 H42 V75 H18 Z M58 64 H82 V75 H58 Z", tone: "y" }] },
};

const legacyByKey: Partial<Record<string, IconName>> = {
  "open-book": "book", book: "book", lightbulb: "lightbulb", calculator: "calculator",
  clock: "clock", calendar: "calendar", target: "target", invoice: "invoice",
  factory: "factory", gear: "gear", "delivery-truck": "truck", truck: "truck",
  building: "building", "company-building": "building", wrench: "wrench",
  "shopping-cart": "cart", package: "box", "question-mark": "question",
  percentage: "percent", division: "divide", "bar-chart": "chart",
  "warning-triangle": "warning", checkmark: "check", electricity: "lightning",
  "coins-stack": "coins", banknote: "money", team: "people",
};

export function proceduralGraphic(item: Pick<ProceduralIconEntry, "key" | "template">): ProceduralGraphic {
  const distinct = distinctGraphics[item.key];
  if (distinct) return distinct;
  const legacy = legacyByKey[item.key];
  if (legacy) return legacyGraphic(legacy);
  const nodes = SEMANTIC_ICON_NODES[item.key];
  if (!nodes) return { paths: [], washes: [] };
  return { paths: nodes.map(semanticNodePath).filter((path): path is string => Boolean(path)), washes: [], viewBox: "0 0 24 24" };
}

export function hasDistinctProceduralGraphic(item: Pick<ProceduralIconEntry, "key">) {
  return Boolean(distinctGraphics[item.key] || legacyByKey[item.key] || SEMANTIC_ICON_NODES[item.key]);
}

export function legacyGraphic(icon: IconName): ProceduralGraphic {
  return { paths: ICONS[icon], washes: ICON_WASH[icon] ?? [] };
}