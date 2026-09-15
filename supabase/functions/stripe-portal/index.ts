import Stripe from "npm:stripe@22.6.2";
import { withSupabase } from "npm:@supabase/server@1.5.2";
import type { Database } from "../_shared/database.types.ts";
import { allowedOrigin, withCors } from "../_shared/cors.ts";

const stripe = new Stripe(Deno.env.get("STRIPE_SECRET_KEY") ?? "", {
  httpClient: Stripe.createFetchHttpClient(),
});
const webAppURL = (Deno.env.get("WEB_APP_URL") ?? "").replace(/\/$/, "");

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

    const { data: customerID } = await context.supabaseAdmin.rpc(
      "stripe_customer_for_user",
      { p_user_id: userID },
    );
    if (!customerID) {
      return Response.json({ error: "no_web_subscription" }, { status: 404 });
    }

    const origin = allowedOrigin(request) ?? webAppURL;
    try {
      const portal = await stripe.billingPortal.sessions.create({
        customer: customerID,
        return_url: `${origin}/app/profile`,
      });
      return Response.json({ url: portal.url });
    } catch (error) {
      console.error("stripe portal failed", error);
      return Response.json({ error: "Billing portal could not open" }, {
        status: 502,
      });
    }
  },
);

export default { fetch: withCors(handler) };
