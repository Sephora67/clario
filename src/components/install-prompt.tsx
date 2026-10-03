// Invitation discrète à installer Clario sur l'écran d'accueil (téléphone / tablette).
import { useEffect, useState } from "react";
import { Share, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useI18n } from "@/lib/i18n";

type BIPEvent = Event & { prompt: () => Promise<void>; userChoice: Promise<unknown> };

export function InstallPrompt() {
  const { t } = useI18n();
  const [evt, setEvt] = useState<BIPEvent | null>(null);
  const [ios, setIos] = useState(false);
  const [show, setShow] = useState(false);
  const [help, setHelp] = useState(false);

  useEffect(() => {
    const standalone = window.matchMedia("(display-mode: standalone)").matches || (navigator as { standalone?: boolean }).standalone;
    if (standalone) return;
    const ua = navigator.userAgent;
    const isIos = /iPad|iPhone|iPod/.test(ua) || (ua.includes("Macintosh") && navigator.maxTouchPoints > 1);
    if (isIos) { setIos(true); const id = setTimeout(() => setShow(true), 4000); return () => clearTimeout(id); }
    const on = (e: Event) => { e.preventDefault(); setEvt(e as BIPEvent); setShow(true); };
    window.addEventListener("beforeinstallprompt", on);
    return () => window.removeEventListener("beforeinstallprompt", on);
  }, []);

  // Une fermeture vaut seulement pour la page actuelle : sur les pages publiques,
  // l'invitation revient au prochain rafraîchissement tant que Clario n'est pas installé.
  const dismiss = () => { setShow(false); setHelp(false); };
  const add = async () => {
    if (ios) { setHelp(true); return; }
    if (!evt) return;
    await evt.prompt(); await evt.userChoice; dismiss();
  };
  if (!show) return null;

  if (help) return <div className="fixed inset-x-3 bottom-3 z-50 mx-auto max-w-sm rounded-2xl border bg-card p-5 shadow-lg" role="dialog" aria-label={t("install.iosTitle")}>
    <h3 className="font-semibold">{t("install.iosTitle")}</h3>
    <ol className="mt-3 list-decimal space-y-1.5 pl-5 text-sm text-muted-foreground">
      <li>{t("install.ios1")} <Share className="inline size-4 align-text-bottom" /></li><li>{t("install.ios2")}</li><li>{t("install.ios3")}</li>
    </ol>
    <Button className="mt-4 w-full" onClick={dismiss}>{t("install.ok")}</Button>
  </div>;

  return <div className="fixed inset-x-3 bottom-3 z-50 mx-auto flex max-w-sm items-center gap-3 rounded-2xl border bg-card p-3 shadow-lg" role="dialog" aria-label={t("install.title")}>
    <img src="/icon-512.png" alt="" className="size-10 rounded-xl" />
    <div className="min-w-0 flex-1"><p className="text-sm font-semibold">{t("install.title")}</p><p className="text-xs text-muted-foreground">{t("install.desc")}</p></div>
    <Button size="sm" onClick={() => void add()}>{t("install.add")}</Button>
    <button aria-label={t("install.later")} onClick={dismiss} className="text-muted-foreground"><X className="size-4" /></button>
  </div>;
}
