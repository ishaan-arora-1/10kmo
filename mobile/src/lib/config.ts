/**
 * "First claim free": free accounts could file one claim without paying (website, 2026-10-07 to 10-09).
 * Off, as on the website: filing is locked until they subscribe. Claims they already started stay unlocked.
 */
export const FIRST_CLAIM_FREE = false;

/** Same support address as the website (scripts/set-support-email.sh updates both). */
export const SUPPORT_EMAIL = "support@claimrightful.com";

/** The website, for Terms, Privacy, and Support. */
export const WEBSITE_URL = (process.env.EXPO_PUBLIC_WEBSITE_URL || "https://claimrightful.com").replace(/\/$/, "");

/** The plans the website sells; the app sells the same ones through the same Razorpay plans. */
export type WebPlan = "yearly" | "monthly";

/**
 * App Store subscriptions (one subscription group in App Store Connect). The verify-purchase and
 * app-store-notifications functions map these IDs to plans; keep the three in sync.
 */
export const APPLE_PRODUCT_IDS: Record<WebPlan, string> = {
  monthly: "com.claimrightful.app.monthly",
  yearly: "com.claimrightful.app.yearly",
};

/**
 * Fallback display prices (Android/Razorpay, and iPhone before the App Store answers).
 * On iPhone the paywall shows the App Store's own localized prices.
 */
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

/**
 * App Review can't receive sign-in codes, so this one address signs in with a password instead.
 * Create the account in Supabase (Authentication → Users → Add user, with a password) and give
 * the address and password to Apple in App Store Connect → App Review Information.
 */
export const REVIEW_EMAIL = (process.env.EXPO_PUBLIC_REVIEW_EMAIL || "").trim().toLowerCase();
