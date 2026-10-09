/** Same support address as the website (scripts/set-support-email.sh updates both). */
export const SUPPORT_EMAIL = "support@claimrightful.com";

/** The website, for Terms, Privacy, and Support. */
export const WEBSITE_URL = (process.env.EXPO_PUBLIC_WEBSITE_URL || "https://claimrightful.com").replace(/\/$/, "");

/** The plans the website sells; the app sells the same ones through the same Razorpay plans. */
export type WebPlan = "yearly" | "monthly";

/** Display prices; they must match the plans created in Razorpay. */
export const PRICE_LABELS: Record<WebPlan, string> = {
  yearly: process.env.EXPO_PUBLIC_PRICE_YEARLY || "$39.99",
  monthly: process.env.EXPO_PUBLIC_PRICE_MONTHLY || "$4.99",
};

/** The same prices as numbers, for per-month math. */
export const PRICE_VALUES: Record<WebPlan, number> = {
  yearly: Number(PRICE_LABELS.yearly.replace(/[^0-9.]/g, "")),
  monthly: Number(PRICE_LABELS.monthly.replace(/[^0-9.]/g, "")),
};

/** Email reminders need a custom sending domain, so they stay off until one exists. */
export const EMAIL_REMINDERS_ENABLED = process.env.EXPO_PUBLIC_ENABLE_EMAIL_REMINDERS === "true";

export const APP_VERSION = "1.0";
