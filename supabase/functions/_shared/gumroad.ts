// Minimal Gumroad client: the two API reads we use to confirm a ping before trusting it.
// Gumroad pings carry no signature, so every sale and membership is re-read from the API.

const apiBase = "https://api.gumroad.com/v2";
const accessToken = Deno.env.get("GUMROAD_ACCESS_TOKEN") ?? "";
export const gumroadSellerId = Deno.env.get("GUMROAD_SELLER_ID") ?? "";
export const gumroadConfigured = accessToken !== "";

/** A sale as GET /v2/sales/:id returns it (fields we use). */
export interface GumroadSale {
  id: string;
  email?: string | null;
  product_id?: string | null;
  created_at?: string | null;
  refunded?: boolean;
  chargedback?: boolean;
  subscription_id?: string | null;
}

/** A membership as GET /v2/subscribers/:id returns it (fields we use). */
export interface GumroadSubscriber {
  id: string;
  product_id?: string | null;
  user_email?: string | null;
  status?: string | null;
  recurrence?: string | null;
  created_at?: string | null;
}

/** Null when Gumroad says the record doesn't exist (a forged or test ping); throws on outages. */
async function read<T>(path: string, key: string): Promise<T | null> {
  const response = await fetch(`${apiBase}${path}?access_token=${encodeURIComponent(accessToken)}`);
  if (response.status === 404) return null;
  const body = await response.json().catch(() => null);
  if (!response.ok) {
    if (body && body.success === false) return null;
    throw new Error(`Gumroad ${path} answered ${response.status}`);
  }
  return (body?.success ? body[key] : null) as T | null;
}

export const getSale = (id: string) => read<GumroadSale>(`/sales/${encodeURIComponent(id)}`, "sale");
export const getSubscriber = (id: string) =>
  read<GumroadSubscriber>(`/subscribers/${encodeURIComponent(id)}`, "subscriber");

/** Statuses that still give access: paid up, canceled but not yet ended, or retrying a card. */
export const ACTIVE_STATUSES = new Set(["alive", "pending_cancellation", "pending_failure"]);

export function planForRecurrence(recurrence: string | null | undefined): "monthly" | "yearly" | null {
  if (recurrence === "monthly") return "monthly";
  if (recurrence === "yearly") return "yearly";
  return null;
}

const GRACE_DAYS = 3;

/** End of the period a payment made at `paidAt` covers, plus a few days for renewal pings to land. */
export function periodEnd(paidAt: string | null | undefined, plan: "monthly" | "yearly"): string {
  const end = paidAt ? new Date(paidAt) : new Date();
  if (Number.isNaN(end.getTime())) end.setTime(Date.now());
  if (plan === "yearly") end.setUTCFullYear(end.getUTCFullYear() + 1);
  else end.setUTCMonth(end.getUTCMonth() + 1);
  end.setUTCDate(end.getUTCDate() + GRACE_DAYS);
  return end.toISOString();
}
