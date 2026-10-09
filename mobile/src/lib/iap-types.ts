import type { WebPlan } from "./config";

/** A plan's price as the App Store shows it in the person's own currency. */
export interface StorePrice {
  /** Localized, e.g. "$4.99". */
  label: string;
  value: number;
}

/** An active App Store subscription on this device's Apple ID. */
export interface AppleEntitlement {
  productId: string;
  plan: WebPlan;
  /** StoreKit 2 signed transaction (JWS), verified by the verify-purchase function. */
  signedTransaction: string | null;
  /** ISO time the current period ends. */
  expiresAt: string | null;
  willRenew: boolean | null;
}

export type BuyOutcome =
  | { type: "purchased"; entitlement: AppleEntitlement }
  | { type: "pending" }
  | { type: "cancelled" }
  | { type: "failed"; message: string };

/**
 * Runs for every completed App Store transaction: a new purchase, a renewal, or one Apple
 * replays at launch. The transaction is finished once this resolves.
 */
export type TransactionHandler = (entitlement: AppleEntitlement) => Promise<void>;
