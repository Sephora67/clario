// Presse-papiers interne du cahier : mémorise soit du texte, soit des annotations
// (traits, formes, textes) copiées au lasso, pour les recoller sur une autre page.
// Le presse-papiers système garde le texte ; les annotations ne tiennent que ici.
import type { Mark } from "@/components/notebook";

export type NotebookClip = { kind: "text"; text: string } | { kind: "marks"; marks: Mark[] };

let clip: NotebookClip | null = null;

export const setNotebookClip = (next: NotebookClip) => { clip = next; };
export const getNotebookClip = (): NotebookClip | null => clip;
