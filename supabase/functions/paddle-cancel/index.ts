import { withSupabase } from "npm:@supabase/server@1.5.2";
import type { Database } from "../_shared/database.types.ts";
import { withCors } from "../_shared/cors.ts";
import { paddle, type PaddleSubscription, recordPaddleSubscription } from "../_shared/paddle.ts";

// Cancels at the end of the paid period, so people keep what they paid for and aren't charged again.
const handler = withSupabase<Database>(
  { auth: "user" },
  async (request, context) => {
    if (request.method !== "POST") {
      return Response.json({ error: "Method not allowed" }, { status: 405 });
    }

    const userID = context.userClaims?.id;
    if (!userID) {
      return Response.json({ error: "Sign in required" }, { status: 401 });
    }

    const { data: subscriptionIDs, error } = await context.supabaseAdmin.rpc(
      "active_paddle_subscription_ids",
      { p_user_id: userID },
    );
    if (error) {
      console.error("paddle subscription lookup failed", error);
      return Response.json({ error: "Subscription lookup failed" }, { status: 500 });
    }
    if (!subscriptionIDs || subscriptionIDs.length === 0) {
      return Response.json({ error: "no_web_subscription" }, { status: 404 });
    }

    let accessUntil: string | null = null;
    try {
      for (const subscriptionID of subscriptionIDs) {
        const updated = await paddle<PaddleSubscription>(
          `/subscriptions/${encodeURIComponent(subscriptionID)}/cancel`,
          { method: "POST", body: { effective_from: "next_billing_period" } },
        );
        await recordPaddleSubscription(context.supabaseAdmin, updated, userID, new Date().toISOString());
        accessUntil = updated.scheduled_change?.effective_at ??
          updated.current_billing_period?.ends_at ?? accessUntil;
      }
    } catch (cancelError) {
      console.error("paddle cancel failed", cancelError);
      return Response.json({ error: "Subscription could not be canceled" }, { status: 502 });
    }

    return Response.json({ cancelled: true, accessUntil });
  },
);

export default { fetch: withCors(handler) };
