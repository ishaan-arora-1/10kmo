import { withSupabase } from "npm:@supabase/server@1.5.2";
import type { Database } from "../_shared/database.types.ts";
import {
  paddle,
  type PaddleSubscription,
  recordPaddleSubscription,
  subscriptionUserId,
  verifyPaddleSignature,
} from "../_shared/paddle.ts";

type WebhookEvent = {
  event_id?: string;
  event_type?: string;
  occurred_at?: string;
  data?: PaddleSubscription;
};

// Paddle signs every delivery; only a 2xx counts as delivered, anything else is retried.
// Subscription events carry the full subscription, so each one is applied as the latest state
// (older events that arrive late are ignored by upsert_paddle_subscription).
export default {
  fetch: withSupabase<Database>({ auth: "none" }, async (request, context) => {
    if (request.method !== "POST") {
      return Response.json({ error: "Method not allowed" }, { status: 405 });
    }

    const rawBody = await request.text();
    const signature = request.headers.get("paddle-signature") ?? "";
    if (!(await verifyPaddleSignature(rawBody, signature))) {
      return Response.json({ error: "Invalid Paddle signature" }, { status: 401 });
    }

    let event: WebhookEvent;
    try {
      event = JSON.parse(rawBody) as WebhookEvent;
    } catch {
      return Response.json({ error: "Invalid payload" }, { status: 400 });
    }

    const subscription = event.data;
    if (!event.event_type?.startsWith("subscription.") || !subscription?.id) {
      return Response.json({ received: true });
    }

    try {
      let userID = subscriptionUserId(subscription);
      if (!userID) {
        const { data } = await context.supabaseAdmin.rpc("paddle_subscription_owner", {
          p_subscription_id: subscription.id,
        });
        userID = data ?? null;
      }
      if (!userID) {
        console.error("paddle subscription without a user", subscription.id, event.event_id);
        return Response.json({ received: true });
      }
      const plan = await recordPaddleSubscription(
        context.supabaseAdmin,
        subscription,
        userID,
        event.occurred_at ?? null,
      );
      console.log("paddle", event.event_type, subscription.id, subscription.status, "->", plan);

      // Paid while a free trial was still running (people on a trial can pay monthly to unlock
      // everything now): end the trial right away so it never charges the yearly price too.
      // A failure here returns 500, so Paddle retries the whole event.
      if (plan && subscription.status === "active") {
        const { data: trialIDs, error: trialError } = await context.supabaseAdmin.rpc(
          "trialing_paddle_subscription_ids",
          { p_user_id: userID },
        );
        if (trialError) throw trialError;
        for (const trialID of (trialIDs ?? []).filter((id) => id !== subscription.id)) {
          const canceled = await paddle<PaddleSubscription>(
            `/subscriptions/${encodeURIComponent(trialID)}/cancel`,
            { method: "POST", body: { effective_from: "immediately" } },
          );
          await recordPaddleSubscription(context.supabaseAdmin, canceled, userID, new Date().toISOString());
          console.log("paddle trial canceled after payment", trialID, "paid by", subscription.id);
        }
      }
    } catch (error) {
      console.error("paddle webhook processing failed", event.event_type, event.event_id, error);
      return Response.json({ error: "Webhook processing failed" }, { status: 500 });
    }

    return Response.json({ received: true });
  }),
};
