import { createFileRoute } from "@tanstack/react-router";
import { Dashboard } from "@/components/dashboard";

export const Route = createFileRoute("/_authenticated/dossiers")({
  validateSearch: (s: Record<string, unknown>): { f?: string } => (typeof s["f"] === "string" ? { f: s["f"] } : {}),
  head: () => ({ meta: [
    { title: "Folders — Clario" },
    { name: "description", content: "Organise your notes and documents by subject in your Clario folders." },
    { property: "og:title", content: "Folders — Clario" },
    { property: "og:description", content: "Your notes and documents sorted by subject." },
    { property: "og:type", content: "website" }, { name: "twitter:card", content: "summary" },
  ] }),
  component: () => <Dashboard folderId={Route.useSearch().f ?? null} />,
});
