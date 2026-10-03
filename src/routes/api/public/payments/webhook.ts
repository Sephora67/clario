import { createFileRoute } from "@tanstack/react-router";
import { verifyWebhook, EventName, type PaddleEnv } from "@/lib/paddle.server";

// Chaque événement est vérifié par signature avant toute écriture.
async function admin() {
  return (await import("@/integrations/supabase/client.server")).supabaseAdmin;
}

const isUuid = (v: unknown): v is string => typeof v === "string" && /^[0-9a-f-]{36}$/i.test(v);

async function upsertSubscription(data: any, env: PaddleEnv) {
  const userId = data.customData?.userId;
  const item = data.items?.[0];
  const priceId = item?.price?.importMeta?.externalId;
  const productId = item?.product?.importMeta?.externalId ?? "pro_club";
  if (!isUuid(userId) || !priceId) { console.warn("subscription skipped: missing user or externalId"); return; }
  const db = await admin();
  const { error } = await db.from("subscriptions").upsert({
    user_id: userId,
    paddle_subscription_id: data.id,
    paddle_customer_id: data.customerId,
    product_id: productId,
    price_id: priceId,
    status: data.status,
    current_period_start: data.currentBillingPeriod?.startsAt ?? null,
    current_period_end: data.currentBillingPeriod?.endsAt ?? null,
    cancel_at_period_end: data.scheduledChange?.action === "cancel",
    environment: env,
    updated_at: new Date().toISOString(),
  }, { onConflict: "paddle_subscription_id" });
  if (error) throw new Error(error.message);
}

async function resolveExternalPrice(item: any, env: PaddleEnv): Promise<string | undefined> {
  const direct = item?.price?.importMeta?.externalId;
  if (direct) return direct;
  const pid = item?.price?.id ?? item?.priceId;
  if (!pid) return undefined;
  const { gatewayFetch } = await import("@/lib/paddle.server");
  const res = await gatewayFetch(env, `/prices/${encodeURIComponent(pid)}`);
  const json = (await res.json()) as any;
  return json?.data?.import_meta?.external_id ?? json?.data?.importMeta?.externalId;
}

async function handleTransaction(data: any, env: PaddleEnv) {
  const userId = data.customData?.userId;
  const item = data.items?.[0];
  const priceId = await resolveExternalPrice(item, env);
  if (!isUuid(userId) || !priceId) { console.warn("transaction skipped: missing user or externalId", data.id); return; }
  const amount = Number(data.details?.totals?.subtotal ?? data.details?.totals?.total ?? 0);
  const db = await admin();
  const { error } = await db.rpc("apply_purchase", {
    _uid: userId, _env: env, _txn: data.id, _price: priceId,
    _amount: Number.isFinite(amount) ? Math.round(amount) : 0,
    _is_change: data.origin === "subscription_update",
  });
  if (error) throw new Error(error.message);
}

export const Route = createFileRoute("/api/public/payments/webhook")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const env = (new URL(request.url).searchParams.get("env") === "live" ? "live" : "sandbox") as PaddleEnv;
        let event;
        try { event = await verifyWebhook(request, env); }
        catch (e) { console.error("webhook signature rejected", e); return new Response("Invalid signature", { status: 401 }); }
        try {
          switch (event.eventType) {
            case EventName.SubscriptionCreated:
            case EventName.SubscriptionUpdated:
            case EventName.SubscriptionCanceled:
              await upsertSubscription(event.data, env); break;
            case EventName.TransactionCompleted:
              await handleTransaction(event.data, env); break;
            default: break;
          }
          return Response.json({ received: true });
        } catch (e) {
          console.error("webhook processing error", e);
          return new Response("Webhook error", { status: 500 });
        }
      },
    },
  },
});
