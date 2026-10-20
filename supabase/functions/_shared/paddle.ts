// Minimal Paddle Billing client: webhook signatures, plan mapping, and the API calls we use.
// Sandbox and live are separate accounts; PADDLE_ENV picks which API we talk to.

import { hmacSHA256Hex, timingSafeEqual, type WebPlan } from "./razorpay.ts";

const environment = Deno.env.get("PADDLE_ENV") === "production" ? "production" : "sandbox";
const apiBase = environment === "production" ? "https://api.paddle.com" : "https://sandbox-api.paddle.com";
const apiKey = Deno.env.get("PADDLE_API_KEY") ?? "";
export const paddleWebhookSecret = Deno.env.get("PADDLE_WEBHOOK_SECRET") ?? "";
export const paddleConfigured = apiKey !== "";

const priceIds: Record<WebPlan, (string | undefined)[]> = {
  // The yearly plan with a free trial is its own Paddle price; both unlock "yearly".
  yearly: [Deno.env.get("PADDLE_PRICE_YEARLY"), Deno.env.get("PADDLE_PRICE_YEARLY_TRIAL")],
  monthly: [Deno.env.get("PADDLE_PRICE_MONTHLY")],
  weekly: [],
};

export function planForPrice(priceId: string): WebPlan | null {
  if (priceId && priceIds.yearly.includes(priceId)) return "yearly";
  if (priceId && priceIds.monthly.includes(priceId)) return "monthly";
  return null;
}

/** The subscription entity as Paddle sends it in webhooks and API responses (fields we use). */
export interface PaddleSubscription {
  id: string;
  status: string;
  customer_id: string | null;
  custom_data: Record<string, unknown> | null;
  items: { price: { id: string } | null }[];
  current_billing_period: { starts_at: string; ends_at: string } | null;
  scheduled_change: { action: string; effective_at: string } | null;
}

const SIGNATURE_TOLERANCE_SECONDS = 5 * 60;

/**
 * Verifies the Paddle-Signature header ("ts=...;h1=..."): HMAC-SHA256 of "ts:rawBody" with the
 * destination's secret. Several h1 values can appear while a secret is being rotated.
 */
export async function verifyPaddleSignature(rawBody: string, header: string): Promise<boolean> {
  if (!paddleWebhookSecret || !header) return false;
  const parts = header.split(";").map((part) => part.trim().split("=", 2) as [string, string]);
  const ts = parts.find(([key]) => key === "ts")?.[1];
  const signatures = parts.filter(([key]) => key === "h1").map(([, value]) => value);
  if (!ts || signatures.length === 0) return false;
  if (Math.abs(Date.now() / 1000 - Number(ts)) > SIGNATURE_TOLERANCE_SECONDS) return false;
  const expected = await hmacSHA256Hex(paddleWebhookSecret, `${ts}:${rawBody}`);
  return signatures.some((signature) => timingSafeEqual(expected, signature));
}

export async function paddle<T>(
  path: string,
  options: { method?: "GET" | "POST"; body?: unknown } = {},
): Promise<T> {
  const response = await fetch(`${apiBase}${path}`, {
    method: options.method ?? "GET",
    headers: { authorization: `Bearer ${apiKey}`, "content-type": "application/json" },
    body: options.body === undefined ? undefined : JSON.stringify(options.body),
    signal: AbortSignal.timeout(15_000),
  });
  const text = await response.text();
  if (!response.ok) throw new Error(`Paddle ${response.status}: ${text}`);
  return (JSON.parse(text) as { data: T }).data;
}

export function subscriptionUserId(subscription: PaddleSubscription): string | null {
  const userID = subscription.custom_data?.user_id;
  return typeof userID === "string" ? userID : null;
}

/**
 * Whether the subscription has a real payment: a paid or completed transaction above $0.
 * A subscription can be 'active' before it is paid (a trial's first charge comes right after).
 */
export async function hasPaddlePayment(subscriptionID: string): Promise<boolean> {
  const transactions = await paddle<{ details: { totals: { grand_total: string } } | null }[]>(
    `/transactions?subscription_id=${encodeURIComponent(subscriptionID)}&status=paid,completed&per_page=30`,
  );
  return transactions.some((transaction) => Number(transaction.details?.totals.grand_total ?? 0) > 0);
}

/** Saves a subscription snapshot and recomputes the user's plan. Null if the price isn't ours. */
export async function recordPaddleSubscription(
  // deno-lint-ignore no-explicit-any
  admin: any,
  subscription: PaddleSubscription,
  userID: string,
  occurredAt: string | null,
): Promise<string | null> {
  const priceId = subscription.items.find((item) => item.price?.id)?.price?.id ?? "";
  const plan = planForPrice(priceId);
  if (!plan) return null;
  // Being paid only matters once a subscription is active or past_due (see recompute_subscription_plan).
  const paid = ["active", "past_due"].includes(subscription.status) ? await hasPaddlePayment(subscription.id) : null;
  const { data, error } = await admin.rpc("upsert_paddle_subscription", {
    p_subscription_id: subscription.id,
    p_user_id: userID,
    p_customer_id: subscription.customer_id,
    p_price_id: priceId,
    p_plan: plan,
    p_status: subscription.status,
    p_current_period_end: subscription.current_billing_period?.ends_at ?? null,
    p_cancel_at_period_end: subscription.scheduled_change?.action === "cancel",
    p_occurred_at: occurredAt,
    p_paid: paid,
  });
  if (error) throw error;
  return data as string;
}
