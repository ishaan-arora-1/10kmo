/** Replaced everywhere by scripts/set-support-email.sh. */
export const SUPPORT_EMAIL = "support@rightful.app";

/** Display prices; they must match the plans created in Razorpay. */
export const PRICE_LABELS = {
  yearly: import.meta.env.VITE_PRICE_YEARLY || "$39.99",
  weekly: import.meta.env.VITE_PRICE_WEEKLY || "$4.99",
} as const;

/** Email reminders need a custom sending domain, so they stay off until one exists. */
export const EMAIL_REMINDERS_ENABLED = import.meta.env.VITE_ENABLE_EMAIL_REMINDERS === "true";
