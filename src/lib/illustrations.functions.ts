import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { catalog } from "./illustration-catalog";

type Ctx = { supabase: any; userId: string };
async function assertAdmin({ supabase, userId }: Ctx) {
  const { data } = await supabase.rpc("has_role", { _user_id: userId, _role: "admin" });
  if (!data) throw new Error("Accès réservé à l'administratrice.");
}

export const amIAdmin = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data } = await context.supabase.rpc("has_role", { _user_id: context.userId, _role: "admin" });
    return { admin: !!data };
  });

export const listIllustrations = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertAdmin(context);
    const { data, error } = await context.supabase.from("illustrations").select("key,status,svg,custom_prompt,visual_description,updated_at");
    if (error) throw new Error("Impossible de charger la bibliothèque.");
    return data;
  });

export const generateIllustration = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ key: z.string().max(120), instruction: z.string().max(2000).optional() }).parse(d))
  .handler(async ({ data, context }) => {
    await assertAdmin(context);
    const item = catalog().find((c) => c.key === data.key);
    if (!item) throw new Error("Élément inconnu.");
    const apiKey = process.env["RECRAFT_API_KEY"];
    if (!apiKey) throw new Error("Clé Recraft manquante.");
    const instruction = data.instruction?.trim() || null;
    const prompt = instruction ? `${item.prompt} — ${instruction}` : item.prompt;
    const res = await fetch("https://external.api.recraft.ai/v1/images/generations", {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({ prompt, style: "vector_illustration", model: "recraftv3", size: "1024x1024", n: 1 }),
    });
    if (!res.ok) {
      const t = await res.text().catch(() => "");
      console.error("recraft", res.status, t);
      if (res.status === 401) throw new Error("Recraft refuse la clé API.");
      if (res.status === 402 || /balance|credit/i.test(t)) throw new Error("Crédits Recraft insuffisants.");
      throw new Error(`Recraft n'a pas pu dessiner (${res.status}).`);
    }
    const j = await res.json() as { data?: { url?: string }[] };
    const url = j.data?.[0]?.url;
    if (!url) throw new Error("Recraft n'a renvoyé aucun dessin.");
    const svg = await (await fetch(url)).text();
    if (!svg.includes("<svg")) throw new Error("Le dessin reçu n'est pas un SVG.");
    // Archive the previous version so "Refaire" never loses a drawing.
    const { data: prev } = await context.supabase.from("illustrations").select("svg,status").eq("key", item.key).maybeSingle();
    if (prev?.svg) {
      await (context.supabase as any).from("illustration_history").insert({ key: item.key, svg: prev.svg, status: prev.status ?? "pending" });
    }
    const { error } = await context.supabase.from("illustrations").upsert({
      key: item.key, category: item.category, label: item.label, prompt: item.prompt, custom_prompt: instruction, svg, status: "pending", updated_at: new Date().toISOString(),
    }, { onConflict: "key" });
    if (error) throw new Error("Impossible d'enregistrer le dessin.");
    return { key: item.key, svg, status: "pending" as const };
  });

export const listIllustrationHistory = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ key: z.string().max(120) }).parse(d))
  .handler(async ({ data, context }) => {
    await assertAdmin(context);
    const { data: rows, error } = await (context.supabase as any).from("illustration_history")
      .select("id,svg,status,created_at").eq("key", data.key).order("created_at", { ascending: false }).limit(20);
    if (error) throw new Error("Impossible de charger l'historique.");
    return (rows ?? []) as { id: string; svg: string; status: string; created_at: string }[];
  });

export const restoreIllustration = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ key: z.string().max(120), id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    await assertAdmin(context);
    const hist = (context.supabase as any).from("illustration_history");
    const { data: h, error } = await hist.select("svg").eq("id", data.id).eq("key", data.key).single();
    if (error || !h) throw new Error("Version introuvable.");
    // Keep the current version in history too, then restore the chosen one.
    const { data: cur } = await context.supabase.from("illustrations").select("svg,status").eq("key", data.key).maybeSingle();
    if (cur?.svg) {
      await hist.insert({ key: data.key, svg: cur.svg, status: cur.status ?? "pending" });
    }
    const { error: up } = await context.supabase.from("illustrations")
      .update({ svg: h.svg, status: "pending", updated_at: new Date().toISOString() }).eq("key", data.key);
    if (up) throw new Error("Restauration impossible.");
    await hist.delete().eq("id", data.id);
    return { key: data.key, svg: h.svg, status: "pending" as const };
  });

export const setIllustrationStatus = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ key: z.string().max(120), status: z.enum(["approved", "rejected", "pending"]) }).parse(d))
  .handler(async ({ data, context }) => {
    await assertAdmin(context);
    const { error } = await context.supabase.from("illustrations").update({ status: data.status, updated_at: new Date().toISOString() }).eq("key", data.key);
    if (error) throw new Error("Mise à jour impossible.");
    return { ok: true };
  });

export const saveVisualDescription = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ key: z.string().max(120), description: z.string().max(300) }).parse(d))
  .handler(async ({ data, context }) => {
    await assertAdmin(context);
    const { error } = await context.supabase.from("illustrations")
      .update({ visual_description: data.description.trim() || null }).eq("key", data.key);
    if (error) throw new Error("Impossible d'enregistrer la description.");
    return { ok: true };
  });

export const detectVisualContent = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ key: z.string().max(120), image: z.string().startsWith("data:image/png;base64,").max(3_000_000) }).parse(d))
  .handler(async ({ data, context }) => {
    await assertAdmin(context);
    const apiKey = process.env["LOVABLE_API_KEY"];
    if (!apiKey) throw new Error("Configuration IA manquante.");
    const res = await fetch("https://ai.gateway.lovable.dev/v1/responses", {
      method: "POST",
      headers: { "Content-Type": "application/json", "Lovable-API-Key": apiKey, Authorization: `Bearer ${apiKey}`, "X-Lovable-AIG-SDK": "fetch" },
      body: JSON.stringify({
        model: "openai/gpt-6-astra",
        stream: true,
        store: false,
        reasoning: { effort: "low" },
        input: [{ role: "user", content: [
          { type: "input_text", text: "Décris en français, en une seule ligne courte (max 15 mots, mots-clés séparés par des virgules), ce qui est RÉELLEMENT visible dans ce dessin : nombre de personnes, rôle apparent, pose, lieu, objets principaux. Ignore tout titre. Réponds uniquement par la ligne." },
          { type: "input_image", image_url: data.image },
        ] }],
      }),
    });
    if (!res.ok || !res.body) {
      const t = await res.text().catch(() => "");
      console.error("detect", res.status, t);
      if (res.status === 402) throw new Error("Crédits IA insuffisants.");
      if (res.status === 429) throw new Error("Trop de demandes, réessayez dans un instant.");
      throw new Error(`Analyse impossible (${res.status}).`);
    }
    const reader = res.body.getReader();
    const dec = new TextDecoder();
    let buf = "", text = "";
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      buf += dec.decode(value, { stream: true });
      const lines = buf.split("\n"); buf = lines.pop() ?? "";
      for (const l of lines) {
        if (!l.startsWith("data:")) continue;
        const p = l.slice(5).trim();
        if (!p || p === "[DONE]") continue;
        try { const j = JSON.parse(p); if (j.type === "response.output_text.delta") text += j.delta ?? ""; } catch { /* ignore */ }
      }
    }
    const description = text.trim().replace(/\s+/g, " ").slice(0, 300);
    if (!description) throw new Error("L'IA n'a rien décrit.");
    await context.supabase.from("illustrations").update({ visual_description: description }).eq("key", data.key);
    return { description };
  });
