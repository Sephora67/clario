import type { Locale } from "./i18n";

export const localeTag = (l: Locale) => (l === "fr" ? "fr-CA" : "en-CA");
export const toneBg: Record<string, string> = { purple: "bg-folder-purple", pink: "bg-folder-pink", blue: "bg-folder-blue", green: "bg-folder-green", coral: "bg-folder-coral", yellow: "bg-folder-yellow", violet: "bg-folder-violet" };
export const statusClass: Record<string, string> = { en_cours: "bg-primary-soft text-amber-strong", a_reviser: "bg-school-purple-soft text-school-purple", valide: "bg-school-green-soft text-school-green-strong" };
export function ago(t: number, locale: Locale, tr: (k: string, v?: Record<string, string | number>) => string) {
  const m = Math.round((Date.now() - t) / 60000);
  if (m < 1) return tr("ago.now"); if (m < 60) return tr("ago.min", { n: m });
  const h = Math.round(m / 60); if (h < 24) return tr("ago.hour", { n: h });
  const d = Math.round(h / 24); return d === 1 ? tr("ago.yesterday") : tr("ago.days", { n: d });
}
export const fmtDateTime = (iso: string, locale: Locale) => new Date(iso).toLocaleString(localeTag(locale), { weekday: "short", day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });
