import { createFileRoute } from "@tanstack/react-router";
import { createClient } from "@supabase/supabase-js";
import { streamText } from "ai";
import { openaiProvider, OPENAI_TEXT_MODEL } from "@/lib/openai-direct.server";

// Lit le texte d'un extrait de page sélectionné (pour copier / rechercher).
export const Route = createFileRoute("/api/read-selection")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const token = request.headers.get("authorization")?.replace(/^Bearer\s+/i, "");
        const key = process.env["SUPABASE_PUBLISHABLE_KEY"] ?? process.env["SUPABASE_ANON_KEY"]!;
        const { data } = token ? await createClient(process.env["SUPABASE_URL"]!, key, { auth: { persistSession: false } }).auth.getUser(token) : { data: { user: null } };
        if (!data.user) return new Response("Connexion requise", { status: 401 });
        const { image } = (await request.json()) as { image?: string };
        if (!image?.startsWith("data:image/") || image.length > 4_000_000) return new Response("Image invalide", { status: 400 });
        const provider = openaiProvider();
        const result = streamText({
          model: provider.responses(OPENAI_TEXT_MODEL), maxRetries: 0, abortSignal: request.signal,
          messages: [{ role: "user", content: [{ type: "text", text: "Transcris exactement le texte visible dans cette image (y compris l'écriture manuscrite et les formules en texte simple). Réponds uniquement avec le texte, sans commentaire." }, { type: "image", image }] }],
          providerOptions: { openai: { store: false } },
        });
        return result.toTextStreamResponse();
      },
    },
  },
});
