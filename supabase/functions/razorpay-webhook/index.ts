import { withSupabase } from "npm:@supabase/server@1.5.2";
import type { Database } from "../_shared/database.types.ts";
import {
  hmacSHA256Hex,
  type RazorpaySubscription,
  recordSubscription,
  subscriptionUserId,
  timingSafeEqual,
} from "../_shared/razorpay.ts";

const webhookSecret = Deno.env.get("RAZORPAY_WEBHOOK_SECRET") ?? "";

type WebhookEvent = {
  event?: string;
  payload?: { subscription?: { entity?: RazorpaySubscription } };
};

export default {
  fetch: withSupabase<Database>({ auth: "none" }, async (request, context) => {
    if (request.method !== "POST") {
      return Response.json({ error: "Method not allowed" }, { status: 405 });
    }

    const payload = await request.text();
    const signature = request.headers.get("x-razorpay-signature") ?? "";
    const expected = await hmacSHA256Hex(webhookSecret, payload);
    if (!webhookSecret || !timingSafeEqual(expected, signature)) {
      return Response.json({ error: "Invalid Razorpay signature" }, {
        status: 400,
      });
    }

    let event: WebhookEvent;
    try {
      event = JSON.parse(payload) as WebhookEvent;
    } catch {
      return Response.json({ error: "Invalid payload" }, { status: 400 });
    }

    const subscription = event.payload?.subscription?.entity;
    if (!event.event?.startsWith("subscription.") || !subscription) {
      return Response.json({ received: true });
    }

    try {
      let userID = subscriptionUserId(subscription);
      if (!userID) {
        const { data } = await context.supabaseAdmin.rpc(
          "razorpay_subscription_owner",
          { p_subscription_id: subscription.id },
        );
        userID = data ?? null;
      }
      if (!userID) {
        console.error("razorpay subscription without a user", subscription.id);
        return Response.json({ received: true });
      }
      await recordSubscription(context.supabaseAdmin, subscription, userID);
    } catch (error) {
      console.error("razorpay webhook processing failed", event.event, error);
      // A non-2xx response makes Razorpay retry the event.
      return Response.json({ error: "Webhook processing failed" }, {
        status: 500,
      });
    }

    return Response.json({ received: true });
  }),
};
