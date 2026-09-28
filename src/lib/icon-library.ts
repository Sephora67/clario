// Read-only catalog of the exact procedural illustrations used by the lesson
// whiteboard. Keeping only IconName references makes Admin and lessons share
// the same paths and colour washes.
import type { IconName } from "./board-icons";

export type IconGroup = { id: string; label: string; icons: [string, IconName][] };

export const ICON_GROUPS: IconGroup[] = [
  {
    id: "education",
    label: "Éducation",
    icons: [
      ["livre ouvert", "book"], ["enseignant·e", "teacher"], ["étudiant·e", "person"],
      ["groupe", "people"], ["ampoule", "lightbulb"], ["calendrier", "calendar"],
      ["question", "question"],
    ],
  },
  {
    id: "business",
    label: "Business & organisation",
    icons: [
      ["usine", "factory"], ["machine", "machine"], ["engrenage", "gear"],
      ["immeuble", "building"], ["plan", "floorplan"], ["outil", "wrench"],
      ["camion", "truck"], ["colis", "box"], ["panier", "cart"],
      ["direction", "signpost"],
    ],
  },
  {
    id: "finance",
    label: "Finance & comptabilité",
    icons: [
      ["clé de répartition", "key"], ["facture", "invoice"], ["calculatrice", "calculator"],
      ["billet", "money"], ["pièces", "coins"], ["dollar", "dollar"],
      ["pourcentage", "percent"], ["balance", "balance"], ["graphique", "chart"],
      ["division", "divide"],
    ],
  },
  {
    id: "symbols",
    label: "Repères & symboles",
    icons: [
      ["toiture", "roof"], ["électricité", "lightning"], ["document", "document"],
      ["attention", "warning"], ["horloge", "clock"], ["validation", "check"],
      ["objectif", "target"],
    ],
  },
];

export const ICON_COUNT = ICON_GROUPS.reduce((count, group) => count + group.icons.length, 0);