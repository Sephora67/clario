import { useState } from "react";
import { Link } from "@tanstack/react-router";
import { Check, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useI18n } from "@/lib/i18n";
import { cn } from "@/lib/utils";
import { openCheckout, refreshCredits, type PriceKey } from "@/hooks/use-credits";

const PLANS = [
  { id: "free", features: 3, tone: "bg-card" },
  { id: "pass", features: 3, tone: "bg-school-yellow-soft", featured: true },
  { id: "club", features: 4, tone: "bg-school-purple-soft" },
  { id: "max", features: 4, tone: "bg-school-purple-soft" },
  { id: "topup", features: 2, tone: "bg-school-green-soft" },
] as const;

function BuyButton({ priceKey, label }: { priceKey: PriceKey; label: string }) {
  const { t } = useI18n();
  const [busy, setBusy] = useState(false);
  const buy = async () => {
    setBusy(true);
    try {
      const signedIn = await openCheckout(priceKey);
      if (!signedIn) window.location.href = "/auth";
      else refreshCredits();
    } finally { setBusy(false); }
  };
  return <Button className="mt-2 w-full" disabled={busy} onClick={() => void buy()}>{busy ? <Loader2 className="animate-spin" /> : label}</Button>;
}

export function PricingPlans() {
  const { t } = useI18n();
  return <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
    {PLANS.map((p) => (
      <article key={p.id} className={cn("relative flex flex-col rounded-2xl border p-6", p.tone, "featured" in p && "border-amber-strong border-2")}>
        {"featured" in p && <span className="absolute -top-3 left-6 rounded-full bg-primary px-3 py-0.5 text-xs font-semibold text-primary-foreground">{t("pricing.pass.tag")}</span>}
        <h3 className="font-display text-xl font-bold">{t(`pricing.${p.id}.name`)}</h3>
        <p className="mt-3 font-display text-3xl font-bold">{t(`pricing.${p.id}.price`)}</p>
        <p className="text-sm text-muted-foreground">{t(`pricing.${p.id}.per`)}</p>
        <ul className="mt-5 flex-1 space-y-2 text-sm">
          {Array.from({ length: p.features }, (_, i) => <li key={i} className="flex gap-2"><Check className="mt-0.5 size-4 shrink-0 text-success-strong" />{t(`pricing.${p.id}.f${i + 1}`)}</li>)}
        </ul>
        {p.id === "free" && <Button asChild className="mt-6"><Link to="/auth">{t("pricing.cta")}</Link></Button>}
        {p.id === "pass" && <div className="mt-6"><BuyButton priceKey="notebook_pass_once" label={`${t("pricing.buy")} — ${t("pricing.pass.price")}`} /></div>}
        {p.id === "club" && <div className="mt-6 space-y-2"><BuyButton priceKey="pro_club_monthly" label={t("pricing.club.monthly")} /><BuyButton priceKey="pro_club_yearly" label={t("pricing.club.yearly")} /></div>}
        {p.id === "max" && <div className="mt-6 space-y-2"><BuyButton priceKey="pro_club_max_monthly" label={t("pricing.max.monthly")} /><BuyButton priceKey="pro_club_max_yearly" label={t("pricing.max.yearly")} /></div>}
        {p.id === "topup" && <div className="mt-6 space-y-2"><BuyButton priceKey="topup_questions_100" label={t("pricing.topup.questions")} /><BuyButton priceKey="topup_videos_5" label={t("pricing.topup.videos")} /></div>}
      </article>
    ))}
  </div>;
}

export function PricingNotes() {
  const { t } = useI18n();
  return <div className="grid gap-4 sm:grid-cols-2">
    <div className="rounded-2xl border bg-card p-5"><h3 className="font-semibold">{t("pricing.rto.t")}</h3><p className="mt-1 text-sm text-muted-foreground">{t("pricing.rto.d")}</p></div>
    <div className="rounded-2xl border bg-card p-5"><h3 className="font-semibold">{t("pricing.mine.t")}</h3><p className="mt-1 text-sm text-muted-foreground">{t("pricing.mine.d")}</p></div>
    <div className="rounded-2xl border bg-card p-5 sm:col-span-2"><h3 className="font-semibold">{t("pricing.keep.t")}</h3><p className="mt-1 text-sm text-muted-foreground">{t("pricing.keep.d")}</p></div>
  </div>;
}

export function PaymentTestBanner() {
  const { t } = useI18n();
  return <p className="mx-auto max-w-6xl px-4 pt-4 text-center text-xs text-muted-foreground sm:px-6">{t("pricing.soon")}</p>;
}
