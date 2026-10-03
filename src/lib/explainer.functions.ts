import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import type { ExplainerScript, ExplainerVisual } from "./explainer-types";
import { createExplainerPlan } from "./explainer-generation.server";
import { friendlyOpenAIError } from "./openai-direct.server";
import { geminiTtsKey, synthesizeGemini } from "./gemini-tts.server";

const TYPES = ["title", "bullets", "formula", "steps", "compare", "page", "example", "outro"] as const;
const clamp = (n: unknown) => Math.max(0, Math.min(1, Number(n) || 0));
type RawVisual = Omit<Partial<ExplainerVisual>, "formula"> & { formula?: string | null };

function cleanVisual(v: RawVisual | undefined): ExplainerVisual {
  const type = TYPES.includes(v?.type as (typeof TYPES)[number]) ? (v?.type as ExplainerVisual["type"]) : "bullets";
  const items = Array.isArray(v?.items) ? v.items.filter((i) => typeof i === "string" && i.trim()).slice(0, 5).map((i) => i.slice(0, 90)) : [];
  const z = v?.zone;
  const zone = type === "page" && z ? { x: clamp(z.x), y: clamp(z.y), w: clamp(z.w), h: clamp(z.h) } : null;
  const valid = zone && zone.w > 0.05 && zone.h > 0.03;
  return {
    type: type === "page" && !valid ? "bullets" : type,
    heading: String(v?.heading ?? "").slice(0, 80),
    items,
    formula: type === "formula" ? String(v?.formula ?? "").slice(0, 160) : undefined,
    zone: valid ? zone : null,
    anchors: Array.isArray(v?.anchors) ? v.anchors.slice(0, items.length).map((a) => String(a).trim().slice(0, 100)) : [],
    formulaAnchor: type === "formula" && v?.formulaAnchor ? String(v.formulaAnchor).trim().slice(0, 100) : null,
    note: type === "outro" && v?.note ? String(v.note).slice(0, 140) : undefined,
  };
}

export const generateExplainer = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) =>
    z.object({
      documentId: z.string().uuid(),
      title: z.string().min(1).max(200),
      image: z.string().min(100).max(8_000_000),
      locale: z.enum(["en", "fr"]).optional(),
    }).parse(data),
  )
  .handler(async ({ data, context }): Promise<ExplainerScript> => {
    const base = `${context.userId}/anims/${data.documentId}/${crypto.randomUUID()}`;
    const fr = data.locale !== "en";

    // Crédit 🎬 retiré de façon atomique AVANT tout appel à l'IA.
    const { data: paid, error: cErr } = await context.supabase.rpc("consume_credit", { _kind: "video" });
    if (cErr || paid === 0)
      throw new Error(fr ? "Tu n'as plus de vidéos 🎬. Prends une recharge, le Pass ou le Club dans « Tarifs » pour continuer !" : "You're out of videos 🎬. Grab a top-up, the Pass or the Club in “Pricing” to keep going!");
    if (paid === 2)
      throw new Error(fr
        ? "🏖️ Oula, doucement champion ! Tes crédits sont bien au chaud et t'appartiennent pour toujours, mais mes processeurs commencent à chauffer. Clario a besoin de vacances. Je vais aux Bahamas et je te reviens le mois prochain."
        : "🏖️ Whoa, easy there, champ! Your credits are safe, sound and yours forever — but my processors are heating up. Clario needs a vacation. I'm off to the Bahamas and I'll be back next month!");
    const refund = async () => { try { const { supabaseAdmin } = await import("@/integrations/supabase/client.server"); await supabaseAdmin.rpc("refund_credit", { _uid: context.userId, _kind: "video" }); } catch (e) { console.error("refund failed", e); } };

    // 1. Sauvegarde de l'image de la page (pour les gros plans dans la vidéo).
    const m = /^data:(image\/(?:jpeg|png));base64,(.+)$/.exec(data.image);
    let pageImagePath: string | null = null;
    if (m) {
      const bytes = Uint8Array.from(atob(m[2]!), (c) => c.charCodeAt(0));
      const up = await context.supabase.storage.from("clario-files").upload(`${base}-page.jpg`, bytes, { contentType: m[1]!, upsert: false });
      if (!up.error) pageImagePath = `${base}-page.jpg`;
    }

    // 2. Script pédagogique (vision).
    let parsed: Awaited<ReturnType<typeof createExplainerPlan>>;
    try {
      parsed = await createExplainerPlan(data.title, data.image, fr ? "fr" : "en");
    } catch (error) {
      const status = (error as { statusCode?: number })?.statusCode;
      if (status === 401 || status === 402 || status === 429) { void refund(); throw new Error(friendlyOpenAIError(status, "")); }
      console.error("generateExplainer", error);
      void refund();
      const safeMessage = error instanceof Error ? error.message : "";
      throw new Error(safeMessage || (fr ? "Clario n’a pas réussi à préparer l’explication. Réessaie." : "Clario couldn't prepare the explanation. Try again."));
    }
    if (parsed.refused) {
      if (pageImagePath) await context.supabase.storage.from("clario-files").remove([pageImagePath]);
      void refund();
      throw new Error(fr ? "Clario ne peut pas animer ce type de contenu. Choisis une page de cours ou de révision ! 📚" : "Clario can't animate this type of content. Pick a course or revision page! 📚");
    }
    const content = parsed.scenes.filter((s) => s.narration.trim() && s.visual?.type !== "outro").slice(0, 7);
    if (!content.length) { void refund(); throw new Error(fr ? "Clario n’a rien trouvé à expliquer sur cette page." : "Clario couldn't find anything to explain on this page."); }
    // Scène finale ajoutée par le serveur, dans la langue détectée du DOCUMENT (pas celle de l'appli).
    const docFr = parsed.language ? parsed.language === "fr" : fr;
    const OUTRO = docFr
      ? "Tu as encore une question ou un doute sur cette page ? Clique sur Clario juste en bas à droite, je suis là pour t'aider ! Au revoir !"
      : "Still have a question or a doubt about this page? Tap Clario at the bottom right, I'm here to help! Bye!";
    const scenes = [...content, { narration: OUTRO, visual: { type: "outro" as const, heading: docFr ? "Une question ?" : "A question?", items: [], formula: null, zone: null, anchors: [], formulaAnchor: null } }];

    // 3. Une piste par scène permet au lecteur de mesurer les vrais silences
    //    et d'aligner précisément scène, visuels et sous-titres sur la voix.
    //    Toutes les pistes gardent la même voix Kore et la langue du document.
    if (!geminiTtsKey()) { void refund(); throw new Error("La clé Google AI Studio (voix) n'est pas configurée."); }
    let tracks: Uint8Array[];
    try { tracks = await Promise.all(scenes.map((s) => synthesizeGemini(s.narration.trim(), docFr ? "fr" : "en"))); }
    catch (e) { console.error("tts failed", e); void refund(); throw new Error(fr ? "Clario n'a pas réussi à enregistrer la voix. Réessaie." : "Clario couldn't record the voice. Try again."); }
    const audioPaths = scenes.map((_, index) => `${base}-scene-${index}.wav`);
    const uploads = await Promise.all(tracks.map((bytes, index) =>
      context.supabase.storage.from("clario-files").upload(audioPaths[index] ?? `${base}-scene-${index}.wav`, bytes, { contentType: "audio/wav", upsert: false }),
    ));
    if (uploads.some((upload) => upload.error)) {
      await context.supabase.storage.from("clario-files").remove(audioPaths);
      void refund();
      throw new Error("Impossible d’enregistrer la voix.");
    }

    return {
      version: 2,
      title: String(parsed.title || data.title).slice(0, 120),
      pageKind: String(parsed.pageKind || "page").slice(0, 40),
      pageImagePath,
      fullAudioPath: null,
      scenes: scenes.map((s, index) => ({ narration: s.narration.trim(), visual: cleanVisual(s.visual), audioPath: audioPaths[index] ?? null })),
    };
  });

export const saveExplainer = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) =>
    z.object({
      documentId: z.string().uuid(),
      courseId: z.string().uuid().nullable(),
      page: z.number().int().min(0),
      script: z.object({ version: z.literal(2), title: z.string() }).passthrough(),
    }).parse(data),
  )
  .handler(async ({ data, context }): Promise<{ id: string }> => {
    const script = data.script as unknown as ExplainerScript;
    const { data: row, error } = await context.supabase.from("animations").insert({
      document_id: data.documentId,
      course_id: data.courseId,
      page: data.page,
      title: script.title,
      script: script as never,
      audio_path: script.fullAudioPath ?? script.scenes[0]?.audioPath ?? null,
    }).select("id").single();
    if (error) throw new Error("Impossible d’enregistrer la vidéo : " + error.message);
    return { id: row.id as string };
  });

export const deleteExplainerFiles = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => z.object({ id: z.string().uuid() }).parse(data))
  .handler(async ({ data, context }) => {
    const { data: row } = await context.supabase.from("animations").select("script").eq("id", data.id).maybeSingle();
    const s = row?.script as unknown as ExplainerScript | undefined;
    if (s?.version === 2) {
      const paths = [s.pageImagePath, s.fullAudioPath ?? null, ...s.scenes.map((x) => x.audioPath)].filter((p): p is string => !!p);
      if (paths.length) await context.supabase.storage.from("clario-files").remove(paths);
    }
    const { error } = await context.supabase.from("animations").delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });
