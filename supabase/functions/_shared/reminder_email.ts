// Claim reminder emails (see migration 20261015150000): one plain-text email per person per day
// with everything due that day. Account emails about the person's own matches, no sales content.

import { claimLink } from "./marketing_email.ts";

export interface ReminderRow {
  user_id: string;
  email: string;
  kind: "deadline" | "opens" | "new" | "payout" | "weekly";
  item: string;
  settlement_id: string;
  company: string;
  title: string;
  qualifies_summary: string | null;
  payout_min: number | string | null;
  payout_max: number | string | null;
  deadline: string;
  days_left: number;
}

export interface ReminderEmail {
  subject: string;
  text: string;
}

const APP = "https://claimrightful.com/app";
// How many claims the weekly list shows before "and N more".
const WEEKLY_SHOWN = 5;

function dayLabel(day: string): string {
  return new Date(`${day}T12:00:00Z`).toLocaleDateString("en-US", { month: "short", day: "numeric", timeZone: "UTC" });
}

/** payout_max 0 means the amount varies; payout_min 0 means "up to". */
function amount(row: ReminderRow): string | null {
  const max = Number(row.payout_max ?? 0);
  const min = Number(row.payout_min ?? 0);
  const dollars = (n: number) => `$${n.toLocaleString("en-US", { maximumFractionDigits: 0 })}`;
  if (max <= 0) return null;
  if (min <= 0 || min === max) return `up to ${dollars(max)}`;
  return `${dollars(min)} to ${dollars(max)}`;
}

function name(row: ReminderRow): string {
  return `${row.company} (${row.title})`;
}

/** Everything for one person, all rows sharing user_id. */
export function renderReminderEmail(rows: ReminderRow[], unsubscribeURL: string): ReminderEmail {
  const of = (kind: ReminderRow["kind"]) => rows.filter((row) => row.kind === kind);
  const deadlines = of("deadline").sort((a, b) => a.days_left - b.days_left);
  const opens = of("opens");
  const added = of("new");
  const payouts = of("payout");
  const mentioned = new Set([...deadlines, ...opens, ...added].map((row) => row.settlement_id));
  const weekly = of("weekly")
    .filter((row) => !mentioned.has(row.settlement_id))
    .sort((a, b) => a.deadline.localeCompare(b.deadline) || a.company.localeCompare(b.company));

  const paragraphs: string[] = ["Hi,"];

  for (const row of deadlines) {
    const when = row.days_left === 1 ? "tomorrow" : `in ${row.days_left} days`;
    const pays = amount(row);
    paragraphs.push(
      `The ${name(row)} settlement closes ${when}, on ${dayLabel(row.deadline)}.` +
        (pays ? ` It pays ${pays}.` : "") +
        ` If you qualify, file here:\n${claimLink(row.settlement_id)}`,
    );
  }
  for (const row of opens) {
    paragraphs.push(
      `Claims for the ${name(row)} settlement are open now, until ${dayLabel(row.deadline)}:\n${claimLink(row.settlement_id)}`,
    );
  }
  for (const row of added) {
    paragraphs.push(
      `New settlement: ${name(row)}. ${row.qualifies_summary ?? ""} Claims close ${dayLabel(row.deadline)}.\n` +
        claimLink(row.settlement_id),
    );
  }
  for (const row of payouts) {
    paragraphs.push(
      `Payments for the ${name(row)} settlement are starting. When yours arrives, mark it paid in the app:\n${APP}/claims`,
    );
  }

  if (weekly.length > 0) {
    const shown = weekly.slice(0, WEEKLY_SHOWN);
    const lines = shown.map((row) => {
      const pays = amount(row);
      return `- ${name(row)}${pays ? `, ${pays}` : ""}. Closes ${dayLabel(row.deadline)}.\n  ${claimLink(row.settlement_id)}`;
    });
    if (weekly.length > shown.length) lines.push(`- And ${weekly.length - shown.length} more in the app: ${APP}`);
    paragraphs.push(
      (paragraphs.length > 1 ? "Your other open claims:" : "Here are the settlements you can still file:") +
        "\n\n" + lines.join("\n\n"),
    );
    paragraphs.push("Each takes about 5 minutes, and there's no need to wait for the deadline.");
  }

  paragraphs.push("Already filed one? Mark it as filed in the app and we'll stop reminding you about it.");
  paragraphs.push("The ClaimRightful team");

  const first = deadlines[0] ?? opens[0] ?? added[0] ?? payouts[0];
  let subject: string;
  if (!first) {
    subject = `${weekly.length} settlement ${weekly.length === 1 ? "claim" : "claims"} you can still file`;
  } else if (first.kind === "deadline") {
    subject = `${first.company} claims close ${first.days_left === 1 ? "tomorrow" : `in ${first.days_left} days`}`;
  } else if (first.kind === "opens") {
    subject = `${first.company} claims are open`;
  } else if (first.kind === "new") {
    subject = `New settlement: ${first.company}`;
  } else {
    subject = `${first.company} settlement payments are starting`;
  }

  const footer = "You're getting these reminders because you have a ClaimRightful account. " +
    `Turn them off: ${unsubscribeURL}\n` +
    "Amounts are the most each settlement pays, from court filings; most people get less. " +
    "ClaimRightful is not a law firm.";

  return { subject, text: paragraphs.join("\n\n") + "\n\n--\n" + footer };
}
