// Fenêtres Clario (remplacent les boîtes du navigateur qui affichent l'adresse du site).
import { useEffect, useRef, useState } from "react";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useI18n } from "@/lib/i18n";

type Req = { kind: "text" | "confirm" | "choice"; title: string; value?: string; danger?: boolean; choices?: string[]; resolve: (v: string | boolean | number | null) => void };
let push: ((r: Req) => void) | null = null;

export function askText(title: string, value = ""): Promise<string | null> {
  return new Promise((resolve) => { if (!push) return resolve(null); push({ kind: "text", title, value, resolve: resolve as Req["resolve"] }); });
}
export function askConfirm(title: string): Promise<boolean> {
  return new Promise((resolve) => { if (!push) return resolve(false); push({ kind: "confirm", title, danger: /supprimer|delete/i.test(title), resolve: (v) => resolve(v === true) }); });
}
// Fenêtre à plusieurs choix (ex. supprimer une vidéo ou la délier de sa page).
export function askChoice(title: string, choices: string[]): Promise<number | null> {
  return new Promise((resolve) => { if (!push) return resolve(null); push({ kind: "choice", title, choices, resolve: (v) => resolve(typeof v === "number" ? v : null) }); });
}

export function DialogHost() {
  const { t } = useI18n();
  const [req, setReq] = useState<Req | null>(null); const [value, setValue] = useState(""); const input = useRef<HTMLInputElement>(null);
  useEffect(() => { push = (r) => { setValue(r.value ?? ""); setReq(r); }; return () => { push = null; }; }, []);
  const close = (v: string | boolean | number | null) => { req?.resolve(v); setReq(null); };
  return <Dialog open={!!req} onOpenChange={(o) => { if (!o) close(req?.kind === "confirm" ? false : null); }}>
    <DialogContent className="max-w-sm" onOpenAutoFocus={(e) => { if (req?.kind === "text") { e.preventDefault(); input.current?.focus(); input.current?.select(); } }}>
      <DialogHeader><DialogTitle className="font-display">{req?.kind === "confirm" ? t("dialog.confirmTitle") : req?.title}</DialogTitle>{req?.kind === "confirm" && <DialogDescription>{req.title}</DialogDescription>}</DialogHeader>
      {req?.kind === "text" && <form id="clario-ask" onSubmit={(e) => { e.preventDefault(); close(value); }}><Input ref={input} value={value} onChange={(e) => setValue(e.target.value)} /></form>}
      {req?.kind === "choice" && <DialogFooter className="flex-col gap-2 sm:flex-col">
        {req.choices?.map((label, i) => <Button key={label} variant={/supprimer|effacer|delete/i.test(label) ? "destructive" : i === 0 ? "default" : "outline"} onClick={() => close(i)}>{label}</Button>)}
        <Button variant="ghost" onClick={() => close(null)}>{t("common.cancel")}</Button>
      </DialogFooter>}
      {req?.kind !== "choice" && <DialogFooter className="gap-2"><Button variant="ghost" onClick={() => close(req?.kind === "confirm" ? false : null)}>{t("common.cancel")}</Button>
        {req?.kind === "text" ? <Button type="submit" form="clario-ask" disabled={!value.trim()}>{t("common.ok")}</Button> : <Button variant={req?.danger ? "destructive" : "default"} onClick={() => close(true)}>{t("common.confirm")}</Button>}</DialogFooter>}
    </DialogContent>
  </Dialog>;
}
