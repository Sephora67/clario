import { createOpenAI } from "@ai-sdk/openai";

// Toutes les fonctions IA de Clario passent par la clé OpenAI de la propriétaire
// (facturée sur son compte OpenAI, pas sur les crédits Lovable).
export const OPENAI_TEXT_MODEL = "gpt-4.1-mini";
export const OPENAI_TTS_MODEL = "gpt-4o-mini-tts";

export function openaiKey(): string {
  const key = process.env["OPENAI_API_KEY"];
  if (!key) throw new Error("Clé OpenAI manquante dans la configuration.");
  return key;
}

export function openaiProvider() {
  return createOpenAI({ apiKey: openaiKey() });
}

export function friendlyOpenAIError(status: number | undefined, fallback: string) {
  if (status === 401) return "La clé OpenAI est refusée. Vérifie-la dans les réglages du projet.";
  if (status === 429) return "Le compte OpenAI est à court de crédits ou reçoit trop de demandes. Réessaie plus tard.";
  if (status === 402) return "Le compte OpenAI n’a plus de crédits.";
  return fallback;
}
