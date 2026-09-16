import { withSupabase } from "npm:@supabase/server@1.5.2";
import type { Database } from "../_shared/database.types.ts";
import { withCors } from "../_shared/cors.ts";
import {
  planIds,
  razorpay,
  razorpayKeyId,
  type RazorpaySubscription,
  type WebPlan,
} from "../_shared/razorpay.ts";

// Razorpay requires a finite number of billing cycles; these are effectively open-ended.
const TOTAL_COUNT: Record<WebPlan, number> = { yearly: 10, weekly: 260 };

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

    const body = await request.json().catch(() => ({})) as { plan?: string };
    const plan: WebPlan | null = body.plan === "yearly" || body.plan === "weekly"
      ? body.plan
      : null;
    if (!plan) {
      return Response.json({ error: "Unknown plan" }, { status: 400 });
    }
    const planID = planIds[plan];
    if (!planID || !razorpayKeyId) {
      return Response.json({ error: "Web plans are not configured" }, {
        status: 500,
      });
    }

    const { data: profile } = await context.supabaseAdmin
      .from("profiles")
      .select("plan")
      .eq("user_id", userID)
      .maybeSingle();
    if (profile && profile.plan !== "free") {
      return Response.json({ error: "already_subscribed" }, { status: 409 });
    }

    const { data: user } = await context.supabaseAdmin.auth.admin.getUserById(
      userID,
    );

    try {
      const subscription = await razorpay<RazorpaySubscription>(
        "/subscriptions",
        {
          method: "POST",
          body: {
            plan_id: planID,
            total_count: TOTAL_COUNT[plan],
            quantity: 1,
            customer_notify: 1,
            notes: { user_id: userID, plan },
          },
        },
      );
      return Response.json({
        subscription_id: subscription.id,
        key_id: razorpayKeyId,
        email: user.user?.email ?? null,
        name: (user.user?.user_metadata?.full_name as string | undefined) ??
          null,
      });
    } catch (error) {
      console.error("razorpay subscription create failed", error);
      return Response.json({ error: "Checkout could not start" }, {
        status: 502,
      });
    }
  },
);

export default { fetch: withCors(handler) };
