import type { Zone } from "./animation-types";

// Vidéo explicative générée à partir d'une page (version 2 des animations).
export type ExplainerVisual = {
  type: "title" | "bullets" | "formula" | "steps" | "compare" | "page" | "example" | "outro";
  heading: string;
  items: string[]; // points révélés au fil de la voix
  formula?: string | undefined; // pour type "formula"
  zone?: Zone | null; // pour type "page" : zone de la page à montrer en gros plan
  anchors?: string[]; // extrait exact de narration déclenchant chaque item
  formulaAnchor?: string | null; // extrait exact déclenchant la formule
  note?: string | undefined; // texte libre affiché sous le titre (scène outro, bilingue)
};

export type ExplainerScene = {
  narration: string;
  visual: ExplainerVisual;
  audioPath: string | null;
};

export type ExplainerScript = {
  version: 2;
  title: string;
  pageKind: string; // introduction, concept, formule, méthode, exemple, schéma…
  pageImagePath: string | null;
  scenes: ExplainerScene[];
  fullAudioPath?: string | null; // narration continue : un seul fichier voix pour toute la vidéo
};

export function isExplainer(s: unknown): s is ExplainerScript {
  return !!s && typeof s === "object" && (s as { version?: number }).version === 2;
}
