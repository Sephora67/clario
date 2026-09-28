// Layer 2 catalog: everything that needs a real illustration (Recraft).
import { SCENARIO_GROUPS } from "./scenario-data";
import { SCENARIO_FR, describeScenario } from "./scenario-fr";
export const ILLUS_ROLES = ["student", "teacher", "professor", "accountant", "doctor", "scientist", "engineer", "lawyer", "manager", "customer", "worker", "child", "parent"] as const;
export const ILLUS_POSES = ["sitting", "standing", "walking", "running", "writing", "reading", "thinking", "pointing", "explaining", "presenting", "talking", "listening", "raising hand", "holding a book", "holding a laptop", "using a calculator", "working at a desk", "looking confused", "celebrating", "making a mistake"] as const;
export const ILLUS_ENVIRONMENTS = ["classroom", "office", "factory", "laboratory", "hospital", "store", "warehouse", "home", "restaurant", "construction site", "bank", "library"] as const;
export const ILLUS_OBJECTS = ["desk", "chair", "laptop", "printer", "calculator", "cash register", "factory machine", "car", "truck", "microscope", "test tubes", "bookshelf", "whiteboard", "blackboard", "filing cabinet", "shopping cart"] as const;

export const FR: Record<string, string> = {
  student: "Étudiant·e", teacher: "Enseignant·e", professor: "Professeur·e", accountant: "Comptable", doctor: "Médecin", scientist: "Scientifique", engineer: "Ingénieur·e", lawyer: "Avocat·e", manager: "Gestionnaire", customer: "Client·e", worker: "Travailleur·se", child: "Enfant", parent: "Parent",
  sitting: "assis", standing: "debout", walking: "marche", running: "court", writing: "écrit", reading: "lit", thinking: "réfléchit", pointing: "pointe", explaining: "explique", presenting: "présente", talking: "parle", listening: "écoute", "raising hand": "lève la main", "holding a book": "tient un livre", "holding a laptop": "tient un portable", "using a calculator": "calculatrice", "working at a desk": "au bureau", "looking confused": "confus", celebrating: "célèbre", "making a mistake": "se trompe",
  classroom: "Salle de classe", office: "Bureau", factory: "Usine", laboratory: "Laboratoire", hospital: "Hôpital", store: "Magasin", warehouse: "Entrepôt", home: "Maison", restaurant: "Restaurant", "construction site": "Chantier", bank: "Banque", library: "Bibliothèque",
  desk: "Bureau (meuble)", chair: "Chaise", laptop: "Portable", printer: "Imprimante", calculator: "Calculatrice", "cash register": "Caisse", "factory machine": "Machine d'usine", car: "Voiture", truck: "Camion", microscope: "Microscope", "test tubes": "Éprouvettes", bookshelf: "Étagère", whiteboard: "Tableau blanc", blackboard: "Tableau noir", "filing cabinet": "Classeur", "shopping cart": "Panier d'épicerie",
};

const STYLE = "Friendly hand-drawn whiteboard explainer style, clean dark ink outlines, flat soft pastel fills, no gradients, no shadows, plain white background, no text, no letters. Every person's face, ears, neck, hands, arms, legs and all visible skin must remain completely white and unfilled, with dark outlines and facial features only. Never apply green, purple, yellow, peach, tan, brown or any other color to skin or faces. Use natural dark ink tones for hair. The pastel palette (butter yellow, lavender and mint green) applies ONLY to clothing, furniture and objects.";

export type CatalogItem = { key: string; category: "character" | "environment" | "object" | "scenario"; label: string; prompt: string; description?: string };

export const SCENARIO_SUBS = SCENARIO_GROUPS.map((g) => g.id);
for (const g of SCENARIO_GROUPS) FR[g.id] = g.label;

export function catalog(): CatalogItem[] {
  const out: CatalogItem[] = [];
  for (const r of ILLUS_ROLES) for (const p of ILLUS_POSES) out.push({
    key: `character:${r}:${p}`, category: "character", label: `${FR[r]} — ${FR[p]}`,
    prompt: `A single full-body ${r} character, ${p}, centered, ${STYLE}`,
  });
  for (const e of ILLUS_ENVIRONMENTS) out.push({ key: `environment:${e}`, category: "environment", label: FR[e]!, prompt: `A simple ${e} scene background, wide view, sparse details, ${STYLE}` });
  for (const o of ILLUS_OBJECTS) out.push({ key: `object:${o}`, category: "object", label: FR[o]!, prompt: `A single ${o}, centered, isolated, ${STYLE}` });
  const MULTI = /two|team|group|class|meeting|interview|negotiat|discussion|conversation|collaborat|addressing|another|\+|with (students|client)|to (teacher|student|patient|client|class)|empty/i;
  for (const g of SCENARIO_GROUPS) for (const [n, text] of g.items) {
    const solo = !MULTI.test(text);
    out.push({
      key: `scenario:${g.id}:${n}`, category: "scenario", label: `#${n} ${SCENARIO_FR[n] ?? text}`,
      description: describeScenario(text, !solo),
      prompt: solo
        ? `${text}. Exactly ONE person in the entire image, no other people, no background decor, no posters, no furniture or props beyond what is named, subject centered, consistent three-quarter view, fully inside the frame with margin, ${STYLE}`
        : `${text}. One complete self-contained scene: every person, furniture and prop drawn together in a single coherent composition, consistent three-quarter view, whole scene fully inside the frame with margin, ${STYLE}`,
    });
  }
  return out;
}
