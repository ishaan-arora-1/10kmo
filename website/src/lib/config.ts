/** Replaced everywhere by scripts/set-support-email.sh. */
/**
 * "First claim free": free accounts could file one claim without paying (2026-10-07 to 10-09).
 * Off: filing is locked until they subscribe. Claims they already started stay unlocked.
 */
export const FIRST_CLAIM_FREE = false;

export const SUPPORT_EMAIL = "support@claimrightful.com";

/**
 * Paddle checkout (cards only for now; see lib/paddle.ts). Used when all of these are set;
 * otherwise the site keeps using Razorpay. Sandbox and live have different tokens and price IDs.
 */
export const PADDLE = {
  token: import.meta.env.VITE_PADDLE_CLIENT_TOKEN ?? "",
  environment: (import.meta.env.VITE_PADDLE_ENV === "production" ? "production" : "sandbox") as
    | "production"
    | "sandbox",
  prices: {
    monthly: import.meta.env.VITE_PADDLE_PRICE_MONTHLY ?? "",
    yearly: import.meta.env.VITE_PADDLE_PRICE_YEARLY ?? "",
  },
};

/**
 * Gumroad memberships (cards, PayPal, Apple Pay, Google Pay): the stopgap while Paddle's
 * website review is pending. Each URL is a Gumroad membership product page.
 */
export const GUMROAD = {
  monthly: import.meta.env.VITE_GUMROAD_MONTHLY_URL ?? "",
  yearly: import.meta.env.VITE_GUMROAD_YEARLY_URL ?? "",
};

/** Paddle when configured, else Gumroad when configured, else Razorpay. */
export const PAYMENTS: "paddle" | "gumroad" | "razorpay" =
  PADDLE.token && PADDLE.prices.monthly && PADDLE.prices.yearly
    ? "paddle"
    : GUMROAD.monthly && GUMROAD.yearly
      ? "gumroad"
      : "razorpay";

/**
 * Free trial on the yearly plan, in days (2026-10-17 test: 1 day, then $39.99/year). Only with
 * Paddle, and VITE_PADDLE_PRICE_YEARLY must then be the Paddle price that has this trial.
 * 0 or unset: no trial, yearly is charged at checkout.
 */
export const YEARLY_TRIAL_DAYS = PAYMENTS === "paddle" ? Number(import.meta.env.VITE_PADDLE_YEARLY_TRIAL_DAYS || 0) : 0;

/**
 * What the yearly free trial includes (2026-10-20): the three most-filed claims, by settlement
 * id, with the short name the copy uses. The first three still open count, so CVS takes Pork's
 * place once Pork closes on Oct 29. Everything else unlocks with the first payment.
 * Trials started before this rule have full access (the database decides; see
 * profiles.plan_trial_until).
 */
export const TRIAL_CLAIMS: { id: string; label: string }[] = [
  { id: "0e0a8a5e-4a3f-5d52-9a1e-9b2a1f0d7c31", label: "Apple" },
  { id: "13ad194f-c4b3-5071-8afc-59248754e7e4", label: "ATM fee" },
  { id: "38714408-60ba-59e6-959d-0d0e4d77626f", label: "Pork" },
  { id: "988e6c93-a552-536c-b3aa-e6807cafe4c6", label: "CVS" },
];
export const TRIAL_CLAIM_COUNT = 3;

/** The plans the website sells. Existing weekly subscriptions still renew, but weekly isn't offered. */
export type WebPlan = "yearly" | "monthly";

/** Display prices; they must match the plans created in Razorpay. */
export const PRICE_LABELS: Record<WebPlan, string> = {
  yearly: import.meta.env.VITE_PRICE_YEARLY || "$39.99",
  monthly: import.meta.env.VITE_PRICE_MONTHLY || "$4.99",
};

/** The same prices as numbers, for per-month math and ad-conversion values. */
export const PRICE_VALUES: Record<WebPlan, number> = {
  yearly: Number(PRICE_LABELS.yearly.replace(/[^0-9.]/g, "")),
  monthly: Number(PRICE_LABELS.monthly.replace(/[^0-9.]/g, "")),
};

/** Email reminders need a custom sending domain, so they stay off until one exists. */
export const EMAIL_REMINDERS_ENABLED = import.meta.env.VITE_ENABLE_EMAIL_REMINDERS === "true";
