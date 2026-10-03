// Fenêtre « Mon profil » : prénom ou pseudo, avatar (grille de 17 portraits ou initiale), langue EN | FR.
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { useServerFn } from "@tanstack/react-start";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Link } from "@tanstack/react-router";
import { AVATAR_GALLERY, isPhotoAvatar } from "@/components/avatar";
import { useI18n, tf } from "@/lib/i18n";
import { updateProfile, type Profile } from "@/lib/library";
import { cn } from "@/lib/utils";
import { useCredits } from "@/hooks/use-credits";
import { useAuth } from "@/hooks/use-auth";
import { supabase } from "@/integrations/supabase/client";
import { getBillingPortal } from "@/lib/payments.functions";
import { getPaddleEnvironment } from "@/lib/paddle";
import { deleteMyAccount } from "@/lib/admin.functions";
import { askConfirm } from "@/lib/dialogs";
import { Camera, Check } from "lucide-react";

function resizePhoto(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      const s = Math.min(img.width, img.height); const c = document.createElement("canvas"); c.width = c.height = 256;
      c.getContext("2d")!.drawImage(img, (img.width - s) / 2, (img.height - s) / 2, s, s, 0, 0, 256, 256);
      URL.revokeObjectURL(img.src); resolve(c.toDataURL("image/jpeg", 0.85));
    };
    img.onerror = () => reject(new Error(tf("Image illisible")));
    img.src = URL.createObjectURL(file);
  });
}

export function ProfileDialog({ open, onOpenChange, profile, onSaved }: { open: boolean; onOpenChange: (v: boolean) => void; profile: Profile | null; onSaved: () => void }) {
  const { t, setLocale } = useI18n();
  const { user } = useAuth();
  const [name, setName] = useState("");
  const [avatar, setAvatar] = useState<string | null>(null);
  const [locale, setLocaleUi] = useState<"en" | "fr">("en");
  const [busy, setBusy] = useState(false);
  const [email, setEmail] = useState("");
  const [emailEdit, setEmailEdit] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const { credits } = useCredits();
  const portal = useServerFn(getBillingPortal);
  useEffect(() => { if (open && profile) { setName(profile.displayName ?? ""); setAvatar(profile.avatar === "selena" ? "1" : profile.avatar); setLocaleUi(profile.locale); } }, [open, profile]);
  useEffect(() => { if (open) { setEmail(user?.email ?? ""); setEmailEdit(false); } }, [open, user?.email]);

  const save = async () => {
    setBusy(true);
    try {
      const nextEmail = email.trim();
      if (emailEdit && nextEmail && nextEmail !== user?.email) {
        const { error } = await supabase.auth.updateUser({ email: nextEmail }, { emailRedirectTo: window.location.origin });
        if (error) throw error;
        toast.success(tf("Vérifie ta nouvelle adresse : un lien de confirmation t'a été envoyé."));
      }
      await updateProfile({ displayName: name.trim() || null, avatar, locale });
      setLocale(locale);
      toast.success(t("profile.saved"));
      onSaved();
      onOpenChange(false);
    } catch (e) { toast.error((e as Error).message); } finally { setBusy(false); }
  };

  const onPhoto = async (f?: File) => {
    if (!f) return;
    if (!f.type.startsWith("image/")) { toast.error(tf("Choisis une image")); return; }
    try { setAvatar(await resizePhoto(f)); } catch (e) { toast.error((e as Error).message); }
  };

  const confirmDelete = async () => {
    const msg = tf("Supprimer définitivement ton compte et tout son contenu ? Cette action est irréversible.");
    if (!(await askConfirm(msg))) return;
    setBusy(true);
    try {
      const r = await deleteMyAccount();
      if (!r.ok && r.reason === "ACTIVE_SUB") {
        toast.error(tf("Ton abonnement est encore actif. Annule-le d'abord via « Gérer l'abonnement » : ta suppression prendra effet à la fin de la période payée."));
        return;
      }
      await supabase.auth.signOut();
      onOpenChange(false);
      toast.success(tf("Compte supprimé. Bonne continuation !"));
      window.location.href = "/";
    } catch (e) { toast.error((e as Error).message); } finally { setBusy(false); }
  };

  const photoSelected = isPhotoAvatar(avatar);

  return <Dialog open={open} onOpenChange={onOpenChange}>
    <DialogContent className="max-h-[85dvh] max-w-md overflow-y-auto">
      <DialogHeader><DialogTitle className="font-display">{t("profile.title")}</DialogTitle></DialogHeader>
      <div className="space-y-4">
        <label className="block text-sm">
          {t("profile.name")}
          <Input className="mt-1" value={name} onChange={(e) => setName(e.target.value)} placeholder={t("profile.namePlaceholder")} maxLength={40} />
        </label>
        <div className="block text-sm">
          {tf("E-mail")}
          <div className="relative mt-1">
            <Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} disabled={!emailEdit} className={cn("disabled:opacity-70", !emailEdit && "pr-20")} />
            {!emailEdit && <button type="button" className="absolute inset-y-1 right-1 rounded-md px-3 text-sm font-semibold text-blue-600 hover:bg-muted" onClick={() => setEmailEdit(true)}>{tf("Modifier")}</button>}
          </div>
        </div>
        <div className="text-sm">
          {t("profile.avatar")}
          <div className="mt-2 grid grid-cols-3 gap-2 sm:grid-cols-4">
            {AVATAR_GALLERY.map((src, i) => {
              const value = String(i + 1);
              const label = i === 0 ? "Selena" : undefined;
              const selected = avatar === value;
              return (
                <button key={value} type="button" aria-label={label ?? `${tf("Avatar")} ${i + 1}`} onClick={() => setAvatar(value)} className={cn("relative aspect-square overflow-hidden rounded-xl border-2 p-0 transition-colors", selected ? "border-amber-strong" : "border-transparent hover:border-muted-foreground/30")}>
                  <img src={src} alt="" className="size-full object-cover" loading="lazy" />
                  {selected && (
                    <span className="absolute bottom-1 left-1 grid size-5 place-items-center rounded-full bg-amber-strong text-primary-foreground">
                      <Check className="size-3.5" strokeWidth={3} />
                    </span>
                  )}
                </button>
              );
            })}
            <button type="button" aria-label={tf("Importer une photo")} onClick={() => fileRef.current?.click()} className={cn("relative flex aspect-square flex-col items-center justify-center gap-1 overflow-hidden rounded-xl border-2 transition-colors", photoSelected ? "border-amber-strong" : "border-dashed border-muted-foreground/30 bg-muted/40 hover:bg-muted")}>
              {photoSelected ? <img src={avatar!} alt="" className="absolute inset-0 size-full object-cover" /> : <><Camera className="size-6 text-muted-foreground" /><span className="text-[11px] font-semibold">{tf("Importer une photo")}</span></>}
            </button>
            <input ref={fileRef} type="file" accept="image/*" hidden onChange={(e) => { void onPhoto(e.target.files?.[0]); e.target.value = ""; }} />
          </div>
        </div>
        <div className="text-sm">
          {t("profile.language")}
          <div className="mt-2 flex rounded-md border p-0.5">
            {(["en", "fr"] as const).map((l) => (
              <button key={l} type="button" onClick={() => setLocaleUi(l)} className={cn("flex-1 rounded px-3 py-1.5 text-sm font-semibold uppercase", locale === l ? "bg-primary-soft text-amber-strong" : "text-muted-foreground")}>{l}</button>
            ))}
          </div>
        </div>
          {credits && (
          <div className="rounded-lg border bg-card p-3 text-sm">
            <div className="flex items-center justify-between gap-2">
              <span className="font-medium">💬 {credits.questions} · 🎬 {credits.videos}</span>
              <span className="flex gap-1">
                {credits.hasPass && <span className="rounded-full bg-school-yellow-soft px-2 py-0.5 text-xs font-semibold">{tf("Pass")}</span>}
                {credits.club && <span className="rounded-full bg-school-purple-soft px-2 py-0.5 text-xs font-semibold">{tf("Club")}</span>}
              </span>
            </div>
            <p className="mt-1 text-xs text-muted-foreground">{tf("Crédits et abonnement")}</p>
            <div className="mt-2 flex gap-2">
              <Button asChild variant="outline" size="sm" className="flex-1"><Link to="/pricing">{t("pricing.title")}</Link></Button>
              {credits.club && (
                <Button variant="outline" size="sm" className="flex-1" onClick={async () => {
                  try { const { url } = await portal({ data: { environment: getPaddleEnvironment() } }); window.open(url, "_blank", "noopener"); }
                  catch (e) { toast.error((e as Error).message); }
                }}>{tf("Gérer l'abonnement")}</Button>
              )}
            </div>
          </div>
        )}
        <Button className="w-full" disabled={busy} onClick={() => void save()}>{t("common.save")}</Button>
        <div className="rounded-lg border border-destructive/30 p-3">
          <p className="text-sm font-semibold text-destructive">{tf("Zone de danger")}</p>
          <p className="mt-1 text-xs text-muted-foreground">{tf("Supprimer ton compte efface définitivement tous tes documents, notes, discussions, quiz et crédits restants. Cette action est irréversible.")}</p>
          <Button variant="destructive" size="sm" className="mt-2 w-full" disabled={busy} onClick={() => void confirmDelete()}>
            {tf("Supprimer mon compte")}
          </Button>
        </div>
      </div>
    </DialogContent>
  </Dialog>;
}
