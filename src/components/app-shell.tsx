import { tf } from "@/lib/i18n";
import { useEffect, useRef, useState, type ReactNode } from "react";
import { Link, useNavigate } from "@tanstack/react-router";
import { Bell, BookOpen, CalendarDays, Folder, GraduationCap, LayoutDashboard, Library, LogOut, Menu, NotebookPen, Search, UserRound } from "lucide-react";
import { AvatarFace } from "@/components/avatar";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { ProfileDialog } from "@/components/profile-dialog";
import { useCredits } from "@/hooks/use-credits";
import { useAuth } from "@/hooks/use-auth";
import { useLibrary } from "@/hooks/use-library";
import { supabase } from "@/integrations/supabase/client";
import { checkReminders, getProfile, listNotifications, markAllRead, markRead, searchAll, updateProfile, type Profile } from "@/lib/library";
import { ago } from "@/lib/tones";
import { currentLocale, useI18n } from "@/lib/i18n";
import { cn } from "@/lib/utils";

const nav = [
  { key: "dashboard", icon: LayoutDashboard, to: "/" },
  { key: "courses", icon: GraduationCap, to: "/cours" },
  { key: "folders", icon: Folder, to: "/dossiers" },
  { key: "library", icon: Library, to: "/bibliotheque" },
  { key: "notes", icon: NotebookPen, to: "/notes" },
  { key: "calendar", icon: CalendarDays, to: "/calendrier" },
] as const;

function Nav({ section, onGo }: { section: string; onGo?: () => void }) {
  const { t } = useI18n();
  return <nav className="mt-8 space-y-1" aria-label={tf("Navigation principale")}>
    {nav.map(({ key, icon: Icon, to }) => <Link key={key} to={to} onClick={onGo} className={cn("flex items-center gap-3 rounded-md px-3 py-2.5 text-sm font-medium transition-colors", key === section ? "bg-primary-soft font-semibold text-amber-strong" : "text-muted-foreground hover:bg-muted hover:text-foreground")}><Icon className="size-4.5" />{t(`nav.${key}`)}</Link>)}
  </nav>;
}

function SearchDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (v: boolean) => void }) {
  const { t } = useI18n();
  const navigate = useNavigate();
  const [q, setQ] = useState("");
  const [res, setRes] = useState<Awaited<ReturnType<typeof searchAll>> | null>(null);
  useEffect(() => { if (!q.trim()) { setRes(null); return; } const t = setTimeout(() => void searchAll(q.trim()).then(setRes), 200); return () => clearTimeout(t); }, [q]);
  const go = (fn: () => void) => { fn(); onOpenChange(false); setQ(""); };
  const empty = res && !res.courses.length && !res.folders.length && !res.docs.length;
  return <Dialog open={open} onOpenChange={onOpenChange}>
    <DialogContent className="top-[15%] translate-y-0 gap-0 p-0 sm:max-w-lg">
      <DialogTitle className="sr-only">{t("shell.search")}</DialogTitle>
      <label className="flex items-center gap-3 border-b px-4 py-3"><Search className="size-4 text-muted-foreground" /><input autoFocus value={q} onChange={(e) => setQ(e.target.value)} placeholder={t("shell.searchPlaceholder")} className="flex-1 bg-transparent text-sm outline-none" /></label>
      <div className="max-h-[60vh] overflow-y-auto p-2 text-sm">
        {!res && <p className="p-4 text-center text-muted-foreground">{t("shell.searchHint")}</p>}
        {empty && <p className="p-4 text-center text-muted-foreground">{t("shell.noResults", { q })}</p>}
        {res?.courses.map((c) => <button key={c.id} onClick={() => go(() => navigate({ to: "/cours/$id", params: { id: c.id } }))} className="flex w-full items-center gap-3 rounded-md px-3 py-2 text-left hover:bg-muted"><GraduationCap className="size-4 text-muted-foreground" />{c.name}<span className="ml-auto text-xs text-muted-foreground">{t("shell.kindCourse")}</span></button>)}
        {res?.folders.map((f) => <button key={f.id} onClick={() => go(() => navigate({ to: "/dossiers", search: { f: f.id } }))} className="flex w-full items-center gap-3 rounded-md px-3 py-2 text-left hover:bg-muted"><Folder className="size-4 text-muted-foreground" />{f.name}<span className="ml-auto text-xs text-muted-foreground">{t("shell.kindFolder")}</span></button>)}
        {res?.docs.map((d) => <button key={d.id} onClick={() => go(() => navigate({ to: "/cahier", search: { doc: d.id } }))} className="flex w-full items-center gap-3 rounded-md px-3 py-2 text-left hover:bg-muted"><BookOpen className="size-4 text-muted-foreground" />{d.name}<span className="ml-auto text-xs text-muted-foreground">{d.kind}</span></button>)}
      </div>
    </DialogContent>
  </Dialog>;
}

function showDeviceNotification(title: string, body: string) {
  try {
    if (typeof window === "undefined" || !("Notification" in window) || Notification.permission !== "granted") return;
    const opts = { body, icon: "/favicon.png" };
    if ("serviceWorker" in navigator) {
      void navigator.serviceWorker.getRegistration().then((reg) => {
        if (reg) { void reg.showNotification(title, opts); return; }
        try { new Notification(title, opts); } catch { /* mobile browsers without a worker */ }
      }).catch(() => undefined);
      return;
    }
    new Notification(title, opts);
  } catch { /* never crash the app for an alert */ }
}

function Notifications() {
  const { t, locale } = useI18n();
  const navigate = useNavigate();
  const { data, reload } = useLibrary(listNotifications, []);
  const seen = useRef<Set<string> | null>(null);
  useEffect(() => {
    const tick = () => void checkReminders().then((n) => { if (n > 0) void reload(); }).catch(() => undefined);
    tick(); const i = setInterval(tick, 60_000); const onFocus = () => tick(); window.addEventListener("focus", onFocus);
    return () => { clearInterval(i); window.removeEventListener("focus", onFocus); };
  }, [reload]);
  useEffect(() => {
    if (seen.current === null) { seen.current = new Set(data.map((n) => n.id)); return; }
    for (const n of data) if (!seen.current.has(n.id)) { seen.current.add(n.id); if (!n.readAt) showDeviceNotification(n.title, n.body); }
  }, [data]);
  const unread = data.filter((n) => !n.readAt);
  return <Popover>
    <PopoverTrigger asChild><Button variant="ghost" size="icon" className="relative" aria-label={t("shell.unreadAria", { n: unread.length })}><Bell />{unread.length > 0 && <span className="absolute right-1 top-1 grid min-w-4 place-items-center rounded-full bg-destructive px-1 text-[10px] font-bold leading-4 text-destructive-foreground">{unread.length}</span>}</Button></PopoverTrigger>
    <PopoverContent align="end" className="w-80 p-0">
      <div className="flex items-center justify-between border-b px-4 py-3"><strong className="text-sm">{t("shell.notifications")}</strong>{unread.length > 0 && <button className="text-xs font-semibold text-amber-strong" onClick={() => void markAllRead()}>{t("shell.markAllRead")}</button>}</div>
      <div className="max-h-96 overflow-y-auto">
        {data.length === 0 ? <p className="p-6 text-center text-sm text-muted-foreground">{t("shell.noNotifications")}</p> :
          data.map((n) => <button key={n.id} onClick={() => { void markRead(n.id); if (n.link) void navigate({ to: n.link }); }} className={cn("block w-full border-b px-4 py-3 text-left text-sm last:border-0 hover:bg-muted", !n.readAt && "bg-primary-soft/50")}>
            <span className="flex items-center gap-2 font-semibold">{!n.readAt && <span className="size-2 rounded-full bg-amber-strong" />}{n.title}</span>
            <span className="block text-xs text-muted-foreground">{n.body} · {ago(new Date(n.createdAt).getTime(), locale, t)}</span>
          </button>)}
      </div>
      {"Notification" in (typeof window === "undefined" ? {} : window) && typeof Notification !== "undefined" && Notification.permission === "default" && <button className="w-full border-t px-4 py-2 text-xs font-semibold text-amber-strong" onClick={() => void Notification.requestPermission()}>{t("shell.enableDeviceAlerts")}</button>}
    </PopoverContent>
  </Popover>;
}

export function AppShell({ children, section = "dashboard", compact = false }: { children: ReactNode; section?: string; compact?: boolean }) {
  const { t } = useI18n();
  const { user } = useAuth();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);
  const { credits } = useCredits();
  const { data: profile, reload: reloadProfile } = useLibrary<Profile | null>(getProfile, null);
  // La langue du compte suit l'élève sur tous ses appareils ; un choix fait sur l'écran
  // de connexion est enregistré dans le compte dès que le profil arrive.
  useEffect(() => {
    if (!profile) return;
    let pending: string | null = null;
    try { pending = sessionStorage.getItem("clario-locale-pending"); } catch { /* indisponible */ }
    if (pending === "en" || pending === "fr") {
      try { sessionStorage.removeItem("clario-locale-pending"); } catch { /* indisponible */ }
      if (profile.locale !== pending) void updateProfile({ locale: pending }).then(reloadProfile).catch(() => undefined);
      return;
    }
    if (profile.locale && profile.locale !== currentLocale()) window.dispatchEvent(new CustomEvent("clario-locale", { detail: profile.locale }));
  }, [profile?.locale]);
  useEffect(() => { const k = (e: KeyboardEvent) => { if ((e.metaKey || e.ctrlKey) && e.key === "k") { e.preventDefault(); setSearchOpen(true); } }; window.addEventListener("keydown", k); return () => window.removeEventListener("keydown", k); }, []);
  const signOut = async () => { await supabase.auth.signOut(); void navigate({ to: "/" }); };
  return (
    <div className="min-h-dvh bg-background text-foreground lg:grid lg:grid-cols-[230px_minmax(0,1fr)]">
      <aside className="hidden border-r bg-sidebar lg:sticky lg:top-0 lg:flex lg:h-dvh lg:flex-col lg:px-4 lg:py-6">
        <Link to="/" className="flex items-center gap-2 px-3 font-display text-2xl font-bold tracking-tight" aria-label={t("shell.homeAria")}>{tf("Clario")}<span className="mt-1 size-2 rounded-full bg-primary" /></Link>
        <Nav section={section} />
        <button onClick={() => setProfileOpen(true)} className="mt-auto flex items-center gap-3 rounded-md px-3 py-2 text-left text-sm text-muted-foreground transition-colors hover:bg-muted hover:text-foreground" aria-label={t("shell.myProfile")}>
          <span className="size-9 shrink-0 overflow-hidden rounded-full"><AvatarFace avatar={profile?.avatar} name={profile?.displayName ?? user?.email} /></span>
          <span className="min-w-0 flex-1"><span className="block truncate font-medium text-foreground">{profile?.displayName || user?.email || t("shell.account")}</span>{profile?.displayName && user?.email && <span className="block truncate text-xs">{user.email}</span>}</span>
        </button>
        {user && <Button variant="ghost" size="sm" className="justify-start" onClick={() => void signOut()}><LogOut />{t("shell.signOut")}</Button>}
      </aside>
      <div className="min-w-0">
        <header className={cn("sticky top-0 z-30 grid grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-3 border-b bg-background/95 px-3 py-2.5 pt-[max(0.625rem,env(safe-area-inset-top))] backdrop-blur lg:px-8", compact && "shadow-sm")}>
          <Button variant="ghost" size="icon" aria-label={t("shell.menu")} className="lg:hidden" onClick={() => setOpen(true)}><Menu /></Button>
          <button onClick={() => setSearchOpen(true)} className="flex h-9 w-full max-w-md items-center gap-2 justify-self-center rounded-md border bg-card px-3 text-sm text-muted-foreground md:justify-self-start"><Search className="size-4" /><span className="truncate">{t("shell.search")}</span><kbd className="ml-auto hidden text-[10px] sm:inline">{tf("Ctrl K")}</kbd></button>
          <div className="flex items-center gap-1 justify-self-end">
            {user && credits && (
              <Link to="/pricing" aria-label={tf("Voir mes crédits")} className="mr-1 flex items-center gap-1.5 rounded-md px-1.5 py-1 text-sm font-medium text-foreground transition-colors hover:bg-muted">
                <span>💬 {credits.questions}</span><span aria-hidden className="text-muted-foreground">·</span><span>🎬 {credits.videos}</span>
              </Link>
            )}
            {user ? <Notifications /> : <Button size="sm" onClick={() => navigate({ to: "/auth" })}>{t("shell.signIn")}</Button>}
          </div>
        </header>
        <Sheet open={open} onOpenChange={setOpen}>
          <SheetContent side="left" className="w-64">
            <SheetHeader><SheetTitle className="font-display text-2xl">{tf("Clario")}</SheetTitle></SheetHeader>
            <Nav section={section} onGo={() => setOpen(false)} />
            {user && <div className="mt-8 border-t pt-4">
              <button onClick={() => { setOpen(false); setProfileOpen(true); }} className="flex w-full items-center gap-3 rounded-md px-3 py-2 text-left text-sm text-muted-foreground transition-colors hover:bg-muted" aria-label={t("shell.myProfile")}>
                <span className="size-10 shrink-0 overflow-hidden rounded-full"><AvatarFace avatar={profile?.avatar} name={profile?.displayName ?? user.email} /></span>
                <span className="min-w-0 flex-1"><span className="block truncate font-medium text-foreground">{profile?.displayName || user.email}</span>{profile?.displayName && <span className="block truncate text-xs">{user.email}</span>}</span>
              </button>
              <Button variant="ghost" size="sm" className="mt-1 w-full justify-start" onClick={() => { setOpen(false); void signOut(); }}><LogOut />{t("shell.signOut")}</Button>
            </div>}
          </SheetContent>
        </Sheet>
        <SearchDialog open={searchOpen} onOpenChange={setSearchOpen} />
        {user && <ProfileDialog open={profileOpen} onOpenChange={setProfileOpen} profile={profile ?? null} onSaved={reloadProfile} />}
        {children}
      </div>
    </div>
  );
}
