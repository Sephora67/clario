// Types partagés entre le cahier (client) et les fonctions serveur d'animation.

// Zone normalisée sur la page (0..1, relative à la largeur/hauteur).
export type Zone = { x: number; y: number; w: number; h: number };

// Un élément repéré sur la page par l'analyse.
export type AnalyzedElement = {
  label: string; // nom court affiché à l'étudiant
  text: string; // texte exact repéré sur la page
  zone: Zone;
};

export type RejectedElement = { label: string; reason: string };

export type PageAnalysis = {
  animable: AnalyzedElement[];
  rejected: RejectedElement[];
};

// Une note que Clario écrit pendant l'animation.
export type AnimNote = {
  text: string; // court texte écrit en marge (vide pour cercle/flèche/soulignement)
  style: "circle" | "arrow" | "underline" | "margin";
  zone: Zone; // où dessiner la note
};

// Une étape de l'animation : une phrase + ce qu'on montre pendant qu'elle est dite.
export type AnimStep = {
  narration: string;
  zone: Zone | null; // zone surlignée pendant la phrase
  note: AnimNote | null; // note dessinée progressivement pendant la phrase
};

export type AnimScript = {
  title: string;
  steps: AnimStep[];
};

// Une animation enregistrée (table `animations`).
export type SavedAnimation = {
  id: string;
  documentId: string;
  courseId: string | null;
  page: number;
  title: string;
  script: AnimScript;
  audioPath: string | null;
  createdAt: string;
};
