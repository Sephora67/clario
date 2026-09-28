import { useState, type ReactNode } from "react";
import { Link, useNavigate } from "@tanstack/react-router";
import { Folder, LogOut, Menu, NotebookPen, UserRound } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { useAuth } from "@/hooks/use-auth";
import { supabase } from "@/integrations/supabase/client";
import { cn } from "@/lib/utils";

const nav = [
  { label: "Dossiers", icon: Folder, to: "/" },
  { label: "Cahier", icon: NotebookPen, to: "/cahier" },
] as const;

function Nav({ section, onGo }: { section: string; onGo?: () => void }) {
  return <nav className="mt-8 space-y-1" aria-label="Navigation principale">
    {nav.map(({ label, icon: Icon, to }) => <Link key={label} to={to} onClick={onGo} className={cn("flex items-center gap-3 rounded-md px-3 py-2.5 text-sm font-medium transition-colors", label === section ? "bg-primary-soft font-semibold text-amber-strong" : "text-muted-foreground hover:bg-muted hover:text-foreground")}><Icon className="size-4.5" />{label}</Link>)}
  </nav>;
}

export function AppShell({ children, section = "Dossiers", compact = false }: { children: ReactNode; section?: string; compact?: boolean }) {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  return (
    <div className="min-h-dvh bg-background text-foreground lg:grid lg:grid-cols-[230px_minmax(0,1fr)]">
      <aside className="hidden border-r bg-sidebar lg:flex lg:h-dvh lg:flex-col lg:px-4 lg:py-6">
        <Link to="/" className="flex items-center gap-2 px-3 font-display text-2xl font-bold tracking-tight" aria-label="Clario accueil">Clario<span className="mt-1 size-2 rounded-full bg-primary" /></Link>
        <Nav section={section} />
        <div className="mt-auto flex items-center gap-3 px-3 py-2 text-sm text-muted-foreground">
          <span className="grid size-9 shrink-0 place-items-center rounded-full bg-primary-soft font-semibold text-amber-strong">{user?.email?.slice(0, 2).toUpperCase() ?? <UserRound className="size-4" />}</span>
          <span className="min-w-0 flex-1 truncate">{user?.email ?? "Compte"}</span>
          {user && <Button variant="ghost" size="icon" className="size-8" aria-label="Se déconnecter" onClick={() => supabase.auth.signOut()}><LogOut /></Button>}
        </div>
      </aside>
      <div className="min-w-0">
        <header className={cn("grid grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-3 border-b bg-background px-3 py-2.5 pt-[max(0.625rem,env(safe-area-inset-top))] lg:hidden", compact && "shadow-sm")}>
          <Button variant="ghost" size="icon" aria-label="Menu" onClick={() => setOpen(true)}><Menu /></Button>
<Link to="/" className="justify-self-center font-display text-xl font-bold tracking-tight">Clario</Link>
          {user ? <span className="grid size-9 place-items-center rounded-full bg-primary-soft text-xs font-semibold text-amber-strong">{user.email?.slice(0, 2).toUpperCase()}</span> : <Button size="sm" onClick={() => navigate({ to: "/auth" })}>Connexion</Button>}
        </header>
        <Sheet open={open} onOpenChange={setOpen}>
          <SheetContent side="left" className="w-64">
            <SheetHeader><SheetTitle className="font-display text-2xl">Clario</SheetTitle></SheetHeader>
            <Nav section={section} onGo={() => setOpen(false)} />
            {user && <Button variant="ghost" className="mt-6 w-full justify-start" onClick={() => { void supabase.auth.signOut(); setOpen(false); }}><LogOut />Se déconnecter</Button>}
          </SheetContent>
        </Sheet>
        {children}
      </div>
    </div>
  );
}
