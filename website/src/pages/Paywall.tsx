import { useEffect, useState } from "react";
import { Navigate, useNavigate, useSearchParams } from "react-router-dom";
import { ActivityToast } from "../components/ActivityToast";
import { BrandSeal, historyHeadline } from "../components/ui";
import { track } from "../lib/analytics";
import { PRICE_LABELS, PRICE_VALUES, type WebPlan } from "../lib/config";
import {
  cappedTotal,
  daysUntil,
  deadlineLabel,
  isUpcoming,
  maxTotal,
  payoutRange,
  pendingCaseFor,
  plural,
  safeNext,
  usd,
  type Settlement,
} from "../lib/models";
import { useStore } from "../lib/store";
import { isSampleMode } from "../lib/supabase";

/** Above this, a payout is a documented-loss cap most people won't get. */
const BIG_CLAIM = 1000;

export function Paywall() {
  const store = useStore();
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const next = safeNext(params.get("next"));
  // Shown right after they file their free claim.
  const afterFreeClaim = params.get("from") === "free_claim";
  const [plan, setPlan] = useState<WebPlan>("monthly");
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
  const restMax = maxTotal(store.toFile);

  // The bill: claims they can file now, the one they came from first, then biggest first.
  // Caps over $1,000 (documented losses, e.g. car theft) count at their typical payout.
  const fileable = store.toFile
    .filter((s) => !isUpcoming(s))
    .sort(
      (a, b) =>
        Number(b.id === target?.id) - Number(a.id === target?.id) ||
        Number(b.payoutMax > 0) - Number(a.payoutMax > 0) ||
        b.payoutMax - a.payoutMax,
    );
  const counted = (s: Settlement) => (s.payoutMax <= BIG_CLAIM ? s.payoutMax : (s.payoutTypical ?? 0));
  const billTotal = fileable.reduce((total, s) => total + counted(s), 0);
  const shown = fileable.slice(0, 5);
  const rest = fileable.slice(5);
  const anyBig = fileable.some((s) => s.payoutMax > BIG_CLAIM);
  const price = PRICE_VALUES[plan];
  // Whole dollars, rounded down, so it never overstates.
  const keep = Math.floor(billTotal - price);
  const closingSoon = fileable.filter((s) => daysUntil(s.deadline) <= 30).length;
  const showBill = billTotal > 0;

  // Accounts go back to where they were; the dashboard stays open to them.
  const close = () => navigate(store.session || isSampleMode ? next : "/start", { replace: true });

  const openBrandIds = new Set(store.matched.map((s) => s.brandId));
  const pendingNames = store.brands
    .filter((brand) => store.selectedBrandIds.has(brand.id) && !openBrandIds.has(brand.id) && pendingCaseFor(brand))
    .map((brand) => brand.name);
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

  const priceLabel = PRICE_LABELS[plan];
  const buttonLabel = busy
    ? "Opening secure checkout…"
    : isSampleMode
      ? "Unlock sample"
      : showBill
        ? `Claim my ${usd(billTotal)} for ${priceLabel}`
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
          {showBill
            ? `Pay ${priceLabel}. Claim up to ${usd(billTotal)}.`
            : afterFreeClaim
              ? "Be first when your companies settle"
              : count > 0
                ? `Your ${count} ${plural(count, "claim is", "claims are")} ready`
                : store.history.total > 0
                  ? `${historyHeadline(store.history)}. Don’t miss the next one.`
                  : "Be first when your companies settle"}
        </h1>

        {showBill ? (
          <>
            {target && !isUpcoming(target) && (
              <p className="pw-total">Starting with your {target.company} claim.</p>
            )}
            <div className="bill" aria-label="Your claims compared with the price of Rightful">
              <p className="bill-label">Your claims</p>
              {shown.map((s) => (
                <div key={s.id} className={`bill-row${s.id === target?.id ? " target" : ""}`}>
                  <span>
                    {s.company} · {s.title}
                  </span>
                  <span className="bill-amt">
                    {s.payoutMax > 0 ? payoutRange(s) : "Varies"}
                    {s.payoutMax > BIG_CLAIM && "*"}
                  </span>
                </div>
              ))}
              {rest.length > 0 && (
                <div className="bill-row">
                  <span>
                    + {rest.length} more {plural(rest.length, "claim", "claims")}
                  </span>
                  <span className="bill-amt">
                    {rest.reduce((t, s) => t + counted(s), 0) > 0
                      ? `up to ${usd(rest.reduce((t, s) => t + counted(s), 0))}`
                      : "Varies"}
                  </span>
                </div>
              )}
              <div className="bill-row sum">
                <span>You could claim</span>
                <span className="bill-amt">up to {usd(billTotal)}</span>
              </div>
              <div className="bill-row">
                <span>Rightful, {plan === "yearly" ? "1 year" : "1 month"}</span>
                <span className="bill-amt minus">−{priceLabel}</span>
              </div>
              {keep > 0 && (
                <div className="bill-row keep">
                  <span>You could keep</span>
                  <span className="bill-amt">up to {usd(keep)}</span>
                </div>
              )}
              {anyBig && (
                <p className="bill-note">
                  * Counted at its typical payout in your total. The maximum needs proof of loss.
                </p>
              )}
            </div>
            <p className="pw-lines">
              {plan === "monthly" ? "File them all this month, cancel anytime." : "File them all, and every new claim this year."}
              <br />
              {closingSoon > 0
                ? `${closingSoon === fileable.length && closingSoon === 1 ? "Your claim closes" : `${closingSoon} of your claims close`} in the next 30 days.`
                : nearest && `Your first claim closes ${deadlineLabel(nearest)}.`}
            </p>
          </>
        ) : (
          upTo > 0 &&
          !afterFreeClaim && (
            <p className="pw-total">
              Up to <b>{cappedTotal(upTo)}</b> {restMax > 0 ? "waiting for you" : "tied to your companies"}
            </p>
          )
        )}

        {message && (
          <p className="error-text" role="alert">
            {message}
          </p>
        )}

        <button type="button" className="btn block" onClick={subscribe} disabled={busy}>
          {buttonLabel}
        </button>
        <p className="pw-plan">
          {plan === "monthly" ? `${PRICE_LABELS.monthly}/month · cancel anytime` : `${PRICE_LABELS.yearly} billed yearly · cancel anytime`}
          <br />
          <button type="button" className="link-btn" onClick={() => setPlan(plan === "monthly" ? "yearly" : "monthly")}>
            {plan === "monthly"
              ? `or ${PRICE_LABELS.yearly}/year${yearlySaving > 0 ? ` (save ${yearlySaving}%)` : ""}`
              : `or ${PRICE_LABELS.monthly}/month`}
          </button>
        </p>

        <ul className="features compact">
          <li>
            {count > 0
              ? `Step-by-step filing for ${count === 1 ? "your claim" : count === 2 ? "both of your claims" : `all ${count} of your claims`}`
              : `We watch your ${store.selectedBrandIds.size} ${plural(store.selectedBrandIds.size, "company", "companies")} for new settlements`}
          </li>
          <li>Verified official claim links, so you never land on a fake site</li>
          <li>
            {pendingNames.length > 0
              ? `First to know when the ${pendingNames.join(" and ")} case opens for claims`
              : "A tracker for every claim until you’re paid"}
          </li>
        </ul>

        <p className="fine-print center">
          US settlements only. Amounts are the most each settlement pays, from court filings; most people get less.
          Payouts come from each settlement’s administrator, usually months after its deadline.
        </p>
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
      <ActivityToast />
    </div>
  );
}
