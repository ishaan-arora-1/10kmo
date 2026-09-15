import Stripe from "npm:stripe@22.6.2";
import { withSupabase } from "npm:@supabase/server@1.5.2";
import type { Database } from "../_shared/database.types.ts";
import { allowedOrigin, withCors } from "../_shared/cors.ts";

const stripe = new Stripe(Deno.env.get("STRIPE_SECRET_KEY") ?? "", {
  httpClient: Stripe.createFetchHttpClient(),
});

const prices: Record<"yearly" | "weekly", string | undefined> = {
  yearly: Deno.env.get("STRIPE_PRICE_YEARLY"),
  weekly: Deno.env.get("STRIPE_PRICE_WEEKLY"),
};
const webAppURL = (Deno.env.get("WEB_APP_URL") ?? "").replace(/\/$/, "");

type RequestBody = { plan?: string; next?: string };

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

    const body = await request.json().catch(() => ({})) as RequestBody;
    const plan = body.plan === "yearly" || body.plan === "weekly"
      ? body.plan
      : null;
    const price = plan ? prices[plan] : undefined;
    if (!plan || !price) {
      return Response.json({ error: "Unknown plan" }, { status: 400 });
    }

    const origin = allowedOrigin(request) ?? webAppURL;
    if (!origin) {
      return Response.json({ error: "Website origin is not configured" }, {
        status: 500,
      });
    }
    const next = typeof body.next === "string" && body.next.startsWith("/") &&
        !body.next.startsWith("//")
      ? body.next
      : "/";

    const { data: profile } = await context.supabaseAdmin
      .from("profiles")
      .select("plan")
      .eq("user_id", userID)
      .maybeSingle();
    if (profile && profile.plan !== "free") {
      return Response.json({ error: "already_subscribed" }, { status: 409 });
    }

    const [{ data: customerID }, { data: hadSubscription }, { data: user }] =
      await Promise.all([
        context.supabaseAdmin.rpc("stripe_customer_for_user", {
          p_user_id: userID,
        }),
        context.supabaseAdmin.rpc("user_had_stripe_subscription", {
          p_user_id: userID,
        }),
        context.supabaseAdmin.auth.admin.getUserById(userID),
      ]);

    // First-time yearly subscribers get the same 3-day trial as the App Store.
    const trial = plan === "yearly" && !hadSubscription
      ? { trial_period_days: 3 }
      : {};

    try {
      const session = await stripe.checkout.sessions.create({
        mode: "subscription",
        line_items: [{ price, quantity: 1 }],
        customer: customerID ?? undefined,
        customer_email: customerID ? undefined : user.user?.email ?? undefined,
        client_reference_id: userID,
        metadata: { user_id: userID, plan },
        subscription_data: { metadata: { user_id: userID, plan }, ...trial },
        allow_promotion_codes: true,
        success_url: `${origin}/app/welcome?checkout=success&next=${
          encodeURIComponent(next)
        }`,
        cancel_url: `${origin}/app/paywall?next=${encodeURIComponent(next)}`,
      });
      return Response.json({ url: session.url });
    } catch (error) {
      console.error("stripe checkout failed", error);
      return Response.json({ error: "Checkout could not start" }, {
        status: 502,
      });
    }
  },
);

export default { fetch: withCors(handler) };
