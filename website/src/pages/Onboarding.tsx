import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { BrandPicker } from "../components/BrandPicker";
import { BrandSeal, MoneyCheck, SampleBadge, SettlementCard } from "../components/ui";
import { plural } from "../lib/models";
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
  const { selectedBrandIds } = useStore();
  const count = selectedBrandIds.size;
  return (
    <>
      <div className="flow-body">
        <p className="eyebrow">Step 1 · 30 seconds</p>
        <h1 className="flow-title">Which of these have you used?</h1>
        <p className="muted">Any account since 2015 counts. No bank or email logins, ever.</p>
        <BrandPicker idPrefix="onboarding" />
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

  const continueFree = () => {
    store.completeOnboarding();
    navigate("/", { replace: true });
  };

  if (matches.length === 0) {
    return (
      <>
        <div className="flow-body">
          <p className="eyebrow">Scan complete</p>
          <h1 className="flow-title">No open matches yet</h1>
          <p className="muted">
            New settlements open every week. Add more companies you’ve used, or continue and we’ll show new
            matches as they’re verified.
          </p>
        </div>
        <div className="sticky-cta">
          <button type="button" className="btn block" onClick={onPickMore}>
            Pick more companies
          </button>
          <button type="button" className="btn-quiet" onClick={continueFree}>
            Continue to Rightful
          </button>
        </div>
      </>
    );
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
        <p className="fine-print">
          Estimates come from court filings. Final amounts depend on how many people claim.
          {matches.some((s) => s.isSample) && " Sample records are labeled and are not live claims."}
        </p>
      </div>
      <div className="sticky-cta">
        <button type="button" className="btn block" onClick={startClaiming}>
          Start claiming
        </button>
      </div>
    </>
  );
}
