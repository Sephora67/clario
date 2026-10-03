// Outils d'administration Clario : rôles d'équipe, utilisateurs, crédits.
// Chaque fonction vérifie le rôle de l'appelant AVANT de charger le client privilégié.
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

type Ctx = { supabase: any; userId: string };
export type StaffRole = "admin" | "support" | null;

async function roleOf(ctx: Ctx): Promise<StaffRole> {
  const [{ data: a }, { data: s }] = await Promise.all([
    ctx.supabase.rpc("has_role", { _user_id: ctx.userId, _role: "admin" }),
    ctx.supabase.rpc("has_role", { _user_id: ctx.userId, _role: "support" }),
  ]);
  return a ? "admin" : s ? "support" : null;
}
async function requireAdmin(ctx: Ctx) {
  if ((await roleOf(ctx)) !== "admin") throw new Error("Réservé à l'administratrice.");
}
async function findUserByEmail(admin: any, email: string) {
  const target = email.trim().toLowerCase();
  for (let page = 1; page <= 20; page++) {
    const { data, error } = await admin.auth.admin.listUsers({ page, perPage: 200 });
    if (error) throw new Error("Recherche impossible.");
    const hit = data.users.find((u: any) => (u.email ?? "").toLowerCase() === target);
    if (hit) return hit as { id: string; email: string; created_at: string; last_sign_in_at?: string };
    if (data.users.length < 200) break;
  }
  return null;
}

export const myStaffRole = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => ({ role: await roleOf(context) }));

export const adminFindUser = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ email: z.string().email().max(200) }).parse(d))
  .handler(async ({ data, context }) => {
    await requireAdmin(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const u = await findUserByEmail(supabaseAdmin, data.email);
    if (!u) return { user: null };
    const [credits, subs, purchases, adjustments, profile] = await Promise.all([
      supabaseAdmin.from("user_credits").select("questions,videos,has_pass,questions_used,videos_used").eq("user_id", u.id).maybeSingle(),
      supabaseAdmin.from("subscriptions").select("price_id,status,current_period_end,environment,paddle_customer_id").eq("user_id", u.id).order("created_at", { ascending: false }),
      supabaseAdmin.from("purchases").select("price_id,amount_cents,environment,paddle_transaction_id,created_at").eq("user_id", u.id).order("created_at", { ascending: false }).limit(30),
      supabaseAdmin.from("admin_credit_adjustments").select("questions_delta,videos_delta,reason,created_at").eq("user_id", u.id).order("created_at", { ascending: false }).limit(30),
      supabaseAdmin.from("profiles").select("display_name").eq("id", u.id).maybeSingle(),
    ]);
    return {
      user: { id: u.id, email: u.email, name: profile.data?.display_name ?? "", createdAt: u.created_at, lastSignIn: u.last_sign_in_at ?? null },
      credits: credits.data, subscriptions: subs.data ?? [], purchases: purchases.data ?? [], adjustments: adjustments.data ?? [],
    };
  });

export const adminAdjustCredits = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({
    userId: z.string().uuid(), questions: z.number().int().min(-10000).max(10000), videos: z.number().int().min(-1000).max(1000), reason: z.string().trim().min(2).max(300),
  }).parse(d))
  .handler(async ({ data, context }) => {
    await requireAdmin(context);
    if (!data.questions && !data.videos) throw new Error("Aucun changement.");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    await supabaseAdmin.from("user_credits").upsert({ user_id: data.userId }, { onConflict: "user_id", ignoreDuplicates: true });
    const { data: cur, error } = await supabaseAdmin.from("user_credits").select("questions,videos").eq("user_id", data.userId).single();
    if (error || !cur) throw new Error("Compte introuvable.");
    const next = { questions: Math.max(0, cur.questions + data.questions), videos: Math.max(0, cur.videos + data.videos) };
    const { error: e2 } = await supabaseAdmin.from("user_credits").update({ ...next, updated_at: new Date().toISOString() }).eq("user_id", data.userId);
    if (e2) throw new Error("Mise à jour impossible.");
    await supabaseAdmin.from("admin_credit_adjustments").insert({ user_id: data.userId, admin_id: context.userId, questions_delta: data.questions, videos_delta: data.videos, reason: data.reason });
    return next;
  });

export const adminListTeam = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await requireAdmin(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data } = await supabaseAdmin.from("user_roles").select("user_id,role").in("role", ["admin", "support"]);
    const rows = await Promise.all((data ?? []).map(async (r) => {
      const { data: u } = await supabaseAdmin.auth.admin.getUserById(r.user_id);
      return { userId: r.user_id, role: r.role as "admin" | "support", email: u.user?.email ?? "—", me: r.user_id === context.userId };
    }));
    return rows;
  });

export const adminSetRole = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ email: z.string().email().max(200), role: z.enum(["admin", "support"]), grant: z.boolean() }).parse(d))
  .handler(async ({ data, context }) => {
    await requireAdmin(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const u = await findUserByEmail(supabaseAdmin, data.email);
    if (!u) throw new Error("Aucun compte Clario avec cet e-mail. La personne doit d'abord créer son compte.");
    if (!data.grant && u.id === context.userId && data.role === "admin") throw new Error("Tu ne peux pas retirer ton propre accès administrateur.");
    if (data.grant) {
      const { error } = await supabaseAdmin.from("user_roles").upsert({ user_id: u.id, role: data.role }, { onConflict: "user_id,role", ignoreDuplicates: true });
      if (error) throw new Error("Attribution impossible.");
    } else {
      await supabaseAdmin.from("user_roles").delete().eq("user_id", u.id).eq("role", data.role);
    }
    return { ok: true };
  });

/** Supprime définitivement le compte de l'appelant et tout son contenu. */
export const deleteMyAccount = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const uid = context.userId;
    const { data: club } = await context.supabase.rpc("has_active_club", { _uid: uid });
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    if (club) {
      const { data: active } = await supabaseAdmin.from("subscriptions").select("cancel_at_period_end,status").eq("user_id", uid).in("status", ["active", "trialing", "past_due"]);
      if ((active ?? []).some((s) => !s.cancel_at_period_end)) return { ok: false as const, reason: "ACTIVE_SUB" as const };
    }
    // Fichiers privés
    const paths: string[] = [];
    async function walk(prefix: string) {
      const { data } = await supabaseAdmin.storage.from("clario-files").list(prefix, { limit: 1000 });
      for (const f of data ?? []) {
        const p = `${prefix}/${f.name}`;
        if (f.id) paths.push(p); else await walk(p);
      }
    }
    await walk(uid);
    for (let i = 0; i < paths.length; i += 100) await supabaseAdmin.storage.from("clario-files").remove(paths.slice(i, i + 100));
    // Données (ordre respectant les liens)
    const { data: quizzes } = await supabaseAdmin.from("page_quizzes").select("id").eq("user_id", uid);
    const qids = (quizzes ?? []).map((q) => q.id);
    if (qids.length) await supabaseAdmin.from("page_quiz_keys").delete().in("quiz_id", qids);
    for (const t of ["page_quizzes", "doc_chats", "media", "animations", "notifications"] as const) await supabaseAdmin.from(t).delete().eq("user_id", uid);
    await supabaseAdmin.from("calendar_events").delete().eq("user_id", uid);
    await supabaseAdmin.from("documents").delete().eq("user_id", uid);
    await supabaseAdmin.from("folders").update({ parent_id: null }).eq("user_id", uid);
    for (const t of ["folders", "courses", "lessons", "support_messages", "user_credits", "chat_rate_limits", "user_roles"] as const) await supabaseAdmin.from(t).delete().eq("user_id", uid);
    await supabaseAdmin.from("profiles").delete().eq("id", uid);
    // Les achats restent comme registres de facturation (exigence légale).
    const { error } = await supabaseAdmin.auth.admin.deleteUser(uid);
    if (error) throw new Error("Suppression du compte impossible. Réessaie ou contacte le support.");
    return { ok: true as const };
  });
