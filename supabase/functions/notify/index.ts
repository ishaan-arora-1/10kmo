import { importPKCS8, SignJWT } from "npm:jose@6.2.12";
import { withSupabase } from "npm:@supabase/server@1.5.2";
import type { Database } from "../_shared/database.types.ts";

type Device = {
  user_id: string;
  apns_token: string;
  environment: "sandbox" | "production";
};

type BrandPick = {
  user_id: string;
  brand_id: string;
};

type Settlement = {
  id: string;
  company: string;
  title: string;
  brand_id: string;
  payout_min: number;
  payout_max: number;
  deadline: string;
  payout_window_start: string | null;
  created_at: string;
};

type Claim = {
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

export default {
  fetch: withSupabase<Database>(
    { auth: "secret:automations" },
    async (request, context) => {
      if (request.method !== "POST") {
        return Response.json({ error: "Method not allowed" }, { status: 405 });
      }

      const today = utcDateString(new Date());
      const yesterday = new Date(Date.now() - 24 * 60 * 60 * 1000)
        .toISOString();

      const [
        devicesResult,
        profilesResult,
        picksResult,
        settlementsResult,
        claimsResult,
      ] = await Promise.all([
        context.supabaseAdmin.from("notification_devices").select(
          "user_id,apns_token,environment",
        ),
        context.supabaseAdmin.from("profiles").select("user_id").eq(
          "notifications_enabled",
          true,
        ),
        context.supabaseAdmin.from("profile_brands").select("user_id,brand_id"),
        context.supabaseAdmin.from("settlements").select(
          "id,company,title,brand_id,payout_min,payout_max,deadline,payout_window_start,created_at",
        ).eq("status", "verified").eq("is_sample", false).gte(
          "deadline",
          today,
        ),
        context.supabaseAdmin.from("claims").select(
          "user_id,settlement_id,status",
        ),
      ]);

      const firstError = [
        devicesResult.error,
        profilesResult.error,
        picksResult.error,
        settlementsResult.error,
        claimsResult.error,
      ].find(Boolean);
      if (firstError) {
        console.error("notification query failed", firstError);
        return Response.json(
          { error: "Notification data could not be loaded" },
          { status: 500 },
        );
      }

      const enabledUsers = new Set(
        (profilesResult.data ?? []).map((profile) => profile.user_id),
      );
      const devices = (devicesResult.data ?? []) as Device[];
      const picks = (picksResult.data ?? []) as BrandPick[];
      const settlements = (settlementsResult.data ?? []) as Settlement[];
      const claims = (claimsResult.data ?? []) as Claim[];

      const brandsByUser = groupValues(picks, "user_id", "brand_id");
      const filedByUser = groupValues(claims, "user_id", "settlement_id");
      const pushes: PendingPush[] = [];

      for (const userID of enabledUsers) {
        const brandIDs = brandsByUser.get(userID) ?? new Set<string>();
        const filedIDs = filedByUser.get(userID) ?? new Set<string>();
        const matches = settlements.filter((settlement) =>
          brandIDs.has(settlement.brand_id)
        );

        for (const settlement of matches) {
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

          if (settlement.created_at >= yesterday) {
            pushes.push({
              id: `new-match:${userID}:${settlement.id}`,
              userID,
              type: "new_match",
              title: `New match: ${settlement.company}`,
              body:
                `${settlement.title}, est. $${settlement.payout_min}–$${settlement.payout_max}`,
            });
          }

          if (
            settlement.payout_window_start === today &&
            filedIDs.has(settlement.id)
          ) {
            pushes.push({
              id: `payout:${userID}:${settlement.id}`,
              userID,
              type: "payout_window",
              title: `${settlement.company} payments are going out`,
              body: "Got yours? Open Rightful to update your claim.",
            });
          }
        }

        if (new Date().getUTCDay() === 0 && matches.length > 0) {
          const waiting = matches
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
            body: `Review ${matches.length} matching ${
              matches.length === 1 ? "claim" : "claims"
            } this week.`,
          });
        }
      }

      if (pushes.length === 0) {
        return Response.json({ sent: 0, skipped: 0 });
      }

      const { data: alreadySent } = await context.supabaseAdmin
        .rpc("existing_notification_ids", {
          p_ids: pushes.map((push) => push.id),
        });
      const sentIDs = new Set((alreadySent ?? []).map((row) => row.id));

      let sent = 0;
      let failed = 0;
      for (const push of pushes) {
        if (sentIDs.has(push.id)) continue;

        const userDevices = devices.filter((device) =>
          device.user_id === push.userID
        );
        let delivered = false;
        for (const device of userDevices) {
          const response = await sendAPNs(device, push);
          delivered ||= response.ok;
          if (!response.ok) {
            failed += 1;
            console.error(
              "APNs delivery failed",
              response.status,
              await response.text(),
            );
          }
        }

        if (delivered) {
          sent += 1;
          await context.supabaseAdmin
            .rpc("record_notification_sent", {
              p_id: push.id,
              p_user_id: push.userID,
              p_notification_type: push.type,
              p_payload: { title: push.title, body: push.body },
            });
        }
      }

      return Response.json({ sent, failed, skipped: sentIDs.size });
    },
  ),
};

async function sendAPNs(device: Device, push: PendingPush): Promise<Response> {
  const token = await providerToken();
  const host = device.environment === "production"
    ? "https://api.push.apple.com"
    : "https://api.sandbox.push.apple.com";

  return fetch(`${host}/3/device/${device.apns_token}`, {
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
  });
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
