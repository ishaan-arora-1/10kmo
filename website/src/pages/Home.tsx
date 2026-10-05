import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { ArrowRightIcon, LockIcon } from "../components/icons";
import { StatePicker } from "../components/StatePicker";
import { Modal, MoneyCheck, Monogram, PayoutList, SampleBadge, SettlementCard } from "../components/ui";
import { track } from "../lib/analytics";
import {
  cappedTotal,
  daysUntil,
  isUpcoming,
  opensLabel,
  payoutRange,
  plural,
  usd,
  type Settlement,
} from "../lib/models";
import { useStore } from "../lib/store";

export function Home() {
  const store = useStore();
  const [statesOpen, setStatesOpen] = useState(false);

  useEffect(() => {
    track("dashboard_seen", { userId: store.session?.user.id ?? null, detail: store.isPremium ? "member" : "free" });
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Open claims first, soonest deadline first; ones whose claim site hasn't opened yet go last.
  const toFile = store.matched
    .filter((settlement) => !store.claimFor(settlement.id))
    .sort((a, b) => Number(isUpcoming(a)) - Number(isUpcoming(b)) || a.deadline.localeCompare(b.deadline));
  const filedCount = store.claims.filter((claim) => claim.status !== "Paid").length;
  const noProof = toFile.filter((settlement) => !settlement.proofRequired).length;
  const firstOpen = toFile.find((settlement) => !isUpcoming(settlement));
  const needsStates = store.selectedStates.size === 0;
  const missedTotal = store.missed.reduce((total, payout) => total + payout.amountMax, 0);
  const watching = store.estimates.filter(({ brand }) => !toFile.some((s) => s.brandId === brand.id));

  // Never show $0 or "Varies": add pending/past figures, else what they missed, else what settlements paid this year.
  const upTo = store.waitingMax + store.estimateMax;
  const hero =
    upTo > 0
      ? {
          headline:
            // "Could claim" only when every dollar is open now; past and pending figures aren't claimable yet.
            toFile.length > 0 && store.estimateMax === 0
              ? `You could claim up to ${cappedTotal(upTo)}`
              : `Up to ${cappedTotal(upTo)} tied to your companies`,
          payee: "You",
          label: "Up to",
          amount: upTo,
        }
      : missedTotal > 0
        ? { headline: `You missed up to ${cappedTotal(missedTotal)}`, payee: "You", label: "Missed", amount: missedTotal }
        : {
            headline: `People got up to ${cappedTotal(store.history.total)} this past year`,
            payee: "People like you",
            label: "Paid this past year",
            amount: store.history.total,
          };

  const subline =
    toFile.length > 0
      ? [
          `${toFile.length} ${plural(toFile.length, "claim", "claims")} ready to file`,
          noProof > 0 && `${noProof} need no proof`,
          firstOpen && `first closes in ${dayCount(daysUntil(firstOpen.deadline))}`,
        ]
          .filter(Boolean)
          .join(" · ")
      : `We’re watching your ${store.selectedBrandIds.size} ${plural(store.selectedBrandIds.size, "company", "companies")} for new settlements`;

  const payees = [...new Set([...toFile.map((s) => s.company), ...watching.map(({ brand }) => brand.name)])];
  const memo =
    payees.length > 0
      ? `${payees.slice(0, 3).join(", ")}${payees.length > 3 ? ` + ${payees.length - 3} more` : ""}`
      : "Settlements you could have claimed";

  // Free accounts see everything; filing is what the plan unlocks.
  const unlock = `/paywall?next=${encodeURIComponent("/")}`;

  return (
    <div className="page">
      <header className="page-head">
        <p className="eyebrow">{greeting()}</p>
        <h1>{hero.headline}</h1>
        <p>{store.isSampleData ? "Previewing Rightful with sample data" : subline}</p>
      </header>

      <MoneyCheck
        number={String(toFile.length).padStart(4, "0")}
        payee={hero.payee}
        amountLabel={hero.label}
        amount={hero.amount}
        capped
        memo={memo}
        footer={`‖ ${toFile.length} TO FILE ‖ ${filedCount} FILED ‖ ${usd(store.paidTotal)} PAID`}
      />

      {!store.isPremium && (
        <Link to={unlock} className="unlock-strip">
          <LockIcon />
          <span>
            <b>Free plan</b>
            <span>
              {toFile.length > 0
                ? `Unlock filing for your ${toFile.length} ${plural(toFile.length, "claim", "claims")}${
                    store.waitingMax > 0 ? ` (up to ${cappedTotal(store.waitingMax)})` : ""
                  }`
                : "Get emailed the day your companies settle"}
            </span>
          </span>
          <ArrowRightIcon />
        </Link>
      )}

      <section className="section">
        <h2 className="section-label">
          Ready to file{toFile.length > 0 && ` · ${toFile.length}`}
        </h2>
        {toFile.length === 0 ? (
          <div className="empty-card">
            <b>You’re caught up</b>
            <p className="muted">We’ll keep checking for new matches.</p>
          </div>
        ) : (
          <div className="stack">
            {toFile.map((settlement, index) => (
              <ClaimTile
                key={settlement.id}
                settlement={settlement}
                urgent={index === 0 && settlement === firstOpen && daysUntil(settlement.deadline) <= 30}
                locked={!store.isPremium}
              />
            ))}
          </div>
        )}
      </section>

      {watching.length > 0 && (
        <section className="section">
          <h2 className="section-label">Watching for you</h2>
          <div className="stack">
            {watching.map(({ brand, estimate }) => (
              <div key={brand.id} className="settlement-card">
                <Monogram brand={brand} name={brand.name} />
                <div className="sc-body">
                  <div className="sc-top">
                    <span className="sc-title">
                      {brand.name} · {estimate.label}
                    </span>
                    <span className="sc-amount">Up to {cappedTotal(estimate.amount)}</span>
                  </div>
                  <span className="sc-note">{estimate.note}</span>
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      {store.featured.length > 0 && (
        <section className="section">
          <h2 className="section-label">Open to everyone in the US</h2>
          <div className="stack">
            {store.featured.map((settlement) => (
              <Link key={settlement.id} to={`/settlements/${settlement.id}`} className="card-link">
                <SettlementCard settlement={settlement} action="Check if you qualify" />
              </Link>
            ))}
          </div>
        </section>
      )}

      {store.missed.length > 0 && (
        <section className="section">
          <h2 className="section-label">You missed up to {cappedTotal(missedTotal)}</h2>
          <PayoutList payouts={store.missed} />
        </section>
      )}

      {store.peoplePaid.payouts.length > 0 && (
        <section className="section">
          <h2 className="section-label">Paid this past year to people like you</h2>
          <p className="proof-total">
            People got up to <b>{cappedTotal(store.peoplePaid.total)}</b> from these settlements alone.
          </p>
          <PayoutList payouts={store.peoplePaid.payouts} />
        </section>
      )}

      {needsStates ? (
        <button type="button" className="find-more" onClick={() => setStatesOpen(true)}>
          <span>
            <b>Find more money</b>
            <span className="muted">Add the states you’ve lived in to check state-only settlements.</span>
          </span>
          <ArrowRightIcon />
        </button>
      ) : (
        <Link to="/browse" className="find-more">
          <span>
            <b>Find more money</b>
            <span className="muted">Browse open settlements and add companies you’ve used.</span>
          </span>
          <ArrowRightIcon />
        </Link>
      )}

      <p className="fine-print">
        Amounts are the most each settlement pays, from court filings. Most people get less. Rightful is not a law
        firm and is not affiliated with settlement administrators.
      </p>

      <Modal open={statesOpen} onClose={() => setStatesOpen(false)} title="States you’ve lived in">
        <StatePicker />
        <button type="button" className="btn block" onClick={() => setStatesOpen(false)}>
          Done
        </button>
      </Modal>
    </div>
  );
}

/** One claim to file: what it pays, how long is left, and whether proof is needed. */
function ClaimTile({ settlement, urgent, locked }: { settlement: Settlement; urgent: boolean; locked: boolean }) {
  const { brandById } = useStore();
  const upcoming = isUpcoming(settlement);
  const days = daysUntil(settlement.deadline);
  return (
    <Link to={`/settlements/${settlement.id}`} className={`claim-tile${urgent ? " urgent" : ""}`}>
      <Monogram brand={brandById(settlement.brandId)} name={settlement.company} size={44} />
      <span className="ct-body">
        {urgent && <span className="ct-flag">Most urgent</span>}
        <b className="ct-title">{settlement.company}</b>
        <span className="ct-sub">{settlement.title}</span>
        <span className="ct-tags">
          {upcoming ? (
            <span className="ct-tag">Opens {opensLabel(settlement)}</span>
          ) : (
            <span className={`ct-tag${days <= 14 ? " hot" : ""}`}>{closesIn(days)}</span>
          )}
          {!settlement.proofRequired && <span className="ct-tag money">No proof needed</span>}
          {settlement.isSample && <SampleBadge />}
        </span>
      </span>
      <span className="ct-side">
        <span className="ct-amount">{payoutRange(settlement)}</span>
        <span className="pill-dark">
          {upcoming ? "Details" : "File"}
          {locked && !upcoming && <LockIcon />}
        </span>
      </span>
    </Link>
  );
}

function dayCount(days: number): string {
  return `${days} ${plural(days, "day", "days")}`;
}

function closesIn(days: number): string {
  return days === 0 ? "Closes today" : `${dayCount(days)} left`;
}

function greeting(): string {
  const hour = new Date().getHours();
  if (hour < 5 || hour >= 18) return "Good evening";
  if (hour < 12) return "Good morning";
  return "Good afternoon";
}
