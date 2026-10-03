import { createFileRoute, Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useMemo, useState } from "react";
import { Eye, EyeOff, Inbox, Ticket, Users, UserCog, Archive } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useAuth } from "@/hooks/use-auth";
import { catalog, FR, ILLUS_ENVIRONMENTS, ILLUS_OBJECTS, ILLUS_ROLES, SCENARIO_SUBS, type CatalogItem } from "@/lib/illustration-catalog";
import { PROCEDURAL_ICON_CATALOG, PROCEDURAL_ICON_GROUPS, type ProceduralIconEntry } from "@/lib/procedural-icon-catalog";
import { hasDistinctProceduralGraphic, proceduralGraphic } from "@/lib/procedural-icon-renderer";
import { listHiddenProceduralIcons, setProceduralIconHidden } from "@/lib/procedural-icons.functions";
import { listHiddenScenarios, setScenarioHidden } from "@/lib/scenario-visibility.functions";
import { SCENARIO_CLUSTERS, scenarioNumber } from "@/lib/scenario-clusters";
import { amIAdmin, generateIllustration, listIllustrationHistory, listIllustrations, restoreIllustration, setIllustrationStatus, detectVisualContent, saveVisualDescription } from "@/lib/illustrations.functions";
import { listSupportMessages, setSupportMessageStatus, deleteSupportMessage } from "@/lib/support.functions";
import { myStaffRole, adminFindUser, adminAdjustCredits, adminListTeam, adminSetRole, type StaffRole } from "@/lib/admin.functions";

export const Route = createFileRoute("/admin")({
  head: () => ({
    meta: [
      { title: "Administration Clario" },
      { name: "description", content: "Espace réservé à l'équipe Clario : tickets, utilisateurs, crédits et archives graphiques." },
      { property: "og:title", content: "Administration Clario" },
      { property: "og:description", content: "Espace administrateur Clario." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: AdminHome,
});

const STAFF_TABS = [
  { id: "tickets", label: "Tickets & Support", icon: Ticket, roles: ["admin", "support"] },
  { id: "users", label: "Utilisateurs & Crédits", icon: Users, roles: ["admin"] },
  { id: "team", label: "Équipe & Rôles", icon: UserCog, roles: ["admin"] },
  { id: "archive", label: "Archives graphiques", icon: Archive, roles: ["admin"] },
] as const;
type StaffTab = (typeof STAFF_TABS)[number]["id"];

type Row = { key: string; status: string; svg: string | null; custom_prompt: string | null; visual_description?: string | null };
const TABS = [
  { id: "scenario", label: "Scénarios complets" },
  { id: "character", label: "Personnages" },
  { id: "environment", label: "Lieux" },
  { id: "object", label: "Objets" },
  { id: "icons", label: "Icônes (gratuites)" },
  { id: "support", label: "Messages & Support" },
] as const;
const SUBS: Record<string, readonly string[]> = { scenario: SCENARIO_SUBS, character: ILLUS_ROLES, environment: ILLUS_ENVIRONMENTS, object: ILLUS_OBJECTS, icons: [] };

function IconGallery({ filter }: { filter: string }) {
  const q = filter.trim().toLowerCase();
  const listHidden = useServerFn(listHiddenProceduralIcons);
  const setHiddenRemote = useServerFn(setProceduralIconHidden);
  const [hidden, setHidden] = useState<Set<string>>(new Set());
  const [showHidden, setShowHidden] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const verifiedCatalog = useMemo(() => PROCEDURAL_ICON_CATALOG.filter(hasDistinctProceduralGraphic), []);

  useEffect(() => {
    listHidden().then((keys) => setHidden(new Set(keys))).catch(() => setError("Impossible de charger les icônes masquées."));
  }, []);

  async function changeVisibility(key: string, shouldHide: boolean) {
    setBusy(key); setError(null);
    try {
      await setHiddenRemote({ data: { key, hidden: shouldHide } });
      setHidden((current) => {
        const next = new Set(current);
        if (shouldHide) next.add(key); else next.delete(key);
        return next;
      });
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Impossible de modifier cette icône.");
    } finally { setBusy(null); }
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-muted-foreground">{verifiedCatalog.length} dessins distincts disponibles · {PROCEDURAL_ICON_CATALOG.length - verifiedCatalog.length} restent à dessiner · {hidden.size} masqués · 0 $.</p>
        <Button type="button" variant={showHidden ? "secondary" : "outline"} size="sm" onClick={() => setShowHidden((value) => !value)}>
          {showHidden ? <Eye className="size-4" /> : <EyeOff className="size-4" />}
          {showHidden ? "Voir les icônes actives" : `Masquées (${hidden.size})`}
        </Button>
      </div>
      {error && <p className="rounded-lg bg-destructive/10 p-3 text-sm text-destructive">{error}</p>}
      {PROCEDURAL_ICON_GROUPS.map((g) => {
        const groupItems = verifiedCatalog.filter((item) => item.group === g.id);
        const list = groupItems.filter((item) => {
          const matches = !q || `${item.label} ${item.keywords}`.toLowerCase().includes(q);
          return matches && (showHidden ? hidden.has(item.key) : !hidden.has(item.key));
        });
        if (!list.length) return null;
        return (
          <section key={g.id} className="space-y-2">
            <h2 className="font-semibold">{g.label} <span className="text-xs text-muted-foreground">{groupItems.length - groupItems.filter((item) => hidden.has(item.key)).length}/{groupItems.length}</span></h2>
            <div className="grid grid-cols-3 gap-2 sm:grid-cols-6 lg:grid-cols-8">
              {list.map((item) => (
                <div key={item.key} className="flex min-h-36 flex-col items-center justify-between gap-2 rounded-lg border bg-whiteboard-paper p-3">
                  <BoardIconPreview item={item} />
                  <span className="text-center text-[11px] font-medium text-whiteboard-ink">{item.label}</span>
                  <Button type="button" variant="ghost" size="sm" disabled={busy === item.key} onClick={() => changeVisibility(item.key, !showHidden)} className="h-7 text-[11px]">
                    {showHidden ? <Eye className="size-3.5" /> : <EyeOff className="size-3.5" />}
                    {showHidden ? "Restaurer" : "Masquer"}
                  </Button>
                </div>
              ))}
            </div>
          </section>
        );
      })}
    </div>
  );
}

const PREVIEW_WASH = {
  y: "fill-school-yellow",
  g: "fill-school-green",
  p: "fill-school-purple",
  w: "fill-white",
} as const;

function BoardIconPreview({ item }: { item: ProceduralIconEntry }) {
  const { paths, washes, viewBox } = proceduralGraphic(item);
  return (
    <svg viewBox={viewBox ?? "0 0 100 100"} role="img" aria-label={`Aperçu ${item.label}`} className="size-14 overflow-visible text-whiteboard-ink" fill="none" strokeLinecap="round" strokeLinejoin="round">
      {!viewBox && <circle cx="58" cy="56" r="34" className="fill-school-yellow-soft" />}
      {washes.map((wash, index) => (
        <path key={`wash-${index}`} d={wash.d} className={PREVIEW_WASH[wash.tone]} stroke="none" />
      ))}
      {paths.map((path, index) => (
        <g key={`path-${index}`}>
          <path d={path} pathLength={1} className="stroke-current" strokeWidth={viewBox ? 1.8 : 3.6} />
          <path d={path} pathLength={1} transform={viewBox ? "translate(0.2 0.15)" : "translate(1.1 0.8) rotate(0.8 50 50)"} className="stroke-current opacity-25" strokeWidth={viewBox ? 0.7 : 1.4} />
        </g>
      ))}
    </svg>
  );
}
const STATUS_FR: Record<string, string> = { pending: "À valider", approved: "Approuvé", rejected: "Refusé" };
const STATUS_FILTERS = [
  { id: "all", label: "Tous" },
  { id: "pending", label: "À valider" },
  { id: "approved", label: "Approuvés" },
  { id: "rejected", label: "Refusés" },
] as const;

function AdminHome() {
  const { user, loading } = useAuth();
  const checkStaff = useServerFn(myStaffRole);
  const [staffRole, setStaffRole] = useState<StaffRole | null>(null);
  const [staffLoading, setStaffLoading] = useState(true);
  const [tab, setTab] = useState<StaffTab>("tickets");
  useEffect(() => {
    if (!user) { setStaffLoading(false); return; }
    checkStaff().then((r) => setStaffRole(r.role)).catch(() => setStaffRole(null)).finally(() => setStaffLoading(false));
  }, [user]);

  if (loading || (user && staffLoading)) return <Shell><p className="text-muted-foreground">Chargement…</p></Shell>;
  if (!user) return <Shell><p>Connecte-toi pour accéder à cet espace. <Link to="/auth" className="underline">Connexion</Link></p></Shell>;
  if (!staffRole) return <Shell><p>Cet espace est réservé à l'équipe Clario.</p></Shell>;
  const tabs = STAFF_TABS.filter((t) => (t.roles as readonly string[]).includes(staffRole));

  return (
    <Shell>
      <div className="flex flex-wrap items-center gap-2">
        {tabs.map((t) => {
          const Icon = t.icon;
          return (
            <button key={t.id} onClick={() => setTab(t.id)} className={`flex items-center gap-2 rounded-full border px-4 py-1.5 text-sm ${tab === t.id ? "bg-primary text-primary-foreground" : "bg-card"}`}>
              <Icon className="size-4" />{t.label}
            </button>
          );
        })}
      </div>
      {tab === "tickets" && <SupportInbox />}
      {tab === "users" && <UsersPanel />}
      {tab === "team" && <TeamPanel />}
      {tab === "archive" && <AdminLibrary />}
    </Shell>
  );
}

function UsersPanel() {
  const findUser = useServerFn(adminFindUser);
  const adjust = useServerFn(adminAdjustCredits);
  const [email, setEmail] = useState("");
  const [data, setData] = useState<Awaited<ReturnType<typeof findUser>> | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [dq, setDq] = useState("100");
  const [dv, setDv] = useState("0");
  const [reason, setReason] = useState("");

  const search = async () => {
    setBusy(true); setError(null); setData(null);
    try { setData(await findUser({ data: { email: email.trim() } })); }
    catch (e) { setError(e instanceof Error ? e.message : "Erreur inconnue."); }
    finally { setBusy(false); }
  };
  const applyAdjust = async () => {
    if (!data?.user) return;
    setBusy(true); setError(null);
    try {
      const next = await adjust({ data: { userId: data.user.id, questions: parseInt(dq, 10) || 0, videos: parseInt(dv, 10) || 0, reason: reason.trim() || "Ajustement manuel" } });
      toast.success(`Crédits mis à jour : ${next.questions} questions · ${next.videos} vidéos.`);
      setData({ ...data, credits: { ...data.credits!, questions: next.questions, videos: next.videos }, adjustments: [{ questions_delta: parseInt(dq, 10) || 0, videos_delta: parseInt(dv, 10) || 0, reason: reason.trim() || "Ajustement manuel", created_at: new Date().toISOString() }, ...(data.adjustments ?? [])] });
      setReason("");
    } catch (e) { setError(e instanceof Error ? e.message : "Erreur inconnue."); }
    finally { setBusy(false); }
  };

  const c = data?.credits;
  return (
    <div className="space-y-4">
      <div className="flex gap-2">
        <Input value={email} onChange={(e) => setEmail(e.target.value)} placeholder="client@exemple.com" type="email" onKeyDown={(e) => e.key === "Enter" && void search()} className="max-w-sm" />
        <Button disabled={busy || !email.trim()} onClick={() => void search()}>Rechercher</Button>
      </div>
      {error && <p className="rounded-lg bg-destructive/10 p-3 text-sm text-destructive">{error}</p>}
      {data && !data.user && <p className="text-sm text-muted-foreground">Aucun compte Clario avec cet e-mail.</p>}
      {data?.user && (
        <div className="space-y-4">
          <div className="rounded-2xl border bg-card p-4">
            <div className="flex flex-wrap items-center gap-2">
              <p className="font-medium">{data.user.name || "Étudiant"}</p>
              <span className="text-sm text-muted-foreground">{data.user.email}</span>
              <span className="ml-auto text-xs text-muted-foreground">Inscrit le {new Date(data.user.createdAt).toLocaleDateString("fr-CA")}</span>
            </div>
            <div className="mt-3 flex flex-wrap gap-2 text-sm">
              <span className="rounded-full bg-school-yellow-soft px-3 py-1 font-medium">💬 {c?.questions ?? 0} questions</span>
              <span className="rounded-full bg-school-purple-soft px-3 py-1 font-medium">🎬 {c?.videos ?? 0} vidéos</span>
              {c?.has_pass && <span className="rounded-full bg-secondary px-3 py-1">Pass</span>}
              <span className="rounded-full bg-muted px-3 py-1 text-xs text-muted-foreground">Utilisé ce mois : {c?.questions_used ?? 0} Q · {c?.videos_used ?? 0} V</span>
            </div>
          </div>
          <div className="rounded-2xl border bg-card p-4">
            <p className="text-sm font-semibold">Abonnements</p>
            {data.subscriptions.length === 0 && <p className="mt-1 text-sm text-muted-foreground">Aucun abonnement.</p>}
            {data.subscriptions.map((s, i) => (
              <div key={i} className="mt-2 flex flex-wrap items-center gap-2 text-sm">
                <span className="rounded-full bg-secondary px-2 py-0.5 text-xs">{s.environment}</span>
                <span className="font-medium">{s.price_id}</span>
                <span>{s.status}</span>
                {s.current_period_end && <span className="text-xs text-muted-foreground">jusqu'au {new Date(s.current_period_end).toLocaleDateString("fr-CA")}</span>}
              </div>
            ))}
            <p className="mt-3 text-sm font-semibold">Achats récents</p>
            {data.purchases.length === 0 && <p className="mt-1 text-sm text-muted-foreground">Aucun achat.</p>}
            {data.purchases.map((p, i) => (
              <div key={i} className="mt-1 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                <span className="font-medium text-foreground">{p.price_id}</span>
                <span>{(p.amount_cents / 100).toFixed(2)} $</span>
                <span>{p.environment}</span>
                <span className="truncate">{p.paddle_transaction_id}</span>
                <span>{new Date(p.created_at).toLocaleDateString("fr-CA")}</span>
              </div>
            ))}
            <p className="mt-3 text-xs text-muted-foreground">Remboursement d'argent : ouvre le portail de paiement avec l'identifiant client ci-dessous, onglet Transactions → Rembourser.</p>
            {data.subscriptions[0]?.paddle_customer_id && <code className="mt-1 block rounded bg-muted px-2 py-1 text-xs">{data.subscriptions[0].paddle_customer_id}</code>}
          </div>
          <div className="rounded-2xl border bg-card p-4">
            <p className="text-sm font-semibold">Ajuster les crédits</p>
            <p className="mt-1 text-xs text-muted-foreground">Négatif pour retirer (ex. rembourser des crédits après un incident).</p>
            <div className="mt-2 flex flex-wrap gap-2">
              <Input value={dq} onChange={(e) => setDq(e.target.value)} type="number" className="w-24" aria-label="Questions" />
              <Input value={dv} onChange={(e) => setDv(e.target.value)} type="number" className="w-24" aria-label="Vidéos" />
              <Input value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Raison (ex. geste commercial, remboursement)" className="min-w-52 flex-1" maxLength={300} />
              <Button disabled={busy} onClick={() => void applyAdjust()}>Appliquer</Button>
            </div>
            {data.adjustments.length > 0 && (
              <div className="mt-3 space-y-1">
                <p className="text-xs text-muted-foreground">Historique des ajustements</p>
                {data.adjustments.map((a, i) => (
                  <p key={i} className="text-xs text-muted-foreground">{new Date(a.created_at).toLocaleString("fr-CA")} · {a.questions_delta >= 0 ? `+${a.questions_delta}` : a.questions_delta} Q · {a.videos_delta >= 0 ? `+${a.videos_delta}` : a.videos_delta} V · {a.reason}</p>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function TeamPanel() {
  const listTeam = useServerFn(adminListTeam);
  const saveRole = useServerFn(adminSetRole);
  const [rows, setRows] = useState<{ userId: string; role: "admin" | "support"; email: string; me: boolean }[] | null>(null);
  const [email, setEmail] = useState("");
  const [role, setRolePick] = useState<"admin" | "support">("support");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const refresh = async () => {
    try { setRows(await listTeam()); } catch (e) { setError(e instanceof Error ? e.message : "Erreur inconnue."); }
  };
  useEffect(() => { void refresh(); }, []);
  const change = async (grant: boolean, r?: "admin" | "support", targetEmail?: string) => {
    setBusy(true); setError(null);
    try {
      await saveRole({ data: { email: targetEmail ?? email.trim(), role: r ?? role, grant } });
      toast.success(grant ? "Accès accordé." : "Accès retiré.");
      setEmail("");
      await refresh();
    } catch (e) { setError(e instanceof Error ? e.message : "Erreur inconnue."); }
    finally { setBusy(false); }
  };

  return (
    <div className="space-y-4">
      <div className="rounded-2xl border bg-card p-4">
        <p className="text-sm font-semibold">Ajouter ou modifier un accès</p>
        <p className="mt-1 text-xs text-muted-foreground">La personne doit déjà avoir un compte Clario. « Support » voit uniquement les tickets.</p>
        <div className="mt-2 flex flex-wrap gap-2">
          <Input value={email} onChange={(e) => setEmail(e.target.value)} type="email" placeholder="employe@clario.app" className="max-w-xs" />
          <div className="flex rounded-md border p-0.5">
            {(["support", "admin"] as const).map((r) => (
              <button key={r} type="button" onClick={() => setRolePick(r)} className={`rounded px-3 py-1 text-sm font-semibold ${role === r ? "bg-primary text-primary-foreground" : "text-muted-foreground"}`}>{r === "support" ? "Support" : "Admin"}</button>
            ))}
          </div>
          <Button disabled={busy || !email.trim()} onClick={() => void change(true)}>Accorder</Button>
        </div>
      </div>
      {error && <p className="rounded-lg bg-destructive/10 p-3 text-sm text-destructive">{error}</p>}
      <div className="space-y-2">
        {rows === null && <p className="text-sm text-muted-foreground">Chargement…</p>}
        {rows?.length === 0 && <p className="text-sm text-muted-foreground">Aucun membre d'équipe pour l'instant.</p>}
        {rows?.map((r) => (
          <div key={r.userId + r.role} className="flex flex-wrap items-center gap-2 rounded-xl border bg-card p-3">
            <span className="rounded-full bg-secondary px-2 py-0.5 text-xs font-semibold">{r.role === "admin" ? "Admin" : "Support"}</span>
            <span className="text-sm">{r.email}</span>
            {r.me && <span className="text-xs text-muted-foreground">(toi)</span>}
            {!r.me && (
              <button disabled={busy} onClick={() => void change(false, r.role, r.email)} className="ml-auto rounded-full border px-3 py-1 text-xs disabled:opacity-50">
                Retirer
              </button>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

function AdminLibrary() {
  const { user, loading } = useAuth();
  const checkAdmin = useServerFn(amIAdmin);
  const list = useServerFn(listIllustrations);
  const gen = useServerFn(generateIllustration);
  const setStatus = useServerFn(setIllustrationStatus);
  const listHist = useServerFn(listIllustrationHistory);
  const restore = useServerFn(restoreIllustration);
  const [admin, setAdmin] = useState<boolean | null>(null);
  const [rows, setRows] = useState<Record<string, Row>>({});
  const [tab, setTab] = useState<(typeof TABS)[number]["id"]>("scenario");
  const [sub, setSub] = useState<string>("all");
  const [statusFilter, setStatusFilter] = useState<(typeof STATUS_FILTERS)[number]["id"]>("all");
  const [busy, setBusy] = useState<Record<string, boolean>>({});
  const [flipped, setFlipped] = useState<Record<string, boolean>>({});
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState("");
  const [histOpen, setHistOpen] = useState<string | null>(null);
  const [history, setHistory] = useState<Record<string, { id: string; svg: string; status: string; created_at: string }[]>>({});
  const [instr, setInstr] = useState<Record<string, string>>({});
  const [hiddenScenarios, setHiddenScenarios] = useState<Set<string>>(new Set());
  const listHiddenScen = useServerFn(listHiddenScenarios);
  const setScenHidden = useServerFn(setScenarioHidden);
  const detect = useServerFn(detectVisualContent);
  const saveDesc = useServerFn(saveVisualDescription);
  const [desc, setDesc] = useState<Record<string, string>>({});
  const [descBusy, setDescBusy] = useState<Record<string, boolean>>({});
  async function svgToPng(svg: string) {
    const img = new Image();
    img.src = `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`;
    await img.decode();
    const c = document.createElement("canvas"); c.width = 512; c.height = 512;
    const ctx = c.getContext("2d")!; ctx.fillStyle = "#ffffff"; ctx.fillRect(0, 0, 512, 512);
    ctx.drawImage(img, 0, 0, 512, 512);
    return c.toDataURL("image/png");
  }
  async function autoDetect(key: string) {
    const svg = rows[key]?.svg; if (!svg) return;
    setDescBusy((b) => ({ ...b, [key]: true })); setError(null);
    try {
      const r = await detect({ data: { key, image: await svgToPng(svg) } });
      setDesc((s) => ({ ...s, [key]: r.description }));
      setRows((s) => ({ ...s, [key]: { ...s[key]!, visual_description: r.description } }));
    } catch (e) { setError(e instanceof Error ? e.message : "Analyse impossible."); }
    finally { setDescBusy((b) => ({ ...b, [key]: false })); }
  }
  async function saveDescription(key: string) {
    const value = desc[key]; if (value === undefined || value === (rows[key]?.visual_description ?? "")) return;
    try {
      await saveDesc({ data: { key, description: value } });
      setRows((s) => ({ ...s, [key]: { ...s[key]!, visual_description: value.trim() || null } }));
    } catch (e) { setError(e instanceof Error ? e.message : "Enregistrement impossible."); }
  }


  useEffect(() => {
    if (!user) return;
    checkAdmin().then(async (r) => {
      setAdmin(r.admin);
      if (r.admin) {
        const data = await list();
        setRows(Object.fromEntries(data.map((d) => [d.key, d as Row])));
        const hiddenKeys = await listHiddenScen().catch(() => [] as string[]);
        setHiddenScenarios(new Set(hiddenKeys));
      }
    }).catch(() => setAdmin(false));
  }, [user]);

  const items = useMemo(() => catalog().filter((c) => {
    if (c.category !== tab) return false;
    if (hiddenScenarios.has(c.key)) return false;
    if (sub !== "all" && c.key.split(":")[1] !== sub) return false;
    if (!c.label.toLowerCase().includes(filter.toLowerCase())) return false;
    if (statusFilter !== "all") {
      const st = rows[c.key]?.status;
      if (statusFilter === "pending" ? st !== "pending" : st !== statusFilter) return false;
    }
    return true;
  }), [tab, sub, filter, statusFilter, rows, hiddenScenarios]);
  const all = catalog();
  const counts = { drawn: Object.values(rows).filter((r) => r.svg).length, approved: Object.values(rows).filter((r) => r.status === "approved").length };

  async function draw(item: CatalogItem) {
    setBusy((b) => ({ ...b, [item.key]: true })); setError(null);
    try {
      const r = await gen({ data: { key: item.key, instruction: (instr[item.key] ?? "").trim() || undefined } });
      setRows((s) => ({ ...s, [r.key]: { key: r.key, svg: r.svg, status: r.status, custom_prompt: (instr[item.key] ?? "").trim() || null } }));
    } catch (e) { setError(e instanceof Error ? e.message : "Erreur inconnue."); }
    finally { setBusy((b) => ({ ...b, [item.key]: false })); }
  }
  async function mark(key: string, status: "approved" | "rejected") {
    await setStatus({ data: { key, status } });
    setRows((s) => ({ ...s, [key]: { ...s[key]!, status } }));
  }
  async function removeScenario(key: string, hidden: boolean) {
    setError(null);
    try {
      await setScenHidden({ data: { key, hidden } });
      setHiddenScenarios((current) => {
        const next = new Set(current);
        if (hidden) next.add(key); else next.delete(key);
        return next;
      });
    } catch (e) { setError(e instanceof Error ? e.message : "Impossible de retirer ce scénario."); }
  }

  const renderCard = (item: CatalogItem, badge?: string) => {
    const row = rows[item.key];
    const isRemoved = hiddenScenarios.has(item.key);
    return (
      <div key={item.key} className={`flex flex-col overflow-hidden rounded-2xl border bg-card ${isRemoved ? "opacity-60" : ""}`}>
        <div className="flex aspect-square items-center justify-center bg-background p-2">
          {busy[item.key] ? <span className="text-xs text-muted-foreground">Dessin en cours…</span>
            : row?.svg ? <img alt={item.label} className={`h-full w-full object-contain transition-transform duration-300 ${flipped[item.key] ? "-scale-x-100" : ""}`} src={`data:image/svg+xml;utf8,${encodeURIComponent(row.svg)}`} />
            : <span className="text-xs text-muted-foreground">Pas encore dessiné</span>}
        </div>
        <div className="space-y-2 p-3">
          <p className="text-sm font-medium leading-tight">{item.label}</p>
          {item.description && <p className="text-xs text-muted-foreground">{item.description}</p>}
          {badge && <span className="inline-block rounded-full bg-school-green-soft px-2 py-0.5 text-xs font-medium text-whiteboard-ink">{badge}</span>}
          {isRemoved && <span className="inline-block rounded-full bg-destructive/10 px-2 py-0.5 text-xs text-destructive">Retiré</span>}
          {row?.svg && <span className={`inline-block rounded-full px-2 py-0.5 text-xs ${row.status === "approved" ? "bg-accent text-accent-foreground" : row.status === "rejected" ? "bg-destructive/10 text-destructive" : "bg-secondary text-secondary-foreground"}`}>{STATUS_FR[row.status]}</span>}
          {row?.svg && (
            <div className="space-y-1 rounded-lg border bg-muted/40 p-2">
              <div className="flex items-center justify-between gap-2">
                <span className="text-xs font-medium">Contenu réel</span>
                <button disabled={descBusy[item.key]} onClick={() => autoDetect(item.key)} className="rounded-full border bg-background px-2 py-0.5 text-xs disabled:opacity-50">{descBusy[item.key] ? "Analyse…" : "Auto-détecter"}</button>
              </div>
              <textarea
                value={desc[item.key] ?? row.visual_description ?? ""}
                onChange={(e) => setDesc((s) => ({ ...s, [item.key]: e.target.value }))}
                onBlur={() => saveDescription(item.key)}
                placeholder="Ce qu'on voit vraiment (ex. « 1 étudiante, salle de classe, pupitre »)"
                rows={2}
                maxLength={300}
                className="w-full resize-y rounded-md border bg-background px-2 py-1 text-xs"
              />
            </div>
          )}
          <textarea
            value={instr[item.key] ?? row?.custom_prompt ?? ""}
            onChange={(e) => setInstr((s) => ({ ...s, [item.key]: e.target.value }))}
            placeholder="Décrivez vos ajustements… (ex. « assise, de trois-quarts »)"
            rows={4}
            maxLength={2000}
            className="w-full resize-y rounded-lg border bg-background px-2 py-1.5 text-xs leading-relaxed"
          />
          <div className="flex flex-wrap gap-1">
            <button disabled={busy[item.key]} onClick={() => draw(item)} className="rounded-full bg-primary px-3 py-1 text-xs text-primary-foreground disabled:opacity-50">{row?.svg ? "Refaire" : "Dessiner"}</button>
            {item.category === "scenario" && (
              <button onClick={() => removeScenario(item.key, !isRemoved)} className="rounded-full border px-3 py-1 text-xs">{isRemoved ? "Restaurer" : "Retirer"}</button>
            )}
            {row?.svg && <>
              <button onClick={() => setFlipped((f) => ({ ...f, [item.key]: !f[item.key] }))} className="rounded-full border px-3 py-1 text-xs">Miroir</button>
              <button onClick={() => mark(item.key, "approved")} className="rounded-full border px-3 py-1 text-xs">Approuver</button>
              <button onClick={() => mark(item.key, "rejected")} className="rounded-full border px-3 py-1 text-xs">Refuser</button>
              <button onClick={() => toggleHistory(item.key)} className={`rounded-full border px-3 py-1 text-xs ${histOpen === item.key ? "bg-secondary text-secondary-foreground" : ""}`}>Historique</button>
            </>}
          </div>
          {histOpen === item.key && (
            <div className="space-y-2 border-t pt-2">
              <p className="text-xs text-muted-foreground">Versions précédentes</p>
              {!history[item.key] && <p className="text-xs text-muted-foreground">Chargement…</p>}
              {history[item.key]?.length === 0 && <p className="text-xs text-muted-foreground">Aucune version précédente pour l'instant — chaque « Refaire » gardera l'ancien dessin ici.</p>}
              {history[item.key]?.map((h) => (
                <div key={h.id} className="flex items-center gap-2">
                  <img alt={item.label} className={`h-12 w-12 shrink-0 rounded border bg-background object-contain ${flipped[item.key] ? "-scale-x-100" : ""}`} src={`data:image/svg+xml;utf8,${encodeURIComponent(h.svg)}`} />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-xs text-muted-foreground">{new Date(h.created_at).toLocaleString("fr-CA")}</p>
                    <span className={`inline-block rounded-full px-2 py-0.5 text-xs ${h.status === "approved" ? "bg-accent text-accent-foreground" : h.status === "rejected" ? "bg-destructive/10 text-destructive" : "bg-secondary text-secondary-foreground"}`}>{STATUS_FR[h.status]}</span>
                  </div>
                  <button disabled={busy[item.key]} onClick={() => restoreVersion(item.key, h.id)} className="rounded-full bg-primary px-3 py-1 text-xs text-primary-foreground disabled:opacity-50">Restaurer</button>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    );
  };
  async function toggleHistory(key: string) {
    if (histOpen === key) { setHistOpen(null); return; }
    setHistOpen(key);
    const h = await listHist({ data: { key } });
    setHistory((s) => ({ ...s, [key]: h }));
  }
  async function restoreVersion(key: string, id: string) {
    setBusy((b) => ({ ...b, [key]: true })); setError(null);
    try {
      const r = await restore({ data: { key, id } });
      setRows((s) => ({ ...s, [r.key]: { key: r.key, svg: r.svg, status: r.status, custom_prompt: s[r.key]?.custom_prompt ?? null } }));
      const h = await listHist({ data: { key } });
      setHistory((s) => ({ ...s, [key]: h }));
    } catch (e) { setError(e instanceof Error ? e.message : "Erreur inconnue."); }
    finally { setBusy((b) => ({ ...b, [key]: false })); }
  }

  if (loading || (user && admin === null)) return <Shell><p className="text-muted-foreground">Chargement…</p></Shell>;
  if (!user) return <Shell><p>Connecte-toi pour accéder à cet espace. <Link to="/auth" className="underline">Connexion</Link></p></Shell>;
  if (!admin) return <Shell><p>Cet espace est réservé à l'administratrice.</p></Shell>;

  return (
    <>
      <p className="text-sm text-muted-foreground">
        {all.length} illustrations prévues · {counts.drawn} dessinées · {counts.approved} approuvées. Chaque dessin coûte environ 0,08 $ sur Recraft, une seule fois.
      </p>
      <div className="flex flex-wrap items-center gap-2">
        {TABS.map((t) => (
          <button key={t.id} onClick={() => { setTab(t.id); setSub("all"); }} className={`rounded-full border px-4 py-1.5 text-sm ${tab === t.id ? "bg-primary text-primary-foreground" : "bg-card"}`}>{t.label}</button>
        ))}
        <input value={filter} onChange={(e) => setFilter(e.target.value)} placeholder="Rechercher…" className={`ml-auto rounded-full border bg-card px-4 py-1.5 text-sm ${tab === "support" ? "hidden" : ""}`} />
      </div>
      {tab === "support" ? <SupportInbox /> : tab === "icons" ? <IconGallery filter={filter} /> : (<>
      <div className="flex flex-wrap items-center gap-2">
        <button onClick={() => setSub("all")} className={`rounded-full border px-3 py-1 text-xs ${sub === "all" ? "bg-accent text-accent-foreground" : "bg-card"}`}>Tous</button>
        {tab === "scenario" && (
          <button onClick={() => setSub("__dups")} className={`rounded-full border px-3 py-1 text-xs ${sub === "__dups" ? "bg-accent text-accent-foreground" : "bg-card"}`}>Doublons similaires</button>
        )}
        {SUBS[tab]!.map((s) => {
          const inSub = all.filter((c) => c.category === tab && c.key.split(":")[1] === s);
          const drawn = inSub.filter((c) => rows[c.key]?.svg).length;
          return (
            <button key={s} onClick={() => setSub(s)} className={`rounded-full border px-3 py-1 text-xs ${sub === s ? "bg-accent text-accent-foreground" : "bg-card"}`}>{FR[s]} <span className="opacity-60">{drawn}/{inSub.length}</span></button>
          );
        })}
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-xs text-muted-foreground">Statut :</span>
        {STATUS_FILTERS.map((s) => (
          <button key={s.id} onClick={() => setStatusFilter(s.id)} className={`rounded-full border px-3 py-1 text-xs ${statusFilter === s.id ? "bg-secondary text-secondary-foreground" : "bg-card"}`}>{s.label}</button>
        ))}
      </div>
      {error && <p className="rounded-lg bg-destructive/10 p-3 text-sm text-destructive">{error}</p>}
      {sub === "__dups" && tab === "scenario" ? (
        SCENARIO_CLUSTERS.map((cluster) => {
          const keepers = new Set(cluster.keepers);
          const cards = cluster.members
            .map((n) => all.find((c) => c.category === "scenario" && scenarioNumber(c.key) === n))
            .filter((c): c is CatalogItem => Boolean(c));
          if (!cards.length) return null;
          return (
            <section key={cluster.id} className="space-y-2">
              <h2 className="font-semibold">
                {cluster.label} <span className="text-xs font-normal text-muted-foreground">{cards.length} scénarios similaires{keepers.size ? ` · garder ${cluster.keepers.join(", ")}` : " · tout est déjà gratuit"}</span>
              </h2>
              {cluster.note && <p className="text-xs text-muted-foreground">{cluster.note}</p>}
              <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-5">
                {cards.map((item) => renderCard(item, keepers.has(scenarioNumber(item.key)!) ? "À garder" : undefined))}
              </div>
            </section>
          );
        })
      ) : (
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-5">
        {items.map((item) => renderCard(item))}
      </div>
      )}
      </>)}
    </>
  );
}

type SupportRow = { id: string; user_email: string; user_name: string; document_name: string; question: string; context: string; status: string; created_at: string };

function SupportInbox() {
  const list = useServerFn(listSupportMessages);
  const mark = useServerFn(setSupportMessageStatus);
  const remove = useServerFn(deleteSupportMessage);
  const [rows, setRows] = useState<SupportRow[] | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    list().then((r) => setRows(r as SupportRow[])).catch((e) => setError(e instanceof Error ? e.message : "Impossible de charger les messages."));
  }, []);

  async function changeStatus(id: string, status: "nouveau" | "traite") {
    setBusyId(id); setError(null);
    try {
      await mark({ data: { id, status } });
      setRows((s) => (s ?? []).map((r) => (r.id === id ? { ...r, status } : r)));
    } catch (e) { setError(e instanceof Error ? e.message : "Erreur inconnue."); }
    finally { setBusyId(null); }
  }

  async function del(id: string) {
    setBusyId(id); setError(null);
    try {
      await remove({ data: { id } });
      setRows((s) => (s ?? []).filter((r) => r.id !== id));
    } catch (e) { setError(e instanceof Error ? e.message : "Erreur inconnue."); }
    finally { setBusyId(null); }
  }

  const unread = rows?.filter((r) => r.status !== "traite").length ?? 0;
  return (
    <div className="space-y-4">
      <p className="text-sm text-muted-foreground">
        {rows === null ? "Chargement…" : `${rows.length} message(s) reçu(s) · ${unread} en attente. Les questions sur l'application que les étudiants choisissent de te transmettre arrivent ici.`}
      </p>
      {error && <p className="rounded-lg bg-destructive/10 p-3 text-sm text-destructive">{error}</p>}
      {rows?.length === 0 && (
        <div className="flex flex-col items-center gap-2 rounded-2xl border border-dashed p-8 text-center">
          <Inbox className="size-8 text-muted-foreground" />
          <p className="text-sm text-muted-foreground">Aucun message pour l'instant. Quand un étudiant demande à Clario de transmettre une question sur l'appli, elle apparaît ici.</p>
        </div>
      )}
      {rows?.map((r) => (
        <div key={r.id} className={`space-y-2 rounded-2xl border bg-card p-4 ${r.status === "traite" ? "opacity-60" : ""}`}>
          <div className="flex flex-wrap items-center gap-2">
            <span className={`inline-block rounded-full px-2 py-0.5 text-xs font-medium ${r.status === "traite" ? "bg-secondary text-secondary-foreground" : "bg-primary text-primary-foreground"}`}>
              {r.status === "traite" ? "Traitée" : "Nouveau"}
            </span>
            <span className="text-sm font-medium">{r.user_name || "Étudiant"}</span>
            {r.user_email && <a href={`mailto:${r.user_email}`} className="text-xs underline">{r.user_email}</a>}
            <span className="ml-auto text-xs text-muted-foreground">{new Date(r.created_at).toLocaleString("fr-CA")}</span>
          </div>
          <p className="whitespace-pre-wrap text-sm">{r.question}</p>
          {r.document_name && <p className="text-xs text-muted-foreground">Document : « {r.document_name} »</p>}
          {r.context && <details className="text-xs text-muted-foreground"><summary className="cursor-pointer">Contexte de la conversation</summary><p className="mt-1 whitespace-pre-wrap">{r.context}</p></details>}
          <div className="flex flex-wrap gap-1">
            {r.status === "traite"
              ? <button disabled={busyId === r.id} onClick={() => changeStatus(r.id, "nouveau")} className="rounded-full border px-3 py-1 text-xs disabled:opacity-50">Réouvrir</button>
              : <button disabled={busyId === r.id} onClick={() => changeStatus(r.id, "traite")} className="rounded-full bg-primary px-3 py-1 text-xs text-primary-foreground disabled:opacity-50">Marquer traitée</button>}
            <button disabled={busyId === r.id} onClick={() => del(r.id)} className="rounded-full border px-3 py-1 text-xs disabled:opacity-50">Supprimer</button>
          </div>
        </div>
      ))}
    </div>
  );
}

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <main className="mx-auto max-w-6xl space-y-5 p-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Administration Clario</h1>
        <Link to="/" className="text-sm underline">Retour à Clario</Link>
      </div>
      {children}
    </main>
  );
}
