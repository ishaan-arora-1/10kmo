// Android and the browser preview: no App Store. Android keeps the website's Razorpay checkout.
import type { WebPlan } from "./config";
import type { AppleEntitlement, BuyOutcome, StorePrice, TransactionHandler } from "./iap-types";

export const IAP_AVAILABLE = false;

export async function connectStore(_onTransaction: TransactionHandler): Promise<() => void> {
  return () => undefined;
}

export async function loadPrices(): Promise<Partial<Record<WebPlan, StorePrice>>> {
  return {};
}

export async function currentEntitlement(): Promise<AppleEntitlement | null> {
  return null;
}

export async function buy(_plan: WebPlan, _accountId: string | null): Promise<BuyOutcome> {
  return { type: "failed", message: "In-app purchases aren’t available on this device." };
}

export async function restore(): Promise<AppleEntitlement | null> {
  return null;
}

export async function manageSubscriptions(): Promise<void> {}
