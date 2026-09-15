import { useEffect, useState } from "react";
import { Navigate, useNavigate, useSearchParams } from "react-router-dom";
import { BrandSeal } from "../components/ui";
import { daysUntil, deadlineLabel, plural, safeNext, usd } from "../lib/models";
import { useStore } from "../lib/store";
import { isSampleMode } from "../lib/supabase";

const PRICES = { yearly: "$39.99", weekly: "$4.99" } as const;

export function Paywall() {
  const store = useStore();
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const next = safeNext(params.get("next"));
  const [plan, setPlan] = useState<"yearly" | "weekly">("yearly");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    if (store.isPremium) navigate(`/welcome?next=${encodeURIComponent(next)}`, { replace: true });
  }, [store.isPremium, next, navigate]);

  if (!isSampleMode && !store.session) {
    const back = `/paywall?next=${encodeURIComponent(next)}`;
    return <Navigate to={`/sign-in?next=${encodeURIComponent(back)}`} replace />;
  }

  const count = store.unfiled.length;
  const nearest = store.nearest;
  const filingFeature =
    count === 0
      ? "Step-by-step filing for every match"
      : count === 1
        ? "Step-by-step filing for your match"
        : count === 2
          ? "Step-by-step filing for both of your matches"
          : `Step-by-step filing for all ${count} of your matches`;

  const close = () => {
    if (!store.onboardingCompleted) {
      store.completeOnboarding();
      navigate("/", { replace: true });
    } else {
      navigate(next, { replace: true });
    }
  };

  const subscribe = async () => {
    setBusy(true);
    setMessage(null);
    const result = await store.startCheckout(plan, next);
    if (!result.ok) {
      setMessage(result.message ?? "Checkout couldn’t start. Please try again.");
      setBusy(false);
      return;
    }
    if (!result.redirected) navigate(`/welcome?next=${encodeURIComponent(next)}`);
  };

  return (
    <div className="flow narrow">
      <header className="flow-top">
        <BrandSeal />
        <button type="button" className="icon-btn" onClick={close} aria-label="Close">
          ×
        </button>
      </header>
      <div className="flow-body">
        <h1 className="flow-title">
          {store.waitingMax > 0 ? `Don’t let ${usd(store.waitingMax)} expire` : "Turn matches into money"}
        </h1>
        {nearest ? (
          <div className="deadline-strip">
            <b>Your first deadline</b>
            <span>
              {deadlineLabel(nearest)} · {daysUntil(nearest.deadline)}{" "}
              {plural(daysUntil(nearest.deadline), "day", "days")}
            </span>
          </div>
        ) : (
          <p className="muted">Rightful guides every filing and keeps each claim on track until you’re paid.</p>
        )}

        <ul className="features">
          <li>{filingFeature}</li>
          <li>An alert the day a new settlement matches you</li>
          <li>Deadline reminders, so nothing closes on you</li>
          <li>A tracker for every claim until you’re paid</li>
          <li>Works on the web and the Rightful iPhone app</li>
        </ul>

        <fieldset className="plans">
          <legend className="visually-hidden">Choose a plan</legend>
          <label className={`plan-option${plan === "yearly" ? " on" : ""}`} htmlFor="plan-yearly">
            <input
              id="plan-yearly"
              type="radio"
              name="plan"
              checked={plan === "yearly"}
              onChange={() => setPlan("yearly")}
            />
            <span className="plan-text">
              <b>
                Yearly <span className="badge">Best value</span>
              </b>
              <span>3-day free trial for new subscribers, then {PRICES.yearly}/year</span>
            </span>
          </label>
          <label className={`plan-option${plan === "weekly" ? " on" : ""}`} htmlFor="plan-weekly">
            <input
              id="plan-weekly"
              type="radio"
              name="plan"
              checked={plan === "weekly"}
              onChange={() => setPlan("weekly")}
            />
            <span className="plan-text">
              <b>Weekly</b>
              <span>{PRICES.weekly}/week</span>
            </span>
          </label>
        </fieldset>

        {message && (
          <p className="error-text" role="alert">
            {message}
          </p>
        )}

        <button type="button" className="btn block" onClick={subscribe} disabled={busy}>
          {busy ? "Opening secure checkout…" : isSampleMode ? "Unlock sample" : plan === "yearly" ? "Start my free trial" : "Continue weekly"}
        </button>
        <p className="fine-print center">
          {isSampleMode
            ? "Sample mode: no payment is taken."
            : plan === "yearly"
              ? `Payments are handled securely by Stripe. First-time subscribers aren’t charged for 3 days, then ${PRICES.yearly} every year until you cancel in Profile → Manage billing.`
              : `Payments are handled securely by Stripe. ${PRICES.weekly} is charged today and every week until you cancel in Profile → Manage billing.`}
        </p>
        <p className="fine-print center">
          <a href="/terms">Terms</a> · <a href="/privacy">Privacy</a>
        </p>
      </div>
    </div>
  );
}
