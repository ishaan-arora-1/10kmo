import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { BrandPicker } from "../components/BrandPicker";
import { BrandSeal, Monogram, MoneyCheck, PayoutHistoryCard, SampleBadge, historyHeadline, SettlementCard } from "../components/ui";
import { isOpen, plural, sortBrandsForPicker } from "../lib/models";
import { useStore } from "../lib/store";
import { isSampleMode } from "../lib/supabase";

type Stage = "brands" | "scanning" | "results";

export function Onboarding() {
  const [stage, setStage] = useState<Stage>("brands");

  return (
    <div className="flow">
      <header className="flow-top">
        <a className="brand" href="/">
          <BrandSeal />
          Rightful
        </a>
      </header>
      {stage === "brands" && <PickStep onContinue={() => setStage("scanning")} />}
      {stage === "scanning" && <ScanStep onDone={() => setStage("results")} />}
      {stage === "results" && <ResultsStep onPickMore={() => setStage("brands")} />}
    </div>
  );
}

function PickStep({ onContinue }: { onContinue: () => void }) {
  const { selectedBrandIds, session } = useStore();
  const count = selectedBrandIds.size;
  return (
    <>
      <div className="flow-body">
        <p className="eyebrow">Step 1 · 30 seconds</p>
        <h1 className="flow-title">Which of these have you used?</h1>
        <p className="muted">Any US account since 2015 counts. No bank or email logins, ever.</p>
        <BrandPicker idPrefix="onboarding" />
        {!session && !isSampleMode && (
          <p className="center muted">
            Already a member? <Link to={`/sign-in?next=${encodeURIComponent("/paywall")}`}>Sign in</Link>
          </p>
        )}
      </div>
      <div className="sticky-cta">
        <span className="mono-note">
          {count} {plural(count, "company", "companies")} selected
        </span>
        <button type="button" className="btn block" onClick={onContinue} disabled={count === 0}>
          Check open settlements
        </button>
      </div>
    </>
  );
}

function ScanStep({ onDone }: { onDone: () => void }) {
  const { settlements, matched } = useStore();
  const [progress, setProgress] = useState(0.04);

  useEffect(() => {
    const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (reduceMotion) {
      const timer = window.setTimeout(onDone, 400);
      return () => window.clearTimeout(timer);
    }
    let step = 0;
    const interval = window.setInterval(() => {
      step += 1;
      setProgress(step / 24);
      if (step >= 24) {
        window.clearInterval(interval);
        window.setTimeout(onDone, 250);
      }
    }, 70);
    return () => window.clearInterval(interval);
  }, [onDone]);

  const checked = Math.round(progress * settlements.length);
  return (
    <div className="flow-body scan" aria-live="polite">
      <div
        className="scan-ring"
        style={{ background: `conic-gradient(var(--money) ${progress * 360}deg, var(--line) 0deg)` }}
      >
        <div>
          <b>{checked}</b>
          <span>of {settlements.length}</span>
        </div>
      </div>
      <h1 className="flow-title center">Checking open settlements</h1>
      <p className="muted center">Matching happens right here in your browser.</p>
      <ul className="scan-list">
        {matched.slice(0, 4).map((settlement) => (
          <li key={settlement.id}>
            <span>
              {settlement.company} · {settlement.title}
            </span>
            <b>Match</b>
          </li>
        ))}
      </ul>
    </div>
  );
}

function ResultsStep({ onPickMore }: { onPickMore: () => void }) {
  const store = useStore();
  const navigate = useNavigate();
  const matches = store.matched;
  const noProof = matches.filter((s) => !s.proofRequired).length;

  const startClaiming = () => {
    if (store.isPremium) navigate("/welcome");
    else if (!store.session && !isSampleMode) navigate(`/sign-in?next=${encodeURIComponent("/paywall")}`);
    else navigate("/paywall");
  };

  if (matches.length === 0) {
    return <NoMatches onPickMore={onPickMore} onContinue={startClaiming} />;
  }

  return (
    <>
      <div className="flow-body">
        <p className="eyebrow">Good news</p>
        <h1 className="flow-title">
          You may qualify for {matches.length} {plural(matches.length, "settlement", "settlements")}
        </h1>
        {matches.every((s) => s.isSample) && <SampleBadge />}
        <MoneyCheck
          number={String(matches.length).padStart(4, "0")}
          payee="You"
          amountLabel="Est. up to"
          amount={store.potentialMax}
          memo={`${matches.length} ${plural(matches.length, "settlement", "settlements")} · ${noProof} need no proof`}
          footer={`‖ ${store.settlements.length} CHECKED ‖ ${matches.length} MATCHED`}
        />
        <div className="stack">
          {matches.slice(0, 3).map((settlement) => (
            <button key={settlement.id} type="button" className="card-button" onClick={startClaiming}>
              <SettlementCard settlement={settlement} />
            </button>
          ))}
        </div>
        {matches.length > 3 && (
          <p className="center muted strong">
            + {matches.length - 3} more {plural(matches.length - 3, "match", "matches")}
          </p>
        )}
        <FeaturedSettlements onSelect={startClaiming} />
        <p className="fine-print">
          Estimates come from court filings. Final amounts depend on how many people claim.
          {matches.some((s) => s.isSample) && " Sample records are labeled and are not live claims."}
        </p>
        {store.potentialMax === 0 && (
          <>
            <h2 className="past-year-title">{historyHeadline(store.history)}</h2>
            <PayoutHistoryCard history={store.history} />
          </>
        )}
      </div>
      <div className="sticky-cta">
        <button type="button" className="btn block" onClick={startClaiming}>
          Start claiming
        </button>
      </div>
    </>
  );
}

/** No open match: show what they missed, suggest more companies, then continue to membership. */
function NoMatches({ onPickMore, onContinue }: { onPickMore: () => void; onContinue: () => void }) {
  const { brands, settlements, selectedBrandIds, toggleBrand, history } = useStore();
  const open = settlements.filter(isOpen);
  const openBrandIds = new Set(open.map((settlement) => settlement.brandId));
  const suggestions = sortBrandsForPicker(
    brands.filter((brand) => openBrandIds.has(brand.id) && !selectedBrandIds.has(brand.id)),
    openBrandIds,
  )
    .sort((a, b) => topPayout(b.id) - topPayout(a.id))
    .slice(0, 12);

  function topPayout(brandId: string) {
    return Math.max(0, ...open.filter((s) => s.brandId === brandId).map((s) => s.payoutMax));
  }

  return (
    <>
      <div className="flow-body">
        <p className="eyebrow">Scan complete</p>
        <h1 className="flow-title">{historyHeadline(history)}</h1>
        <PayoutHistoryCard history={history} />
        <FeaturedSettlements onSelect={onContinue} />
        <h2 className="past-year-title">Add more options</h2>
        <div className="brand-grid">
          {suggestions.map((brand) => (
            <button
              key={brand.id}
              type="button"
              className="brand-tile"
              aria-pressed={false}
              onClick={() => toggleBrand(brand.id)}
            >
              <Monogram brand={brand} name={brand.name} size={40} />
              <span>{brand.name}</span>
            </button>
          ))}
        </div>
      </div>
      <div className="sticky-cta">
        <button type="button" className="btn block" onClick={onContinue}>
          Continue
        </button>
        <button type="button" className="btn-quiet" onClick={onPickMore}>
          Search all companies
        </button>
      </div>
    </>
  );
}

/** Big settlements anyone in the US may qualify for, shown whatever they picked. */
function FeaturedSettlements({ onSelect }: { onSelect: () => void }) {
  const { featured } = useStore();
  if (featured.length === 0) return null;
  return (
    <>
      <h2 className="past-year-title">Open to everyone in the US</h2>
      <div className="stack">
        {featured.map((settlement) => (
          <button key={settlement.id} type="button" className="card-button" onClick={onSelect}>
            <SettlementCard settlement={settlement} />
          </button>
        ))}
      </div>
    </>
  );
}
