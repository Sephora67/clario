// Traduction Clario : anglais par défaut, français disponible.
// Le choix est gardé en local (affichage instantané) puis synchronisé avec le compte.
import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";

export type Locale = "en" | "fr";
const STORE_KEY = "clario-locale";
export const LOCALE_EVENT = "clario-locale";

import { en } from "./i18n/en";
import { fr } from "./i18n/fr";
import { phrases } from "./i18n/phrases";
import { landingEn, landingFr } from "./i18n/landing";

const dicts: Record<Locale, Record<string, string>> = { en: { ...en, ...landingEn }, fr: { ...fr, ...landingFr } };

type I18n = {
  locale: Locale;
  setLocale: (l: Locale) => void;
  /** Traduit la clé ; {name} et autres variables sont remplacés. */
  t: (key: string, vars?: Record<string, string | number>) => string;
};

const Ctx = createContext<I18n>({ locale: "en", setLocale: () => undefined, t: (k) => k });

function detect(): Locale {
  try {
    const saved = localStorage.getItem(STORE_KEY);
    if (saved === "en" || saved === "fr") return saved;
  } catch { /* storage indisponible */ }
  return "en"; // anglais par défaut au premier lancement
}

export function I18nProvider({ children }: { children: ReactNode }) {
  const [locale, setLocaleState] = useState<Locale>("en"); // rendu serveur/initial : anglais, puis langue enregistrée après hydratation
  activeLocale = locale;

  useEffect(() => { const saved = detect(); if (saved !== "en") setLocaleState(saved); }, []);

  useEffect(() => {
    document.documentElement.lang = locale;
    try { localStorage.setItem(STORE_KEY, locale); } catch { /* storage indisponible */ }
  }, [locale]);

  useEffect(() => {
    const apply = (e: Event) => { const l = (e as CustomEvent<Locale>).detail; if (l === "en" || l === "fr") setLocaleState(l); };
    window.addEventListener(LOCALE_EVENT, apply);
    return () => window.removeEventListener(LOCALE_EVENT, apply);
  }, []);

  const setLocale = useCallback((l: Locale) => {
    setLocaleState(l);
    window.dispatchEvent(new CustomEvent<Locale>(LOCALE_EVENT, { detail: l }));
  }, []);

  const t = useCallback((key: string, vars?: Record<string, string | number>) => {
    let s = dicts[locale][key] ?? dicts[Object.keys(dicts).find((k) => k !== locale) as Locale][key] ?? key;
    if (vars) for (const [k, v] of Object.entries(vars)) s = s.replaceAll(`{${k}}`, String(v));
    return s;
  }, [locale]);

  const value = useMemo(() => ({ locale, setLocale, t }), [locale, setLocale, t]);
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useI18n() {
  return useContext(Ctx);
}

let activeLocale: Locale = "en";

/** Traduit une phrase française du code vers la langue active (hors React, sans hook). */
export function tf(frText: string, vars?: unknown[]): string {
  const base = activeLocale === "en" ? (phrases[frText] ?? frText) : frText;
  if (!vars) return base;
  return base.replace(/\{(\d+)\}/g, (_, i: string) => {
    const v = vars[Number(i)];
    return v === undefined || v === null ? "" : String(v);
  });
}

/** Utilitaire hors React (ex. librairie) : langue courante pour les appels serveur. */
export function currentLocale(): Locale {
  try { const s = localStorage.getItem(STORE_KEY); if (s === "fr") return "fr"; } catch { /* storage indisponible */ }
  return "en";
}
