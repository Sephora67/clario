import { Link } from "@tanstack/react-router";
import { BellRing, BookOpen, FileUp, Lock, MessageCircle, PenLine, PlayCircle, Smartphone, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { PricingNotes, PricingPlans } from "@/components/pricing-plans";
import { PublicShell } from "@/components/public-shell";
import { useI18n } from "@/lib/i18n";
import studentHero from "@/assets/clario-hero-illustration.png.asset.json";
import studentAvatar from "@/assets/student-avatar.jpg.asset.json";
import robotAvatar from "@/assets/clario-robot-avatar.jpg.asset.json";
import { Send } from "lucide-react";
import { LandingShowcase } from "@/components/landing-showcase";
import { InstallPrompt } from "@/components/install-prompt";

export function Landing() {
  const { t } = useI18n();
  const steps = [{ I: FileUp, k: "step1" }, { I: PenLine, k: "step2" }, { I: Sparkles, k: "step3" }];
  const feats = [
    { I: BookOpen, k: "f1", c: "bg-school-yellow-soft" }, { I: PlayCircle, k: "f2", c: "bg-school-purple-soft" }, { I: MessageCircle, k: "f3", c: "bg-school-green-soft" },
    { I: BellRing, k: "f4", c: "bg-school-yellow-soft" }, { I: Smartphone, k: "f5", c: "bg-school-purple-soft" }, { I: Lock, k: "f6", c: "bg-school-green-soft" },
  ];
  return <PublicShell>
    <main>
      <section className="relative isolate overflow-hidden lg:min-h-[720px]">
        <img
          src={studentHero.url}
          alt=""
          aria-hidden="true"
          fetchPriority="high"
          className="relative h-[400px] w-full object-cover object-[55%_35%] sm:h-[440px] lg:absolute lg:inset-0 lg:h-full lg:object-[right_center]"
        />
        <div className="relative mx-auto max-w-6xl px-5 pb-12 pt-8 sm:px-8 lg:absolute lg:inset-x-0 lg:top-0 lg:min-h-[720px] lg:px-6 lg:pt-20">
          <div className="lg:max-w-lg">
            <span className="text-xs font-semibold uppercase text-school-purple">{t("landing.badge")}</span>
<h1 className="mt-3 font-[Instrument_Serif] text-[2.25rem] font-normal leading-[0.98] sm:text-5xl sm:leading-[1.02] lg:max-w-[27rem] lg:text-6xl lg:leading-[0.98]">{t("landing.title")}</h1>
            <p className="mt-4 max-w-md font-[Work_Sans] text-[0.95rem] leading-relaxed text-foreground/85 sm:text-lg lg:max-w-[19rem]">{t("landing.subtitle")}</p>
            <div className="mt-6 flex flex-wrap gap-3">
              <Button asChild size="lg" className="bg-foreground px-6 text-background shadow-none hover:bg-foreground/90"><Link to="/auth">{t("landing.cta")}</Link></Button>
              <Button asChild size="lg" variant="outline" className="border-foreground/25 bg-background/60 px-6 shadow-none backdrop-blur-sm hover:bg-background/80"><Link to="/pricing">{t("landing.ctaSecondary")}</Link></Button>
            </div>
            <p className="mt-3 font-[Work_Sans] text-sm font-medium text-foreground/70">{t("landing.note")}</p>
          </div>
        </div>
      </section>

      <LandingShowcase />

      <section className="border-y bg-card">
        <div className="mx-auto max-w-6xl px-4 py-14 sm:px-6">
          <h2 className="font-display text-3xl font-bold">{t("landing.howTitle")}</h2>
          <ol className="mt-8 grid gap-6 sm:grid-cols-3">
            {steps.map(({ I, k }, i) => <li key={k}>
              <div className="flex items-center gap-3"><span className="grid size-10 place-items-center rounded-xl bg-primary text-primary-foreground"><I className="size-5" /></span><span className="font-display text-2xl font-bold text-muted-foreground">{i + 1}</span></div>
              <h3 className="mt-3 text-lg font-semibold">{t(`landing.${k}.t`)}</h3>
              <p className="mt-1 text-sm text-muted-foreground">{t(`landing.${k}.d`)}</p>
            </li>)}
          </ol>
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-4 py-14 sm:px-6">
        <div className="grid items-center gap-8 lg:grid-cols-[1fr_1.2fr]">
          <div>
            <h2 className="font-display text-3xl font-bold">{t("landing.chatTitle")}</h2>
            <p className="mt-2 max-w-md text-muted-foreground">{t("landing.chatSub")}</p>
          </div>
          <div className="rounded-3xl border bg-school-purple-soft/40 p-4 sm:p-6">
            <div className="flex items-end justify-end gap-3">
              <div className="max-w-[80%] rounded-2xl rounded-br-sm bg-foreground px-4 py-3 text-sm text-background">{t("landing.chatQ")}</div>
              <img src={studentAvatar.url} alt={t("landing.chatStudent")} className="size-11 shrink-0 rounded-full border-2 border-background object-cover object-[50%_25%]" />
            </div>
            <div className="mt-4 flex items-end gap-3">
              <img src={robotAvatar.url} alt="Clario" className="size-11 shrink-0 rounded-full border-2 border-background object-cover object-[50%_20%] scale-110" />
              <div className="max-w-[85%] space-y-2 rounded-2xl rounded-bl-sm border bg-card px-4 py-3 text-sm">
                <p className="text-xs font-semibold text-school-purple">Clario</p>
                <p className="font-medium">{t("landing.chatA1")}</p>
                <p className="text-muted-foreground">{t("landing.chatA2")}</p>
                <p>{t("landing.chatA3")}</p>
              </div>
            </div>
            <div className="mt-5 flex items-center justify-between rounded-full border bg-card px-4 py-2.5 text-sm text-muted-foreground">
              <span>{t("landing.chatInput")}</span><Send className="size-4" />
            </div>
          </div>
        </div>
      </section>


      <section className="mx-auto max-w-6xl px-4 py-14 sm:px-6">
        <h2 className="font-display text-3xl font-bold">{t("landing.featTitle")}</h2>
        <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {feats.map(({ I, k, c }) => <div key={k} className="rounded-2xl border bg-card p-5">
            <span className={`grid size-10 place-items-center rounded-xl ${c}`}><I className="size-5" /></span>
            <h3 className="mt-3 font-semibold">{t(`landing.${k}.t`)}</h3>
            <p className="mt-1 text-sm text-muted-foreground">{t(`landing.${k}.d`)}</p>
          </div>)}
        </div>
      </section>

      <section className="border-y bg-card">
        <div className="mx-auto max-w-6xl space-y-6 px-4 py-14 sm:px-6">
          <div><h2 className="font-display text-3xl font-bold">{t("landing.plansTitle")}</h2><p className="mt-2 max-w-2xl text-muted-foreground">{t("landing.plansSub")}</p><p className="mt-1 text-sm text-muted-foreground">{t("pricing.counters")}</p></div>
          <PricingPlans />
          <PricingNotes />
        </div>
      </section>

      <section className="mx-auto max-w-3xl px-4 py-14 sm:px-6">
        <h2 className="font-display text-3xl font-bold">{t("landing.faqTitle")}</h2>
        <div className="mt-6 divide-y rounded-2xl border bg-card">
          {[1, 2, 3, 4].map((n) => <details key={n} className="group p-5"><summary className="cursor-pointer list-none font-semibold">{t(`landing.faq${n}.q`)}</summary><p className="mt-2 text-sm text-muted-foreground">{t(`landing.faq${n}.a`)}</p></details>)}
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-4 pb-16 sm:px-6">
        <div className="rounded-3xl bg-school-yellow-soft p-8 text-center sm:p-12">
          <h2 className="font-display text-3xl font-bold">{t("landing.finalTitle")}</h2>
          <Button asChild size="lg" className="mt-5"><Link to="/auth">{t("landing.cta")}</Link></Button>
        </div>
      </section>
    </main>
    <InstallPrompt />
  </PublicShell>;
}
