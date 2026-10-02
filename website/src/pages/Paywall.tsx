import { useEffect, useState } from "react";
import { Navigate, useNavigate, useSearchParams } from "react-router-dom";
import { BrandSeal, historyHeadline, Monogram } from "../components/ui";
import { track } from "../lib/analytics";
import { PRICE_LABELS } from "../lib/config";
import {
  cappedTotal,
  daysUntil,
  deadlineLabel,
  pendingCaseFor,
  plural,
  reminderSchedule,
  safeNext,
  shortDay,
  usd,
} from "../lib/models";
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
    track("paywall_seen", { userId: store.session?.user.id ?? null });
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

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

  // Display only: personalizes what the plan includes. Nothing here affects checkout.
  const filingBrands = [...new Set(store.unfiled.map((s) => s.brandId))]
    .map((id) => store.brandById(id))
    .filter((brand) => brand !== undefined);
  const filingNames = filingBrands.slice(0, 3).map((brand) => brand.name);
  const reminderDays = [...new Set(reminderSchedule([...store.matched, ...store.featured]).map((r) => r.sendOn))]
    .slice(0, 3)
    .map(shortDay);
  const openBrandIds = new Set(store.matched.map((s) => s.brandId));
  const pendingNames = store.brands
    .filter((brand) => store.selectedBrandIds.has(brand.id) && !openBrandIds.has(brand.id) && pendingCaseFor(brand))
    .map((brand) => brand.name);
  const biggestClaim = Math.max(0, ...store.unfiled.map((s) => s.payoutMax));
  const yearlyPrice = Number(PRICE_LABELS.yearly.replace(/[^0-9.]/g, ""));

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
        ? `Subscribe for ${PRICE_LABELS.yearly}/year`
        : `Subscribe for ${PRICE_LABELS.weekly}/week`;

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
          {count > 0
            ? `Your ${count} ${plural(count, "claim is", "claims are")} ready`
            : store.history.total > 0
              ? `${historyHeadline(store.history)}. Don’t miss the next one.`
              : "Be first when your companies settle"}
        </h1>
        {store.waitingMax > 0 && (
          <p className="pw-total">
            Up to <b>{cappedTotal(store.waitingMax)}</b> waiting for you
          </p>
        )}
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

        <h2 className="past-year-title">What you get with Rightful</h2>
        <ul className="features">
          <li>
            <span>
              {count > 0 && filingNames.length > 0 ? (
                <>
                  Step-by-step filing guides for {filingNames.join(", ")}
                  {filingBrands.length > filingNames.length && ` (+${filingBrands.length - filingNames.length} more)`}
                  <span className="pw-logos" aria-hidden="true">
                    {filingBrands.slice(0, 6).map((brand) => (
                      <Monogram key={brand.id} brand={brand} name={brand.name} size={26} />
                    ))}
                  </span>
                </>
              ) : (
                filingFeature
              )}
            </span>
          </li>
          <li>Verified official claim links, so you never land on a fake site</li>
          <li>
            {reminderDays.length > 0
              ? `Email reminders before your deadlines: ${reminderDays.join(" · ")}`
              : "Email reminders before every deadline"}
          </li>
          <li>
            {pendingNames.length > 0
              ? `First to know when the ${pendingNames.join(" and ")} case opens for claims`
              : "First to know when your companies settle"}
          </li>
          <li>A tracker for every claim until you’re paid</li>
        </ul>
        {count > 0 && yearlyPrice > 0 && biggestClaim >= yearlyPrice && (
          <p className="pw-value">
            Just one of your claims (up to {usd(biggestClaim)}) could cover a whole year of Rightful.
          </p>
        )}

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
              <span>{PRICE_LABELS.yearly}/year</span>
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

        <p className="fine-print center">
          US settlements only. You qualify if you used these companies while living in the United States.
        </p>

        <button type="button" className="btn block" onClick={subscribe} disabled={busy}>
          {buttonLabel}
        </button>
        <p className="fine-print center">
          {isSampleMode
            ? "Sample mode: no payment is taken."
            : plan === "yearly"
              ? `Payments are processed securely by Razorpay. ${PRICE_LABELS.yearly} is charged today and every year until you cancel in Profile.`
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
