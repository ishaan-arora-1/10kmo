import { withSupabase } from "npm:@supabase/server@1.5.2";
import type { Database } from "../_shared/database.types.ts";
import { withCors } from "../_shared/cors.ts";
import {
  razorpay,
  type RazorpaySubscription,
  recordSubscription,
} from "../_shared/razorpay.ts";

// Paid subscriptions end at the close of the current period; trials that haven't
// been charged yet end immediately so nobody is billed.
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
      "active_razorpay_subscription_ids",
      { p_user_id: userID },
    );
    if (error) {
      console.error("subscription lookup failed", error);
      return Response.json({ error: "Subscription lookup failed" }, {
        status: 500,
      });
    }
    if (!subscriptionIDs || subscriptionIDs.length === 0) {
      return Response.json({ error: "no_web_subscription" }, { status: 404 });
    }

    let accessUntil: string | null = null;
    try {
      for (const subscriptionID of subscriptionIDs) {
        const path = `/subscriptions/${encodeURIComponent(subscriptionID)}`;
        const current = await razorpay<RazorpaySubscription>(path);
        const notYetCharged = current.status === "created" ||
          current.status === "authenticated";
        const updated = await razorpay<RazorpaySubscription>(
          `${path}/cancel`,
          {
            method: "POST",
            body: { cancel_at_cycle_end: notYetCharged ? 0 : 1 },
          },
        );
        await recordSubscription(
          context.supabaseAdmin,
          updated,
          userID,
          !notYetCharged,
        );
        if (!notYetCharged && updated.current_end) {
          accessUntil = new Date(updated.current_end * 1000).toISOString();
        }
      }
    } catch (cancelError) {
      console.error("razorpay cancel failed", cancelError);
      return Response.json({ error: "Subscription could not be canceled" }, {
        status: 502,
      });
    }

    return Response.json({ cancelled: true, accessUntil });
  },
);

export default { fetch: withCors(handler) };
