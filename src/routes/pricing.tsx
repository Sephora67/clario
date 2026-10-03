import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { PaymentTestBanner, PricingNotes, PricingPlans } from "@/components/pricing-plans";
import { PublicShell } from "@/components/public-shell";
import { useI18n } from "@/lib/i18n";

export const Route = createFileRoute("/pricing")({
  head: () => ({
    meta: [
      { title: "Plans and pricing — Clario" },
      { name: "description", content: "Start free with 5 documents, unlock unlimited documents with a one-time Pass, or join the Pro Club for more questions and videos." },
      { property: "og:title", content: "Clario plans and pricing" },
      { property: "og:description", content: "Free Discovery, Unlimited Notebook Pass and Pro Club — simple plans for students." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: PricingPage,
});

function PricingPage() {
  const { t } = useI18n();
  return <PublicShell>
    <div className="mx-auto max-w-6xl px-4 pt-4 sm:px-6">
      <Button asChild variant="ghost" size="sm" className="gap-1.5 text-muted-foreground"><Link to="/" onClick={(e) => { if (window.history.length > 1) { e.preventDefault(); window.history.back(); } }}><ArrowLeft className="size-4" />{t("common.back")}</Link></Button>
    </div>
    <PaymentTestBanner />
    <main className="mx-auto max-w-6xl space-y-8 px-4 py-12 sm:px-6">
      <div><h1 className="font-display text-4xl font-bold tracking-tight">{t("pricing.title")}</h1><p className="mt-2 text-lg text-muted-foreground">{t("pricing.subtitle")}</p><p className="mt-1 text-sm text-muted-foreground">{t("pricing.counters")}</p></div>
      <PricingPlans />
      <PricingNotes />
    </main>
  </PublicShell>;
}
