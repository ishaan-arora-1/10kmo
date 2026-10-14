// The "this settlement is open" email: one settlement, one link, plain text styling
// (plain notes have reached Gmail's Primary tab; designed ones land in Promotions).

import { hmacSHA256Hex, timingSafeEqual } from "./razorpay.ts";

const SITE = "https://claimrightful.com";

export interface MarketingRow {
  user_id: string;
  email: string;
  settlement_id: string;
  company: string;
  title: string;
  qualifies_summary: string | null;
  payout_max: number | string | null;
  proof_required: boolean | null;
  deadline: string;
}

export interface MarketingEmail {
  subject: string;
  html: string;
  text: string;
}

// How each settlement reads in a sentence ("the ... settlement").
const NAMES: Record<string, string> = {
  "Apple": "Apple iPhone",
  "Pork producers": "pork price-fixing",
  "Visa & Mastercard": "Visa & Mastercard ATM fee",
  "CVS": "CVS website privacy",
};

export function settlementName(company: string): string {
  return NAMES[company] ?? company;
}

export function claimLink(settlementId: string): string {
  // Signed in: straight to the claim. Signed out: sign in, then the claim.
  return `${SITE}/app/sign-in?next=${encodeURIComponent(`/settlements/${settlementId}`)}`;
}

export function unsubscribeToken(secret: string, userId: string): Promise<string> {
  return hmacSHA256Hex(secret, `unsubscribe:${userId}`);
}

export async function validUnsubscribeToken(secret: string, userId: string, token: string): Promise<boolean> {
  return secret !== "" && token !== "" && timingSafeEqual(await unsubscribeToken(secret, userId), token);
}

function escapeHTML(value: string): string {
  return value.replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;");
}

function dayLabel(day: string): string {
  return new Date(`${day}T12:00:00Z`).toLocaleDateString("en-US", { month: "short", day: "numeric", timeZone: "UTC" });
}

export function renderMarketingEmail(
  row: MarketingRow,
  unsubscribeURL: string,
  postalAddress: string,
): MarketingEmail {
  const name = settlementName(row.company);
  const max = Number(row.payout_max ?? 0);
  const amount = max > 0 ? `$${max.toLocaleString("en-US", { maximumFractionDigits: 0 })}` : null;
  const link = claimLink(row.settlement_id);

  const capitalized = name.charAt(0).toUpperCase() + name.slice(1);
  const subject = amount ? `${capitalized} settlement is paying up to ${amount}` : `The ${name} settlement is paying out`;
  const opener = [
    amount ? `The ${name} settlement is paying out up to ${amount} per person.` : `The ${name} settlement is paying out.`,
    row.proof_required === false ? "No receipts needed." : "",
  ].filter(Boolean).join(" ");

  // [html, text] for each paragraph.
  const paragraphs: [string, string][] = [
    ["Hi,", "Hi,"],
    [escapeHTML(opener), opener],
    [`Claims close <b>${dayLabel(row.deadline)}</b>.`, `Claims close ${dayLabel(row.deadline)}.`],
    [
      `File yours here (about 5 minutes): <a href="${link}">${escapeHTML(name)} claim</a>`,
      `File yours here (about 5 minutes): ${link}`,
    ],
    ["The ClaimRightful team", "The ClaimRightful team"],
  ];

  const footerText = `You're getting this because you have a ClaimRightful account. Unsubscribe: ${unsubscribeURL}\n` +
    `ClaimRightful, ${postalAddress}. Amounts are the most the settlement pays, from court filings; most people ` +
    "get less. ClaimRightful is not a law firm.";
  const footerHTML = `<p style="margin-top:28px;font-size:12px;color:#777;line-height:1.5">You're getting this ` +
    `because you have a ClaimRightful account. <a href="${unsubscribeURL}" style="color:#777">Unsubscribe</a>.<br>` +
    `ClaimRightful, ${escapeHTML(postalAddress)}. Amounts are the most the settlement pays, from court filings; ` +
    "most people get less. ClaimRightful is not a law firm.</p>";

  const html = '<div style="font-family:Arial,sans-serif;font-size:15px;color:#222;max-width:560px">' +
    paragraphs.map(([p]) => `<p style="margin:0 0 14px;line-height:1.5">${p}</p>`).join("") + footerHTML + "</div>";
  const text = paragraphs.map(([, t]) => t).join("\n\n") + "\n\n" + footerText;
  return { subject, html, text };
}
