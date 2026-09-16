import { withSupabase } from "npm:@supabase/server@1.5.2";
import type { Database } from "../_shared/database.types.ts";
import { withCors } from "../_shared/cors.ts";
import {
  hmacSHA256Hex,
  razorpay,
  razorpayKeySecret,
  type RazorpaySubscription,
  recordSubscription,
  subscriptionUserId,
  timingSafeEqual,
} from "../_shared/razorpay.ts";

type CheckoutResponse = {
  razorpay_payment_id?: string;
  razorpay_subscription_id?: string;
  razorpay_signature?: string;
};

// Confirms Razorpay Checkout's success callback right away, so filing unlocks
// without waiting for the webhook.
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

    const body = await request.json().catch(() => ({})) as CheckoutResponse;
    const paymentID = body.razorpay_payment_id;
    const subscriptionID = body.razorpay_subscription_id;
    const signature = body.razorpay_signature;
    if (!paymentID || !subscriptionID || !signature) {
      return Response.json({ error: "Missing payment details" }, {
        status: 400,
      });
    }

    const expected = await hmacSHA256Hex(
      razorpayKeySecret,
      `${paymentID}|${subscriptionID}`,
    );
    if (!timingSafeEqual(expected, signature)) {
      return Response.json({ error: "Invalid payment signature" }, {
        status: 400,
      });
    }

    try {
      const subscription = await razorpay<RazorpaySubscription>(
        `/subscriptions/${encodeURIComponent(subscriptionID)}`,
      );
      if (subscriptionUserId(subscription) !== userID) {
        return Response.json({ error: "Subscription belongs to another account" }, {
          status: 403,
        });
      }
      const plan = await recordSubscription(
        context.supabaseAdmin,
        subscription,
        userID,
      );
      return Response.json({ verified: true, plan });
    } catch (error) {
      console.error("razorpay verification failed", error);
      return Response.json({ error: "Payment could not be confirmed" }, {
        status: 502,
      });
    }
  },
);

export default { fetch: withCors(handler) };
