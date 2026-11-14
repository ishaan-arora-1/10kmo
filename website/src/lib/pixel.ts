/** Meta and Snap Pixel events, so ads can be optimized for people who actually subscribe. */
type PixelEvent = "ViewContent" | "CompleteRegistration" | "InitiateCheckout" | "StartTrial" | "Purchase";

declare global {
  interface Window {
    fbq?: (command: string, event: string, params?: Record<string, unknown>) => void;
    snaptr?: (command: string, event: string, params?: Record<string, unknown>) => void;
  }
}

// Snap's names for the same events.
const SNAP_EVENTS: Record<PixelEvent, string> = {
  ViewContent: "VIEW_CONTENT",
  CompleteRegistration: "SIGN_UP",
  InitiateCheckout: "START_CHECKOUT",
  StartTrial: "START_TRIAL",
  Purchase: "PURCHASE",
};

/** Never throws and never blocks: the pixels are missing whenever an ad blocker is on. */
export function pixel(event: PixelEvent, params: Record<string, unknown> = {}): void {
  try {
    window.fbq?.("track", event, params);
  } catch {
    // Ignore: measurement must never break the app.
  }
  try {
    const snap: Record<string, unknown> = {};
    if (typeof params.value === "number") snap.price = params.value;
    if (typeof params.currency === "string") snap.currency = params.currency;
    if (typeof params.content_name === "string") snap.item_category = params.content_name;
    window.snaptr?.("track", SNAP_EVENTS[event], snap);
  } catch {
    // Ignore: measurement must never break the app.
  }
}
