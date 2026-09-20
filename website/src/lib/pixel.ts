/** Meta Pixel events, so ads can be optimized for people who actually subscribe. */
type PixelEvent = "ViewContent" | "CompleteRegistration" | "InitiateCheckout" | "Purchase";

declare global {
  interface Window {
    fbq?: (command: string, event: string, params?: Record<string, unknown>) => void;
  }
}

/** Never throws and never blocks: the pixel is missing whenever an ad blocker is on. */
export function pixel(event: PixelEvent, params: Record<string, unknown> = {}): void {
  try {
    window.fbq?.("track", event, params);
  } catch {
    // Ignore: measurement must never break the app.
  }
}
