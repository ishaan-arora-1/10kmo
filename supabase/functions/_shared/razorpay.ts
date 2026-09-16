// Minimal Razorpay REST client for subscriptions (no SDK needed in Deno).

const keyId = Deno.env.get("RAZORPAY_KEY_ID") ?? "";
const keySecret = Deno.env.get("RAZORPAY_KEY_SECRET") ?? "";

export const razorpayKeyId = keyId;
export const razorpayKeySecret = keySecret;

export type WebPlan = "yearly" | "weekly";

export const planIds: Record<WebPlan, string | undefined> = {
  yearly: Deno.env.get("RAZORPAY_PLAN_YEARLY"),
  weekly: Deno.env.get("RAZORPAY_PLAN_WEEKLY"),
};

export interface RazorpaySubscription {
  id: string;
  plan_id: string;
  status: string;
  current_end: number | null;
  charge_at: number | null;
  start_at: number | null;
  notes: Record<string, string> | unknown[] | null;
}

export async function razorpay<T>(
  path: string,
  options: { method?: "GET" | "POST"; body?: unknown } = {},
): Promise<T> {
  const response = await fetch(`https://api.razorpay.com/v1${path}`, {
    method: options.method ?? "GET",
    headers: {
      authorization: `Basic ${btoa(`${keyId}:${keySecret}`)}`,
      "content-type": "application/json",
    },
    body: options.body === undefined ? undefined : JSON.stringify(options.body),
    signal: AbortSignal.timeout(15_000),
  });
  const text = await response.text();
  if (!response.ok) throw new Error(`Razorpay ${response.status}: ${text}`);
  return JSON.parse(text) as T;
}

export async function hmacSHA256Hex(
  secret: string,
  message: string,
): Promise<string> {
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const signature = await crypto.subtle.sign(
    "HMAC",
    key,
    new TextEncoder().encode(message),
  );
  return Array.from(new Uint8Array(signature))
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
}

export function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let difference = 0;
  for (let index = 0; index < a.length; index += 1) {
    difference |= a.charCodeAt(index) ^ b.charCodeAt(index);
  }
  return difference === 0;
}

export function planForId(planId: string): WebPlan | null {
  if (planId && planId === planIds.yearly) return "yearly";
  if (planId && planId === planIds.weekly) return "weekly";
  return null;
}

export function subscriptionUserId(
  subscription: RazorpaySubscription,
): string | null {
  const notes = subscription.notes;
  if (!notes || Array.isArray(notes)) return null;
  return typeof notes.user_id === "string" ? notes.user_id : null;
}

/** Saves a subscription snapshot and recomputes the user's plan. */
export async function recordSubscription(
  // deno-lint-ignore no-explicit-any
  admin: any,
  subscription: RazorpaySubscription,
  userID: string,
  cancelAtPeriodEnd: boolean | null = null,
): Promise<string | null> {
  const plan = planForId(subscription.plan_id);
  if (!plan) return null;

  // During a free trial nothing has been charged yet, so access runs until the first charge.
  const periodEnd = subscription.current_end ?? subscription.charge_at ??
    subscription.start_at;

  const { data, error } = await admin.rpc("upsert_razorpay_subscription", {
    p_subscription_id: subscription.id,
    p_user_id: userID,
    p_plan_id: subscription.plan_id,
    p_plan: plan,
    p_status: subscription.status,
    p_current_period_end: periodEnd
      ? new Date(periodEnd * 1000).toISOString()
      : null,
    p_cancel_at_period_end: cancelAtPeriodEnd,
  });
  if (error) throw error;
  return data as string;
}
