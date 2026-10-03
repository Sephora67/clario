import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const Env = z.enum(["sandbox", "live"]);

export const resolvePaddlePrice = createServerFn({ method: "GET" })
  .inputValidator((d: unknown) => z.object({ priceId: z.string().regex(/^[a-z0-9_]{1,60}$/), environment: Env }).parse(d))
  .handler(async ({ data }) => {
    const { gatewayFetch } = await import("./paddle.server");
    const res = await gatewayFetch(data.environment, `/prices?external_id=${encodeURIComponent(data.priceId)}`);
    const json = (await res.json()) as { data?: { id: string }[] };
    if (!json.data?.length) throw new Error("Price not found");
    return json.data[0]!.id;
  });

async function currentSub(supabase: any, userId: string, env: string) {
  const { data } = await supabase.from("subscriptions").select("*").eq("user_id", userId).eq("environment", env)
    .in("status", ["active", "trialing", "past_due"]).order("created_at", { ascending: false }).limit(1).maybeSingle();
  return data as { paddle_subscription_id: string; paddle_customer_id: string; price_id: string } | null;
}

/** Passe du Club mensuel à l'annuel (ou l'inverse), immédiatement et au prorata. */
export const changeClubPlan = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ target: z.enum(["pro_club_monthly", "pro_club_yearly"]), environment: Env }).parse(d))
  .handler(async ({ data, context }) => {
    const sub = await currentSub(context.supabase, context.userId, data.environment);
    if (!sub) throw new Error("NO_SUB");
    if (sub.price_id === data.target) return { ok: true };
    const { getPaddleClient, gatewayFetch } = await import("./paddle.server");
    const res = await gatewayFetch(data.environment, `/prices?external_id=${data.target}`);
    const priceId = ((await res.json()) as { data?: { id: string }[] }).data?.[0]?.id;
    if (!priceId) throw new Error("Price not found");
    await getPaddleClient(data.environment).subscriptions.update(sub.paddle_subscription_id, {
      items: [{ priceId, quantity: 1 }],
      prorationBillingMode: "prorated_immediately",
    });
    return { ok: true };
  });

/** Lien temporaire vers l'espace client (annuler, carte, factures). */
export const getBillingPortal = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ environment: Env }).parse(d))
  .handler(async ({ data, context }) => {
    const { data: row } = await context.supabase.from("subscriptions").select("paddle_subscription_id,paddle_customer_id")
      .eq("user_id", context.userId).eq("environment", data.environment).order("created_at", { ascending: false }).limit(1).maybeSingle();
    if (!row) throw new Error("NO_SUB");
    const { getPaddleClient } = await import("./paddle.server");
    const s = await getPaddleClient(data.environment).customerPortalSessions.create(row.paddle_customer_id, [row.paddle_subscription_id]);
    return { url: s.urls.general.overview };
  });
