import { importPKCS8, SignJWT } from "npm:jose@6.2.12";
import { withSupabase } from "npm:@supabase/server@1.5.2";
import type { Database, Json } from "../_shared/database.types.ts";

const PAGE_SIZE = 500;
const DELIVERY_CONCURRENCY = 10;
const FILED_STATUS_VALUES = ["Filed", "Approved", "Paid"] as const;
const FILED_STATUSES = new Set<string>(FILED_STATUS_VALUES);
const PAYOUT_STATUSES = new Set<string>(["Filed", "Approved"]);

type Device = {
  id: string;
  user_id: string;
  apns_token: string;
  environment: "sandbox" | "production";
};

type Profile = { user_id: string };
type BrandPick = { user_id: string; brand_id: string };

type Settlement = {
  id: string;
  company: string;
  title: string;
  brand_id: string;
  payout_min: number;
  payout_max: number;
  deadline: string;
  payout_window_start: string | null;
  published_at: string | null;
};

type Claim = {
  id: string;
  user_id: string;
  settlement_id: string;
  status: string;
};

type PendingPush = {
  id: string;
  userID: string;
  type: string;
  title: string;
  body: string;
};

type Delivery = {
  deliveryID: string;
  push: PendingPush;
  device: Device;
  alreadyClaimed: boolean;
};

type Page<T> = { data: T[] | null; error: unknown };

type APNsResult = {
  ok: boolean;
  status: number;
  reason: string;
  invalidToken: boolean;
  retryable: boolean;
};

export default {
  fetch: withSupabase<Database>(
    { auth: "secret:automations" },
    async (request, context) => {
      if (request.method !== "POST") {
        return Response.json({ error: "Method not allowed" }, { status: 405 });
      }

      const today = utcDateString(new Date());
      const publishedSince = new Date(Date.now() - 48 * 60 * 60 * 1000)
        .toISOString();

      let devices: Device[];
      let profiles: Profile[];
      let picks: BrandPick[];
      let settlements: Settlement[];
      let claims: Claim[];

      try {
        [devices, profiles, picks, settlements, claims] = await Promise.all([
          fetchPages<Device>(async (from, to) => {
            const result = await context.supabaseAdmin
              .from("notification_devices")
              .select("id,user_id,apns_token,environment")
              .order("id")
              .range(from, to);
            return {
              data: result.data as Device[] | null,
              error: result.error,
            };
          }),
          fetchPages<Profile>(async (from, to) => {
            const result = await context.supabaseAdmin
              .from("profiles")
              .select("user_id")
              .eq("notifications_enabled", true)
              .order("user_id")
              .range(from, to);
            return {
              data: result.data as Profile[] | null,
              error: result.error,
            };
          }),
          fetchPages<BrandPick>(async (from, to) => {
            const result = await context.supabaseAdmin
              .from("profile_brands")
              .select("user_id,brand_id")
              .order("user_id")
              .order("brand_id")
              .range(from, to);
            return {
              data: result.data as BrandPick[] | null,
              error: result.error,
            };
          }),
          fetchPages<Settlement>(async (from, to) => {
            const result = await context.supabaseAdmin
              .from("settlements")
              .select(
                "id,company,title,brand_id,payout_min,payout_max,deadline,payout_window_start,published_at",
              )
              .eq("status", "verified")
              .eq("is_sample", false)
              .or(`deadline.gte.${today},payout_window_start.eq.${today}`)
              .order("id")
              .range(from, to);
            return {
              data: result.data as Settlement[] | null,
              error: result.error,
            };
          }),
          fetchPages<Claim>(async (from, to) => {
            const result = await context.supabaseAdmin
              .from("claims")
              .select("id,user_id,settlement_id,status")
              .in("status", FILED_STATUS_VALUES)
              .order("id")
              .range(from, to);
            return { data: result.data as Claim[] | null, error: result.error };
          }),
        ]);
      } catch (error) {
        console.error("notification query failed", error);
        return Response.json(
          { error: "Notification data could not be loaded" },
          { status: 500 },
        );
      }

      const devicesByUser = groupRows(devices, (device) => device.user_id);
      const brandsByUser = groupValues(picks, "user_id", "brand_id");
      const filedByUser = groupValues(claims, "user_id", "settlement_id");
      const payoutByUser = groupValues(
        claims.filter((claim) => PAYOUT_STATUSES.has(claim.status)),
        "user_id",
        "settlement_id",
      );
      const pushes: PendingPush[] = [];

      for (const { user_id: userID } of profiles) {
        const brandIDs = brandsByUser.get(userID) ?? new Set<string>();
        const filedIDs = filedByUser.get(userID) ?? new Set<string>();
        const payoutIDs = payoutByUser.get(userID) ?? new Set<string>();
        const brandMatches = settlements.filter((settlement) =>
          brandIDs.has(settlement.brand_id)
        );
        const openMatches = brandMatches.filter((settlement) =>
          settlement.deadline >= today
        );

        for (const settlement of openMatches) {
          const days = daysBetweenUTC(today, settlement.deadline);
          if ((days === 7 || days === 1) && !filedIDs.has(settlement.id)) {
            pushes.push({
              id: `deadline:${userID}:${settlement.id}:${days}`,
              userID,
              type: "deadline",
              title: `${settlement.company} closes ${
                days === 1 ? "tomorrow" : "in 7 days"
              }`,
              body:
                `Estimated $${settlement.payout_min}–$${settlement.payout_max} is still waiting.`,
            });
          }

          if (
            settlement.published_at &&
            settlement.published_at >= publishedSince
          ) {
            pushes.push({
              id: `new-match:${userID}:${settlement.id}`,
              userID,
              type: "new_match",
              title: `New match: ${settlement.company}`,
              body:
                `${settlement.title}, est. $${settlement.payout_min}–$${settlement.payout_max}`,
            });
          }
        }

        for (
          const settlement of brandMatches.filter((candidate) =>
            candidate.payout_window_start === today
          )
        ) {
          if (payoutIDs.has(settlement.id)) {
            pushes.push({
              id: `payout:${userID}:${settlement.id}`,
              userID,
              type: "payout_window",
              title: `${settlement.company} payments are going out`,
              body: "Got yours? Open Rightful to update your claim.",
            });
          }
        }

        if (new Date().getUTCDay() === 0 && openMatches.length > 0) {
          const waiting = openMatches
            .filter((settlement) => !filedIDs.has(settlement.id))
            .reduce(
              (sum, settlement) => sum + Number(settlement.payout_max),
              0,
            );
          pushes.push({
            id: `digest:${userID}:${today}`,
            userID,
            type: "weekly_digest",
            title: `$${Math.round(waiting)} may still be waiting`,
            body: `Review ${openMatches.length} matching ${
              openMatches.length === 1 ? "claim" : "claims"
            } this week.`,
          });
        }
      }

      const { data: retryRows, error: retryError } = await context.supabaseAdmin
        .rpc("claim_pending_notification_deliveries", { p_limit: 500 });
      if (retryError) {
        console.error("pending notification claim failed", retryError);
        return Response.json(
          { error: "Pending notifications could not be claimed" },
          { status: 500 },
        );
      }

      const pendingDeliveries: Delivery[] = (retryRows ?? []).map((row) => {
        const payload = row.delivery_payload as {
          title: string;
          body: string;
        };
        return {
          deliveryID: row.delivery_id,
          push: {
            id: row.delivery_id,
            userID: row.delivery_user_id,
            type: row.delivery_type,
            title: payload.title,
            body: payload.body,
          },
          device: {
            id: row.delivery_device_id,
            user_id: row.delivery_user_id,
            apns_token: row.apns_token,
            environment: row.apns_environment,
          },
          alreadyClaimed: true,
        };
      });
      const newDeliveries: Delivery[] = pushes.flatMap((push) =>
        (devicesByUser.get(push.userID) ?? []).map((device) => ({
          deliveryID: `${push.id}:${device.id}`,
          push,
          device,
          alreadyClaimed: false,
        }))
      );
      const deliveries = [...pendingDeliveries, ...newDeliveries];

      let sent = 0;
      let failed = 0;
      let skipped = 0;

      for (
        let offset = 0;
        offset < deliveries.length;
        offset += DELIVERY_CONCURRENCY
      ) {
        const batch = deliveries.slice(offset, offset + DELIVERY_CONCURRENCY);
        const outcomes = await Promise.all(
          batch.map(async ({ deliveryID, push, device, alreadyClaimed }) => {
            const payload: Json = { title: push.title, body: push.body };
            if (!alreadyClaimed) {
              const { data: claimed, error: claimError } = await context
                .supabaseAdmin.rpc("claim_notification_delivery", {
                  p_id: deliveryID,
                  p_user_id: push.userID,
                  p_device_id: device.id,
                  p_notification_type: push.type,
                  p_payload: payload,
                });

              if (claimError) throw claimError;
              if (!claimed) return "skipped" as const;
            }

            const result = await sendAPNs(device, push);
            const completion = result.ok
              ? "sent"
              : result.retryable
              ? "retry"
              : "failed";

            if (result.invalidToken) {
              const { error } = await context.supabaseAdmin
                .from("notification_devices")
                .delete()
                .eq("id", device.id);
              if (error) console.error("invalid token removal failed", error);
            }

            const { error: completionError } = await context.supabaseAdmin.rpc(
              "complete_notification_delivery",
              { p_id: deliveryID, p_result: completion },
            );
            if (completionError) throw completionError;

            if (!result.ok) {
              console.error(
                "APNs delivery failed",
                result.status,
                result.reason,
              );
            }
            return result.ok ? "sent" as const : "failed" as const;
          }),
        );

        for (const outcome of outcomes) {
          if (outcome === "sent") sent += 1;
          else if (outcome === "failed") failed += 1;
          else skipped += 1;
        }
      }

      return Response.json({ sent, failed, skipped });
    },
  ),
};

async function fetchPages<T>(
  load: (from: number, to: number) => Promise<Page<T>>,
): Promise<T[]> {
  const rows: T[] = [];
  for (let from = 0;; from += PAGE_SIZE) {
    const { data, error } = await load(from, from + PAGE_SIZE - 1);
    if (error) throw error;
    const page = data ?? [];
    rows.push(...page);
    if (page.length < PAGE_SIZE) return rows;
  }
}

async function sendAPNs(
  device: Device,
  push: PendingPush,
): Promise<APNsResult> {
  const token = await providerToken();
  const host = device.environment === "production"
    ? "https://api.push.apple.com"
    : "https://api.sandbox.push.apple.com";

  for (let attempt = 0; attempt < 3; attempt += 1) {
    try {
      const response = await fetch(`${host}/3/device/${device.apns_token}`, {
        method: "POST",
        headers: {
          authorization: `bearer ${token}`,
          "apns-topic": Deno.env.get("APPLE_BUNDLE_ID") ?? "com.rightful.app",
          "apns-push-type": "alert",
          "apns-priority": "10",
          "content-type": "application/json",
        },
        body: JSON.stringify({
          aps: {
            alert: { title: push.title, body: push.body },
            sound: "default",
          },
          rightful: { type: push.type },
        }),
        signal: AbortSignal.timeout(10_000),
      });

      const body = await response.text();
      const reason = parseAPNsReason(body);
      const invalidToken = response.status === 410 ||
        (response.status === 400 &&
          ["BadDeviceToken", "DeviceTokenNotForTopic"].includes(reason));
      const retryable = [429, 500, 503].includes(response.status);

      if (response.ok || !retryable || attempt === 2) {
        return {
          ok: response.ok,
          status: response.status,
          reason,
          invalidToken,
          retryable,
        };
      }
    } catch (error) {
      if (attempt === 2) {
        return {
          ok: false,
          status: 0,
          reason: error instanceof Error ? error.message : "Network error",
          invalidToken: false,
          retryable: true,
        };
      }
    }
    await delay(250 * 2 ** attempt);
  }

  return {
    ok: false,
    status: 0,
    reason: "APNs retry limit reached",
    invalidToken: false,
    retryable: true,
  };
}

function parseAPNsReason(body: string): string {
  try {
    const value = JSON.parse(body) as { reason?: string };
    return value.reason ?? body;
  } catch {
    return body;
  }
}

let cachedProviderToken: { value: string; expiresAt: number } | null = null;

async function providerToken(): Promise<string> {
  if (cachedProviderToken && cachedProviderToken.expiresAt > Date.now()) {
    return cachedProviderToken.value;
  }

  const keyID = requiredEnvironment("APPLE_APNS_KEY_ID");
  const teamID = requiredEnvironment("APPLE_TEAM_ID");
  const privateKey = requiredEnvironment("APPLE_APNS_PRIVATE_KEY").replaceAll(
    "\\n",
    "\n",
  );
  const key = await importPKCS8(privateKey, "ES256");
  const value = await new SignJWT({})
    .setProtectedHeader({ alg: "ES256", kid: keyID })
    .setIssuer(teamID)
    .setIssuedAt()
    .sign(key);

  cachedProviderToken = {
    value,
    expiresAt: Date.now() + 50 * 60 * 1000,
  };
  return value;
}

function requiredEnvironment(name: string): string {
  const value = Deno.env.get(name);
  if (!value) throw new Error(`Missing ${name}`);
  return value;
}

function utcDateString(date: Date): string {
  return date.toISOString().slice(0, 10);
}

function daysBetweenUTC(start: string, end: string): number {
  const startDate = new Date(`${start}T00:00:00Z`);
  const endDate = new Date(`${end}T00:00:00Z`);
  return Math.round((endDate.getTime() - startDate.getTime()) / 86_400_000);
}

function groupRows<T>(
  rows: T[],
  key: (row: T) => string,
): Map<string, T[]> {
  const result = new Map<string, T[]>();
  for (const row of rows) {
    const groupKey = key(row);
    const group = result.get(groupKey) ?? [];
    group.push(row);
    result.set(groupKey, group);
  }
  return result;
}

function groupValues<T extends Record<string, string>>(
  rows: T[],
  key: keyof T,
  value: keyof T,
): Map<string, Set<string>> {
  const result = new Map<string, Set<string>>();
  for (const row of rows) {
    const group = result.get(row[key]) ?? new Set<string>();
    group.add(row[value]);
    result.set(row[key], group);
  }
  return result;
}

function delay(milliseconds: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, milliseconds));
}
