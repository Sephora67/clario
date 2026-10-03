import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { importLocalDocs, listLocalDocs } from "@/lib/library";
import { useI18n } from "@/lib/i18n";

/** Propose d'envoyer dans le compte les fichiers enregistrés auparavant sur cet appareil. */
export function LocalImportBanner() {
  const { t } = useI18n();
  const [count, setCount] = useState(0);
  const [busy, setBusy] = useState(false);
  useEffect(() => { if (localStorage.getItem("clario-docs-migrated") !== "1") setCount(listLocalDocs().length); }, []);
  if (!count) return null;
  const run = async () => { setBusy(true); try { const n = await importLocalDocs(); toast.success(t("local.added", { n })); setCount(0); } catch { toast.error(t("local.failed")); } finally { setBusy(false); } };
  return <div className="mb-6 flex flex-wrap items-center gap-3 rounded-md border border-amber-strong/40 bg-primary-soft p-4 text-sm">
    <p className="min-w-0 flex-1"><strong>{t("local.banner", { n: count })}</strong> {t("local.bannerHint")}</p>
    <Button size="sm" disabled={busy} onClick={() => void run()}>{busy ? t("local.importing") : t("local.addToAccount")}</Button>
    <Button size="sm" variant="ghost" onClick={() => { localStorage.setItem("clario-docs-migrated", "1"); setCount(0); }}>{t("local.later")}</Button>
  </div>;
}
