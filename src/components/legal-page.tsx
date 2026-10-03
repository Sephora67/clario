import type { ReactNode } from "react";
import { PublicShell } from "@/components/public-shell";

export function LegalPage({ title, updated, children }: { title: string; updated: string; children: ReactNode }) {
  return <PublicShell>
    <main className="mx-auto max-w-3xl px-4 py-12 sm:px-6">
      <h1 className="font-display text-4xl font-bold">{title}</h1>
      <p className="mt-2 text-sm text-muted-foreground">{updated}</p>
      <div className="mt-8 space-y-6 text-[15px] leading-relaxed [&_h2]:font-display [&_h2]:text-xl [&_h2]:font-bold [&_h2]:mt-8 [&_ul]:list-disc [&_ul]:pl-5 [&_ul]:space-y-1 [&_p]:text-muted-foreground [&_li]:text-muted-foreground">
        {children}
      </div>
    </main>
  </PublicShell>;
}

export type Sections = { h: string; p?: string; li?: string[] }[];
export function renderSections(s: Sections) {
  return s.map((x) => <section key={x.h}><h2>{x.h}</h2>{x.p && <p className="mt-2">{x.p}</p>}{x.li && <ul className="mt-2">{x.li.map((l) => <li key={l}>{l}</li>)}</ul>}</section>);
}

export const CONTACT_EMAIL = "support@clario.app";
