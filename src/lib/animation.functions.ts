import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import type { AnimScript, PageAnalysis } from "./animation-types";

// Tous les appels OpenAI passent par la clé de l'utilisateur, lue côté serveur
// uniquement, dans le handler. Aucun crédit Lovable n'est consommé.

const zoneSchema = z.object({
  x: z.number().min(0).max(1),
  y: z.number().min(0).max(1),
  w: z.number().min(0).max(1),
  h: z.number().min(0).max(1),
});

async function openaiChat(apiKey: string, messages: unknown[], maxTokens: number): Promise<string> {
  const res = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      model: "gpt-4o-mini",
      messages,
      max_tokens: maxTokens,
      response_format: { type: "json_object" },
    }),
  });
  if (!res.ok) {
    const detail = await res.text().catch(() => "");
    if (res.status === 401) throw new Error("Clé OpenAI invalide — vérifie-la dans les réglages du projet.");
    if (res.status === 429) throw new Error(await quotaMessage(res));
    throw new Error(`OpenAI a refusé la demande (${res.status}). ${detail.slice(0, 200)}`);
  }
  const json = (await res.json()) as { choices?: { message?: { content?: string } }[] };
  const content = json.choices?.[0]?.message?.content;
  if (!content) throw new Error("OpenAI n'a rien renvoyé.");
  return content;
}

function getKey(): string {
  const key = process.env["OPENAI_API_KEY"];
  if (!key) throw new Error("Aucune clé OpenAI configurée — ajoute-la dans les réglages du projet.");
  return key;
}

// Étape 1 : analyse la page rendue en image et repère les zones animables.
export const analyzePage = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) =>
    z
      .object({
        image: z.string().min(100), // data URL PNG/JPEG de la page
        hints: z.array(z.string()).max(20).optional(), // éléments suggérés par l'étudiant
      })
      .parse(data),
  )
  .handler(async ({ data }): Promise<PageAnalysis> => {
    const apiKey = getKey();
    const hints = data.hints?.length
      ? `L'étudiant souhaite en particulier expliquer : ${data.hints.join(", ")}.`
      : "";
    const content = await openaiChat(apiKey, [
      {
        role: "system",
        content:
          "Tu es un assistant d'étude. On te donne l'image d'une page de cours ou de notes. " +
          "Repère les éléments pédagogiques importants (titre, définitions, formules, méthodes, exemples, résultats, schémas légendés). " +
          "Pour chacun, donne un label court en français, le texte exact repéré, et sa zone normalisée sur la page " +
          "(x, y, w, h entre 0 et 1 ; x,y = coin haut-gauche). " +
          "Les éléments illisibles, trop ambigus ou sans contenu pédagogique vont dans `rejected` avec une raison courte en français. " +
          'Réponds UNIQUEMENT en JSON : {"animable": [{"label": "...", "text": "...", "zone": {"x":0,"y":0,"w":0,"h":0}}], "rejected": [{"label": "...", "reason": "..."}]}. ' +
          "Maximum 8 éléments animables. " + hints,
      },
      {
        role: "user",
        content: [
          { type: "text", text: "Analyse cette page de cours." },
          { type: "image_url", image_url: { url: data.image, detail: "high" } },
        ],
      },
    ], 2000);
    const parsed = JSON.parse(content) as PageAnalysis;
    return {
      animable: (parsed.animable ?? []).filter((e) => e?.label && e?.zone).slice(0, 8),
      rejected: (parsed.rejected ?? []).filter((e) => e?.label).slice(0, 8),
    };
  });

// Étape 2 : écrit le script d'explication à partir des éléments choisis.
export const generateScript = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) =>
    z
      .object({
        title: z.string().min(1).max(200),
        elements: z
          .array(z.object({ label: z.string(), text: z.string(), zone: zoneSchema }))
          .min(1)
          .max(8),
      })
      .parse(data),
  )
  .handler(async ({ data }): Promise<AnimScript> => {
    const apiKey = getKey();
    const content = await openaiChat(apiKey, [
      {
        role: "system",
        content:
          "Tu es un tuteur bienveillant qui explique une page de cours à un étudiant, en français. " +
          "À partir des éléments fournis (avec leur zone normalisée sur la page), écris une explication animée : " +
          "une suite d'étapes, chacune = une phrase de narration claire et pédagogique (1 à 2 phrases courtes), " +
          "la zone à surligner pendant la phrase (reprends la zone de l'élément concerné, ou null), " +
          "et éventuellement une note à écrire (style: circle, arrow, underline ou margin ; texte très court pour margin, sinon chaîne vide ; zone où dessiner). " +
          "Ordre logique : d'abord le titre/contexte, puis les définitions, puis la méthode, puis l'exemple, puis le résultat. " +
          "6 à 10 étapes maximum. " +
          'Réponds UNIQUEMENT en JSON : {"title": "...", "steps": [{"narration": "...", "zone": {"x":0,"y":0,"w":0,"h":0} ou null, "note": {"text": "...", "style": "margin", "zone": {"x":0,"y":0,"w":0,"h":0}} ou null}]}.',
      },
      {
        role: "user",
        content: `Document : « ${data.title} ». Éléments à expliquer :\n` +
          data.elements.map((e, i) => `${i + 1}. ${e.label} — « ${e.text} » — zone ${JSON.stringify(e.zone)}`).join("\n"),
      },
    ], 3000);
    const parsed = JSON.parse(content) as AnimScript;
    return {
      title: parsed.title || data.title,
      steps: (parsed.steps ?? []).filter((s) => s?.narration).slice(0, 12),
    };
  });

// Étape 3 : génère la narration audio (TTS OpenAI) et la stocke dans le bucket privé.
export const generateAudio = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) =>
    z.object({ documentId: z.string().uuid(), text: z.string().min(1).max(4000) }).parse(data),
  )
  .handler(async ({ data, context }): Promise<{ audioPath: string }> => {
    const apiKey = getKey();
    const res = await fetch("https://api.openai.com/v1/audio/speech", {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({ model: "tts-1", voice: "nova", input: data.text, response_format: "mp3" }),
    });
    if (!res.ok) {
      if (res.status === 401) throw new Error("Clé OpenAI invalide — vérifie-la dans les réglages du projet.");
      if (res.status === 429) throw new Error(await quotaMessage(res));
      throw new Error(`La génération audio a échoué (${res.status}).`);
    }
    const audio = await res.arrayBuffer();
    const path = `${context.userId}/anims/${data.documentId}/${crypto.randomUUID()}.mp3`;
    const { error } = await context.supabase.storage
      .from("clario-files")
      .upload(path, audio, { contentType: "audio/mpeg", upsert: false });
    if (error) throw new Error("Impossible d'enregistrer l'audio : " + error.message);
    return { audioPath: path };
  });

// Étape 4 : enregistre l'animation dans le cours du document.
export const saveAnimation = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) =>
    z
      .object({
        documentId: z.string().uuid(),
        courseId: z.string().uuid().nullable(),
        page: z.number().int().min(0),
        title: z.string().min(1).max(200),
        script: z.object({
          title: z.string(),
          steps: z.array(
            z.object({
              narration: z.string(),
              zone: zoneSchema.nullable(),
              note: z
                .object({
                  text: z.string(),
                  style: z.enum(["circle", "arrow", "underline", "margin"]),
                  zone: zoneSchema,
                })
                .nullable(),
            }),
          ),
        }),
        audioPath: z.string().nullable(),
      })
      .parse(data),
  )
  .handler(async ({ data, context }): Promise<{ id: string }> => {
    const { data: row, error } = await context.supabase
      .from("animations")
      .insert({
        document_id: data.documentId,
        course_id: data.courseId,
        page: data.page,
        title: data.title,
        script: data.script,
        audio_path: data.audioPath,
      })
      .select("id")
      .single();
    if (error) throw new Error("Impossible d'enregistrer l'animation : " + error.message);
    return { id: row.id as string };
  });

export const deleteAnimation = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => z.object({ id: z.string().uuid() }).parse(data))
  .handler(async ({ data, context }) => {
    const { data: row } = await context.supabase
      .from("animations")
      .select("audio_path")
      .eq("id", data.id)
      .maybeSingle();
    if (row?.audio_path) await context.supabase.storage.from("clario-files").remove([row.audio_path]);
    const { error } = await context.supabase.from("animations").delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

// Distingue un compte sans crédits d'une simple limite temporaire.
async function quotaMessage(res: Response): Promise<string> {
  try {
    const body = (await res.json()) as { error?: { code?: string } };
    if (body?.error?.code === "insufficient_quota") return "Ton compte OpenAI n’a plus de crédits — ajoute-en sur platform.openai.com puis réessaie.";
  } catch { /* message générique */ }
  return "Limite OpenAI atteinte — réessaie dans un moment.";
}
