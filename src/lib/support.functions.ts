import { createServerFn } from "@tanstack/react-start";
import type { SupabaseClient } from "@supabase/supabase-js";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import type { Database } from "@/integrations/supabase/types";

// Tickets : accessibles à l'administratrice et aux employés « support ».
async function staffClient(supabase: SupabaseClient<Database>, userId: string) {
  const [{ data: a, error }, { data: s }] = await Promise.all([
    supabase.rpc("has_role", { _user_id: userId, _role: "admin" }),
    supabase.rpc("has_role", { _user_id: userId, _role: "support" }),
  ]);
  if (error) throw new Error("Vérification du rôle impossible.");
  if (!a && !s) throw new Error("Cet espace est réservé à l'équipe Clario.");
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  return supabaseAdmin;
}

export const listSupportMessages = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const db = await staffClient(context.supabase, context.userId);
    const { data, error } = await db
      .from("support_messages")
      .select("id, user_email, user_name, document_name, question, context, status, created_at, handled_at")
      .order("created_at", { ascending: false })
      .limit(200);
    if (error) throw new Error(error.message);
    return data;
  });

export const setSupportMessageStatus = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { id: string; status: "nouveau" | "traite" }) => input)
  .handler(async ({ data, context }) => {
    const db = await staffClient(context.supabase, context.userId);
    const { error } = await db
      .from("support_messages")
      .update({ status: data.status, handled_at: data.status === "traite" ? new Date().toISOString() : null })
      .eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const deleteSupportMessage = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { id: string }) => input)
  .handler(async ({ data, context }) => {
    const db = await staffClient(context.supabase, context.userId);
    const { error } = await db.from("support_messages").delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });
