// Galerie d'avatars illustrés de Clario : 16 portraits HD (Selena #1) + photo importée,
// avec repli sur les pastels et l'initiale pour les anciens profils.
import { toneBg } from "@/lib/tones";
import { cn } from "@/lib/utils";

const files = import.meta.glob<{ url: string }>("@/assets/avatars/avatar-*.jpg.asset.json", { eager: true, import: "default" });
export const AVATAR_GALLERY = Array.from({ length: 16 }, (_, i) => files[`/src/assets/avatars/avatar-${i + 1}.jpg.asset.json`]?.url ?? "");

export function isPhotoAvatar(avatar?: string | null) { return !!avatar && avatar.startsWith("data:image/"); }

export function AvatarFace({ avatar, name, className }: { avatar?: string | null | undefined; name?: string | null | undefined; className?: string | undefined }) {
  const initials = ((name ?? "C").trim()[0] ?? "C").toUpperCase();
  if (isPhotoAvatar(avatar)) return <img src={avatar!} alt="" className={cn("size-full object-cover", className)} />;
  const galleryIndex = avatar === "selena" ? 1 : avatar ? Number(avatar) : NaN;
  if (galleryIndex >= 1 && galleryIndex <= AVATAR_GALLERY.length)
    return <img src={AVATAR_GALLERY[galleryIndex - 1]} alt="" className={cn("size-full object-cover", className)} />;
  if (avatar && toneBg[avatar]) return <span className={cn("size-full", toneBg[avatar], className)} />;
  return <span className={cn("grid size-full place-items-center bg-primary-soft font-semibold text-amber-strong", className)}>{initials}</span>;
}
