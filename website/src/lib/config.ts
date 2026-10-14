/** Replaced everywhere by scripts/set-support-email.sh. */
/**
 * "First claim free": free accounts could file one claim without paying (2026-10-07 to 10-09).
 * Off: filing is locked until they subscribe. Claims they already started stay unlocked.
 */
export const FIRST_CLAIM_FREE = false;

export const SUPPORT_EMAIL = "support@claimrightful.com";

/**
 * Paddle checkout (Apple Pay, Google Pay, PayPal, cards). Used when all of these are set;
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
