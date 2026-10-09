import { createContext, useCallback, useContext, type ReactNode } from "react";
import type { CheckoutOutcome, OpenCheckout, RazorpayOptions, RazorpaySuccess } from "./checkout-types";

// Browser preview of the app (npx expo start --web): Razorpay Checkout runs on the page, like the website.
interface RazorpayCheckout {
  open(): void;
  on(event: "payment.failed", callback: (response: { error?: { description?: string } }) => void): void;
}
type RazorpayConstructor = new (
  options: RazorpayOptions & { handler: (r: RazorpaySuccess) => void; modal: { ondismiss: () => void } },
) => RazorpayCheckout;

let loading: Promise<void> | null = null;
function loadRazorpay(): Promise<void> {
  const host = window as unknown as { Razorpay?: RazorpayConstructor };
  if (host.Razorpay) return Promise.resolve();
  loading ??= new Promise<void>((resolve, reject) => {
    const script = document.createElement("script");
    script.src = "https://checkout.razorpay.com/v1/checkout.js";
    script.async = true;
    script.onload = () => resolve();
    script.onerror = () => {
      loading = null;
      reject(new Error("Razorpay Checkout failed to load"));
    };
    document.head.appendChild(script);
  });
  return loading;
}

const CheckoutContext = createContext<OpenCheckout | null>(null);

export function CheckoutProvider({ children }: { children: ReactNode }) {
  const open = useCallback<OpenCheckout>(async (options, onFailure) => {
    try {
      await loadRazorpay();
    } catch {
      return { type: "load_failed" };
    }
    const Razorpay = (window as unknown as { Razorpay: RazorpayConstructor }).Razorpay;
    return new Promise<CheckoutOutcome>((resolve) => {
      let lastFailure: string | null = null;
      const checkout = new Razorpay({
        ...options,
        handler: (response) => resolve({ type: "success", response }),
        modal: { ondismiss: () => resolve({ type: "dismissed", failure: lastFailure }) },
      });
      checkout.on("payment.failed", (failure) => {
        lastFailure = failure.error?.description ?? "The payment didn’t go through. Please try another card.";
        onFailure(lastFailure);
      });
      checkout.open();
    });
  }, []);
  return <CheckoutContext.Provider value={open}>{children}</CheckoutContext.Provider>;
}

export function useCheckout(): OpenCheckout {
  const open = useContext(CheckoutContext);
  if (!open) throw new Error("useCheckout must be used inside CheckoutProvider");
  return open;
}
