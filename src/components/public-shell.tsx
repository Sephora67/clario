import { Link } from "@tanstack/react-router";
import type { ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { useI18n } from "@/lib/i18n";
import { cn } from "@/lib/utils";

export function LangSwitch() {
  const { locale, setLocale } = useI18n();
  return <div className="flex rounded-md border p-0.5">
    {(["en", "fr"] as const).map((l) => <button key={l} onClick={() => setLocale(l)} className={cn("rounded px-2 py-0.5 text-xs font-semibold uppercase", locale === l ? "bg-primary-soft text-amber-strong" : "text-muted-foreground")}>{l}</button>)}
  </div>;
}

export function PublicShell({ children }: { children: ReactNode }) {
  const { t, locale } = useI18n();
  return <div className="min-h-dvh bg-background text-foreground">
    <header className="sticky top-0 z-30 border-b bg-background/95 backdrop-blur">
      <div className="mx-auto flex max-w-6xl items-center gap-3 px-4 py-3 sm:px-6">
        <Link to="/" className="font-display text-2xl font-bold tracking-tight">Clario<span className="ml-0.5 inline-block size-2 rounded-full bg-primary" /></Link>
        <nav className="ml-auto flex items-center gap-2 sm:gap-3">
          <Link to="/pricing" className="hidden text-sm font-medium text-muted-foreground sm:inline" activeProps={{ className: "text-foreground" }}>{t("nav.pricing")}</Link>
          <LangSwitch />
          <Link to="/auth" className="text-sm font-medium">{t("nav.signIn")}</Link>
          <Button asChild size="sm" className="hidden sm:inline-flex"><Link to="/auth">{t("nav.start")}</Link></Button>
        </nav>
      </div>
    </header>
    {children}
    <footer className="border-t">
      <div className="mx-auto flex max-w-6xl flex-wrap items-center gap-4 px-4 py-8 text-sm text-muted-foreground sm:px-6">
        <span>{t("landing.footer")}</span>
        <Link to="/pricing" className="ml-auto">{t("nav.pricing")}</Link>
        <Link to="/contact">Contact</Link>
        <Link to="/terms">{locale === "fr" ? "Conditions" : "Terms"}</Link>
        <Link to="/privacy">{locale === "fr" ? "Confidentialité" : "Privacy"}</Link>
        <Link to="/auth">{t("nav.signIn")}</Link>
        <span>© 2026</span>
      </div>
    </footer>
  </div>;
}
