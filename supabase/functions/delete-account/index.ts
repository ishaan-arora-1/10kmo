import Stripe from "npm:stripe@22.6.2";
import { withSupabase } from "npm:@supabase/server@1.5.2";
import type { Database } from "../_shared/database.types.ts";
import { withCors } from "../_shared/cors.ts";

const stripeKey = Deno.env.get("STRIPE_SECRET_KEY");
const stripe = stripeKey
  ? new Stripe(stripeKey, { httpClient: Stripe.createFetchHttpClient() })
  : null;

const handler = withSupabase<Database>(
  { auth: "user" },
  async (request, context) => {
    if (request.method !== "POST") {
      return Response.json({ error: "Method not allowed" }, { status: 405 });
    }

    const userID = context.userClaims?.id;
    if (!userID) {
      return Response.json({ error: "User not found" }, { status: 401 });
    }

    // Web subscriptions are billed by us through Stripe, so cancel them before
    // the account disappears. App Store subscriptions can only be canceled by the user.
    if (stripe) {
      const { data: subscriptionIDs } = await context.supabaseAdmin.rpc(
        "active_stripe_subscription_ids",
        { p_user_id: userID },
      );
      for (const subscriptionID of subscriptionIDs ?? []) {
        try {
          await stripe.subscriptions.cancel(subscriptionID);
        } catch (error) {
          console.error("stripe cancel failed", subscriptionID, error);
        }
      }
    }

    const { error: deleteError } = await context.supabaseAdmin.auth.admin
      .deleteUser(userID);
    if (deleteError) {
      console.error("account deletion failed", deleteError);
      return Response.json(
        { error: "Account could not be deleted" },
        { status: 500 },
      );
    }

    return Response.json({ deleted: true });
  },
);

export default { fetch: withCors(handler) };
