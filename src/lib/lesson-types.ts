import type { Cue } from "./scene-timing";

export type BoardLayout =
  | "comparison"
  | "steps"
  | "pipeline"
  | "hierarchy"
  | "formula"
  | "key-rule"
  | "timeline"
  | "cycle"
  | "chart";

// Procedural symbols drawn from primitives (layer 1) — no illustration needed.
export type BoardSymbol =
  | "check" | "cross" | "question" | "warning" | "star"
  | "plus" | "minus" | "equals" | "percent" | "up" | "down";

// One element of a composed whiteboard. It appears the moment its anchor
// words are spoken. `rule` elements are written in the bottom banner.
export type BoardElement = {
  kind: "icon" | "text" | "formula" | "rule" | "host" | "badge" | "callout" | "character" | "illustration"; // host = intro/outro teacher (group 0 wave, 1 thumbs up); illustration = approved library drawing (asset = its key)
  asset: string | null;
  svg?: string | null; // illustration: approved SVG markup, injected at read time
  text: string;
  anchor: string;
  group: number | null; // comparison layout: 0 = left, 1 = right
  symbol?: BoardSymbol | null; // badge glyph, or accent on a step
  role?: string | null; // character: catalog role (student, accountant…)
  pose?: string | null; // character: catalog pose (pointing, thinking…)
  value?: number | null; // chart layout: bar height / measured value
};

export type Board = { layout: BoardLayout; heading: string; elements: BoardElement[] };


export type LessonScene = {
  title: string;
  narration: string;
  keywords: string[];
  board?: Board;
  cues?: Cue[];
  cueLayout?: "verified";
  image?: string | null;
  audio?: string | null;
  imagePrompt?: string;
};

export type LessonContent = {
  title: string;
  subject: string;
  scenes: LessonScene[];
  summary: { intro: string; points: { title: string; text: string }[]; rule: string };
  guide: { title: string; question: string; accepted: string[]; hint: string }[];
  correction: { title: string; detail: string }[];
  quiz: { question: string; options: string[]; answer: number; explanation: string }[];
};
