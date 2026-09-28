import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { CHARACTER_POSES, CHARACTER_ROLES } from "./character-catalog";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import type { LessonContent } from "@/lib/lesson-types";
import { PROCEDURAL_ICON_CATALOG } from "./procedural-icon-catalog";
import { hasDistinctProceduralGraphic } from "./procedural-icon-renderer";

const GATEWAY = "https://ai.gateway.lovable.dev";

function apiKey() {
  const key = process.env["LOVABLE_API_KEY"];
  if (!key) throw new Error("Configuration IA manquante.");
  return key;
}

async function gatewayError(res: Response) {
  let msg = "";
  try { const j = await res.json(); msg = j?.error?.message ?? j?.message ?? ""; } catch { /* ignore */ }
  if (res.status === 402) return new Error("Crédits IA épuisés. Ajoutez des crédits dans Paramètres → Forfaits et crédits.");
  if (res.status === 429) return new Error("Trop de demandes en même temps. Réessayez dans un instant.");
  return new Error(msg || `Erreur du service IA (${res.status}).`);
}

const lessonSchema = z.object({
  title: z.string(),
  subject: z.string(),
  scenes: z.array(z.object({
    title: z.string(),
    narration: z.string(),
    keywords: z.array(z.string()),
    // Strict json_schema: every property must be required; optional = nullable.
    cues: z.array(z.object({
      label: z.string(),
      anchor: z.string(),
      at: z.object({ x: z.number(), y: z.number(), r: z.number() }).nullable(),
    })).nullable(),
    board: z.object({
      layout: z.enum(["comparison", "steps", "pipeline", "hierarchy", "formula", "key-rule", "timeline", "cycle", "chart"]),
      heading: z.string(),
      elements: z.array(z.object({
        kind: z.enum(["icon", "text", "formula", "rule", "badge", "callout", "character", "illustration"]),
        asset: z.string().max(80).nullable(),
        text: z.string(),
        anchor: z.string(),
        group: z.number().nullable(),
        symbol: z.enum(["check", "cross", "question", "warning", "star", "plus", "minus", "equals", "percent", "up", "down"]).nullable(),
        value: z.number().nullable(),
        role: z.enum(CHARACTER_ROLES).nullable(),
        pose: z.enum(CHARACTER_POSES).nullable(),
      })),
    }),

  })),
  summary: z.object({
    intro: z.string(),
    points: z.array(z.object({ title: z.string(), text: z.string() })),
    rule: z.string(),
  }),
  guide: z.array(z.object({ title: z.string(), question: z.string(), accepted: z.array(z.string()), hint: z.string() })),
  correction: z.array(z.object({ title: z.string(), detail: z.string() })),
  quiz: z.array(z.object({ question: z.string(), options: z.array(z.string()), answer: z.number(), explanation: z.string() })),
});

const cueCalibrationSchema = z.object({
  spots: z.array(z.object({
    index: z.number(),
    x: z.number().nullable(),
    y: z.number().nullable(),
    r: z.number().nullable(),
    confidence: z.number(),
  })),
});

type Depth = "essentiel" | "standard" | "approfondi" | "examen";

const DEPTH_TEXT: Record<Depth, string> = {
  essentiel: "Concentre-toi sur les concepts principaux, sans digression.",
  standard: "Explique les concepts et illustre chacun avec un exemple concret des notes.",
  approfondi: "Explique les concepts, les exemples ET le raisonnement détaillé étape par étape, avec les calculs intermédiaires.",
  examen: "Priorise ce qu'il faut absolument savoir pour résoudre les problèmes d'examen : méthodes, formules, pièges.",
};

// A narrated scene runs about 20 seconds, so scene count drives the video length.
function planFor(minutes: number, depth: Depth) {
  const scenes = Math.max(6, Math.min(26, Math.round((minutes * 60) / 20)));
  return { scenes, text: `Durée cible de la vidéo : environ ${minutes} minutes, donc ${scenes - 1} à ${scenes} scènes. N'étire JAMAIS le propos avec des répétitions ou du remplissage : pour allonger, ajoute de la vraie matière (exemples supplémentaires, sous-étapes de calcul, cas limites, récapitulatif). ${DEPTH_TEXT[depth]}` };
}

const SYSTEM = (plan: string, availableIcons: string, availableIllustrations: string) => `Tu es un professeur québécois bienveillant qui transforme des notes de cours en leçon vidéo de type tableau blanc, en français.
${plan}
Produis :
- title et subject courts.
- scenes : LA PREMIÈRE SCÈNE EST UNE VRAIE INTRO (pas de matière encore) : une accroche chaleureuse (« Salut! Aujourd'hui, on... »), pourquoi c'est important (« si tu te trompes... »), une promesse claire (« en quelques minutes tu vas voir... ») et le plan de la leçon. Elle se termine par « C'est parti! ». Les scènes suivantes suivent un ordre pédagogique. La dernière scène est un récapitulatif encourageant.
- narration = 2 à 4 phrases parlées (45 à 70 mots), tutoiement, ton chaleureux, avec un exemple concret tiré des notes.
- board : le tableau blanc composé de la scène (aucune image générée). layout = une disposition parmi comparison (deux colonnes opposées), steps (étapes numérotées), pipeline (flux avec flèches), hierarchy (un élément en haut qui alimente ceux du bas), formula (formules et données), key-rule (éléments côte à côte), timeline (chronologie sur une ligne pointillée, éléments alternés dessus/dessous, ordre chronologique), cycle (éléments en cercle avec flèches en boucle — pour les processus qui reviennent au départ), chart (graphique à barres : chaque élément est une barre, value = la mesure numérique, text = étiquette courte). heading = titre court écrit à la main (ex. « 2. Choisir la base »). elements = 3 à 6 éléments DANS L'ORDRE OÙ LA NARRATION LES NOMME : kind icon (asset = la clé exacte placée avant les deux-points dans la bibliothèque ci-dessous, text = légende de 1 à 4 mots), text (courte note manuscrite, asset null), formula (formule ou calcul court, asset null), badge (pastille avec un glyphe symbol et une courte légende : check/cross pour vrai-faux, question pour une interrogation, warning pour un piège, up/down/plus/minus/equals/percent pour les variations, star pour un point clé — asset null), callout (bulle d'explication de 3 à 10 mots qui commente le reste du tableau — max 1 par scène, asset null), character (personnage du catalogue local, au plus 1 par scène et seulement quand un humain rend le concept plus concret : role parmi ${CHARACTER_ROLES.join(", ")}, pose parmi ${CHARACTER_POSES.join(", ")}, text = courte légende, asset null), illustration (un dessin réel APPROUVÉ de la bibliothèque ci-dessous, au plus 1 par scène et seulement quand sa description correspond vraiment au contexte de la scène — ex. une scène de classe, un étudiant qui réfléchit : asset = la clé exacte avant les deux-points, text = courte légende; ne JAMAIS inventer de clé et ne jamais l'utiliser pour un concept que la description ne couvre pas), rule (au plus une par scène : la règle clé écrite dans le bandeau du bas, asset null). anchor = 1 à 3 mots copiés TEXTUELLEMENT de la narration (mêmes accents) au moment exact où l'élément doit apparaître; chaque anchor doit apparaître après celui de l'élément précédent. group = 0 (gauche) ou 1 (droite) seulement pour comparison, sinon null. symbol, value, role et pose = null sauf badge (symbol), chart (value) et character (role, pose). Choisis le layout qui rend la structure du concept la plus claire — timeline pour les dates/étapes datées, cycle pour les boucles, chart pour comparer des mesures, comparison pour opposer deux idées. Bibliothèque d'icônes actives : ${availableIcons}. Dessins approuvés disponibles (clé : contenu réel du dessin) : ${availableIllustrations || "aucun"}.
- RÈGLES VISUELLES OBLIGATOIRES : ${availableIllustrations ? "préfère TOUJOURS kind illustration à kind character; place un dessin approuvé dans au moins la moitié des scènes (intro et récapitulatif compris), choisi d'après son contenu réel pour évoquer la situation humaine de la scène (étudiant qui réfléchit, qui lit, qui se trompe, qui calcule, professionnel au bureau…)." : ""} Une icône doit représenter LITTÉRALEMENT sa légende (jamais une icône vague pour une idée abstraite — utilise alors text ou badge). En comparison, chaque colonne contient au moins une icône ou un dessin qui illustre son idée, pas seulement du texte.
- cues = null. keywords = 2 ou 3 mots-clés très courts (max 4 mots chacun).
- summary : intro (2 phrases), points = exactement 3 idées clés, rule = la règle d'or.
- guide : 4 à 6 étapes pour résoudre l'exercice des notes SANS jamais donner de résultat chiffré. question = une question courte à laquelle l'étudiant répond par un mot ou une courte expression (méthode, base, ordre, formule). accepted = 3 à 8 réponses acceptables en minuscules sans accents superflus. hint = un indice qui guide sans donner la réponse. S'il n'y a pas d'exercice, crée des étapes d'application des concepts.
- correction : 4 à 6 étapes du corrigé détaillé, avec les calculs si les données sont présentes.
- quiz : exactement 5 questions à choix multiples, 4 options chacune, answer = index 0-3 de la bonne option, explanation courte.`;


export const generateLesson = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({
    files: z.array(z.object({
      name: z.string().max(200),
      text: z.string().max(80000).nullable(),
      base64: z.string().max(14_000_000).nullable(),
      mediaType: z.string().max(80).nullable(),
    })).min(1).max(6),
    minutes: z.number().int().min(2).max(10).nullable(),
    depth: z.enum(["essentiel", "standard", "approfondi", "examen"]),
  }).parse(d))
  .handler(async ({ data, context }) => {
    if (!data.files.some((f) => f.text || f.base64)) throw new Error("Aucun contenu à analyser.");
    const key = apiKey();
    const { streamText, Output } = await import("ai");
    const { createOpenAI } = await import("@ai-sdk/openai");
    const lovable = createOpenAI({
      baseURL: `${GATEWAY}/v1`,
      apiKey: key,
      headers: { "Lovable-API-Key": key, "X-Lovable-AIG-SDK": "vercel-ai-sdk" },
    });
    // "AI decides": scale the lesson with how much material was given.
    const weight = data.files.reduce((n, f) => n + (f.base64 ? 3 : Math.ceil((f.text?.length ?? 0) / 4000)), 0);
    const minutes = data.minutes ?? (weight <= 2 ? 3 : weight <= 6 ? 5 : weight <= 12 ? 8 : 10);
    const plan = planFor(minutes, data.depth);
    const { data: hiddenRows } = await context.supabase.from("procedural_icon_visibility").select("key").eq("hidden", true);
    const hiddenIcons = new Set((hiddenRows ?? []).map((row) => row.key));
    const availableIcons = PROCEDURAL_ICON_CATALOG.filter((item) => hasDistinctProceduralGraphic(item) && !hiddenIcons.has(item.key)).map((item) => `${item.key}:${item.label}`).join(", ");
    // Approved library drawings: the AI matches on the real visual content, never the title.
    const { data: approvedRows } = await context.supabase.from("illustrations").select("key,visual_description").eq("status", "approved");
    const approvedIllustrations = new Map((approvedRows ?? []).map((row) => [row.key, row.visual_description ?? "dessin approuvé"]));
    const availableIllustrations = [...approvedIllustrations].map(([k, desc]) => `${k}:${desc}`).join(", ");
    const approvedKeys = [...approvedIllustrations.keys()];
    const norm = (v: string | null | undefined) => (v ?? "").toLowerCase().replace(/[-_]/g, " ").trim();
    const matchApproved = (role: string | null | undefined, pose: string | null | undefined) => {
      const r = norm(role), p = norm(pose);
      const parts = (k: string) => k.split(":").map(norm);
      return approvedKeys.find((k) => parts(k)[1] === r && parts(k)[2] === p)
        ?? approvedKeys.find((k) => parts(k)[1] === r && (parts(k)[2] ?? "").includes(p.split(" ")[0] ?? "~"))
        ?? approvedKeys.find((k) => parts(k)[2] === p)
        ?? approvedKeys.find((k) => parts(k)[1] === r)
        ?? null;
    };

    type Part = { type: "text"; text: string } | { type: "file"; data: string; mediaType: string; filename?: string } | { type: "image"; image: string; mediaType: string };
    const parts: Part[] = [
      { type: "text", text: `Voici ${data.files.length > 1 ? `les ${data.files.length} documents de cours` : "les notes de cours"} : ${data.files.map((f) => f.name).join(", ")}. Traite-les comme une seule matière cohérente et crée la leçon complète.` },
    ];
    for (const f of data.files) {
      parts.push({ type: "text", text: `--- Document : ${f.name} ---` });
      if (f.text) parts.push({ type: "text", text: f.text });
      else if (f.base64 && f.mediaType?.startsWith("image/")) parts.push({ type: "image", image: f.base64, mediaType: f.mediaType });
      else if (f.base64) parts.push({ type: "file", data: f.base64, mediaType: f.mediaType ?? "application/pdf", filename: f.name });
    }

    let result;
    try {
      const r = streamText({
        model: lovable.responses("openai/gpt-6-astra"),
        system: SYSTEM(plan.text, availableIcons, availableIllustrations),
        messages: [{ role: "user", content: parts }],
        output: Output.object({ schema: lessonSchema }),
        maxRetries: 0,
        providerOptions: { openai: { forceReasoning: true, reasoningEffort: "low", reasoningSummary: "auto", store: false, include: ["reasoning.encrypted_content"] } },
      });
      result = await r.output;
    } catch (e) {
      const status = (e as { statusCode?: number })?.statusCode;
      if (status === 402) throw new Error("Crédits IA épuisés. Ajoutez des crédits dans Paramètres → Forfaits et crédits.");
      if (status === 429) throw new Error("Trop de demandes en même temps. Réessayez dans un instant.");
      console.error("generateLesson", e);
      throw new Error("L'IA n'a pas pu analyser ces documents. Essayez des fichiers plus courts ou en texte.");
    }
    const content: LessonContent = {
      ...result,
      scenes: result.scenes.slice(0, plan.scenes).map((s) => {
        let illustrations = 0;
        return {
        title: s.title,
        narration: s.narration,
        keywords: s.keywords.slice(0, 3),
        board: {
          layout: s.board.layout,
          heading: s.board.heading,
          elements: s.board.elements.slice(0, 7).map((e) => {
            // Stick-figure characters are replaced by the closest approved drawing.
            const wanted = e.kind === "character" ? matchApproved(e.role, e.pose) : e.asset;
            const okIllustration = (e.kind === "illustration" || e.kind === "character") && !!wanted && approvedIllustrations.has(wanted) && illustrations++ < 1;
            return {
              ...e,
              kind: okIllustration ? "illustration" as const : e.kind === "illustration" ? "character" as const : e.kind,
              asset: okIllustration ? wanted : e.kind === "icon" && e.asset && !hiddenIcons.has(e.asset) && PROCEDURAL_ICON_CATALOG.some((item) => item.key === e.asset && hasDistinctProceduralGraphic(item)) ? e.asset : null,
              symbol: e.kind === "badge" ? (e.symbol ?? "check") : null,
              value: e.kind === "badge" || e.kind === "callout" || e.kind === "character" ? null : (e.value ?? null),
              role: e.kind === "character" ? (e.role ?? "student") : null,
              pose: e.kind === "character" ? (e.pose ?? "standing") : null,
            };
          }),
        },

        image: null,
        audio: null,
        };
      }),
      quiz: result.quiz.slice(0, 5).map((q) => ({ ...q, answer: Math.max(0, Math.min(q.options.length - 1, Math.round(q.answer))) })),
      guide: result.guide.map((g) => ({ ...g, accepted: g.accepted.map(normalize) })),
    };
    const { data: row, error } = await context.supabase.from("lessons")
      .insert({ user_id: context.userId, title: content.title, subject: content.subject, status: "media", content: content as never })
      .select("id").single();
    if (error) throw new Error("Impossible d'enregistrer la leçon.");
    return { id: row.id, sceneCount: content.scenes.length };
  });

export const generateSceneMedia = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ lessonId: z.string().uuid(), index: z.number().int().min(0).max(30) }).parse(d))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { data: lesson, error } = await supabase.from("lessons").select("content").eq("id", data.lessonId).single();
    if (error || !lesson) throw new Error("Leçon introuvable.");
    const content = lesson.content as unknown as LessonContent;
    const scene = content.scenes[data.index];
    if (!scene) throw new Error("Scène introuvable.");
    const key = apiKey();
    const base = `${userId}/${data.lessonId}/scene-${data.index + 1}`;

    const imgPromise = (async (): Promise<{ path: string; b64?: string }> => {
      if (scene.image) return { path: scene.image };
      if (scene.board) return { path: "" };
      const res = await fetch(`${GATEWAY}/v1/images/generations`, {
        method: "POST",
        headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          model: "openai/gpt-image-2.5-sunburst",
          prompt: `Whiteboard explainer illustration, hand-drawn black marker line art on pure white background, VideoScribe doodle style, clean and friendly. ${scene.imagePrompt}. Sparse soft pastel yellow, mint green or lavender marker fill accents. No text, no letters, no numbers, no words. Centered composition with lots of white space.`,
          size: "1536x1024",
          quality: "low",
        }),
      });
      if (!res.ok) throw await gatewayError(res);
      const j = await res.json() as { data?: { b64_json?: string }[] };
      const b64 = j.data?.[0]?.b64_json;
      if (!b64) throw new Error("L'illustration n'a pas pu être créée.");
      const bytes = Uint8Array.from(atob(b64), (c) => c.charCodeAt(0));
      const path = `${base}.png`;
      const up = await supabase.storage.from("lesson-media").upload(path, bytes, { contentType: "image/png", upsert: true });
      if (up.error) throw new Error("Impossible d'enregistrer l'illustration.");
      return { path, b64 };
    })();

    const audioPromise = (async () => {
      if (scene.audio) return scene.audio;
      const res = await fetch(`${GATEWAY}/v1/audio/speech`, {
        method: "POST",
        headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          model: "google/gemini-3.1-flash-tts-preview",
          contents: [{ role: "user", parts: [{ text: `Dis ceci en français québécois, d'un ton chaleureux et clair de professeure : ${scene.narration}` }] }],
          generationConfig: { responseModalities: ["AUDIO"], speechConfig: { voiceConfig: { prebuiltVoiceConfig: { voiceName: "Kore" } } } },
          stream_format: "audio",
        }),
      });
      if (!res.ok) throw await gatewayError(res);
      const bytes = new Uint8Array(await res.arrayBuffer());
      const path = `${base}.wav`;
      const up = await supabase.storage.from("lesson-media").upload(path, bytes, { contentType: "audio/wav", upsert: true });
      if (up.error) throw new Error("Impossible d'enregistrer la voix.");
      return path;
    })();

    const [generatedImage, audio] = await Promise.all([imgPromise, audioPromise]);
    const image = generatedImage.path || null;
    let calibratedCues = scene.cues;
    let cueLayout = scene.cueLayout;
    if (generatedImage.b64 && scene.cues?.length) {
      try {
        const { streamText, Output } = await import("ai");
        const { createOpenAI } = await import("@ai-sdk/openai");
        const lovable = createOpenAI({
          baseURL: `${GATEWAY}/v1`,
          apiKey: key,
          headers: { "Lovable-API-Key": key, "X-Lovable-AIG-SDK": "vercel-ai-sdk" },
        });
        const labels = scene.cues.map((cue, index) => `${index}: ${cue.label}`).join("\n");
        const calibration = streamText({
          model: lovable.responses("openai/gpt-6-astra"),
          system: `Inspecte précisément l'illustration fournie. Elle sera affichée avec un recadrage centré au format 16:9 : ignore les bandes qui seront coupées en haut et en bas et donne les coordonnées dans la zone 16:9 visible. Pour chaque objet demandé, retourne son centre x,y normalisé entre 0 et 1 dans cette zone visible et un rayon r entre 0.06 et 0.20 qui entoure l'objet sans englober ses voisins. Si l'objet n'est pas clairement visible, s'il n'existe pas, ou s'il est ambigu, retourne x, y et r à null et une confiance inférieure à 0.75. Ne devine jamais et ne pointe jamais une zone vide. L'index doit rester identique.`,
          messages: [{ role: "user", content: [
            { type: "text", text: `Localise ces objets dans l'image :\n${labels}` },
            { type: "image", image: generatedImage.b64, mediaType: "image/png" },
          ] }],
          output: Output.object({ schema: cueCalibrationSchema }),
          maxRetries: 1,
          providerOptions: { openai: { forceReasoning: true, reasoningEffort: "low", store: false } },
        });
        const measured = await calibration.output;
        const byIndex = new Map(measured.spots.map((spot) => [Math.round(spot.index), spot]));
        calibratedCues = scene.cues.map((cue, index) => {
          const spot = byIndex.get(index);
          if (!spot || spot.confidence < 0.75 || spot.x === null || spot.y === null || spot.r === null) {
            return { label: cue.label, anchor: cue.anchor };
          }
          return {
            label: cue.label,
            anchor: cue.anchor,
            at: {
              x: Math.max(0.04, Math.min(0.96, spot.x)),
              y: Math.max(0.04, Math.min(0.96, spot.y)),
              r: Math.max(0.06, Math.min(0.2, spot.r)),
            },
          };
        });
        cueLayout = "verified";
      } catch (e) {
        console.error("calibrateSceneCues", e);
        calibratedCues = scene.cues.map((cue) => ({ label: cue.label, anchor: cue.anchor }));
      }
    }
    const { data: fresh } = await supabase.from("lessons").select("content").eq("id", data.lessonId).single();
    const next = (fresh?.content ?? content) as unknown as LessonContent;
    next.scenes[data.index] = {
      ...next.scenes[data.index]!,
      image,
      audio,
      ...(calibratedCues ? { cues: calibratedCues } : {}),
      ...(cueLayout ? { cueLayout } : {}),
    };
    const done = next.scenes.every((s) => (s.image || s.board) && s.audio);
    await supabase.from("lessons").update({ content: next as never, status: done ? "ready" : "media", updated_at: new Date().toISOString() }).eq("id", data.lessonId);
    return { done };
  });

export const listLessons = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data, error } = await context.supabase.from("lessons").select("id,title,subject,status,progress,created_at").order("created_at", { ascending: false }).limit(50);
    if (error) throw new Error("Impossible de charger vos leçons.");
    return data;
  });

export const getLesson = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { data: row, error } = await context.supabase.from("lessons").select("id,title,subject,status,content").eq("id", data.id).single();
    if (error || !row) throw new Error("Leçon introuvable.");
    const content = row.content as unknown as LessonContent;
    const paths = content.scenes.flatMap((s) => [s.image, s.audio]).filter((p): p is string => !!p);
    const signed = paths.length ? (await context.supabase.storage.from("lesson-media").createSignedUrls(paths, 60 * 60 * 6)).data ?? [] : [];
    const map = new Map(signed.map((s) => [s.path, s.signedUrl]));
    // Approved illustration SVGs are injected at read time so lessons store only the key.
    const illKeys = [...new Set(content.scenes.flatMap((s) => s.board?.elements.filter((e) => e.kind === "illustration" && e.asset).map((e) => e.asset!) ?? []))];
    const illRows = illKeys.length ? (await context.supabase.from("illustrations").select("key,svg").in("key", illKeys).eq("status", "approved")).data ?? [] : [];
    const svgs = new Map(illRows.map((r) => [r.key, r.svg as string]));
    return { id: row.id, status: row.status, content: {
      ...content,
      scenes: content.scenes.map((s) => ({
        ...s,
        image: s.image ? map.get(s.image) ?? null : null,
        audio: s.audio ? map.get(s.audio) ?? null : null,
        ...(s.board ? { board: { ...s.board, elements: s.board.elements.map((e) => (e.kind === "illustration" ? { ...e, svg: svgs.get(e.asset ?? "") ?? null } : e)) } } : {}),
      })),
    } };
  });

export const deleteLesson = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    await context.supabase.from("lessons").delete().eq("id", data.id);
    return { ok: true };
  });

function normalize(s: string) {
  return s.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[’']/g, "'").trim();
}
