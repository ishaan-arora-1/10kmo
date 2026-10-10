import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { ArrowRightIcon, GiftIcon, LockIcon } from "../components/icons";
import { StatePicker } from "../components/StatePicker";
import { Modal, MoneyCheck, Monogram, PayoutList, SampleBadge } from "../components/ui";
import { track } from "../lib/analytics";
import {
  cappedTotal,
  daysUntil,
  isUpcoming,
  maxTotal,
  opensLabel,
  payoutRange,
  plural,
  type Settlement,
} from "../lib/models";
import { useStore } from "../lib/store";

export function Home() {
  const store = useStore();
  const [statesOpen, setStatesOpen] = useState(false);

  useEffect(() => {
    track("dashboard_seen", { userId: store.session?.user.id ?? null, detail: store.isPremium ? "member" : "free" });
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // The spotlight claim first, then their own matches, then claims open to everyone; within each,
  // soonest deadline first, with claims whose site hasn't opened yet last.
  const featuredIds = new Set(store.featured.map((settlement) => settlement.id));
  const toFile = [...store.toFile].sort(
    (a, b) =>
      Number(b.isSpotlight) - Number(a.isSpotlight) ||
      Number(featuredIds.has(a.id)) - Number(featuredIds.has(b.id)) ||
      Number(isUpcoming(a)) - Number(isUpcoming(b)) ||
      a.deadline.localeCompare(b.deadline),
  );
  const filedCount = store.claims.filter((claim) => claim.status !== "Paid").length;
  const firstOpen = toFile.find((settlement) => !isUpcoming(settlement));
  // Highlight the spotlight claim; without one, the most urgent claim.
  const spotlight = toFile.find((settlement) => settlement.isSpotlight && !isUpcoming(settlement));
  const flagFor = (settlement: Settlement, index: number): string | null =>
    spotlight
      ? settlement === spotlight
        ? "Top pick"
        : null
      : index === 0 && settlement === firstOpen && daysUntil(settlement.deadline) <= 30
        ? "Most urgent"
        : null;
  const needsStates = store.selectedStates.size === 0;
  const missedTotal = store.missed.reduce((total, payout) => total + payout.amountMax, 0);
  const watching = store.estimates.filter(({ brand }) => !toFile.some((s) => s.brandId === brand.id));

  // Never show $0 or "Varies": their matches, pending/past figures and claims open to everyone,
  // else what they missed, else what settlements paid this year. Same total as the results screen.
  const upTo = store.waitingMax + store.estimateMax + store.featuredMax;
  const hero =
    upTo > 0
      ? {
          headline: `You may qualify for up to ${cappedTotal(upTo)}`,
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

  // Their own companies first, then the claims open to everyone.
  const payees = [
    ...new Set([
      ...toFile.filter((s) => !featuredIds.has(s.id)).map((s) => s.company),
      ...watching.map(({ brand }) => brand.name),
      ...toFile.filter((s) => featuredIds.has(s.id)).map((s) => s.company),
    ]),
  ];
  const memo =
    payees.length > 0
      ? `${payees.slice(0, 3).join(", ")}${payees.length > 3 ? ` + ${payees.length - 3} more` : ""}`
      : "Settlements you could have claimed";

  // Free accounts see everything and file one claim free; the plan unlocks the rest.
  const unlock = `/paywall?next=${encodeURIComponent("/")}`;
  const locked = toFile.filter((settlement) => !store.canFile(settlement));
  const lockedMax = maxTotal(locked);
  // Accounts that used a free claim while it was offered keep that one claim unlocked.
  const usedFreeClaim = store.claims.length > 0;

  return (
    <div className="page">
      <header className="page-head">
        <h1>{hero.headline}</h1>
        {store.isSampleData && <p>Previewing Rightful with sample data</p>}
      </header>

      <MoneyCheck
        number={String(toFile.length).padStart(4, "0")}
        payee={hero.payee}
        amountLabel={hero.label}
        amount={hero.amount}
        capped
        memo={memo}
        footer={`‖ ${toFile.length} TO FILE ‖ ${filedCount} FILED`}
      />

      {!store.isPremium &&
        (store.freeClaimAvailable && toFile.some((settlement) => !isUpcoming(settlement)) ? (
          <div className="unlock-strip free">
            <GiftIcon />
            <span>
              <b>Your first claim is free</b>
              <span>Pick any claim below and file it now.</span>
            </span>
          </div>
        ) : (
          <Link to={unlock} className="unlock-strip">
            <LockIcon />
            <span>
              <b>{usedFreeClaim ? "Free claim used" : "Free plan"}</b>
              <span>
                {locked.length > 0
                  ? `Unlock your ${
                      !usedFreeClaim
                        ? `${locked.length} ${plural(locked.length, "claim", "claims")}`
                        : locked.length === 1
                          ? "other claim"
                          : `other ${locked.length} claims`
                    }${lockedMax > 0 ? ` (up to ${cappedTotal(lockedMax)})` : ""}`
                  : "Get emailed the day your companies settle"}
              </span>
            </span>
            <ArrowRightIcon />
          </Link>
        ))}

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
                flag={flagFor(settlement, index)}
                openToAll={featuredIds.has(settlement.id)}
                locked={!store.canFile(settlement)}
                free={store.freeClaimAvailable}
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

      {store.missed.length > 0 && (
        <section className="section">
          <h2 className="section-label">You missed up to {cappedTotal(missedTotal)}</h2>
          <PayoutList payouts={store.missed} />
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
function ClaimTile({
  settlement,
  flag,
  openToAll,
  locked,
  free,
}: {
  settlement: Settlement;
  flag: string | null;
  openToAll: boolean;
  locked: boolean;
  free: boolean;
}) {
  const { brandById } = useStore();
  const upcoming = isUpcoming(settlement);
  const days = daysUntil(settlement.deadline);
  return (
    <Link to={`/settlements/${settlement.id}`} className={`claim-tile${flag ? " urgent" : ""}`}>
      <Monogram brand={brandById(settlement.brandId)} name={settlement.company} size={44} />
      <span className="ct-body">
        {flag && <span className="ct-flag">{flag}</span>}
        <b className="ct-title">{settlement.company}</b>
        <span className="ct-sub">{settlement.title}</span>
        <span className="ct-tags">
          {upcoming ? (
            <span className="ct-tag">Opens {opensLabel(settlement)}</span>
          ) : (
            <span className={`ct-tag${days <= 14 ? " hot" : ""}`}>{closesIn(days)}</span>
          )}
          {!settlement.proofRequired && <span className="ct-tag money">No proof needed</span>}
          {openToAll && <span className="ct-tag">Open to most people</span>}
          {settlement.isSample && <SampleBadge />}
        </span>
      </span>
      <span className="ct-side">
        <span className="ct-amount">{payoutRange(settlement)}</span>
        <span className={`pill-dark${free && !upcoming ? " free" : ""}`}>
          {upcoming ? "Details" : free ? "File free" : "File"}
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
