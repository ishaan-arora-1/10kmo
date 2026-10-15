import { withSupabase } from "npm:@supabase/server@1.5.2";
import type { Database } from "../_shared/database.types.ts";
import { timingSafeEqual } from "../_shared/razorpay.ts";
import { unsubscribeToken } from "../_shared/marketing_email.ts";
import { type ReminderRow, renderReminderEmail } from "../_shared/reminder_email.ts";

// Sends the daily claim reminder emails (see migration 20261015150000).
// POST with header x-marketing-key: MARKETING_SECRET and a JSON body:
//   {"mode": "preview"}                  who would get what today; sends nothing
//   {"mode": "test", "to": "a@b.com"}    a few of today's emails to that address only; logs nothing
//   {"mode": "send"}                     the real send; only when REMINDER_EMAILS_ENABLED=true

const secret = Deno.env.get("MARKETING_SECRET") ?? "";
const enabled = Deno.env.get("REMINDER_EMAILS_ENABLED") === "true";
const resendKey = Deno.env.get("RESEND_API_KEY") ?? "";
const from = Deno.env.get("MARKETING_EMAIL_FROM") ?? "ClaimRightful <hello@claimrightful.com>";
const replyTo = Deno.env.get("MARKETING_REPLY_TO") ?? "support@claimrightful.com";
const unsubscribeBase = Deno.env.get("MARKETING_UNSUBSCRIBE_URL") ??
  `${Deno.env.get("SUPABASE_URL") ?? ""}/functions/v1/email-unsubscribe`;
// Resend's batch endpoint takes up to 100 emails per call.
const BATCH_SIZE = 100;
const ZERO_UUID = "00000000-0000-0000-0000-000000000000";

async function unsubscribeURL(userId: string): Promise<string> {
  return `${unsubscribeBase}?u=${userId}&t=${await unsubscribeToken(secret, userId)}`;
}

type Person = { userId: string; email: string; rows: ReminderRow[] };
type Outgoing = { to: string; subject: string; text: string };

function byPerson(rows: ReminderRow[]): Person[] {
  const people = new Map<string, Person>();
  for (const row of rows) {
    const person = people.get(row.user_id) ?? { userId: row.user_id, email: row.email, rows: [] };
    person.rows.push(row);
    people.set(row.user_id, person);
  }
  return [...people.values()];
}

/** Plain text with no unsubscribe header, like the welcome email, so it reads as a note. */
async function sendBatch(items: Outgoing[]): Promise<(string | null)[]> {
  const response = await fetch("https://api.resend.com/emails/batch", {
    method: "POST",
    headers: { authorization: `Bearer ${resendKey}`, "content-type": "application/json" },
    body: JSON.stringify(items.map(({ to, subject, text }) => ({ from, to: [to], reply_to: replyTo, subject, text }))),
    signal: AbortSignal.timeout(30_000),
  });
  const body = await response.json().catch(() => null);
  if (!response.ok) throw new Error(`Resend ${response.status}: ${JSON.stringify(body)}`);
  const ids = (body?.data ?? []) as { id?: string }[];
  return items.map((_, index) => ids[index]?.id ?? null);
}

/** A few people whose emails show each kind of reminder, for previews and tests. */
function samples(people: Person[]): Person[] {
  const picked: Person[] = [];
  for (const kind of ["deadline", "opens", "new", "payout"] as const) {
    const person = people.find((p) => p.rows.some((row) => row.kind === kind) && !picked.includes(p));
    if (person) picked.push(person);
  }
  const weeklyOnly = people.find((p) => p.rows.every((row) => row.kind === "weekly"));
  if (weeklyOnly) picked.push(weeklyOnly);
  return picked;
}

export default {
  fetch: withSupabase<Database>({ auth: "none" }, async (request, context) => {
    if (request.method !== "POST") {
      return Response.json({ error: "Method not allowed" }, { status: 405 });
    }
    if (!secret || !timingSafeEqual(request.headers.get("x-marketing-key") ?? "", secret)) {
      return Response.json({ error: "Not allowed" }, { status: 401 });
    }

    let options: { mode?: string; to?: string; today?: string };
    try {
      options = await request.json();
    } catch {
      return Response.json({ error: "Invalid body" }, { status: 400 });
    }
    const mode = options.mode ?? "preview";
    // Previews may look at another day ("2026-10-22"); sends always use today.
    const today = mode !== "send" && /^\d{4}-\d{2}-\d{2}$/.test(options.today ?? "") ? options.today : undefined;

    const admin = context.supabaseAdmin;
    const { data, error } = await admin.rpc("reminder_email_batch", today ? { p_today: today } : {});
    if (error) {
      console.error("reminder batch failed", error);
      return Response.json({ error: "Batch failed" }, { status: 500 });
    }
    const people = byPerson((data ?? []) as ReminderRow[]);

    if (mode === "preview") {
      const kinds: Record<string, number> = {};
      for (const person of people) {
        for (const kind of new Set(person.rows.map((row) => row.kind))) kinds[kind] = (kinds[kind] ?? 0) + 1;
      }
      const examples = [];
      for (const person of samples(people)) {
        examples.push(renderReminderEmail(person.rows, await unsubscribeURL(person.userId)));
      }
      return Response.json({ people: people.length, people_by_kind: kinds, examples });
    }

    if (!resendKey) return Response.json({ error: "RESEND_API_KEY is not set" }, { status: 503 });

    if (mode === "test") {
      const to = (options.to ?? "").trim();
      if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(to)) {
        return Response.json({ error: "Give a test address in \"to\"" }, { status: 400 });
      }
      // Test copies carry the tester's own unsubscribe link, never a customer's.
      const { data: testerId } = await admin.rpc("user_id_for_email", { p_email: to });
      const testUnsubscribe = await unsubscribeURL((testerId as string | null) ?? ZERO_UUID);
      const items = samples(people).map((person) => {
        const email = renderReminderEmail(person.rows, testUnsubscribe);
        return { to, subject: `[TEST] ${email.subject}`, text: email.text };
      });
      const ids = items.length ? await sendBatch(items) : [];
      return Response.json({ sent_to: to, emails: items.map((item, i) => ({ subject: item.subject, id: ids[i] })) });
    }

    if (mode === "send") {
      if (!enabled) return Response.json({ error: "Sending is off (REMINDER_EMAILS_ENABLED)" }, { status: 503 });
      let sent = 0;
      let failed = 0;
      for (let start = 0; start < people.length; start += BATCH_SIZE) {
        const chunk = people.slice(start, start + BATCH_SIZE);
        const items: Outgoing[] = [];
        for (const person of chunk) {
          const email = renderReminderEmail(person.rows, await unsubscribeURL(person.userId));
          items.push({ to: person.email, ...email });
        }
        try {
          const ids = await sendBatch(items);
          const log = { p_user_ids: [] as string[], p_items: [] as string[], p_emails: [] as string[], p_resend_ids: [] as string[] };
          for (const [index, person] of chunk.entries()) {
            for (const item of new Set(person.rows.map((row) => row.item))) {
              log.p_user_ids.push(person.userId);
              log.p_items.push(item);
              log.p_emails.push(person.email);
              log.p_resend_ids.push(ids[index] ?? "");
            }
          }
          const { error: logError } = await admin.rpc("log_reminder_emails", log);
          if (logError) console.error("reminder log failed", logError);
          sent += chunk.length;
        } catch (sendError) {
          console.error("reminder batch send failed", sendError);
          failed += chunk.length;
        }
      }
      console.log("reminder emails", { sent, failed });
      return Response.json({ sent, failed });
    }

    return Response.json({ error: "Unknown mode" }, { status: 400 });
  }),
};
