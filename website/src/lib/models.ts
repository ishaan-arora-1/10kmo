export type Plan = "free" | "yearly" | "weekly";
export type PlanSource = "apple" | "stripe" | null;
export type ClaimStatus = "To file" | "Filed" | "Approved" | "Rejected" | "Paid";
export type SettlementStatus = "draft" | "verified" | "closed";

export const CATEGORIES = [
  "All",
  "Social",
  "Phone",
  "Shopping",
  "Delivery",
  "Food",
  "Entertainment",
  "Finance",
  "Tech",
  "Travel",
  "Health",
  "Auto",
] as const;
export type Category = (typeof CATEGORIES)[number];

export interface Brand {
  id: string;
  name: string;
  category: string;
  aliases: string[];
  monogramColor: string;
}

export interface Settlement {
  id: string;
  title: string;
  company: string;
  brandId: string;
  eligibleStateCodes: string[];
  payoutMin: number;
  payoutMax: number;
  /** Calendar day, YYYY-MM-DD. */
  deadline: string;
  proofRequired: boolean;
  qualifiesSummary: string;
  eligibilityDetails: string[];
  claimUrl: string;
  expectedPayoutDate: string;
  status: SettlementStatus;
  isSample: boolean;
}

export interface Claim {
  id: string;
  settlementId: string;
  status: ClaimStatus;
  claimRef: string | null;
  filedAt: string | null;
  paidAmount: number | null;
  paidAt: string | null;
  modifiedAt: string | null;
}

type Row = Record<string, unknown>;

export function brandFromRow(row: Row): Brand {
  return {
    id: String(row.id),
    name: String(row.name),
    category: String(row.category),
    aliases: (row.aliases as string[] | null) ?? [],
    monogramColor: String(row.monogram_color),
  };
}

export function settlementFromRow(row: Row): Settlement {
  return {
    id: String(row.id),
    title: String(row.title),
    company: String(row.company),
    brandId: String(row.brand_id),
    eligibleStateCodes: (row.eligible_state_codes as string[] | null) ?? [],
    payoutMin: Number(row.payout_min),
    payoutMax: Number(row.payout_max),
    deadline: String(row.deadline),
    proofRequired: Boolean(row.proof_required),
    qualifiesSummary: String(row.qualifies_summary),
    eligibilityDetails: (row.eligibility_details as string[] | null) ?? [],
    claimUrl: String(row.claim_url),
    expectedPayoutDate: String(row.expected_payout_date),
    status: row.status as SettlementStatus,
    isSample: Boolean(row.is_sample),
  };
}

export function claimFromRow(row: Row): Claim {
  return {
    id: String(row.id),
    settlementId: String(row.settlement_id),
    status: row.status as ClaimStatus,
    claimRef: (row.claim_ref as string | null) ?? null,
    filedAt: (row.filed_at as string | null) ?? null,
    paidAmount: row.paid_amount == null ? null : Number(row.paid_amount),
    paidAt: (row.paid_at as string | null) ?? null,
    modifiedAt: (row.updated_at as string | null) ?? null,
  };
}

export function claimToRow(claim: Claim, userId: string) {
  return {
    id: claim.id,
    user_id: userId,
    settlement_id: claim.settlementId,
    status: claim.status,
    claim_ref: claim.claimRef,
    filed_at: claim.filedAt,
    paid_amount: claim.paidAmount,
    paid_at: claim.paidAt,
  };
}

export function brandMatchesSearch(brand: Brand, query: string): boolean {
  const q = query.trim().toLowerCase();
  if (!q) return true;
  return (
    brand.name.toLowerCase().includes(q) ||
    brand.aliases.some((alias) => alias.toLowerCase().includes(q))
  );
}

function startOfToday(): Date {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return today;
}

export function parseDay(day: string): Date {
  const [year, month, date] = day.slice(0, 10).split("-").map(Number);
  return new Date(year, month - 1, date);
}

export function daysUntil(day: string): number {
  const diff = parseDay(day).getTime() - startOfToday().getTime();
  return Math.max(0, Math.round(diff / 86_400_000));
}

export function isOpen(settlement: Settlement): boolean {
  return settlement.status !== "closed" && parseDay(settlement.deadline) >= startOfToday();
}

/** State-limited settlements only match once the user has said where they've lived. */
export function matchSettlements(
  settlements: Settlement[],
  brandIds: ReadonlySet<string>,
  stateCodes: ReadonlySet<string>,
): Settlement[] {
  const states = new Set([...stateCodes].map((code) => code.toUpperCase()));
  return settlements
    .filter(
      (settlement) =>
        isOpen(settlement) &&
        brandIds.has(settlement.brandId) &&
        (settlement.eligibleStateCodes.length === 0 ||
          settlement.eligibleStateCodes.some((code) => states.has(code.toUpperCase()))),
    )
    .sort((a, b) => a.deadline.localeCompare(b.deadline));
}

const wholeDollars = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  minimumFractionDigits: 0,
  maximumFractionDigits: 0,
});
const withCents = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

export const usd = (amount: number) => wholeDollars.format(amount);
export const usdCents = (amount: number) => withCents.format(amount);
export const payoutRange = (s: Settlement) => `${usd(s.payoutMin)}–${usd(s.payoutMax)}`;
export const deadlineLabel = (s: Settlement) =>
  parseDay(s.deadline).toLocaleDateString("en-US", { month: "short", day: "numeric" });
export const plural = (count: number, one: string, many: string) => (count === 1 ? one : many);

/** Only same-site paths are allowed as redirect targets. */
export function safeNext(value: string | null): string {
  return value && value.startsWith("/") && !value.startsWith("//") ? value : "/";
}

export const US_STATES: ReadonlyArray<readonly [code: string, name: string]> = [
  ["AL", "Alabama"], ["AK", "Alaska"], ["AZ", "Arizona"], ["AR", "Arkansas"], ["CA", "California"],
  ["CO", "Colorado"], ["CT", "Connecticut"], ["DE", "Delaware"], ["DC", "District of Columbia"],
  ["FL", "Florida"], ["GA", "Georgia"], ["HI", "Hawaii"], ["ID", "Idaho"], ["IL", "Illinois"],
  ["IN", "Indiana"], ["IA", "Iowa"], ["KS", "Kansas"], ["KY", "Kentucky"], ["LA", "Louisiana"],
  ["ME", "Maine"], ["MD", "Maryland"], ["MA", "Massachusetts"], ["MI", "Michigan"], ["MN", "Minnesota"],
  ["MS", "Mississippi"], ["MO", "Missouri"], ["MT", "Montana"], ["NE", "Nebraska"], ["NV", "Nevada"],
  ["NH", "New Hampshire"], ["NJ", "New Jersey"], ["NM", "New Mexico"], ["NY", "New York"],
  ["NC", "North Carolina"], ["ND", "North Dakota"], ["OH", "Ohio"], ["OK", "Oklahoma"], ["OR", "Oregon"],
  ["PA", "Pennsylvania"], ["RI", "Rhode Island"], ["SC", "South Carolina"], ["SD", "South Dakota"],
  ["TN", "Tennessee"], ["TX", "Texas"], ["UT", "Utah"], ["VT", "Vermont"], ["VA", "Virginia"],
  ["WA", "Washington"], ["WV", "West Virginia"], ["WI", "Wisconsin"], ["WY", "Wyoming"],
];
