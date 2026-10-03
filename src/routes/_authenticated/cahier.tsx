import { tf } from "@/lib/i18n";
import { createFileRoute } from "@tanstack/react-router";
import { lazy, Suspense } from "react";
import { ClientOnly } from "@tanstack/react-router";

const Notebook = lazy(() => import("@/components/notebook"));

export const Route = createFileRoute("/_authenticated/cahier")({
  validateSearch: (s: Record<string, unknown>): { doc?: string } => (typeof s["doc"] === "string" ? { doc: s["doc"] as string } : {}),
  head: () => ({
    meta: [
      { title: tf("My notebook — Clario") },
      { name: "description", content: "Open your PDFs and notes, then highlight, write and draw with your stylus right on your pages." },
      { property: "og:title", content: "My Clario study notebook" },
      { property: "og:description", content: "Annotate your PDFs and notes with your stylus, on tablet as on computer." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: () => (
    <ClientOnly fallback={<div className="grid h-dvh place-items-center text-muted-foreground">{tf("Loading…")}</div>}>
      <Suspense fallback={<div className="grid h-dvh place-items-center text-muted-foreground">{tf("Loading…")}</div>}>
        <Notebook />
      </Suspense>
    </ClientOnly>
  ),
});
