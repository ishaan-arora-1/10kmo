import { useEffect, useState } from "react";
import { Navigate, useNavigate, useSearchParams } from "react-router-dom";
import { BrandSeal, historyHeadline, Monogram } from "../components/ui";
import { track } from "../lib/analytics";
import { PRICE_LABELS, PRICE_VALUES, type WebPlan } from "../lib/config";
import {
  cappedTotal,
  daysUntil,
  deadlineLabel,
  isUpcoming,
  maxTotal,
  pendingCaseFor,
  plural,
  reminderSchedule,
  safeNext,
  shortDay,
  usd,
  usdCents,
} from "../lib/models";
import { useStore } from "../lib/store";
import { isSampleMode } from "../lib/supabase";

export function Paywall() {
  const store = useStore();
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const next = safeNext(params.get("next"));
  // Shown right after they file their free claim.
  const afterFreeClaim = params.get("from") === "free_claim";
  const [plan, setPlan] = useState<WebPlan>("yearly");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  // Opened from a settlement's "File your claim" button: lead with that claim.
  const target = store.settlementById(/^\/settlements\/([^/?#]+)/.exec(next)?.[1] ?? "") ?? null;

  useEffect(() => {
    track("paywall_seen", {
      userId: store.session?.user.id ?? null,
      detail: afterFreeClaim ? "after_free_claim" : target ? target.company : next === "/" ? "dashboard" : next,
    });
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (store.isPremium && !busy) navigate(`/welcome?next=${encodeURIComponent(next)}`, { replace: true });
  }, [store.isPremium, busy, next, navigate]);

  // Web subscriptions belong to an account, so sign-in comes first on the website.
  if (!isSampleMode && !store.session) {
    const back = `/paywall?next=${encodeURIComponent(next)}`;
    return <Navigate to={`/sign-in?next=${encodeURIComponent(back)}`} replace />;
  }

  const count = store.toFile.length;
  // Same total as the results screen and dashboard.
  const upTo = store.waitingMax + store.estimateMax + store.featuredMax;
  const nearest = target && !isUpcoming(target) ? target : store.nearest;
  const otherClaims = store.toFile.filter((s) => s.id !== target?.id).length;
  const restMax = maxTotal(store.toFile);
  const filingFeature =
    count === 0
      ? `We watch your ${store.selectedBrandIds.size} ${plural(store.selectedBrandIds.size, "company", "companies")} for new settlements`
      : count === 1
        ? "Step-by-step filing for your match"
        : count === 2
          ? "Step-by-step filing for both of your matches"
          : `Step-by-step filing for all ${count} of your matches`;

  // Accounts go back to where they were; the dashboard stays open to them.
  const close = () => navigate(store.session || isSampleMode ? next : "/start", { replace: true });

  // Display only: personalizes what the plan includes. Nothing here affects checkout.
  const filingBrands = [...new Set(store.toFile.map((s) => s.brandId))]
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
  const biggestClaim = Math.max(0, ...store.toFile.map((s) => s.payoutMax));
  const yearlyPrice = PRICE_VALUES.yearly;
  // Yearly shown per month, and what it saves against paying monthly for a year.
  const yearlyPerMonth = usdCents(Math.floor((PRICE_VALUES.yearly / 12) * 100) / 100);
  const yearlySaving = Math.floor((1 - PRICE_VALUES.yearly / (PRICE_VALUES.monthly * 12)) * 100);

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
        : `Subscribe for ${PRICE_LABELS.monthly}/month`;

  return (
    <div className="flow narrow">
      <header className="flow-top">
        <BrandSeal />
        <button type="button" className="icon-btn" onClick={close} aria-label="Close">
          ×
        </button>
      </header>
      <div className="flow-body">
        {afterFreeClaim && <p className="pw-done">✓ Claim filed. Nice work.</p>}
        <h1 className="flow-title">
          {afterFreeClaim
            ? count > 0
              ? count === 1
                ? "Now file your other claim"
                : `Now file your other ${count} claims`
              : "Be first when your companies settle"
            : target
            ? `Unlock your ${target.company} claim`
            : count > 0
              ? `Your ${count} ${plural(count, "claim is", "claims are")} ready`
              : store.history.total > 0
                ? `${historyHeadline(store.history)}. Don’t miss the next one.`
                : "Be first when your companies settle"}
        </h1>
        {afterFreeClaim ? (
          count > 0 &&
          restMax > 0 && (
            <p className="pw-total">
              Up to <b>{cappedTotal(restMax)}</b> more waiting for you. Unlock {count === 1 ? "it" : "them all"} for {yearlyPerMonth}/month.
            </p>
          )
        ) : target && target.payoutMax > 0 ? (
          <p className="pw-total">
            Up to <b>{usd(target.payoutMax)}</b> from this claim
            {otherClaims > 0 && `, plus ${otherClaims} more ${plural(otherClaims, "claim", "claims")} ready to file`}
          </p>
        ) : (
          upTo > 0 && (
            <p className="pw-total">
              Up to <b>{cappedTotal(upTo)}</b>{" "}
              {store.waitingMax + store.featuredMax > 0 ? "waiting for you" : "tied to your companies"}
            </p>
          )
        )}
        {nearest ? (
          <div className="deadline-strip">
            <b>{nearest === target ? "Deadline to file" : "Your first deadline"}</b>
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
                Yearly{" "}
                <span className="badge">{yearlySaving > 0 ? `Best value · save ${yearlySaving}%` : "Best value"}</span>
              </b>
              <span>
                {yearlyPerMonth}/month, billed {PRICE_LABELS.yearly}/year
              </span>
            </span>
          </label>
          <label className={`plan-option${plan === "monthly" ? " on" : ""}`} htmlFor="plan-monthly">
            <input
              id="plan-monthly"
              type="radio"
              name="plan"
              checked={plan === "monthly"}
              onChange={() => setPlan("monthly")}
            />
            <span className="plan-text">
              <b>Monthly</b>
              <span>{PRICE_LABELS.monthly}/month · cancel anytime</span>
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
              : `Payments are processed securely by Razorpay. ${PRICE_LABELS.monthly} is charged today and every month until you cancel in Profile.`}
        </p>
        <p className="fine-print center">
          {afterFreeClaim && (
            <>
              <button type="button" className="link-btn" onClick={close}>
                Maybe later
              </button>
              {" · "}
            </>
          )}
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
