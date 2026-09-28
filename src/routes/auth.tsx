import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { GraduationCap } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { supabase } from "@/integrations/supabase/client";
import { lovable } from "@/integrations/lovable/index";
import { useAuth } from "@/hooks/use-auth";

export const Route = createFileRoute("/auth")({
  head: () => ({
    meta: [
      { title: "Connexion — Clario" },
      { name: "description", content: "Connectez-vous à Clario pour transformer vos notes en leçons vidéo." },
      { property: "og:title", content: "Connexion — Clario" },
      { property: "og:description", content: "Accédez à vos leçons vidéo tableau blanc." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: AuthPage,
});

function AuthPage() {
  const navigate = useNavigate();
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
      if (error) setMsg("Courriel ou mot de passe incorrect.");
    } else {
      const { error, data } = await supabase.auth.signUp({ email, password, options: { emailRedirectTo: window.location.origin } });
      if (error) setMsg(error.message);
      else if (!data.session) setMsg("Vérifie ta boîte courriel pour confirmer ton compte.");
    }
    setBusy(false);
  };
  const google = async () => {
    const r = await lovable.auth.signInWithOAuth("google", { redirect_uri: window.location.origin });
    if (r.error) setMsg("La connexion Google a échoué.");
  };

  return <main className="grid min-h-screen place-items-center bg-background px-4">
    <div className="w-full max-w-sm rounded-3xl border bg-card p-8 shadow-sm">
      <span className="mx-auto grid size-12 place-items-center rounded-2xl bg-primary text-primary-foreground"><GraduationCap /></span>
      <h1 className="mt-4 text-center font-display text-2xl font-bold">{mode === "in" ? "Bon retour!" : "Crée ton compte"}</h1>
      <p className="mt-1 text-center text-sm text-muted-foreground">Tes leçons t’attendent sur Clario.</p>
      <Button variant="outline" className="mt-6 w-full" onClick={google}>Continuer avec Google</Button>
      <div className="my-4 text-center text-xs text-muted-foreground">ou</div>
      <form onSubmit={submit} className="space-y-3">
        <Input type="email" required placeholder="Courriel" value={email} onChange={(e) => setEmail(e.target.value)} aria-label="Courriel" />
        <Input type="password" required minLength={6} placeholder="Mot de passe" value={password} onChange={(e) => setPassword(e.target.value)} aria-label="Mot de passe" />
        <Button type="submit" className="w-full" disabled={busy}>{mode === "in" ? "Se connecter" : "Créer mon compte"}</Button>
      </form>
      {msg && <p className="mt-3 text-center text-sm text-muted-foreground">{msg}</p>}
      <button className="mt-5 w-full text-center text-sm font-semibold text-school-yellow-strong" onClick={() => setMode(mode === "in" ? "up" : "in")}>{mode === "in" ? "Pas de compte? Inscris-toi" : "Déjà un compte? Connecte-toi"}</button>
    </div>
  </main>;
}
