import type { Board, BoardElement, LessonContent } from "@/lib/lesson-types";
import type { IconName } from "@/lib/board-icons";

const icon = (asset: IconName, text: string, anchor: string, group: number | null = null): BoardElement => ({ kind: "icon", asset, text, anchor, group });
const note = (text: string, anchor: string, group: number | null = null): BoardElement => ({ kind: "text", asset: null, text, anchor, group });
const formula = (text: string, anchor: string): BoardElement => ({ kind: "formula", asset: null, text, anchor, group: null });
const badge = (symbol: NonNullable<BoardElement["symbol"]>, text: string, anchor: string): BoardElement => ({ kind: "badge", asset: null, text, anchor, group: null, symbol });
const callout = (text: string, anchor: string): BoardElement => ({ kind: "callout", asset: null, text, anchor, group: null });
const host = (pose: "wave" | "thumbs", text: string, anchor: string): BoardElement => ({ kind: "host", asset: null, text, anchor, group: pose === "wave" ? 0 : 1 });
const rule = (text: string, anchor: string): BoardElement => ({ kind: "rule", asset: null, text, anchor, group: null });


// Composed boards: each element appears when its anchor words are spoken.
const BOARDS: Board[] = [
  { layout: "steps", heading: "Les coûts communs, en 4 étapes", elements: [
    host("wave", "Bienvenue!", "Salut"),
    rule("Une erreur ici = un coût de revient faux", "devient faux"),
    icon("document", "Classer les frais", "trois minutes"),
    icon("balance", "Choisir la base", "classer les frais"),
    icon("factory", "Répartir les auxiliaires", "bonne base"),
    icon("invoice", "Imputer à AR-300", "auxiliaires"),
  ] },

  { layout: "comparison", heading: "1. Classer les coûts", elements: [
    note("Frais spécifique", "spécifique", 0),
    icon("machine", "Machine d'un atelier", "machine", 0),
    note("Frais commun", "commun", 1),
    icon("key", "Loyer", "loyer", 1),
    icon("lightning", "Électricité", "électricité", 1),
    icon("roof", "Toiture", "toiture", 1),
    rule("Frais commun = à répartir", "répartir"),
  ] },
  { layout: "comparison", heading: "2. Identifier les rôles", elements: [
    icon("truck", "Approvisionnement", "approvisionnement", 0),
    icon("wrench", "Entretien", "entretien", 0),
    callout("Auxiliaires : rendent service", "auxiliaires"),
    icon("factory", "Atelier 1", "ateliers un", 1),
    icon("factory", "Atelier 2", "deux", 1),
    note("Principales : fabriquent", "principales", 1),
    rule("À la fin, tout aboutit dans les ateliers", "aboutir"),
  ] },

  { layout: "steps", heading: "3. Choisir la base", elements: [
    rule("La base = le service réellement consommé", "service consommé"),
    icon("floorplan", "Bâtiment → superficie", "superficie"),
    icon("invoice", "Appro → factures", "factures"),
    icon("clock", "Entretien → heures-machines", "heures-machines"),
  ] },

  { layout: "timeline", heading: "4. Tracer le parcours", elements: [
    icon("money", "Frais communs", "frais communs"),
    icon("wrench", "Sections auxiliaires", "auxiliaires"),
    icon("factory", "Ateliers", "ateliers"),
    icon("invoice", "Commande AR-300", "AR-300"),
    rule("Connais le chemin avant les chiffres", "connais"),
  ] },




  { layout: "pipeline", heading: "5. Répartir par superficie", elements: [
    icon("money", "Frais communs", "frais communs"),
    icon("floorplan", "Plan des locaux", "plan des locaux"),
    formula("part = m² section ÷ m² total", "proportionnelle"),
    icon("check", "Somme = total", "somme"),
  ] },
  { layout: "hierarchy", heading: "6. Fermer l'approvisionnement", elements: [
    icon("truck", "Approvisionnement", "approvisionnement"),
    icon("wrench", "Entretien", "entretien"),
    icon("invoice", "Selon les factures", "factures"),
    icon("factory", "Ateliers 1 et 2", "chaque section"),
    badge("warning", "Jamais à elle-même", "Attention"),
    rule("Jamais vers elle-même, puis la section est fermée", "jamais"),
  ] },

  { layout: "key-rule", heading: "7. Fermer l'entretien", elements: [
    icon("wrench", "Entretien", "entretien"),
    icon("truck", "+ part de l'appro", "approvisionnement"),
    icon("factory", "Vers les 2 ateliers", "ateliers"),
    icon("clock", "Heures-machines", "heures-machines"),
    rule("Plus de machines = plus grosse flèche", "flèche"),
  ] },


  { layout: "formula", heading: "8. Calculer les taux", elements: [
    formula("Taux = frais ÷ activité", "taux d'imputation"),
    icon("machine", "Atelier 1 : heures-machines", "heures-machines"),
    icon("person", "Atelier 2 : heures MOD", "main-d'œuvre"),
    rule("Écris l'unité : $ par heure", "dollars par heure"),
  ] },
  { layout: "formula", heading: "9. Imputer à AR-300", elements: [
    icon("invoice", "Commande AR-300", "AR-300"),
    formula("taux × heures", "multiplie"),
    icon("calendar", "Février", "février"),
    formula("Atelier 1 + Atelier 2", "additionne"),
    rule("= frais indirects imputés à la commande", "imputés"),
  ] },
  { layout: "steps", heading: "10. Vérifier", elements: [
    icon("check", "Vérifie", "vérifie"),
    icon("factory", "Tout finit aux ateliers", "ateliers"),
    icon("calculator", "Plusieurs décimales", "décimales"),
    icon("target", "Arrondi final seulement", "arrondis"),
    rule("Bravo, tu es prêt pour le TP!", "bravo"),
    host("thumbs", "", "bravo"),
  ] },
];

export const demoLesson: LessonContent = {
  title: "Répartition des coûts communs",
  subject: "Comptabilité de management II",
  scenes: [
    { title: "Bienvenue", keywords: ["Objectif", "3 minutes"], cueLayout: "verified", audio: "/audio/scene-0.mp3",
      narration: "Salut! Aujourd'hui, on démystifie la répartition des coûts communs en comptabilité de management. Pourquoi c'est important? Parce que si tu te trompes à cette étape, tout ton coût de revient devient faux. En trois minutes, tu vas voir comment classer les frais, choisir la bonne base, répartir les sections auxiliaires, puis imputer le tout à la commande AR-300. C'est parti!",
      cues: [
        { label: "Répartition des coûts", anchor: "répartition des coûts", at: { x: 0.36, y: 0.38, r: 0.20 } },
        { label: "Coût de revient", anchor: "coût de revient", at: { x: 0.62, y: 0.45, r: 0.12 } },
        { label: "3 minutes", anchor: "trois minutes" },
        { label: "Commande AR-300", anchor: "AR-300" },
      ] },
    { title: "Classer les coûts", keywords: ["Frais spécifiques", "Frais communs"], cueLayout: "verified", audio: "/audio/scene-1.mp3",
      narration: "Avant tout calcul, on trie les frais. Un frais spécifique appartient à une seule section, comme la machine d'un atelier. Un frais commun, comme le loyer, l'électricité ou la toiture, est partagé par toute l'usine. Il faudra donc le répartir.",
      cues: [
        { label: "Frais spécifiques", anchor: "spécifique" },
        { label: "La machine", anchor: "machine", at: { x: 0.20, y: 0.24, r: 0.10 } },
        { label: "Le loyer", anchor: "loyer", at: { x: 0.81, y: 0.67, r: 0.08 } },
        { label: "Électricité", anchor: "électricité", at: { x: 0.82, y: 0.40, r: 0.08 } },
        { label: "La toiture", anchor: "toiture", at: { x: 0.80, y: 0.14, r: 0.09 } },
      ] },
    { title: "Identifier les rôles", keywords: ["Sections auxiliaires", "Ateliers principaux"], cueLayout: "verified", audio: "/audio/scene-2.mp3",
      narration: "Chez AR inc., il y a deux familles de sections. L'approvisionnement et l'entretien sont des sections auxiliaires : elles rendent service. Les ateliers un et deux sont les sections principales : ce sont eux qui fabriquent les produits. À la fin, tous les coûts doivent aboutir dans les ateliers.",
      cues: [
        { label: "Approvisionnement", anchor: "approvisionnement", at: { x: 0.25, y: 0.30, r: 0.15 } },
        { label: "Entretien", anchor: "entretien", at: { x: 0.27, y: 0.63, r: 0.13 } },
        { label: "Ateliers 1 et 2", anchor: "ateliers un et deux", at: { x: 0.64, y: 0.46, r: 0.28 } },
      ] },
    { title: "Choisir la base", keywords: ["Superficie", "Factures", "Heures-machines"], cueLayout: "verified", audio: "/audio/scene-3.mp3",
      narration: "Pour chaque transfert, pose-toi une question : quelle mesure explique le mieux le service consommé? Pour les frais du bâtiment, c'est la superficie. Pour l'approvisionnement, le nombre de factures. Pour l'entretien, les heures-machines.",
      cues: [
        { label: "Superficie", anchor: "superficie", at: { x: 0.30, y: 0.20, r: 0.14 } },
        { label: "Factures", anchor: "factures", at: { x: 0.69, y: 0.19, r: 0.12 } },
        { label: "Heures-machines", anchor: "heures-machines", at: { x: 0.83, y: 0.56, r: 0.13 } },
      ] },
    { title: "Tracer le parcours", keywords: ["Frais", "Sections", "Commande AR-300"], cueLayout: "verified", audio: "/audio/scene-4.mp3",
      narration: "Dessine toujours le chemin avant de calculer. L'argent part des frais communs, passe par les sections auxiliaires, arrive dans les ateliers, puis termine sa route dans la commande AR-300. Si tu connais le chemin, tu ne te perds pas dans les chiffres.",
      cues: [
        { label: "Frais communs", anchor: "frais communs", at: { x: 0.06, y: 0.46, r: 0.09 } },
        { label: "Sections auxiliaires", anchor: "auxiliaires", at: { x: 0.48, y: 0.46, r: 0.18 } },
        { label: "Ateliers", anchor: "ateliers", at: { x: 0.72, y: 0.62, r: 0.10 } },
        { label: "Commande AR-300", anchor: "AR-300", at: { x: 0.90, y: 0.42, r: 0.10 } },
      ] },
    { title: "Répartir par superficie", keywords: ["Plan des locaux", "Proportion de chaque section"], cueLayout: "verified", audio: "/audio/scene-5.mp3",
      narration: "Première étape : les frais communs. Regarde le plan des locaux. Chaque section reçoit une part proportionnelle à ses mètres carrés. Une grande pièce reçoit plus, une petite pièce reçoit moins. Vérifie que la somme distribuée égale exactement le total de départ.",
      cues: [
        { label: "Plan des locaux", anchor: "plan des locaux", at: { x: 0.50, y: 0.63, r: 0.26 } },
        { label: "Mètres carrés", anchor: "mètres carrés" },
        { label: "Somme exacte", anchor: "somme", at: { x: 0.50, y: 0.13, r: 0.09 } },
      ] },
    { title: "Fermer l'approvisionnement", keywords: ["Nombre de factures", "Section fermée"], cueLayout: "verified", audio: "/audio/scene-6.mp3",
      narration: "Avec la méthode séquentielle, on ferme d'abord l'approvisionnement, parce qu'il rend service à l'entretien. On répartit son total selon le nombre de factures traitées pour chaque section. Attention : une section ne se redistribue jamais à elle-même. Une fois répartie, elle est fermée.",
      cues: [
        { label: "Méthode séquentielle", anchor: "séquentielle" },
        { label: "Nombre de factures", anchor: "factures", at: { x: 0.54, y: 0.48, r: 0.14 } },
        { label: "Section fermée", anchor: "fermée", at: { x: 0.13, y: 0.59, r: 0.10 } },
      ] },
    { title: "Fermer l'entretien", keywords: ["Heures-machines", "Vers les ateliers"], cueLayout: "verified", audio: "/audio/scene-7.mp3",
      narration: "Ensuite, l'entretien. Son total inclut maintenant la part reçue de l'approvisionnement. On le répartit entre les deux ateliers selon les heures-machines. L'atelier qui utilise le plus ses machines reçoit la plus grosse flèche.",
      cues: [
        { label: "Part de l'appro", anchor: "approvisionnement" },
        { label: "Heures-machines", anchor: "heures-machines", at: { x: 0.29, y: 0.18, r: 0.08 } },
        { label: "La plus grosse flèche", anchor: "flèche", at: { x: 0.57, y: 0.31, r: 0.10 } },
      ] },
    { title: "Calculer les taux", keywords: ["Frais de l'atelier", "÷ activité", "= taux"], cueLayout: "verified", audio: "/audio/scene-8.mp3",
      narration: "Chaque atelier a maintenant son total. On calcule un taux d'imputation : les frais de l'atelier, divisés par son activité. Pour l'atelier un, l'activité, ce sont les heures-machines. Pour l'atelier deux, les heures de main-d'œuvre directe. Écris toujours l'unité : dollars par heure.",
      cues: [
        { label: "Taux d'imputation", anchor: "taux d'imputation", at: { x: 0.50, y: 0.47, r: 0.20 } },
        { label: "Atelier 1 : heures-machines", anchor: "heures-machines", at: { x: 0.30, y: 0.67, r: 0.12 } },
        { label: "Atelier 2 : heures MOD", anchor: "main-d'œuvre", at: { x: 0.85, y: 0.68, r: 0.13 } },
        { label: "$ par heure", anchor: "dollars par heure", at: { x: 0.70, y: 0.47, r: 0.10 } },
      ] },
    { title: "Imputer à AR-300", keywords: ["Taux × heures utilisées", "Fiche de commande"], cueLayout: "verified", audio: "/audio/scene-9.mp3",
      narration: "Place à la commande AR-300. Pour chaque atelier, multiplie son taux par les heures que la commande a réellement utilisées en février. Additionne les deux montants : tu obtiens les frais indirects imputés à la commande.",
      cues: [
        { label: "Taux × heures", anchor: "multiplie", at: { x: 0.56, y: 0.57, r: 0.17 } },
        { label: "Février", anchor: "février" },
        { label: "On additionne", anchor: "additionne", at: { x: 0.57, y: 0.57, r: 0.17 } },
      ] },
    { title: "Vérifier", keywords: ["Totaux équilibrés", "Arrondi final seulement"], cueLayout: "verified", audio: "/audio/scene-10.mp3",
      narration: "Dernière étape : vérifie. Tous les frais répartis doivent se retrouver dans les ateliers. Garde plusieurs décimales pendant les calculs, et n'arrondis que le résultat final. Bravo, tu es prêt à résoudre le TP!",
      cues: [
        { label: "Tout se retrouve aux ateliers", anchor: "ateliers", at: { x: 0.26, y: 0.50, r: 0.17 } },
        { label: "Plusieurs décimales", anchor: "décimales", at: { x: 0.57, y: 0.46, r: 0.13 } },
        { label: "Arrondi final", anchor: "arrondis", at: { x: 0.85, y: 0.44, r: 0.10 } },
      ] },
  ],
  summary: {
    intro: "Les frais indirects passent des sections auxiliaires vers les ateliers avant d'être imputés aux commandes. Chaque transfert utilise la base qui représente le service réellement consommé.",
    points: [
      { title: "1. Classer", text: "Frais spécifiques : une seule section. Frais communs : à répartir." },
      { title: "2. Répartir", text: "Méthode séquentielle : approvisionnement d'abord (factures), puis entretien (heures-machines)." },
      { title: "3. Imputer", text: "Taux = frais de l'atelier ÷ activité. Puis taux × heures utilisées par la commande." },
    ],
    rule: "Une section ne se redistribue jamais à elle-même, et on n'arrondit qu'au résultat final.",
  },
  guide: [
    { title: "Classer les frais", question: "Les frais du bâtiment servent à toutes les sections. Quelle base utilises-tu pour les répartir? Écris le nom de la base.", accepted: ["superficie", "metres carres", "m2", "surface", "pieds carres"], hint: "Pense aux frais du bâtiment : qu'est-ce qui mesure la place occupée par chaque section?" },
    { title: "Ordre de fermeture", question: "Avec la méthode séquentielle, quelle section auxiliaire fermes-tu en premier?", accepted: ["approvisionnement", "appro"], hint: "Laquelle rend service à l'autre section auxiliaire?" },
    { title: "Base de l'approvisionnement", question: "Quelle base utilises-tu pour répartir l'approvisionnement?", accepted: ["facture", "factures", "nombre de factures"], hint: "Qu'est-ce que l'approvisionnement traite toute la journée?" },
    { title: "Base de l'entretien", question: "Quelle base utilises-tu pour répartir l'entretien?", accepted: ["heures-machines", "heures machines", "heure machine", "heures-machine", "hm"], hint: "L'entretien répare des machines… comment mesurer leur utilisation?" },
    { title: "Taux de l'atelier 2", question: "Quelle unité d'activité sert au taux de l'atelier 2?", accepted: ["heures mod", "mod", "main-d'oeuvre directe", "main d'oeuvre directe", "heures de main-d'oeuvre directe", "heures de main d'oeuvre directe", "main-d'œuvre directe", "heures de main-d'œuvre directe"], hint: "Regarde l'énoncé : l'atelier 2 est surtout manuel." },
  ],
  correction: [
    { title: "A. Frais communs", detail: "Chaque section reçoit : frais communs × (sa superficie ÷ superficie totale). La somme des parts = total des frais communs." },
    { title: "B. Approvisionnement", detail: "Total appro (spécifiques + part des communs) × (factures de la section ÷ factures des autres sections). L'appro n'est pas inclus dans le dénominateur." },
    { title: "C. Entretien", detail: "Total entretien (spécifiques + communs + part de l'appro) × (heures-machines de l'atelier ÷ heures-machines des deux ateliers)." },
    { title: "D. Taux", detail: "Atelier 1 : total ÷ heures-machines prévues. Atelier 2 : total ÷ heures MOD prévues." },
    { title: "E. Commande AR-300", detail: "Taux atelier 1 × HM utilisées + taux atelier 2 × heures MOD utilisées en février." },
  ],
  quiz: [
    { question: "Quelle base explique le mieux les services rendus par l'approvisionnement?", options: ["La superficie", "Le nombre de factures", "Les heures de MOD", "Le coût des matières"], answer: 1, explanation: "Le nombre de factures mesure le travail réellement effectué par l'approvisionnement." },
    { question: "Dans la méthode séquentielle, une section peut-elle se redistribuer à elle-même?", options: ["Oui, toujours", "Seulement l'entretien", "Non, jamais", "Seulement si elle est principale"], answer: 2, explanation: "Une section fermée ne reçoit plus rien et ne se redistribue jamais à elle-même." },
    { question: "Pourquoi ferme-t-on l'approvisionnement avant l'entretien?", options: ["C'est la plus grosse", "Elle rend service à l'entretien", "Par ordre alphabétique", "Parce que l'énoncé l'oublie"], answer: 1, explanation: "On ferme d'abord la section qui rend service à l'autre section auxiliaire." },
    { question: "Comment calcule-t-on le taux d'imputation d'un atelier?", options: ["Activité ÷ frais", "Frais × activité", "Frais de l'atelier ÷ activité", "Frais ÷ nombre de commandes"], answer: 2, explanation: "Taux = frais de l'atelier ÷ unité d'activité (ex. $ par heure-machine)." },
    { question: "Quand faut-il arrondir?", options: ["À chaque étape", "Jamais", "Seulement au résultat final", "Au dixième dès le départ"], answer: 2, explanation: "Arrondir trop tôt crée des écarts : garde plusieurs décimales jusqu'à la fin." },
  ],
};

demoLesson.scenes.forEach((scene, i) => { const b = BOARDS[i]; if (b) scene.board = b; });
