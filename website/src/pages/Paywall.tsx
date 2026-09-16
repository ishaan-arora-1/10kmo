import { useEffect, useState } from "react";
import { Navigate, useNavigate, useSearchParams } from "react-router-dom";
import { BrandSeal, historyHeadline } from "../components/ui";
import { PRICE_LABELS } from "../lib/config";
import { daysUntil, deadlineLabel, plural, safeNext, usd } from "../lib/models";
import { useStore } from "../lib/store";
import { isSampleMode } from "../lib/supabase";

export function Paywall() {
  const store = useStore();
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const next = safeNext(params.get("next"));
  const [plan, setPlan] = useState<"yearly" | "weekly">("yearly");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    if (store.isPremium && !busy) navigate(`/welcome?next=${encodeURIComponent(next)}`, { replace: true });
  }, [store.isPremium, busy, next, navigate]);

  // Web subscriptions belong to an account, so sign-in comes first on the website.
  if (!isSampleMode && !store.session) {
    const back = `/paywall?next=${encodeURIComponent(next)}`;
    return <Navigate to={`/sign-in?next=${encodeURIComponent(back)}`} replace />;
  }

  const count = store.unfiled.length;
  const nearest = store.nearest;
  const filingFeature =
    count === 0
      ? `We watch your ${store.selectedBrandIds.size} ${plural(store.selectedBrandIds.size, "company", "companies")} for new settlements`
      : count === 1
        ? "Step-by-step filing for your match"
        : count === 2
          ? "Step-by-step filing for both of your matches"
          : `Step-by-step filing for all ${count} of your matches`;

  const close = () => navigate("/start", { replace: true });

  const subscribe = async () => {
    setBusy(true);
    setMessage(null);
    const result = await store.startCheckout(plan);
    setBusy(false);
    if (result.ok) {
      navigate(`/welcome?next=${encodeURIComponent(next)}`, { replace: true });
    } else if (!result.cancelled) {
      setMessage(result.message ?? "Checkout couldn’t start. Please try again.");
    }
  };

  const buttonLabel = busy
    ? "Opening secure checkout…"
    : isSampleMode
      ? "Unlock sample"
      : plan === "yearly"
        ? "Start my free trial"
        : "Continue weekly";

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
          {store.waitingMax > 0
            ? `Don’t let ${usd(store.waitingMax)} expire`
            : count > 0
              ? "Turn matches into money"
              : store.history.total > 0
                ? `${historyHeadline(store.history)}. Don’t miss the next one.`
                : "Be first when your companies settle"}
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
          <li>Official claim links, checked by us</li>
          <li>Every open settlement, updated weekly</li>
          <li>A tracker for every claim until you’re paid</li>
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
              <span>3-day free trial for new subscribers, then {PRICE_LABELS.yearly}/year</span>
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
              <span>{PRICE_LABELS.weekly}/week</span>
            </span>
          </label>
        </fieldset>

        {message && (
          <p className="error-text" role="alert">
            {message}
          </p>
        )}

        <button type="button" className="btn block" onClick={subscribe} disabled={busy}>
          {buttonLabel}
        </button>
        <p className="fine-print center">
          {isSampleMode
            ? "Sample mode: no payment is taken."
            : plan === "yearly"
              ? `Payments are processed securely by Razorpay. First-time subscribers aren’t charged for 3 days (your bank may show a temporary authorization), then ${PRICE_LABELS.yearly} every year until you cancel in Profile.`
              : `Payments are processed securely by Razorpay. ${PRICE_LABELS.weekly} is charged today and every week until you cancel in Profile.`}
        </p>
        <p className="fine-print center">
          <a href="/terms">Terms</a> · <a href="/privacy">Privacy</a>
          {store.session && (
            <>
              {" · "}
              <button type="button" className="link-btn" onClick={() => void store.signOut()}>
                Sign out
              </button>
            </>
          )}
        </p>
      </div>
    </div>
  );
}
