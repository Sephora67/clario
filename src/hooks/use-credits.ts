import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { getPaddlePriceId, initializePaddle } from "@/lib/paddle";
import { currentLocale, tf } from "@/lib/i18n";

export type Credits = { questions: number; videos: number; hasPass: boolean; club: boolean; rtoCents: number };

/** Soldes de l'élève (lecture seule ; seul le serveur les modifie). */
export function useCredits() {
  const [credits, setCredits] = useState<Credits | null>(null);
  const reload = useCallback(async () => {
    const { data } = await supabase.rpc("my_credits");
    const r = Array.isArray(data) ? data[0] : null;
    if (r) setCredits({ questions: r.questions, videos: r.videos, hasPass: r.has_pass, club: r.club, rtoCents: r.rto_cents });
  }, []);
  useEffect(() => {
    void reload();
    const on = () => void reload();
    window.addEventListener("clario-credits", on);
    window.addEventListener("focus", on);
    return () => { window.removeEventListener("clario-credits", on); window.removeEventListener("focus", on); };
  }, [reload]);
  return { credits, reload };
}

export const refreshCredits = () => window.dispatchEvent(new Event("clario-credits"));

export type PriceKey = "notebook_pass_once" | "pro_club_monthly" | "pro_club_yearly" | "pro_club_max_monthly" | "pro_club_max_yearly" | "topup_questions_100" | "topup_videos_5";

/** Ouvre le paiement pour l'élève connecté. Renvoie false si non connecté. */
export async function openCheckout(priceId: PriceKey): Promise<boolean> {
  const { data } = await supabase.auth.getUser();
  const user = data.user;
  if (!user) return false;
  try {
    await initializePaddle();
    const id = await getPaddlePriceId(priceId);
    window.Paddle.Checkout.open({
      items: [{ priceId: id, quantity: 1 }],
      customer: user.email ? { email: user.email } : undefined,
      customData: { userId: user.id },
      settings: { displayMode: "overlay", variant: "one-page", allowLogout: false, locale: currentLocale(), successUrl: `${window.location.origin}/?checkout=success` },
    });
  } catch {
    toast.error(tf("Le paiement n'a pas pu s'ouvrir. Réessaie dans un instant."));
  }
  return true;
}
