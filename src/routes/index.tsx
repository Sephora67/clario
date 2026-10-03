import { ClientOnly, createFileRoute, Navigate } from "@tanstack/react-router";
import { Home } from "@/components/home";
import { Landing } from "@/components/landing";
import { useAuth } from "@/hooks/use-auth";
import { useI18n } from "@/lib/i18n";

function isStandalone() {
  return window.matchMedia("(display-mode: standalone)").matches || (navigator as { standalone?: boolean }).standalone === true;
}

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Clario — Your study notebook with a tutor inside" },
      { name: "description", content: "Import your courses, annotate with your stylus and ask Clario to explain any page in a chat or narrated video. Start free." },
      { property: "og:title", content: "Clario — your university study space" },
      { property: "og:description", content: "Courses, annotated notebook, document library and calendar with reminders, synced on all your devices." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: () => <ClientOnly fallback={<div className="grid min-h-dvh place-items-center text-muted-foreground">Loading…</div>}><Gate /></ClientOnly>,
});

function Gate() {
  const { t } = useI18n();
  const { user, loading } = useAuth();
  if (loading) return <div className="grid min-h-dvh place-items-center text-muted-foreground">{t("gate.loading")}</div>;
  if (user) return <Home />;
  if (isStandalone()) return <Navigate to="/auth" replace />;
  return <Landing />;
}
