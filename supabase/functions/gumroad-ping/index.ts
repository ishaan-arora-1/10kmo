import { withSupabase } from "npm:@supabase/server@1.5.2";
import type { Database } from "../_shared/database.types.ts";
import {
  ACTIVE_STATUSES,
  getSale,
  getSubscriber,
  gumroadConfigured,
  gumroadSellerId,
  periodEnd,
  planForRecurrence,
} from "../_shared/gumroad.ts";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

async function readFields(request: Request): Promise<Record<string, string>> {
  const raw = await request.text();
  if ((request.headers.get("content-type") ?? "").includes("application/json")) {
    const parsed = JSON.parse(raw) as Record<string, unknown>;
    return Object.fromEntries(Object.entries(parsed).map(([key, value]) => [key, String(value ?? "")]));
  }
  return Object.fromEntries(new URLSearchParams(raw));
}

// Gumroad's Ping: sales (first payment and every renewal), refunds, disputes and membership
// changes, form-encoded. Pings aren't signed, so nothing is trusted until Gumroad's API confirms
// the sale and the membership. Only a 200 stops Gumroad retrying (hourly, for 3 hours).
export default {
  fetch: withSupabase<Database>({ auth: "none" }, async (request, context) => {
    if (request.method !== "POST") {
      return Response.json({ error: "Method not allowed" }, { status: 405 });
    }
    if (!gumroadConfigured) {
      return Response.json({ error: "Gumroad is not configured" }, { status: 503 });
    }

    let fields: Record<string, string>;
    try {
      fields = await readFields(request);
    } catch {
      return Response.json({ error: "Invalid payload" }, { status: 400 });
    }
    if (gumroadSellerId && fields.seller_id && fields.seller_id !== gumroadSellerId) {
      return Response.json({ ignored: "another seller" });
    }
    const subscriptionId = fields.subscription_id || fields.subscriber_id || "";
    const saleId = fields.sale_id || "";
    if (!subscriptionId) return Response.json({ ignored: "not a membership" });

    try {
      const [subscriber, sale] = await Promise.all([
        getSubscriber(subscriptionId),
        saleId ? getSale(saleId) : Promise.resolve(null),
      ]);
      if (!subscriber || (saleId && !sale)) {
        console.warn("gumroad ping not confirmed by the API", subscriptionId, saleId);
        return Response.json({ ignored: "not confirmed" });
      }
      const plan = planForRecurrence(subscriber.recurrence ?? fields.recurrence);
      if (!plan) return Response.json({ ignored: "not monthly or yearly" });

      const admin = context.supabaseAdmin;
      const { data: stateRows } = await admin.rpc("gumroad_subscription_state", { p_subscription_id: subscriptionId });
      const stored = Array.isArray(stateRows) ? stateRows[0] : null;

      // Who bought it: the account we already know, else the id our paywall put in the link,
      // else the account with the buyer's email.
      let userId: string | null = stored?.user_id ?? null;
      const linkUser = fields["url_params[user_id]"] ?? "";
      if (!userId && UUID.test(linkUser)) userId = linkUser;
      const email = sale?.email ?? subscriber.user_email ?? fields.email ?? null;
      if (!userId && email) {
        const { data } = await admin.rpc("user_id_for_email", { p_email: email });
        userId = (data as string | null) ?? null;
      }
      if (!userId) {
        console.error("gumroad membership without a matching account", subscriptionId, saleId);
        return Response.json({ ignored: "no matching account" });
      }

      const refunded = Boolean(sale?.refunded || sale?.chargedback);
      const active = ACTIVE_STATUSES.has(subscriber.status ?? "") && !refunded;
      let end: string | null = null;
      if (!active) end = new Date().toISOString();
      else if (sale) end = periodEnd(sale.created_at ?? fields.sale_timestamp, plan);
      else if (!stored?.current_period_end) end = periodEnd(subscriber.created_at, plan);

      const { data: result, error } = await admin.rpc("upsert_gumroad_subscription", {
        p_subscription_id: subscriptionId,
        p_user_id: userId,
        p_email: email,
        p_product_id: subscriber.product_id ?? fields.product_id ?? null,
        p_plan: plan,
        p_status: active ? "active" : "ended",
        p_current_period_end: end,
        p_cancel_at_period_end: subscriber.status === "pending_cancellation",
        p_sale_id: saleId || null,
      });
      if (error) throw error;
      console.log("gumroad", subscriptionId, subscriber.status, refunded ? "refunded" : "", "->", result);
      return Response.json({ received: true });
    } catch (error) {
      console.error("gumroad ping failed", subscriptionId, saleId, error);
      return Response.json({ error: "Processing failed" }, { status: 500 });
    }
  }),
};
