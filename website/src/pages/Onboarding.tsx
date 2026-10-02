import { useEffect, useRef, useState } from "react";
import { track } from "../lib/analytics";
import { pixel } from "../lib/pixel";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { BrandPicker } from "../components/BrandPicker";
import { browserKind, EmailCodeForm } from "../components/EmailCodeForm";
import { BrandSeal, Monogram, MoneyCheck, PayoutHistoryCard, SampleBadge, historyHeadline, SettlementCard } from "../components/ui";
import {
  ALSO_USED_COMPANIES,
  cappedTotal,
  isOpen,
  LIFE_EVENT_OPTIONS,
  matchSettlements,
  maxTotal,
  payoutRange,
  pendingCaseFor,
  plural,
  PROOF_OPTIONS,
  reminderSchedule,
  shortDay,
  sortBrandsForPicker,
  WATCHED_BRAND_NAMES,
  type Brand,
  type PendingCase,
  type Settlement,
} from "../lib/models";
import { useStore } from "../lib/store";
import { isSampleMode } from "../lib/supabase";

type Stage = "brands" | "scanning" | "questions" | "results" | "reminders";

export function Onboarding() {
  const [stage, setStage] = useState<Stage>("brands");

  useEffect(() => {
    window.scrollTo(0, 0);
  }, [stage]);

  return (
    <div className="flow">
      <header className="flow-top">
        <a className="brand" href="/">
          <BrandSeal />
          Rightful
        </a>
      </header>
      {stage === "brands" && <PickStep onContinue={() => setStage("scanning")} />}
      {stage === "scanning" && <ScanStep onDone={() => setStage("questions")} />}
      {stage === "questions" && <QuestionsStep onDone={() => setStage("results")} />}
      {stage === "results" && (
        <ResultsStep onPickMore={() => setStage("brands")} onReminders={() => setStage("reminders")} />
      )}
      {stage === "reminders" && <RemindersStep onBack={() => setStage("results")} />}
    </div>
  );
}

function PickStep({ onContinue }: { onContinue: () => void }) {
  const { brands, selectedBrandIds, session, toggleBrand } = useStore();
  const count = selectedBrandIds.size;

  // Landing-page logos link here with ?brand=Netflix: start with that company picked.
  const [params] = useSearchParams();
  const brandParam = params.get("brand");
  const preselected = useRef(false);
  useEffect(() => {
    if (preselected.current || !brandParam) return;
    preselected.current = true;
    const brand = brands.find((b) => b.name.toLowerCase() === brandParam.toLowerCase());
    if (brand && !selectedBrandIds.has(brand.id)) toggleBrand(brand.id);
  }, [brandParam, brands, selectedBrandIds, toggleBrand]);
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
  const { settlements, matched, selectedBrandIds } = useStore();
  useEffect(() => {
    track("brands_picked", { detail: `${selectedBrandIds.size} companies` });
  }, []); // eslint-disable-line react-hooks/exhaustive-deps
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

function ResultsStep({ onPickMore, onReminders }: { onPickMore: () => void; onReminders: () => void }) {
  const store = useStore();
  useEffect(() => {
    track("results_seen", { detail: `${store.matched.length} matches` });
    pixel("ViewContent", { content_name: "settlement matches", num_items: store.matched.length });
  }, []); // eslint-disable-line react-hooks/exhaustive-deps
  const navigate = useNavigate();
  const matches = store.matched;
  const noProof = matches.filter((s) => !s.proofRequired).length;

  const startClaiming = () => {
    if (store.isPremium) navigate("/welcome");
    else onReminders();
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
          amountLabel="Up to"
          amount={store.potentialMax}
          capped
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
        <PendingCases onSelect={startClaiming} />
        <FeaturedSettlements onSelect={startClaiming} />
        <p className="fine-print">
          Amounts are the most each settlement pays, from court filings. Most people get less, and final
          amounts depend on how many people claim and what you can document.
          {matches.some((s) => s.isSample) && " Sample records are labeled and are not live claims."}
        </p>
        {store.history.total > 0 && (
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
        <p className="muted">None of the companies you picked has a settlement open right now.</p>
        <PayoutHistoryCard history={history} />
        <PendingCases onSelect={onContinue} />
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

/** Picked companies with a lawsuit still in court: nothing to claim yet, members get emailed when it opens. */
function PendingCases({ onSelect }: { onSelect: () => void }) {
  const { brands, selectedBrandIds, matched } = useStore();
  // Once a company's settlement is open it shows as a match instead.
  const openBrandIds = new Set(matched.map((settlement) => settlement.brandId));
  const pending = brands
    .filter((brand) => selectedBrandIds.has(brand.id) && !openBrandIds.has(brand.id))
    .flatMap((brand) => {
      const pendingCase = pendingCaseFor(brand);
      return pendingCase ? [{ brand, pendingCase }] : [];
    });
  const names = pending.map(({ brand }) => brand.name).join(",");
  useEffect(() => {
    if (names) track("pending_case_seen", { detail: names });
  }, [names]);
  if (pending.length === 0) return null;
  return (
    <>
      <h2 className="past-year-title">Coming up for you</h2>
      <div className="stack">
        {pending.map(({ brand, pendingCase }) => (
          <PendingCaseCard key={brand.id} brand={brand} pendingCase={pendingCase} onSelect={onSelect} />
        ))}
      </div>
    </>
  );
}

function PendingCaseCard({
  brand,
  pendingCase,
  onSelect,
}: {
  brand: Brand;
  pendingCase: PendingCase;
  onSelect: () => void;
}) {
  const { isPremium } = useStore();
  return (
    <button type="button" className="card-button" onClick={onSelect}>
      <div className="settlement-card">
        <Monogram brand={brand} name={brand.name} />
        <div className="sc-body">
          <div className="sc-top">
            <span className="sc-title">
              {brand.name} · {pendingCase.title}
            </span>
            <span className="status-badge warn">Case pending</span>
          </div>
          <span className="sc-note">{pendingCase.summary}</span>
          <span className="sc-action">
            {isPremium
              ? "As a member, you’ll get an email the day claims open."
              : "Get a Rightful plan and we’ll email you the day claims open."}
          </span>
        </div>
      </div>
    </button>
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

type QuestionId = "life" | "also" | "proof";

/**
 * Three quick questions between the scan and the results. Answers can only add matches
 * (questions 1 and 2) or change the encouragement (question 3); they never lower the total.
 */
function QuestionsStep({ onDone }: { onDone: () => void }) {
  const { brands, settlements, matched, selectedBrandIds, selectedStates, toggleBrand } = useStore();
  const [question, setQuestion] = useState<QuestionId>("life");
  const [picked, setPicked] = useState<ReadonlySet<string>>(new Set());

  const open = settlements.filter(isOpen);
  const matchedIds = new Set(matched.map((settlement) => settlement.id));
  const brandIdsFor = (companies: string[]) =>
    new Set(open.filter((s) => companies.includes(s.company)).map((s) => s.brandId));

  const lifeOptions = LIFE_EVENT_OPTIONS.filter((option) =>
    [...brandIdsFor(option.companies)].some((id) => !selectedBrandIds.has(id)),
  );
  const alsoOptions = ALSO_USED_COMPANIES.flatMap((company) => {
    const offers = open.filter((s) => s.company === company && !selectedBrandIds.has(s.brandId));
    const best = offers.sort((a, b) => b.payoutMax - a.payoutMax)[0];
    return best ? [best] : [];
  });
  const proofOptions = PROOF_OPTIONS.filter((option) => matched.some(option.appliesTo));
  const noProof = matched.filter((s) => !s.proofRequired).length;

  const order: QuestionId[] = ["life", "also", "proof"];
  const available: Record<QuestionId, boolean> = {
    life: lifeOptions.length > 0,
    also: alsoOptions.length > 0,
    proof: proofOptions.length > 0,
  };
  // Fixed count: what question 3 can offer isn't known until questions 1 and 2 are answered.
  const position = order.indexOf(question) + 1;

  // Answers to one question change what the next can offer, so availability is checked on arrival.
  function advance() {
    const nextQuestion = order[order.indexOf(question) + 1];
    setPicked(new Set());
    window.scrollTo(0, 0);
    if (nextQuestion) setQuestion(nextQuestion);
    else onDone();
  }

  // Skip a question that has nothing to offer this person.
  useEffect(() => {
    if (!available[question]) advance();
  });

  const toggle = (id: string) =>
    setPicked((previous) => {
      const nextPicked = new Set(previous);
      if (nextPicked.has(id)) nextPicked.delete(id);
      else nextPicked.add(id);
      return nextPicked;
    });

  // Brands this question's answers would add, and the open settlements they bring.
  const addedBrandIds = new Set<string>();
  if (question === "life") {
    for (const option of lifeOptions) {
      if (picked.has(option.id)) brandIdsFor(option.companies).forEach((id) => addedBrandIds.add(id));
    }
  } else if (question === "also") {
    for (const settlement of alsoOptions) if (picked.has(settlement.id)) addedBrandIds.add(settlement.brandId);
  }
  for (const id of selectedBrandIds) addedBrandIds.delete(id);
  const newMatches = matchSettlements(settlements, addedBrandIds, selectedStates).filter((s) => !matchedIds.has(s.id));

  const submit = () => {
    track("question_answered", { detail: `${question}: ${[...picked].join(",") || "none"}` });
    for (const id of addedBrandIds) toggleBrand(id);
    advance();
  };

  if (!available[question]) return null;

  return (
    <>
      <div className="flow-body">
        <div className="q-progress" aria-label={`Question ${position} of ${order.length}`}>
          {order.map((id, index) => (
            <span key={id} className={index < position ? "on" : ""} />
          ))}
        </div>
        <p className="eyebrow">
          Question {position} of {order.length}
        </p>

        {question === "life" && (
          <>
            <h1 className="flow-title">Which of these have happened to you since 2015?</h1>
            <p className="muted">Tap any that apply. Some settlements cover things people never think to check.</p>
            <div className="q-options">
              {lifeOptions.map((option) => (
                <button
                  key={option.id}
                  type="button"
                  className={`q-option${picked.has(option.id) ? " on" : ""}`}
                  aria-pressed={picked.has(option.id)}
                  onClick={() => toggle(option.id)}
                >
                  {option.label}
                </button>
              ))}
            </div>
          </>
        )}

        {question === "also" && (
          <>
            <h1 className="flow-title">Have you used any of these too?</h1>
            <p className="muted">Each one has a settlement open right now. Tap to add it.</p>
            <div className="q-options">
              {alsoOptions.map((settlement) => (
                <AlsoUsedOption
                  key={settlement.id}
                  settlement={settlement}
                  brand={brands.find((brand) => brand.id === settlement.brandId)}
                  on={picked.has(settlement.id)}
                  onToggle={() => toggle(settlement.id)}
                />
              ))}
            </div>
          </>
        )}

        {question === "proof" && (
          <>
            <h1 className="flow-title">Do you have any of these?</h1>
            <p className="muted">Tap any you have. It’s fine if you don’t.</p>
            <div className="q-options">
              {proofOptions.map((option) => (
                <button
                  key={option.id}
                  type="button"
                  className={`q-option${picked.has(option.id) ? " on" : ""}`}
                  aria-pressed={picked.has(option.id)}
                  onClick={() => toggle(option.id)}
                >
                  {option.label}
                  {picked.has(option.id) && <small className="q-note">{option.feedback}</small>}
                </button>
              ))}
            </div>
          </>
        )}

        <p className="q-feedback" aria-live="polite">
          {question === "proof"
            ? picked.size === 0
              ? noProof > 0
                ? `No problem: ${noProof} of your ${plural(noProof, "claim needs", "claims need")} no proof at all.`
                : "No problem. We’ll show you exactly what each claim needs."
              : `Nice, that helps on ${picked.size} ${plural(picked.size, "claim", "claims")}.`
            : newMatches.length > 0
              ? `+${newMatches.length} ${plural(newMatches.length, "settlement", "settlements")} found${
                  maxTotal(newMatches) > 0 ? ` · up to ${cappedTotal(maxTotal(newMatches))} more` : ""
                }`
              : ""}
        </p>
      </div>
      <div className="sticky-cta">
        <button type="button" className="btn block" onClick={submit}>
          {picked.size > 0 ? "Continue" : question === "also" ? "Skip" : "None of these"}
        </button>
      </div>
    </>
  );
}

function AlsoUsedOption({
  settlement,
  brand,
  on,
  onToggle,
}: {
  settlement: Settlement;
  brand: Brand | undefined;
  on: boolean;
  onToggle: () => void;
}) {
  return (
    <button type="button" className={`q-option q-company${on ? " on" : ""}`} aria-pressed={on} onClick={onToggle}>
      <Monogram brand={brand} name={settlement.company} size={34} />
      <span>
        <b>{settlement.company}</b>
        <small>{settlement.title}</small>
      </span>
      <span className="q-amount">{payoutRange(settlement)}</span>
    </button>
  );
}

/** What members get emailed about, built from real deadlines; entering an email here signs them in. */
function RemindersStep({ onBack }: { onBack: () => void }) {
  const { brands, matched, featured, selectedBrandIds, session } = useStore();
  const navigate = useNavigate();
  const [codeSent, setCodeSent] = useState(false);

  useEffect(() => {
    track("reminders_seen", { detail: browserKind() });
  }, []);

  const rows = reminderSchedule([...matched, ...featured]);
  const shown = rows.slice(0, 5);
  const featuredIds = new Set(featured.map((settlement) => settlement.id));
  const openBrandIds = new Set(matched.map((settlement) => settlement.brandId));
  const pending = brands.filter(
    (brand) => selectedBrandIds.has(brand.id) && !openBrandIds.has(brand.id) && pendingCaseFor(brand),
  );
  const scheduled = new Set([...rows.map((row) => row.settlement.company), ...pending.map((brand) => brand.name)]);
  const watched = WATCHED_BRAND_NAMES.filter((name) => !scheduled.has(name)).slice(0, 4);

  const toPaywall = () => navigate("/paywall");
  const verified = () => {
    pixel("CompleteRegistration", { content_name: "email sign-in" });
    toPaywall();
  };

  return (
    <div className="flow-body">
      <button type="button" className="back-link" onClick={onBack}>
        ← Back
      </button>
      <p className="eyebrow">Almost there</p>
      <h1 className="flow-title">Your reminder schedule</h1>
      <p className="muted">Rightful members get an email before every deadline, so nothing closes on you.</p>

      <ul className="reminder-list">
        {shown.map((row) => (
          <li key={row.settlement.id}>
            <span className="r-date">{shortDay(row.sendOn)}</span>
            <span>
              <b>{row.settlement.company}</b> · {row.settlement.title}
              <small>
                Closes {row.closes}
                {featuredIds.has(row.settlement.id) && " · open to everyone"}
              </small>
            </span>
          </li>
        ))}
        {pending.map((brand) => (
          <li key={brand.id}>
            <span className="r-date">When it opens</span>
            <span>
              <b>{brand.name}</b> · {pendingCaseFor(brand)?.title}
              <small>The day claims open</small>
            </span>
          </li>
        ))}
        {rows.length > shown.length && (
          <li className="r-more">
            + {rows.length - shown.length} more {plural(rows.length - shown.length, "reminder", "reminders")}
          </li>
        )}
      </ul>
      {watched.length > 0 && (
        <p className="muted r-watched">
          👀 We also watch <b>{watched.join(", ")}</b> and {brands.length - watched.length}+ other companies, and email
          members the day a new settlement opens.
        </p>
      )}

      {session ? (
        <>
          <p className="muted">
            Reminders go to <b>{session.user.email}</b>.
          </p>
          <button type="button" className="btn block" onClick={toPaywall}>
            Continue
          </button>
        </>
      ) : isSampleMode ? (
        <button type="button" className="btn block" onClick={toPaywall}>
          Continue in sample mode
        </button>
      ) : (
        <>
          {!codeSent && <h2 className="past-year-title">Where should we send them?</h2>}
          <EmailCodeForm
            submitLabel="Send my reminders here"
            onCodeSent={(email) => setCodeSent(email !== null)}
            onVerified={verified}
          />
          <p className="fine-print center">This creates your Rightful account. No password needed.</p>
        </>
      )}
    </div>
  );
}
