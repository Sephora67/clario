import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

async function assertAdmin(context: { supabase: any; userId: string }) {
  const { data } = await context.supabase.rpc("has_role", { _user_id: context.userId, _role: "admin" });
  if (!data) throw new Error("Accès réservé à l’administratrice.");
}

export const listHiddenScenarios = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data, error } = await (context.supabase as any).from("scenario_visibility").select("key").eq("hidden", true);
    if (error) throw new Error("Impossible de charger les scénarios retirés.");
    return (data ?? []).map((row: { key: string }) => row.key);
  });

export const setScenarioHidden = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((value: unknown) => z.object({ key: z.string().min(1).max(160), hidden: z.boolean() }).parse(value))
  .handler(async ({ data, context }) => {
    await assertAdmin(context);
    const { error } = await (context.supabase as any).from("scenario_visibility").upsert({ key: data.key, hidden: data.hidden, updated_at: new Date().toISOString() });
    if (error) throw new Error("Impossible de modifier ce scénario.");
    return { key: data.key, hidden: data.hidden };
  });
