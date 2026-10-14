import { withSupabase } from "npm:@supabase/server@1.5.2";
import type { Database } from "../_shared/database.types.ts";
import { timingSafeEqual } from "../_shared/razorpay.ts";
import { type MarketingRow, renderMarketingEmail, unsubscribeToken } from "../_shared/marketing_email.ts";

// Sends the weekly "this settlement is open" emails (see migration 20261015100000).
// POST with header x-marketing-key: MARKETING_SECRET and a JSON body:
//   {"mode": "preview"}                  who would get what next; sends nothing
//   {"mode": "test", "to": "a@b.com"}    one of each version to that address only; logs nothing
//   {"mode": "send", "limit": 100}       the real send; only when MARKETING_EMAILS_ENABLED=true

const secret = Deno.env.get("MARKETING_SECRET") ?? "";
const enabled = Deno.env.get("MARKETING_EMAILS_ENABLED") === "true";
const postalAddress = Deno.env.get("MARKETING_POSTAL_ADDRESS") ?? "";
const resendKey = Deno.env.get("RESEND_API_KEY") ?? "";
const from = Deno.env.get("MARKETING_EMAIL_FROM") ?? "ClaimRightful <hello@claimrightful.com>";
const replyTo = Deno.env.get("MARKETING_REPLY_TO") ?? "support@claimrightful.com";
const unsubscribeBase = Deno.env.get("MARKETING_UNSUBSCRIBE_URL") ??
  `${Deno.env.get("SUPABASE_URL") ?? ""}/functions/v1/email-unsubscribe`;
// Resend's batch endpoint takes up to 100 emails per call.
const BATCH_SIZE = 100;

async function unsubscribeURL(userId: string): Promise<string> {
  const token = await unsubscribeToken(secret, userId);
  return `${unsubscribeBase}?u=${userId}&t=${token}`;
}

type Outgoing = { row: MarketingRow; to: string; unsubscribe: string };

async function sendBatch(items: Outgoing[]): Promise<(string | null)[]> {
  const response = await fetch("https://api.resend.com/emails/batch", {
    method: "POST",
    headers: { authorization: `Bearer ${resendKey}`, "content-type": "application/json" },
    body: JSON.stringify(items.map(({ row, to, unsubscribe }) => {
      const email = renderMarketingEmail(row, unsubscribe, postalAddress || "[postal address]");
      return {
        from,
        to: [to],
        reply_to: replyTo,
        subject: email.subject,
        html: email.html,
        text: email.text,
        headers: {
          "List-Unsubscribe": `<${unsubscribe}>`,
          "List-Unsubscribe-Post": "List-Unsubscribe=One-Click",
        },
      };
    })),
    signal: AbortSignal.timeout(30_000),
  });
  const body = await response.json().catch(() => null);
  if (!response.ok) throw new Error(`Resend ${response.status}: ${JSON.stringify(body)}`);
  const ids = (body?.data ?? []) as { id?: string }[];
  return items.map((_, index) => ids[index]?.id ?? null);
}

export default {
  fetch: withSupabase<Database>({ auth: "none" }, async (request, context) => {
    if (request.method !== "POST") {
      return Response.json({ error: "Method not allowed" }, { status: 405 });
    }
    if (!secret || !timingSafeEqual(request.headers.get("x-marketing-key") ?? "", secret)) {
      return Response.json({ error: "Not allowed" }, { status: 401 });
    }

    let options: { mode?: string; to?: string; limit?: number };
    try {
      options = await request.json();
    } catch {
      return Response.json({ error: "Invalid body" }, { status: 400 });
    }
    const mode = options.mode ?? "preview";
    const limit = Math.min(Math.max(Number(options.limit ?? 100), 1), 500);

    const admin = context.supabaseAdmin;
    const { data, error } = await admin.rpc("marketing_email_batch", { p_limit: mode === "send" ? limit : 500 });
    if (error) {
      console.error("marketing batch failed", error);
      return Response.json({ error: "Batch failed" }, { status: 500 });
    }
    const rows = (data ?? []) as MarketingRow[];

    if (mode === "preview") {
      const bySettlement = new Map<string, { count: number; email: ReturnType<typeof renderMarketingEmail> }>();
      for (const row of rows) {
        const entry = bySettlement.get(row.company);
        if (entry) entry.count += 1;
        else {
          bySettlement.set(row.company, {
            count: 1,
            email: renderMarketingEmail(row, await unsubscribeURL(row.user_id), postalAddress || "[postal address]"),
          });
        }
      }
      return Response.json({
        people: rows.length,
        versions: [...bySettlement.entries()].map(([company, { count, email }]) => ({
          company,
          people: count,
          subject: email.subject,
          text: email.text,
        })),
      });
    }

    if (!resendKey) return Response.json({ error: "RESEND_API_KEY is not set" }, { status: 503 });

    if (mode === "test") {
      const to = (options.to ?? "").trim();
      if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(to)) {
        return Response.json({ error: "Give a test address in \"to\"" }, { status: 400 });
      }
      // Test copies carry the tester's own unsubscribe link, never a customer's.
      const { data: testerId } = await admin.rpc("user_id_for_email", { p_email: to });
      const testUnsubscribe = await unsubscribeURL((testerId as string | null) ?? "00000000-0000-0000-0000-000000000000");
      const seen = new Set<string>();
      const items: Outgoing[] = [];
      for (const row of rows) {
        if (seen.has(row.company)) continue;
        seen.add(row.company);
        items.push({ row, to, unsubscribe: testUnsubscribe });
      }
      const ids = items.length ? await sendBatch(items) : [];
      return Response.json({ sent_to: to, versions: items.map((item, i) => ({ company: item.row.company, id: ids[i] })) });
    }

    if (mode === "send") {
      if (!enabled) return Response.json({ error: "Sending is off (MARKETING_EMAILS_ENABLED)" }, { status: 503 });
      if (!postalAddress) return Response.json({ error: "MARKETING_POSTAL_ADDRESS is not set" }, { status: 503 });
      let sent = 0;
      let failed = 0;
      for (let start = 0; start < rows.length; start += BATCH_SIZE) {
        const chunk = rows.slice(start, start + BATCH_SIZE);
        const items: Outgoing[] = [];
        for (const row of chunk) items.push({ row, to: row.email, unsubscribe: await unsubscribeURL(row.user_id) });
        try {
          const ids = await sendBatch(items);
          for (const [index, row] of chunk.entries()) {
            const { error: logError } = await admin.rpc("log_marketing_email", {
              p_user_id: row.user_id,
              p_settlement_id: row.settlement_id,
              p_email: row.email,
              p_resend_id: ids[index] ?? "",
            });
            if (logError) console.error("marketing log failed", row.user_id, logError);
          }
          sent += chunk.length;
        } catch (sendError) {
          console.error("marketing batch send failed", sendError);
          failed += chunk.length;
        }
      }
      console.log("marketing emails", { sent, failed });
      return Response.json({ sent, failed });
    }

    return Response.json({ error: "Unknown mode" }, { status: 400 });
  }),
};
