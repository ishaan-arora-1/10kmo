/** Replaced everywhere by scripts/set-support-email.sh. */
/**
 * "First claim free": free accounts could file one claim without paying (2026-10-07 to 10-09).
 * Off: filing is locked until they subscribe. Claims they already started stay unlocked.
 */
export const FIRST_CLAIM_FREE = false;

export const SUPPORT_EMAIL = "support@claimrightful.com";

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
