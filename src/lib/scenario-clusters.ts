// Regroupement des scénarios visuellement similaires (doublons).
// keeper = numéros recommandés à conserver; members = tous les numéros de la famille.
export type ScenarioCluster = { id: string; label: string; keepers: number[]; members: number[]; note?: string };

export const SCENARIO_CLUSTERS: ScenarioCluster[] = [
  { id: "desk", label: "Étudiant·e assis au bureau", keepers: [16, 90], members: [16, 17, 18, 19, 20, 26, 27, 28, 29, 73, 90, 93, 94] },
  { id: "computer", label: "Personne devant un ordinateur", keepers: [24], members: [24, 95, 96, 196, 224, 261, 262] },
  { id: "calculator", label: "Calculatrice et chiffres", keepers: [25], members: [25, 97, 119, 120, 198, 200, 202, 213, 327], note: "La calculatrice seule existe déjà en icône gratuite (0 $)." },
  { id: "lab", label: "Microscope et laboratoire", keepers: [132, 133], members: [130, 132, 133, 134, 135, 143, 152, 153, 154, 155, 156, 296, 299, 304, 305] },
  { id: "board", label: "Enseignant·e au tableau", keepers: [43, 44], members: [43, 44, 45, 46, 47, 48, 49, 64, 65, 115, 116, 117, 118, 160, 165, 245, 263, 283], note: "Les équations et graphiques sont dessinés en direct par Clario : inutile de les figer dans une illustration." },
  { id: "teacher-student", label: "Interaction enseignant ↔ étudiant", keepers: [31, 56], members: [31, 32, 33, 34, 56, 57, 58, 59, 60, 77, 273, 274] },
  { id: "team", label: "Binôme et travail d'équipe", keepers: [35, 36], members: [35, 36, 37, 38, 39, 40, 41, 42, 74, 78, 79, 284, 320] },
  { id: "charts", label: "Graphiques et courbes", keepers: [], members: [99, 100, 114, 127, 128, 129, 136, 185, 186, 219, 220, 260, 272], note: "Tout est déjà couvert gratuitement par le moteur de graphiques de Clario." },
  { id: "geometry", label: "Géométrie et mesure", keepers: [], members: [103, 104, 121, 122, 123, 124, 125, 126, 161, 162, 163, 231, 232, 301, 307], note: "Règle, compas, rapporteur… existent en icônes gratuites." },
  { id: "exams", label: "Examens et corrections", keepers: [83, 54], members: [54, 55, 81, 82, 83, 84, 85, 279] },
  { id: "accounting", label: "Comptabilité et factures", keepers: [204], members: [201, 204, 205, 206, 207, 208, 209, 210, 212, 214, 215, 216, 217, 218, 235, 236] },
  { id: "meetings", label: "Réunions et table de conférence", keepers: [188, 189], members: [187, 188, 189, 190, 191, 192, 193, 194, 195, 229, 230, 240, 267] },
  { id: "geography", label: "Cartes et géographie", keepers: [250, 252], members: [246, 247, 250, 251, 252, 253, 254] },
  { id: "postures", label: "Postures et émotions de base", keepers: [1, 2, 5, 6, 8], members: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 308, 309, 310, 311, 312, 313, 314, 315, 316, 317, 318, 319, 321, 322, 323, 324, 325, 326] },
];

export const CLUSTERED_SCENARIO_NUMBERS = new Set(SCENARIO_CLUSTERS.flatMap((c) => c.members));

export function scenarioNumber(key: string): number | null {
  const parts = key.split(":");
  if (parts[0] !== "scenario") return null;
  const n = Number(parts[2]);
  return Number.isFinite(n) ? n : null;
}
