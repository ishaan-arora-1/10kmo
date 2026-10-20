import { withSupabase } from "npm:@supabase/server@1.5.2";
import type { Database } from "../_shared/database.types.ts";
import { withCors } from "../_shared/cors.ts";
import { paddle, type PaddleSubscription, recordPaddleSubscription } from "../_shared/paddle.ts";

// Ends the account's free trial now and charges the yearly price to the payment method saved at
// checkout (Paddle's activate operation), so every claim unlocks right away. The website asks
// people to confirm the charge first. Paying monthly instead goes through a normal checkout;
// the webhook then cancels the trial.
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

    const { data: trialIDs, error } = await context.supabaseAdmin.rpc(
      "trialing_paddle_subscription_ids",
      { p_user_id: userID },
    );
    if (error) {
      console.error("paddle trial lookup failed", error);
      return Response.json({ error: "Subscription lookup failed" }, { status: 500 });
    }
    const subscriptionID = trialIDs?.[0];
    if (!subscriptionID) {
      return Response.json({ error: "no_trial" }, { status: 404 });
    }

    const path = `/subscriptions/${encodeURIComponent(subscriptionID)}`;
    try {
      const activated = await paddle<PaddleSubscription>(`${path}/activate`, { method: "POST" });
      await recordPaddleSubscription(context.supabaseAdmin, activated, userID, new Date().toISOString());
      console.log("paddle trial activated", subscriptionID, activated.status);
      return Response.json({ unlocked: activated.status === "active" });
    } catch (activateError) {
      const declined = String(activateError).includes("subscription_payment_declined");
      console.error("paddle activate failed", subscriptionID, activateError);
      // Save whatever state Paddle left the subscription in, so access matches it.
      try {
        const current = await paddle<PaddleSubscription>(path);
        await recordPaddleSubscription(context.supabaseAdmin, current, userID, new Date().toISOString());
      } catch (refreshError) {
        console.error("paddle refresh after failed activate failed", subscriptionID, refreshError);
      }
      return Response.json(
        { error: declined ? "declined" : "activate_failed" },
        { status: declined ? 402 : 502 },
      );
    }
  },
);

export default { fetch: withCors(handler) };
