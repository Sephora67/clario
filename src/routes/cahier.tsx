import { createFileRoute } from "@tanstack/react-router";
import { lazy, Suspense } from "react";
import { ClientOnly } from "@tanstack/react-router";

const Notebook = lazy(() => import("@/components/notebook"));

export const Route = createFileRoute("/cahier")({
  validateSearch: (s: Record<string, unknown>): { doc?: string } => (typeof s["doc"] === "string" ? { doc: s["doc"] as string } : {}),
  head: () => ({
    meta: [
      { title: "Mon cahier — Clario" },
      { name: "description", content: "Ouvrez vos PDF et notes, puis surlignez, écrivez et dessinez au stylet directement sur vos pages." },
      { property: "og:title", content: "Mon cahier d'étude Clario" },
      { property: "og:description", content: "Annotez vos PDF et notes au stylet, sur tablette comme sur ordinateur." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: () => (
    <ClientOnly fallback={<div className="grid h-dvh place-items-center text-muted-foreground">Ouverture du cahier…</div>}>
      <Suspense fallback={<div className="grid h-dvh place-items-center text-muted-foreground">Ouverture du cahier…</div>}>
        <Notebook />
      </Suspense>
    </ClientOnly>
  ),
});
