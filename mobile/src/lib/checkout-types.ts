export interface RazorpaySuccess {
  razorpay_payment_id: string;
  razorpay_subscription_id: string;
  razorpay_signature: string;
}

export interface RazorpayOptions {
  key: string;
  subscription_id: string;
  name: string;
  description: string;
  prefill?: { email?: string; name?: string };
  theme?: { color: string };
}

/** How a Razorpay Checkout session ended. */
export type CheckoutOutcome =
  | { type: "success"; response: RazorpaySuccess }
  | { type: "dismissed"; failure: string | null }
  | { type: "load_failed" };

export type OpenCheckout = (options: RazorpayOptions, onFailure: (description: string) => void) => Promise<CheckoutOutcome>;
