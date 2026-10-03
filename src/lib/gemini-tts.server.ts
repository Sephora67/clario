// Voix Gemini 3.1 Flash TTS via la clé Google AI Studio de la propriétaire.
// Contrairement aux synthétiseurs classiques (Google Studio/Chirp, OpenAI TTS),
// Gemini comprend le sens du texte : il module le rythme, place des respirations
// et accentue les concepts clés — le rendu « tuteur » recherché pour Clario.
// La clé est lue uniquement dans les handlers.

export const GEMINI_TTS_MODEL = "gemini-3.1-flash-tts-preview";
export const GEMINI_VOICE = "Kore"; // voix féminine chaleureuse et posée

export function geminiTtsKey(): string | null {
  return process.env["GEMINI_API_KEY"] ?? null;
}

export function friendlyGeminiTtsError(status: number, fallback: string): string {
  if (status === 400) return "Google a refusé le texte à lire. Réessaie avec un contenu plus court.";
  if (status === 401 || status === 403)
    return "La clé Google AI Studio est refusée — vérifie-la dans les réglages du projet.";
  if (status === 402) return "Le solde Google AI Studio est épuisé — recharge-le sur aistudio.google.com.";
  if (status === 429) return "Le quota Gemini est atteint. Réessaie dans un moment.";
  return fallback;
}

// Gemini renvoie du PCM brut (L16, 24 kHz, mono) : on lui ajoute un en-tête WAV
// pour obtenir un fichier audio standard, lisible partout.
function pcmToWav(pcm: Uint8Array, sampleRate = 24000): Uint8Array {
  const header = new ArrayBuffer(44);
  const v = new DataView(header);
  const writeStr = (off: number, s: string) => { for (let i = 0; i < s.length; i++) v.setUint8(off + i, s.charCodeAt(i)); };
  writeStr(0, "RIFF");
  v.setUint32(4, 36 + pcm.length, true);
  writeStr(8, "WAVE");
  writeStr(12, "fmt ");
  v.setUint32(16, 16, true); // taille du bloc fmt
  v.setUint16(20, 1, true); // PCM
  v.setUint16(22, 1, true); // mono
  v.setUint32(24, sampleRate, true);
  v.setUint32(28, sampleRate * 2, true); // octets/seconde
  v.setUint16(32, 2, true); // alignement bloc
  v.setUint16(34, 16, true); // bits par échantillon
  writeStr(36, "data");
  v.setUint32(40, pcm.length, true);
  const wav = new Uint8Array(44 + pcm.length);
  wav.set(new Uint8Array(header), 0);
  wav.set(pcm, 44);
  return wav;
}

// Synthétise un texte en WAV avec Gemini (voix Kore) dans la langue du document.
export async function synthesizeGemini(text: string, language: "fr" | "en" = "fr"): Promise<Uint8Array> {
  const key = geminiTtsKey();
  if (!key) throw new Error("Clé Google AI Studio manquante dans la configuration.");
  const res = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_TTS_MODEL}:generateContent`,
    {
      method: "POST",
      headers: { "x-goog-api-key": key, "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [
          {
            role: "user",
            parts: [
              {
                text: language === "fr"
                  ? "Lis uniquement le texte ci-dessous en français, avec la voix d'une tutrice universitaire chaleureuse, posée et bienveillante. Garde un rythme naturel, des respirations entre les idées et souligne les concepts clés. Ne traduis rien et n'ajoute rien. Texte à lire : " + text
                  : "Read only the text below in English, with the voice of a warm, calm university tutor. Keep a natural pace, breathe between ideas, and emphasize key concepts. Do not translate or add anything. Text to read: " + text,
              },
            ],
          },
        ],
        generationConfig: {
          responseModalities: ["AUDIO"],
          speechConfig: { voiceConfig: { prebuiltVoiceConfig: { voiceName: GEMINI_VOICE } } },
        },
      }),
    },
  );
  if (!res.ok) {
    let detail = "";
    try {
      const j = (await res.json()) as { error?: { message?: string } };
      detail = j?.error?.message ?? "";
    } catch {
      /* corps non JSON */
    }
    console.error(`Gemini TTS failed [${res.status}]: ${detail}`);
    throw new Error(friendlyGeminiTtsError(res.status, `La génération de la voix a échoué (${res.status}).`));
  }
  const json = (await res.json()) as {
    candidates?: { content?: { parts?: { inlineData?: { data?: string } }[] } }[];
  };
  const b64 = json.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data;
  if (!b64) throw new Error("Google n'a renvoyé aucun audio.");
  const pcm = Uint8Array.from(atob(b64), (c) => c.charCodeAt(0));
  return pcmToWav(pcm);
}
