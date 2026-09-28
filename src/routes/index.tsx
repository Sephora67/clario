import { createFileRoute } from "@tanstack/react-router";
import { Dashboard } from "@/components/dashboard";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Dossiers — Clario" },
      { name: "description", content: "Organisez vos notes et documents par matière dans votre espace Clario." },
      { property: "og:title", content: "Dossiers — Clario" },
      { property: "og:description", content: "Vos notes, documents et pages d'étude réunis par matière." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: Dashboard,
});
