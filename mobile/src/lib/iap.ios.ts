import type { ActiveSubscription, Purchase } from "expo-iap";
import { APPLE_PRODUCT_IDS, type WebPlan } from "./config";
import type { AppleEntitlement, BuyOutcome, StorePrice, TransactionHandler } from "./iap-types";

/** iPhone: subscriptions are sold through the App Store (StoreKit 2), as Apple requires. */
export const IAP_AVAILABLE = true;

type ExpoIap = typeof import("expo-iap");
let loaded: ExpoIap | null | undefined;
/** Loaded lazily: Expo Go has no StoreKit module, and the rest of the app should still run there. */
async function iap(): Promise<ExpoIap | null> {
  if (loaded === undefined) {
    try {
      loaded = await import("expo-iap");
    } catch {
      loaded = null;
    }
  }
  return loaded;
}

const SKUS: string[] = Object.values(APPLE_PRODUCT_IDS);
const planFor = (productId: string): WebPlan | null =>
  (Object.keys(APPLE_PRODUCT_IDS) as WebPlan[]).find((plan) => APPLE_PRODUCT_IDS[plan] === productId) ?? null;
const isoTime = (ms: number | null | undefined) => (ms ? new Date(ms).toISOString() : null);

function fromPurchase(purchase: Purchase): AppleEntitlement | null {
  const plan = planFor(purchase.productId);
  if (!plan || purchase.purchaseState === "pending") return null;
  const ios = purchase as Purchase & { expirationDateIOS?: number | null; revocationDateIOS?: number | null };
  if (ios.revocationDateIOS) return null;
  // Apple replays old transactions at launch; one whose period has ended unlocks nothing.
  if (ios.expirationDateIOS && ios.expirationDateIOS < Date.now()) return null;
  return {
    productId: purchase.productId,
    plan,
    signedTransaction: purchase.purchaseToken ?? null,
    expiresAt: isoTime(ios.expirationDateIOS),
    willRenew: purchase.isAutoRenewing,
  };
}

function fromSubscription(subscription: ActiveSubscription): AppleEntitlement | null {
  const plan = planFor(subscription.productId);
  if (!plan || !subscription.isActive) return null;
  return {
    productId: subscription.productId,
    plan,
    signedTransaction: subscription.purchaseToken ?? null,
    expiresAt: isoTime(subscription.expirationDateIOS),
    willRenew: subscription.renewalInfoIOS?.willAutoRenew ?? null,
  };
}

// A purchase's result arrives through the listener, so buy() waits for it here.
let waiting: { sku: string; resolve: (outcome: BuyOutcome) => void } | null = null;
let connected = false;

export async function connectStore(onTransaction: TransactionHandler): Promise<() => void> {
  const store = await iap();
  if (!store) return () => undefined;
  const { endConnection, finishTransaction, isUserCancelledError, purchaseErrorListener, purchaseUpdatedListener } = store;
  connected = await store.initConnection().catch(() => false);
  if (!connected) return () => undefined;

  const updates = purchaseUpdatedListener(async (purchase) => {
    const entitlement = fromPurchase(purchase);
    if (purchase.purchaseState === "pending") {
      // Ask to Buy or a delayed payment: Apple sends the transaction again when it completes.
      if (waiting?.sku === purchase.productId) waiting.resolve({ type: "pending" });
      return;
    }
    if (entitlement) {
      try {
        await onTransaction(entitlement);
      } catch {
        // The entitlement still unlocks this device; linking to the account retries later.
      }
    }
    await finishTransaction({ purchase, isConsumable: false }).catch(() => undefined);
    if (waiting?.sku === purchase.productId && entitlement) {
      waiting.resolve({ type: "purchased", entitlement });
      waiting = null;
    }
  });

  const errors = purchaseErrorListener((error) => {
    if (!waiting) return;
    waiting.resolve(
      isUserCancelledError(error)
        ? { type: "cancelled" }
        : { type: "failed", message: error.message || "The purchase didn’t go through. Please try again." },
    );
    waiting = null;
  });

  return () => {
    updates.remove();
    errors.remove();
    connected = false;
    void endConnection().catch(() => undefined);
  };
}

export async function loadPrices(): Promise<Partial<Record<WebPlan, StorePrice>>> {
  const store = await iap();
  if (!store || !connected) return {};
  const products = (await store.fetchProducts({ skus: SKUS, type: "subs" }).catch(() => null)) ?? [];
  const prices: Partial<Record<WebPlan, StorePrice>> = {};
  for (const product of products) {
    const plan = planFor(product.id);
    if (plan) prices[plan] = { label: product.displayPrice, value: product.price ?? 0 };
  }
  return prices;
}

/** Throws when the App Store can't be reached, so callers keep what they knew. */
export async function currentEntitlement(): Promise<AppleEntitlement | null> {
  const store = await iap();
  if (!store || !connected) throw new Error("App Store not connected");
  const subscriptions = await store.getActiveSubscriptions(SKUS);
  const entitlements = subscriptions.map(fromSubscription).filter((e): e is AppleEntitlement => e !== null);
  // Yearly first, like the server.
  return entitlements.sort((a, b) => Number(b.plan === "yearly") - Number(a.plan === "yearly"))[0] ?? null;
}

async function connect(store: ExpoIap): Promise<boolean> {
  if (!connected) connected = await store.initConnection().catch(() => false);
  return connected;
}

export async function buy(plan: WebPlan, accountId: string | null): Promise<BuyOutcome> {
  const store = await iap();
  if (!store || !(await connect(store))) {
    return { type: "failed", message: "The App Store isn’t available right now. Please try again." };
  }
  const sku = APPLE_PRODUCT_IDS[plan];
  waiting?.resolve({ type: "cancelled" });
  const outcome = new Promise<BuyOutcome>((resolve) => {
    waiting = { sku, resolve };
  });
  try {
    await store.requestPurchase({
      type: "subs",
      // Ties the purchase to the signed-in account, which verify-purchase checks.
      request: { apple: { sku, appAccountToken: accountId ?? undefined } },
    });
  } catch (error) {
    waiting = null;
    return store.isUserCancelledError(error)
      ? { type: "cancelled" }
      : { type: "failed", message: "The purchase couldn’t start. Please try again." };
  }
  return outcome;
}

/** Restore Purchases: syncs with the App Store, then reads the active subscription. */
export async function restore(): Promise<AppleEntitlement | null> {
  const store = await iap();
  if (!store || !(await connect(store))) throw new Error("App Store not connected");
  await store.restorePurchases();
  return currentEntitlement();
}

/** Opens the App Store's subscription management sheet. */
export async function manageSubscriptions(): Promise<void> {
  const store = await iap();
  if (!store) throw new Error("App Store not available");
  await store.deepLinkToSubscriptions();
}
