import { tf } from "@/lib/i18n";
import { useEffect, useMemo, useState } from "react";
import { Check, CheckCircle2, BookmarkCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { cn } from "@/lib/utils";

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  pages: string[];
  bookmarks: number[];
  currentIndex: number;
  busy?: boolean;
  onShare: (indices: number[]) => void;
};

export default function PageShareDialog({ open, onOpenChange, pages, bookmarks, currentIndex, busy = false, onShare }: Props) {
  const [tab, setTab] = useState<"all" | "bookmarks">("all");
  const [selected, setSelected] = useState<number[]>([]);

  useEffect(() => { if (open) { setTab("all"); setSelected([currentIndex]); } }, [open, currentIndex]);

  const visible = useMemo(() => pages.map((src, i) => ({ src, i })).filter(({ i }) => tab === "all" || bookmarks.includes(i)), [pages, bookmarks, tab]);
  const allVisibleSelected = visible.length > 0 && visible.every(({ i }) => selected.includes(i));
  const toggle = (i: number) => setSelected((list) => list.includes(i) ? list.filter((n) => n !== i) : [...list, i]);
  const toggleAll = () => setSelected((list) => allVisibleSelected ? list.filter((n) => !visible.some(({ i }) => i === n)) : [...new Set([...list, ...visible.map(({ i }) => i)])]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-[min(94vw,760px)] gap-0 p-0">
        <DialogHeader className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-2 px-5 pt-5">
          <DialogTitle className="font-display text-xl">{selected.length}{" "}{tf("choisie")}{selected.length > 1 ? "s" : ""}</DialogTitle>
          <Button variant="ghost" size="icon" aria-label={allVisibleSelected ? tf("Tout désélectionner") : tf("Tout sélectionner")} onClick={toggleAll}>
            <CheckCircle2 className={cn("size-6", allVisibleSelected ? "text-school-yellow-strong" : "text-muted-foreground")} />
          </Button>
        </DialogHeader>

        <div className="px-5 pt-4">
          <Tabs value={tab} onValueChange={(v) => setTab(v as "all" | "bookmarks")}>
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="all">{tf("Toutes les pages")}</TabsTrigger>
              <TabsTrigger value="bookmarks">{tf("Marque-pages")}</TabsTrigger>
            </TabsList>
          </Tabs>
        </div>

        <div className="max-h-[52dvh] overflow-y-auto px-5 py-4">
          {visible.length === 0 ? (
            <p className="py-8 text-center text-sm text-muted-foreground">{tf("Aucune page avec un marque-page pour l’instant.")}</p>
          ) : (
            <div className="grid grid-cols-3 gap-3 sm:grid-cols-4 md:grid-cols-5">
              {visible.map(({ src, i }) => {
                const on = selected.includes(i);
                return (
                  <button key={`${src}-${i}`} type="button" onClick={() => toggle(i)} aria-pressed={on} className="block text-center text-xs font-semibold">
                    <span className={cn("relative block overflow-hidden border-2 bg-card p-1", on ? "border-school-yellow-strong" : "border-border")}>
                      <img src={src} alt={tf("Page {0}", [i + 1])} className="aspect-[3/4] w-full object-cover" />
                      {bookmarks.includes(i) && <BookmarkCheck className="absolute left-1 top-1 size-4 fill-school-yellow text-school-yellow-strong" />}
                      <span className={cn("absolute bottom-2 left-1/2 grid size-7 -translate-x-1/2 place-items-center rounded-full border-2", on ? "border-school-yellow-strong bg-school-yellow-strong text-white" : "border-muted-foreground/60 bg-background/80")}>
                        {on && <Check className="size-4" />}
                      </span>
                    </span>
                    <span className="mt-1 block text-muted-foreground">{i + 1}</span>
                  </button>
                );
              })}
            </div>
          )}
        </div>

        <DialogFooter className="grid grid-cols-2 gap-3 border-t px-5 py-4">
          <Button variant="outline" onClick={() => onOpenChange(false)}>{tf("Annuler")}</Button>
          <Button disabled={selected.length === 0 || busy} onClick={() => onShare([...selected].sort((a, b) => a - b))}>
            {busy ? tf("Préparation…") : tf("Partager")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
