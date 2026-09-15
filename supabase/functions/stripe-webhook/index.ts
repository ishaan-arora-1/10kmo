import Stripe from "npm:stripe@22.6.2";
import { withSupabase } from "npm:@supabase/server@1.5.2";
import type { Database } from "../_shared/database.types.ts";

const stripe = new Stripe(Deno.env.get("STRIPE_SECRET_KEY") ?? "", {
  httpClient: Stripe.createFetchHttpClient(),
});
const cryptoProvider = Stripe.createSubtleCryptoProvider();
const webhookSecret = Deno.env.get("STRIPE_WEBHOOK_SECRET") ?? "";
const planForPrice = new Map<string | undefined, "yearly" | "weekly">([
  [Deno.env.get("STRIPE_PRICE_YEARLY"), "yearly"],
  [Deno.env.get("STRIPE_PRICE_WEEKLY"), "weekly"],
]);

export default {
  fetch: withSupabase<Database>({ auth: "none" }, async (request, context) => {
    if (request.method !== "POST") {
      return Response.json({ error: "Method not allowed" }, { status: 405 });
    }

    const signature = request.headers.get("stripe-signature");
    const payload = await request.text();
    let event: Stripe.Event;
    try {
      event = await stripe.webhooks.constructEventAsync(
        payload,
        signature ?? "",
        webhookSecret,
        undefined,
        cryptoProvider,
      );
    } catch {
      return Response.json({ error: "Invalid Stripe signature" }, {
        status: 400,
      });
    }

    const apply = async (
      subscription: Stripe.Subscription,
      fallbackUserID?: string | null,
    ) => {
      const customerID = typeof subscription.customer === "string"
        ? subscription.customer
        : subscription.customer.id;
      const item = subscription.items.data[0];
      const priceID = item?.price.id;
      const plan = planForPrice.get(priceID);
      if (!priceID || !plan) return;

      let userID = subscription.metadata?.user_id || fallbackUserID || null;
      if (!userID) {
        const { data } = await context.supabaseAdmin.rpc(
          "stripe_user_for_customer",
          { p_customer_id: customerID },
        );
        userID = data ?? null;
      }
      if (!userID) {
        console.error("stripe subscription without a user", subscription.id);
        return;
      }

      // Newer Stripe API versions put the period end on the subscription item.
      const periodEnd =
        (subscription as unknown as { current_period_end?: number })
          .current_period_end ??
          (item as unknown as { current_period_end?: number })
            .current_period_end;

      const { error } = await context.supabaseAdmin.rpc(
        "upsert_stripe_subscription",
        {
          p_subscription_id: subscription.id,
          p_user_id: userID,
          p_customer_id: customerID,
          p_price_id: priceID,
          p_plan: plan,
          p_status: subscription.status,
          p_current_period_end: periodEnd
            ? new Date(periodEnd * 1000).toISOString()
            : null,
          p_cancel_at_period_end: subscription.cancel_at_period_end,
        },
      );
      if (error) throw error;
    };

    try {
      switch (event.type) {
        case "checkout.session.completed": {
          const session = event.data.object;
          if (session.mode === "subscription" && session.subscription) {
            const subscriptionID = typeof session.subscription === "string"
              ? session.subscription
              : session.subscription.id;
            const subscription = await stripe.subscriptions.retrieve(
              subscriptionID,
            );
            await apply(subscription, session.client_reference_id);
          }
          break;
        }
        case "customer.subscription.created":
        case "customer.subscription.updated":
        case "customer.subscription.deleted":
          await apply(event.data.object);
          break;
        default:
          break;
      }
    } catch (error) {
      console.error("stripe webhook processing failed", event.type, error);
      // A 500 makes Stripe retry the event later.
      return Response.json({ error: "Webhook processing failed" }, {
        status: 500,
      });
    }

    return Response.json({ received: true });
  }),
};
