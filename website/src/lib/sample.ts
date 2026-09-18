import brandsJson from "./brands.json";
import type { Brand, Settlement } from "./models";

/** Same company catalog (and IDs) as the database migration and the iPhone app. */
export const SAMPLE_BRANDS: Brand[] = brandsJson as Brand[];

const FTC_REFUNDS = "https://www.ftc.gov/legal-library/browse/cases-proceedings/refunds";

function dayFromNow(days: number): string {
  const date = new Date();
  date.setDate(date.getDate() + days);
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${date.getFullYear()}-${month}-${day}`;
}

function sample(
  n: number,
  title: string,
  company: string,
  brandN: number,
  payoutMin: number,
  payoutMax: number,
  deadlineDays: number,
  proofRequired: boolean,
  qualifiesSummary: string,
  eligibilityDetails: string[],
  expectedPayoutDate: string,
): Settlement {
  return {
    id: `10000000-0000-0000-0000-${String(n).padStart(12, "0")}`,
    title,
    company,
    brandId: `00000000-0000-0000-0000-${String(brandN).padStart(12, "0")}`,
    eligibleStateCodes: [],
    payoutMin,
    payoutMax,
    payoutTypical: null,
    deadline: dayFromNow(deadlineDays),
    opensOn: null,
    isFeatured: false,
    proofRequired,
    qualifiesSummary,
    eligibilityDetails,
    claimUrl: FTC_REFUNDS,
    expectedPayoutDate,
    status: "verified",
    isSample: true,
  };
}

/** Clearly labeled demonstration records. Never shown as live claims. */
export const SAMPLE_SETTLEMENTS: Settlement[] = [
  sample(1, "Privacy settlement", "Facebook", 1, 20, 85, 18, false,
    "US users who had an account at any point during the covered years.",
    ["I had an account during the covered years", "I haven’t already filed this claim"], "Early 2027"),
  sample(2, "Data breach", "T-Mobile", 6, 25, 100, 34, false,
    "Customers whose information was included in the covered incident.",
    ["I was a customer during the covered period", "I did not opt out of the settlement"], "Spring 2027"),
  sample(3, "Savings rate", "Capital One", 12, 30, 350, 47, false,
    "Eligible savings account holders during the settlement period.",
    ["I held an eligible savings account", "The account was open during the covered dates"], "Mid 2027"),
  sample(4, "Service fees", "Ticketmaster", 13, 10, 40, 13, false,
    "US customers who bought eligible tickets during the covered years.",
    ["I bought an eligible ticket", "I used a US billing address"], "Late 2026"),
  sample(5, "Service fees", "Uber", 8, 5, 25, 62, true,
    "Riders charged covered service fees during the settlement period.",
    ["I took a covered ride", "I can provide a receipt if asked"], "Mid 2027"),
  sample(6, "Prime billing", "Amazon", 4, 15, 75, 27, false,
    "Prime members billed during the covered subscription period.",
    ["I had a Prime membership", "I was billed during the covered period"], "Early 2027"),
  sample(7, "Subscription disclosure", "Netflix", 10, 8, 30, 78, false,
    "Subscribers in covered states during the listed billing period.",
    ["I had a paid Netflix plan", "I lived in a covered state"], "Late 2027"),
  sample(8, "App privacy", "TikTok", 3, 12, 60, 96, false,
    "US users who used the app during the covered dates.",
    ["I used the app during the covered dates", "I have not filed another claim"], "Late 2027"),
];
