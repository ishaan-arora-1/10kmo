export type Plan = "free" | "yearly" | "monthly" | "weekly";
export type PlanSource = "apple" | "razorpay" | "grant" | null;
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
  /** What an ordinary claimant gets; payoutMax is often a documented-losses cap. */
  payoutTypical: number | null;
  /** Calendar day, YYYY-MM-DD. */
  deadline: string;
  /** Claims can't be filed before this day; null once a settlement is open. */
  opensOn: string | null;
  /** Shown to everyone, whatever companies they picked. */
  isFeatured: boolean;
  /** Listed first and highlighted on the dashboard. */
  isSpotlight: boolean;
  proofRequired: boolean;
  qualifiesSummary: string;
  eligibilityDetails: string[];
  claimUrl: string;
  expectedPayoutDate: string;
  status: SettlementStatus;
  isSample: boolean;
}

/** A settlement that closed or paid out recently. History only, never claimable. */
export interface RecentPayout {
  id: string;
  brandId: string;
  company: string;
  title: string;
  amountMin: number;
  amountMax: number;
  amountNote: string;
  event: "claims_closed" | "paid";
  /** Calendar day, YYYY-MM-DD. */
  eventOn: string;
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
    payoutTypical: row.payout_typical == null ? null : Number(row.payout_typical),
    deadline: String(row.deadline),
    opensOn: (row.opens_on as string | null) ?? null,
    isFeatured: Boolean(row.is_featured),
    isSpotlight: Boolean(row.is_spotlight),
    proofRequired: Boolean(row.proof_required),
    qualifiesSummary: String(row.qualifies_summary),
    eligibilityDetails: (row.eligibility_details as string[] | null) ?? [],
    claimUrl: String(row.claim_url),
    expectedPayoutDate: String(row.expected_payout_date),
    status: row.status as SettlementStatus,
    isSample: Boolean(row.is_sample),
  };
}

export function recentPayoutFromRow(row: Row): RecentPayout {
  return {
    id: String(row.id),
    brandId: String(row.brand_id),
    company: String(row.company),
    title: String(row.title),
    amountMin: Number(row.amount_min),
    amountMax: Number(row.amount_max),
    amountNote: String(row.amount_note),
    event: row.event as RecentPayout["event"],
    eventOn: String(row.event_on),
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

/** Always the first tiles in the picker, in this order, ahead of the popular/open-claim mix. */
const PINNED_BRAND_NAMES = ["Netflix", "PayPal", "Gmail", "Hyundai", "Kia"];
/** Shown right after the first ten tiles, in this order. */
const AFTER_TOP_TEN_BRAND_NAMES = ["Equifax", "Six Flags"];
const pinnedRank = new Map(PINNED_BRAND_NAMES.map((name, index) => [name.toLowerCase(), index]));
const afterTopTenRank = new Map(AFTER_TOP_TEN_BRAND_NAMES.map((name, index) => [name.toLowerCase(), index]));

/** Household names people recognize at a glance; shown first in the picker, in this order. */
const POPULAR_BRAND_NAMES = [
  "Instagram", "TikTok", "Facebook", "YouTube", "Snapchat", "WhatsApp", "X", "Reddit",
  "Amazon", "Google", "Apple", "Netflix", "Spotify", "Uber", "DoorDash", "Walmart",
  "Target", "Venmo", "Cash App", "PayPal", "T-Mobile", "Verizon", "AT&T", "Disney+",
  "Starbucks", "McDonald's", "Microsoft", "Lyft", "Hulu", "Pinterest",
];
const popularRank = new Map(POPULAR_BRAND_NAMES.map((name, index) => [name.toLowerCase(), index]));

/** Order of the mix at the top of the picker: P = popular brand, C = company with an open claim. */
const PICKER_PATTERN = ["P", "P", "C", "C", "P", "C"] as const;

/**
 * Pinned brands first, then popular brands mixed with open-claim companies (two popular, two claims,
 * one popular, one claim, repeat), then everything else A–Z. Open-claim companies are ordered by their best payout.
 * AFTER_TOP_TEN_BRAND_NAMES are slotted in right after the first ten tiles.
 */
export function sortBrandsForPicker(
  brands: Brand[],
  openBrandIds: ReadonlySet<string>,
  topPayout: (brandId: string) => number = () => 0,
): Brand[] {
  const byName = (a: Brand, b: Brand) => a.name.localeCompare(b.name);
  const pinned = brands
    .filter((brand) => pinnedRank.has(brand.name.toLowerCase()))
    .sort((a, b) => pinnedRank.get(a.name.toLowerCase())! - pinnedRank.get(b.name.toLowerCase())!);
  const afterTopTen = brands
    .filter((brand) => afterTopTenRank.has(brand.name.toLowerCase()))
    .sort((a, b) => afterTopTenRank.get(a.name.toLowerCase())! - afterTopTenRank.get(b.name.toLowerCase())!);
  const others = brands.filter(
    (brand) => !pinnedRank.has(brand.name.toLowerCase()) && !afterTopTenRank.has(brand.name.toLowerCase()),
  );
  const popular = others
    .filter((brand) => popularRank.has(brand.name.toLowerCase()))
    .sort((a, b) => popularRank.get(a.name.toLowerCase())! - popularRank.get(b.name.toLowerCase())!);
  const claims = others
    .filter((brand) => openBrandIds.has(brand.id) && !popularRank.has(brand.name.toLowerCase()))
    .sort((a, b) => topPayout(b.id) - topPayout(a.id) || byName(a, b));
  const rest = others
    .filter((brand) => !popularRank.has(brand.name.toLowerCase()) && !openBrandIds.has(brand.id))
    .sort(byName);

  const mixed: Brand[] = [];
  for (let step = 0; popular.length > 0 || claims.length > 0; step += 1) {
    const wantClaim = PICKER_PATTERN[step % PICKER_PATTERN.length] === "C";
    const next = (wantClaim ? claims : popular).shift() ?? (wantClaim ? popular : claims).shift();
    if (next) mixed.push(next);
  }
  const ordered = [...pinned, ...mixed, ...rest];
  const topTen = Math.max(0, 10 - pinned.length);
  return [...ordered.slice(0, pinned.length + topTen), ...afterTopTen, ...ordered.slice(pinned.length + topTen)];
}

/** Picking one of these also counts as picking the company behind it, for matches and past payouts. */
const COUNTS_AS: Record<string, string> = { gmail: "google" };

export function withParentBrands(brandIds: ReadonlySet<string>, brands: Brand[]): Set<string> {
  const ids = new Set(brandIds);
  for (const brand of brands) {
    const parent = COUNTS_AS[brand.name.toLowerCase()];
    if (!parent || !brandIds.has(brand.id)) continue;
    const parentBrand = brands.find((b) => b.name.toLowerCase() === parent);
    if (parentBrand) ids.add(parentBrand.id);
  }
  return ids;
}

/** A lawsuit that hasn't settled yet: nothing to claim, but members get emailed the day claims open. */
export interface PendingCase {
  brandName: string;
  title: string;
  summary: string;
}

/** Only Netflix for now. No dollar amounts: nothing has been awarded or paid. */
const PENDING_CASES: PendingCase[] = [
  {
    brandName: "Netflix",
    title: "Video privacy case",
    summary:
      "Lawsuits say Netflix shared what subscribers watched without their consent, which federal video privacy law forbids. The cases are still going on and there's no settlement to claim yet.",
  },
];

export function pendingCaseFor(brand: Brand | undefined): PendingCase | undefined {
  return brand && PENDING_CASES.find((c) => c.brandName.toLowerCase() === brand.name.toLowerCase());
}

/**
 * An "up to" figure for a picked company with nothing open, so the total is never blank.
 * Each one is sourced and labeled for what it is: a legal maximum or a past payout, not an open claim.
 */
export interface BrandEstimate {
  brandName: string;
  amount: number;
  label: string;
  note: string;
}

const BRAND_ESTIMATES: BrandEstimate[] = [
  {
    brandName: "Netflix",
    amount: 2500,
    label: "Pending case",
    note: "Federal video privacy law sets damages at $2,500 per violation. The case is still in court.",
  },
  {
    brandName: "PayPal",
    amount: 440,
    label: "Past settlement",
    note: "PayPal’s account-holds settlement paid up to $440 per person. We’ll email you when the next one opens.",
  },
  {
    brandName: "Google",
    amount: 200,
    label: "Recent settlements",
    note: "Google settlements paid up to $200 per person this past year. We’ll email you when the next one opens.",
  },
];

/** Estimates for picked companies (Gmail counts as Google) that have no open settlement among the matches. */
export function brandEstimates(
  brands: Brand[],
  matchBrandIds: ReadonlySet<string>,
  matched: Settlement[],
): { brand: Brand; estimate: BrandEstimate }[] {
  const openBrandIds = new Set(matched.map((settlement) => settlement.brandId));
  return brands
    .filter((brand) => matchBrandIds.has(brand.id) && !openBrandIds.has(brand.id))
    .flatMap((brand) => {
      const estimate = BRAND_ESTIMATES.find((e) => e.brandName.toLowerCase() === brand.name.toLowerCase());
      return estimate ? [{ brand, estimate }] : [];
    });
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

/** Onboarding question 1: everyday situations that are covered by open settlements people rarely think of by name. */
export interface LifeEventOption {
  id: string;
  label: string;
  /** Settlement `company` values this answer adds. */
  companies: string[];
}

export const LIFE_EVENT_OPTIONS: LifeEventOption[] = [
  { id: "car", label: "🚗 I’ve owned a Hyundai, Kia, or Toyota", companies: ["Hyundai", "Kia", "Toyota"] },
  { id: "atm", label: "🏧 I’ve paid a fee at an ATM that wasn’t my bank’s", companies: ["Visa & Mastercard"] },
  { id: "rent", label: "🏠 I’ve rented an apartment since 2018", companies: ["RealPage"] },
  { id: "home", label: "🔑 I’ve bought a home through a real estate agent", companies: ["Real estate brokerages"] },
];

/** Onboarding question 2: popular companies with open claims, offered when they weren't picked. */
export const ALSO_USED_COMPANIES = ["Apple", "CVS", "Kroger", "Lands' End", "Bank of America", "Toyota"];

/** Onboarding question 3: documents that matter for specific matches. Answers only change the encouragement. */
export interface ProofOption {
  id: string;
  label: string;
  feedback: string;
  appliesTo: (settlement: Settlement) => boolean;
}

const isCompany = (settlement: Settlement, ...companies: string[]) => companies.includes(settlement.company);

export const PROOF_OPTIONS: ProofOption[] = [
  {
    id: "kia-window",
    label: "🧾 A repair bill for your Kia’s power windows",
    feedback: "Your Kia window claim can go from a $40 service card to up to $400 with that bill.",
    appliesTo: (s) => isCompany(s, "Kia") && s.title === "Window regulators",
  },
  {
    id: "car-theft",
    label: "🚓 Proof your Hyundai or Kia was stolen or broken into, like a police report or insurance claim",
    feedback: "That’s what the car theft payout needs: up to $4,500 for a total loss.",
    appliesTo: (s) => isCompany(s, "Hyundai", "Kia") && s.title === "Car theft (no immobilizer)",
  },
  {
    id: "airbag",
    label: "🔧 Repair receipts for your Hyundai or Kia’s airbag system",
    feedback: "Documented expenses are paid on top of the payment of up to $350.",
    appliesTo: (s) => isCompany(s, "Hyundai", "Kia") && s.title === "Airbag control units",
  },
  {
    id: "toyota-vin",
    label: "🚙 Your Toyota’s VIN (it’s on your registration or insurance card)",
    feedback: "You’ll need it to file for up to $250.",
    appliesTo: (s) => isCompany(s, "Toyota"),
  },
  {
    id: "breach",
    label: "✉️ A letter or email saying your data was in a breach",
    feedback: "That notice is what qualifies you for these data breach claims.",
    appliesTo: (s) => isCompany(s, "Bank of America", "Lands' End"),
  },
  {
    id: "cvs",
    label: "🛒 CVS order emails or your CVS account history",
    feedback: "That raises your CVS claim from $5 to $10.",
    appliesTo: (s) => isCompany(s, "CVS"),
  },
  {
    id: "lease",
    label: "📄 Your apartment lease or proof of rent paid (2018–2025)",
    feedback: "That’s the proof of rent this claim asks for.",
    appliesTo: (s) => isCompany(s, "RealPage"),
  },
  {
    id: "closing",
    label: "🏡 Your closing statement from buying a home",
    feedback: "That’s the document this claim requires.",
    appliesTo: (s) => isCompany(s, "Real estate brokerages"),
  },
  {
    id: "fridge",
    label: "🧊 Repair records for a Whirlpool, Maytag, KitchenAid, or JennAir fridge",
    feedback: "Those records are what this claim needs to cover repair costs.",
    appliesTo: (s) => isCompany(s, "Whirlpool"),
  },
  {
    id: "levoit",
    label: "🌬️ A dated receipt for a Levoit air purifier or filter",
    feedback: "That receipt is the proof of purchase this claim requires.",
    appliesTo: (s) => isCompany(s, "Levoit"),
  },
];

/** One reminder email from the schedule `notify` sends: 7 days before a deadline, or the day before if that's past. */
export interface ReminderRow {
  settlement: Settlement;
  /** Calendar day, YYYY-MM-DD. */
  sendOn: string;
  closes: "in 7 days" | "tomorrow";
}

export function reminderSchedule(settlements: Settlement[]): ReminderRow[] {
  const today = startOfToday();
  const seen = new Set<string>();
  const rows: ReminderRow[] = [];
  for (const settlement of settlements) {
    if (seen.has(settlement.id) || !isOpen(settlement)) continue;
    seen.add(settlement.id);
    for (const [daysBefore, closes] of [[7, "in 7 days"], [1, "tomorrow"]] as const) {
      const day = parseDay(settlement.deadline);
      day.setDate(day.getDate() - daysBefore);
      if (day >= today) {
        rows.push({ settlement, sendOn: dayString(day), closes });
        break;
      }
    }
  }
  return rows.sort((a, b) => a.sendOn.localeCompare(b.sendOn));
}

function dayString(day: Date): string {
  const pad = (value: number) => String(value).padStart(2, "0");
  return `${day.getFullYear()}-${pad(day.getMonth() + 1)}-${pad(day.getDate())}`;
}

export const shortDay = (day: string) =>
  parseDay(day).toLocaleDateString("en-US", { month: "short", day: "numeric" });

/** Companies we headline as "watching" when there's nothing open for them yet. */
export const WATCHED_BRAND_NAMES = PINNED_BRAND_NAMES.concat(AFTER_TOP_TEN_BRAND_NAMES);

/** Announced, but the administrator's claim site isn't live yet. */
export function isUpcoming(settlement: Settlement): boolean {
  return settlement.opensOn != null && parseDay(settlement.opensOn) > startOfToday();
}

/** Settlements everyone sees, whatever they picked, minus the ones already matched. */
export function featuredSettlements(settlements: Settlement[], matched: Settlement[]): Settlement[] {
  const matchedIds = new Set(matched.map((settlement) => settlement.id));
  return settlements
    .filter((settlement) => settlement.isFeatured && isOpen(settlement) && !matchedIds.has(settlement.id))
    .sort((a, b) => Number(b.isSpotlight) - Number(a.isSpotlight) || a.deadline.localeCompare(b.deadline));
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

/** Every past payout for the chosen companies, newest first. */
export function missedPayouts(payouts: RecentPayout[], brandIds: ReadonlySet<string>): RecentPayout[] {
  return payouts.filter((p) => brandIds.has(p.brandId)).sort((a, b) => b.eventOn.localeCompare(a.eventOn));
}

export type PayoutScope = "past_year" | "recent" | "everyone";

export interface PayoutHistory {
  scope: PayoutScope;
  payouts: RecentPayout[];
  total: number;
}

/**
 * Real money people got from settlements, so no one sees $0:
 * the chosen companies' payouts from the last 12 months, plus the latest older payout for any chosen
 * company without one; if none of the chosen companies ever paid, the biggest recent payouts overall.
 */
export function payoutHistory(payouts: RecentPayout[], brandIds: ReadonlySet<string>): PayoutHistory {
  const cutoff = startOfToday();
  cutoff.setFullYear(cutoff.getFullYear() - 1);
  const withinYear = (p: RecentPayout) => parseDay(p.eventOn) >= cutoff;
  const byNewest = (a: RecentPayout, b: RecentPayout) => b.eventOn.localeCompare(a.eventOn);
  const sum = (list: RecentPayout[]) => list.reduce((total, p) => total + p.amountMax, 0);

  const chosen = payouts.filter((p) => brandIds.has(p.brandId));
  const picked = chosen.filter(withinYear);
  const coveredBrands = new Set(picked.map((p) => p.brandId));
  for (const payout of [...chosen].sort(byNewest)) {
    if (coveredBrands.has(payout.brandId)) continue;
    picked.push(payout);
    coveredBrands.add(payout.brandId);
  }
  if (picked.length > 0) {
    picked.sort((a, b) => b.amountMax - a.amountMax);
    return { scope: picked.every(withinYear) ? "past_year" : "recent", payouts: picked, total: sum(picked) };
  }

  // Large "documented losses" caps would overstate a typical payment, so they're left out here.
  const everyone = payouts
    .filter((p) => withinYear(p) && p.amountMax < 1000)
    .sort((a, b) => b.amountMax - a.amountMax)
    .slice(0, 4);
  return { scope: "everyone", payouts: everyone, total: sum(everyone) };
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
/** payoutMax = 0 means the amount varies (pro rata); payoutMin = 0 means "up to". */
export const payoutRange = (s: Settlement) => {
  if (s.payoutMax <= 0) return "Amount varies";
  if (s.payoutMin <= 0) return `Up to ${usd(s.payoutMax)}`;
  if (s.payoutMin === s.payoutMax) return usd(s.payoutMax);
  return `${usd(s.payoutMin)}–${usd(s.payoutMax)}`;
};
/** Whole dollars when exact, cents otherwise, so amounts are never rounded up. */
export const money = (amount: number) => (Number.isInteger(amount) ? usd(amount) : usdCents(amount));
export const recentAmount = (p: RecentPayout) =>
  p.amountMin > 0 && p.amountMin !== p.amountMax ? `${money(p.amountMin)}–${money(p.amountMax)}` : `Up to ${money(p.amountMax)}`;
export const recentWhen = (p: RecentPayout) =>
  `${p.event === "paid" ? "Paid out" : "Closed"} ${parseDay(p.eventOn).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}`;
/** The most each settlement pays, added up. */
export const maxTotal = (settlements: Settlement[]) =>
  settlements.reduce((total, settlement) => total + settlement.payoutMax, 0);
/** Summed totals above this show as "$5,000+". */
const TOTAL_CAP = 5000;
export const cappedTotal = (amount: number) => (amount > TOTAL_CAP ? `${usd(TOTAL_CAP)}+` : money(amount));

export const deadlineLabel = (s: Settlement) =>
  parseDay(s.deadline).toLocaleDateString("en-US", { month: "short", day: "numeric" });
export const opensLabel = (s: Settlement) =>
  s.opensOn ? parseDay(s.opensOn).toLocaleDateString("en-US", { month: "short", day: "numeric" }) : "";
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
