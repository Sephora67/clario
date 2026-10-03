import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { ArrowLeft, GraduationCap } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { supabase } from "@/integrations/supabase/client";
import { lovable } from "@/integrations/lovable/index";
import { useAuth } from "@/hooks/use-auth";
import { useI18n } from "@/lib/i18n";
import { cn } from "@/lib/utils";
import { InstallPrompt } from "@/components/install-prompt";

export const Route = createFileRoute("/auth")({
  head: () => ({
    meta: [
      { title: "Sign in — Clario" },
      { name: "description", content: "Sign in to Clario to find your courses, notes and deadlines on all your devices." },
      { property: "og:title", content: "Sign in — Clario" },
      { property: "og:description", content: "Your synced study space." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: AuthPage,
});

function AuthPage() {
  const navigate = useNavigate();
  const { t, locale, setLocale } = useI18n();
  const { user } = useAuth();
  const [mode, setMode] = useState<"in" | "up">("in");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [msg, setMsg] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  useEffect(() => { if (user) navigate({ to: "/" }); }, [user, navigate]);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault(); setBusy(true); setMsg(null);
    if (mode === "in") {
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) setMsg(t("auth.wrongCreds"));
    } else {
      const { error, data } = await supabase.auth.signUp({ email, password, options: { emailRedirectTo: window.location.origin } });
      if (error) setMsg(error.message);
      else if (!data.session) setMsg(t("auth.checkInbox"));
    }
    setBusy(false);
  };
  const google = async () => {
    const r = await lovable.auth.signInWithOAuth("google", { redirect_uri: window.location.origin });
    if (r.error) setMsg(t("auth.googleFailed"));
  };

  return <main className="relative grid min-h-screen place-items-center bg-background px-4">
    <Link to="/" className="browser-home-link absolute left-4 top-4 inline-flex items-center gap-1.5 rounded-md px-3 py-2 text-sm font-medium text-muted-foreground hover:bg-muted hover:text-foreground"><ArrowLeft className="size-4" />{locale === "fr" ? "Accueil" : "Home"}</Link>
    <div className="w-full max-w-sm rounded-3xl border bg-card p-8 shadow-sm">
      <div className="flex justify-center"><span className="grid size-12 place-items-center rounded-2xl bg-primary text-primary-foreground"><GraduationCap /></span></div>
      <h1 className="mt-4 text-center font-display text-2xl font-bold">{mode === "in" ? t("auth.welcomeBack") : t("auth.createTitle")}</h1>
      <p className="mt-1 text-center text-sm text-muted-foreground">{t("auth.tagline")}</p>
      <Button variant="outline" className="mt-6 w-full" onClick={google}>{t("auth.google")}</Button>
      <div className="my-4 text-center text-xs text-muted-foreground">{t("auth.or")}</div>
      <form onSubmit={submit} className="space-y-3">
        <Input type="email" required placeholder={t("auth.email")} value={email} onChange={(e) => setEmail(e.target.value)} aria-label={t("auth.email")} />
        <Input type="password" required minLength={6} placeholder={t("auth.password")} value={password} onChange={(e) => setPassword(e.target.value)} aria-label={t("auth.password")} />
        <Button type="submit" className="w-full" disabled={busy}>{mode === "in" ? t("auth.signIn") : t("auth.signUp")}</Button>
      </form>
      {msg && <p className="mt-3 text-center text-sm text-muted-foreground">{msg}</p>}
      <button className="mt-5 w-full text-center text-sm font-semibold text-school-yellow-strong" onClick={() => setMode(mode === "in" ? "up" : "in")}>{mode === "in" ? t("auth.noAccount") : t("auth.haveAccount")}</button>
      <div className="mt-6 flex justify-center rounded-md border p-0.5">
        {(["en", "fr"] as const).map((l) => <button key={l} onClick={() => { setLocale(l); try { sessionStorage.setItem("clario-locale-pending", l); } catch { /* indisponible */ } }} className={cn("flex-1 rounded px-3 py-1 text-xs font-semibold uppercase", locale === l ? "bg-primary-soft text-amber-strong" : "text-muted-foreground")}>{l}</button>)}
      </div>
    </div>
    <InstallPrompt />
  </main>;
}
