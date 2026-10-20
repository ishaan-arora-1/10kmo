import { useState } from "react";
import { PRICE_LABELS, type WebPlan } from "../lib/config";
import { useStore } from "../lib/store";
import { Modal } from "./ui";

/** "Oct 21 at 3:27 AM" in their time zone, or null once that time has passed. */
export function trialEndLabel(iso: string | null): string | null {
  if (!iso) return null;
  const when = new Date(iso);
  if (Number.isNaN(when.getTime()) || when.getTime() <= Date.now()) return null;
  const day = when.toLocaleDateString("en-US", { month: "short", day: "numeric" });
  const time = when.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" });
  return `${day} at ${time}`;
}

/** Ends a limited free trial early: the yearly price now on the saved payment method, or monthly. */
export function UnlockNowModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const store = useStore();
  const [busy, setBusy] = useState<WebPlan | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  const unlock = async (plan: WebPlan) => {
    setBusy(plan);
    setMessage(null);
    const result = await store.unlockNow(plan);
    setBusy(null);
    if (result.ok) onClose();
    else if (!result.cancelled) setMessage(result.message ?? "That didn’t work. Please try again.");
  };

  return (
    <Modal open={open} onClose={() => !busy && onClose()} title="Unlock all your claims now">
      <div className="stack">
        <p className="muted">
          Your free trial includes the {store.trialClaimNames} claims. Start your plan now to file the rest today.
        </p>
        {message && (
          <p className="error-text" role="alert">
            {message}
          </p>
        )}
        <button type="button" className="btn block" onClick={() => void unlock("yearly")} disabled={busy !== null}>
          {busy === "yearly" ? "Charging…" : `Pay ${PRICE_LABELS.yearly} for the year`}
        </button>
        <p className="fine-print center">
          Charged now to the payment method you added for your trial. Your trial ends and your year starts today.
        </p>
        <button
          type="button"
          className="btn secondary block"
          onClick={() => void unlock("monthly")}
          disabled={busy !== null}
        >
          {busy === "monthly" ? "Opening secure checkout…" : `Or pay ${PRICE_LABELS.monthly}/month`}
        </button>
        <p className="fine-print center">
          Opens checkout. Your trial ends and {PRICE_LABELS.yearly} isn’t charged. Cancel anytime in Profile.
        </p>
      </div>
    </Modal>
  );
}
