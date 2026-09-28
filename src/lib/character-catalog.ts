// Layer 2 — local character catalog. Characters are composed in code from a
// shared body + a role accessory + a pose, so every {role, pose} pair is
// available instantly at $0. Recraft is only needed for roles missing here.

export const CHARACTER_ROLES = [
  "student", "teacher", "professor", "accountant", "doctor", "scientist",
  "engineer", "lawyer", "manager", "customer", "worker",
] as const;
export const CHARACTER_POSES = [
  "standing", "pointing", "thinking", "explaining", "raising-hand",
  "celebrating", "confused", "reading", "writing", "holding-laptop",
] as const;

export type CharacterRole = (typeof CHARACTER_ROLES)[number];
export type CharacterPose = (typeof CHARACTER_POSES)[number];

const c = (x: number, y: number, r: number) => `M${x - r} ${y} a${r} ${r} 0 1 0 ${r * 2} 0 a${r} ${r} 0 1 0 ${-r * 2} 0`;

// Shared body: head, torso, legs (viewBox 100×100).
const BODY = [c(50, 22, 10), "M50 32 V62", "M50 62 L40 90 M50 62 L60 90"];

// Arms start at the shoulder (50, 40).
const POSE: Record<CharacterPose, { arms: string[]; extra?: string[] }> = {
  standing: { arms: ["M50 40 L38 58", "M50 40 L62 58"] },
  pointing: { arms: ["M50 40 L38 58", "M50 40 L72 32 L84 28"], extra: ["M86 24 l4 -2 M88 30 l4 1"] },
  thinking: { arms: ["M50 40 L40 52 L46 34", "M50 40 L62 58"], extra: ["M66 10 q4 -4 8 0 q4 4 0 8 q-3 2 -3 6", "M71 30 v1"] },
  explaining: { arms: ["M50 40 L34 46 L26 40", "M50 40 L66 46 L74 40"], extra: ["M20 34 q-4 4 0 8", "M80 34 q4 4 0 8"] },
  "raising-hand": { arms: ["M50 40 L38 58", "M50 40 L62 24 L64 8"], extra: ["M60 6 l-2 -4 M68 6 l2 -4"] },
  celebrating: { arms: ["M50 40 L36 24 L32 12", "M50 40 L64 24 L68 12"], extra: ["M22 10 l3 3 M78 10 l-3 3 M26 22 h-5 M74 22 h5"] },
  confused: { arms: ["M50 40 L38 44 L42 30", "M50 40 L62 58"], extra: ["M64 6 q0 -6 6 -6 q6 0 6 5 q0 4 -6 6 V16", "M70 21 v1"] },
  reading: { arms: ["M50 40 L40 52 L50 50", "M50 40 L60 52 L50 50"], extra: ["M36 46 L50 50 L64 46 V58 L50 62 L36 58 Z", "M50 50 V62"] },
  writing: { arms: ["M50 40 L40 58", "M50 40 L64 52 L72 58"], extra: ["M72 58 l8 -10", "M58 68 H86"] },
  "holding-laptop": { arms: ["M50 40 L38 54 L48 58", "M50 40 L62 54 L52 58"], extra: ["M34 58 H66 L62 70 H38 Z", "M36 50 H64 V58"] },
};

// Role accessory drawn on top of the body.
const ROLE: Record<CharacterRole, string[]> = {
  student: ["M40 36 L44 58 M60 36 L56 58", "M40 18 L50 12 L60 18"], // backpack straps + cap brim
  teacher: ["M42 20 q8 -18 16 0", "M44 22 h4 M52 22 h4"], // hair bun + glasses
  professor: ["M43 22 h5 M52 22 h5", "M48 22 h4", "M44 30 q6 6 12 0"], // glasses + beard
  accountant: ["M50 34 l-3 6 l3 12 l3 -12 z", "M44 22 h4 M52 22 h4"], // tie + glasses
  doctor: ["M42 34 V62 M58 34 V62", "M44 36 q6 14 12 0", c(50, 50, 2)], // coat + stethoscope
  scientist: ["M42 34 V64 M58 34 V64", "M42 20 h16 v4 h-16 z"], // lab coat + goggles
  engineer: ["M38 16 q12 -14 24 0 H38", "M50 4 V10"], // hard hat
  lawyer: ["M50 34 l-3 6 l3 12 l3 -12 z", "M42 34 L50 44 L58 34"], // tie + lapels
  manager: ["M50 34 l-3 6 l3 12 l3 -12 z", "M60 72 h14 v12 h-14 z", "M64 72 v-3 h6 v3"], // tie + briefcase
  customer: ["M28 60 h14 l-2 14 h-10 z", "M32 60 q3 -6 6 0"], // shopping bag
  worker: ["M38 14 q12 -12 24 0", "M42 44 h16 M42 50 h16"], // cap + vest stripes
};

export const ROLE_LABEL: Record<CharacterRole, string> = {
  student: "Étudiant·e", teacher: "Enseignante", professor: "Professeur", accountant: "Comptable",
  doctor: "Médecin", scientist: "Scientifique", engineer: "Ingénieur·e", lawyer: "Avocat·e",
  manager: "Gestionnaire", customer: "Client·e", worker: "Travailleur·se",
};

export type ResolvedCharacter =
  | { source: "local"; paths: string[] }
  | { source: "missing"; paths: string[] }; // fallback figure; Recraft fills it later

/** Cache-first lookup: local catalog, else a neutral figure flagged "missing". */
export function resolveCharacter(role: string | null | undefined, pose: string | null | undefined): ResolvedCharacter {
  const p = POSE[(pose as CharacterPose) ?? "standing"] ?? POSE.standing;
  const r = ROLE[role as CharacterRole];
  const paths = [...BODY, ...p.arms, ...(r ?? []), ...(p.extra ?? [])];
  return r ? { source: "local", paths } : { source: "missing", paths };
}
