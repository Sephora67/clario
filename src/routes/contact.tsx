import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { Mail, Clock } from "lucide-react";
import { PublicShell } from "@/components/public-shell";
import { CONTACT_EMAIL } from "@/components/legal-page";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { useI18n } from "@/lib/i18n";

export const Route = createFileRoute("/contact")({
  head: () => ({ meta: [
    { title: "Contact — Clario" },
    { name: "description", content: "Questions about Clario, your plan or credits? Write to us, we answer within 48 hours." },
    { property: "og:title", content: "Contact — Clario" },
    { property: "og:description", content: "Get help with Clario, your plan or your credits." },
    { property: "og:type", content: "website" },
    { name: "twitter:card", content: "summary" },
  ] }),
  component: Contact,
});

function Contact() {
  const { locale } = useI18n();
  const fr = locale === "fr";
  const topics = fr ? ["Aide technique", "Forfait et crédits", "Suggestion", "Autre"] : ["Technical help", "Plan & credits", "Suggestion", "Other"];
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [topic, setTopic] = useState(topics[0]);
  const [msg, setMsg] = useState("");

  const send = (e: React.FormEvent) => {
    e.preventDefault();
    const body = `${msg}\n\n— ${name} (${email})`;
    window.location.href = `mailto:${CONTACT_EMAIL}?subject=${encodeURIComponent(`[Clario] ${topic}`)}&body=${encodeURIComponent(body)}`;
  };

  return <PublicShell>
    <main className="mx-auto grid max-w-5xl gap-10 px-4 py-12 sm:px-6 md:grid-cols-[1fr_1.4fr]">
      <div>
        <h1 className="font-display text-4xl font-bold">{fr ? "Contacte-nous" : "Contact us"}</h1>
        <p className="mt-3 text-muted-foreground">{fr ? "Une question sur Clario, ton forfait ou tes crédits ? Écris-nous." : "A question about Clario, your plan or your credits? Write to us."}</p>
        <div className="mt-6 space-y-3 text-sm">
          <a href={`mailto:${CONTACT_EMAIL}`} className="flex items-center gap-3 rounded-xl border bg-card p-4"><Mail className="size-5 text-school-purple" />{CONTACT_EMAIL}</a>
          <div className="flex items-center gap-3 rounded-xl border bg-card p-4"><Clock className="size-5 text-school-green" />{fr ? "Réponse sous 48 h (jours ouvrables)" : "Reply within 48 h (business days)"}</div>
        </div>
      </div>
      <form onSubmit={send} className="space-y-4 rounded-2xl border bg-card p-6">
        <label className="block text-sm">{fr ? "Nom" : "Name"}<Input className="mt-1" required value={name} onChange={(e) => setName(e.target.value)} maxLength={80} /></label>
        <label className="block text-sm">E-mail<Input className="mt-1" type="email" required value={email} onChange={(e) => setEmail(e.target.value)} maxLength={120} /></label>
        <div className="text-sm">{fr ? "Sujet" : "Topic"}
          <div className="mt-2 flex flex-wrap gap-2">{topics.map((t) => <button key={t} type="button" onClick={() => setTopic(t)} className={`rounded-full border px-3 py-1.5 text-sm ${topic === t ? "border-amber-strong bg-primary-soft font-semibold" : "text-muted-foreground"}`}>{t}</button>)}</div>
        </div>
        <label className="block text-sm">Message<Textarea className="mt-1 min-h-32" required value={msg} onChange={(e) => setMsg(e.target.value)} maxLength={3000} /></label>
        <Button type="submit" className="w-full">{fr ? "Envoyer" : "Send"}</Button>
      </form>
    </main>
  </PublicShell>;
}
