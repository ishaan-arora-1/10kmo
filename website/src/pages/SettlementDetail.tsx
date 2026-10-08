import { useEffect, useState, type FormEvent } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { ExternalIcon, LockIcon } from "../components/icons";
import { ClaimStatusBadge, Modal, Monogram, SampleBadge } from "../components/ui";
import { track } from "../lib/analytics";
import { deadlineLabel, daysUntil, isUpcoming, opensLabel, payoutRange, plural } from "../lib/models";
import { useStore } from "../lib/store";
import { isSampleMode } from "../lib/supabase";

export function SettlementDetail() {
  const { id = "" } = useParams();
  const store = useStore();
  const navigate = useNavigate();
  const settlement = store.settlementById(id);
  const [checks, setChecks] = useState<boolean[]>([]);
  const [awaitingReturn, setAwaitingReturn] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [reference, setReference] = useState("");

  useEffect(() => {
    setChecks(settlement ? settlement.eligibilityDetails.map(() => false) : []);
  }, [settlement?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  // When they come back from the official site's tab, ask whether they submitted.
  useEffect(() => {
    if (!awaitingReturn) return;
    const onReturn = () => {
      if (document.visibilityState === "visible") setConfirmOpen(true);
    };
    document.addEventListener("visibilitychange", onReturn);
    window.addEventListener("focus", onReturn);
    return () => {
      document.removeEventListener("visibilitychange", onReturn);
      window.removeEventListener("focus", onReturn);
    };
  }, [awaitingReturn]);

  if (!settlement) {
    return (
      <div className="page">
        <div className="empty-card">
          <b>Settlement not found</b>
          <p className="muted">It may have closed or been removed.</p>
          <Link className="btn" to="/browse">
            Browse open settlements
          </Link>
        </div>
      </div>
    );
  }

  const claim = store.claimFor(settlement.id);
  const eligible = checks.length > 0 && checks.every(Boolean);
  const days = daysUntil(settlement.deadline);
  const upcoming = isUpcoming(settlement);
  const unlocked = store.canFile(settlement);
  const isFreeClaim = !store.isPremium && unlocked;

  const file = () => {
    if (!unlocked) {
      track("file_locked_tap", { userId: store.session?.user.id ?? null, detail: settlement.company });
      const paywall = `/paywall?next=${encodeURIComponent(`/settlements/${settlement.id}`)}`;
      navigate(store.session || isSampleMode ? paywall : `/sign-in?next=${encodeURIComponent(paywall)}`);
      return;
    }
    // Open the tab first: browsers block pop-ups that come after an await.
    window.open(settlement.claimUrl, "_blank", "noopener,noreferrer");
    setAwaitingReturn(true);
    if (store.freeClaimAvailable) {
      track("free_claim_started", { userId: store.session?.user.id ?? null, detail: settlement.company });
      void store.startFreeClaim(settlement);
    }
  };

  const confirmFiled = async (event: FormEvent) => {
    event.preventDefault();
    await store.markFiled(settlement, reference);
    setConfirmOpen(false);
    setAwaitingReturn(false);
    if (store.isPremium) {
      navigate("/claims");
      return;
    }
    // Their free claim is in: the moment to offer the rest.
    track("free_claim_filed", { userId: store.session?.user.id ?? null, detail: settlement.company });
    navigate(`/paywall?from=free_claim&next=${encodeURIComponent("/claims")}`);
  };

  return (
    <div className="page">
      <Link to="/browse" className="back-link">
        ← Browse
      </Link>

      <header className="detail-head">
        <Monogram brand={store.brandById(settlement.brandId)} name={settlement.company} size={52} />
        <div>
          <span className="eyebrow">{settlement.company}</span>
          <h1>{settlement.title}</h1>
        </div>
        {claim && <ClaimStatusBadge status={claim.status} />}
      </header>

      {settlement.isSample && (
        <div className="notice warn">
          <SampleBadge />
          <p>This is demonstration content, not a live claim. The filing button opens the FTC refunds hub.</p>
        </div>
      )}

      {upcoming && (
        <div className="notice">
          <b>Claims open {opensLabel(settlement)}</b>
          <p className="muted">
            The court has approved this settlement, but the administrator hasn’t opened its claim site yet. We’ll
            add the official link here as soon as it’s live, and it’s on your dashboard until then.
          </p>
        </div>
      )}

      <dl className="facts">
        <div>
          <dt>Est. payout</dt>
          <dd className="money">{payoutRange(settlement)}</dd>
        </div>
        <div>
          <dt>Deadline</dt>
          <dd className="deadline">
            {deadlineLabel(settlement)} · {days} {plural(days, "day", "days")}
          </dd>
        </div>
        <div>
          <dt>Proof</dt>
          <dd>{settlement.proofRequired ? "Needed" : "Not needed"}</dd>
        </div>
        <div>
          <dt>Paid out</dt>
          <dd>{settlement.expectedPayoutDate}</dd>
        </div>
      </dl>

      <section className="section">
        <h2 className="section-label">Who qualifies</h2>
        <p>{settlement.qualifiesSummary}</p>
      </section>

      <section className="section">
        <h2 className="section-label">Before you file</h2>
        <div className="checklist">
          {settlement.eligibilityDetails.map((detail, index) => (
            <label key={detail} className="check-row" htmlFor={`eligibility-${index}`}>
              <input
                id={`eligibility-${index}`}
                type="checkbox"
                checked={checks[index] ?? false}
                onChange={(event) =>
                  setChecks((previous) => previous.map((value, i) => (i === index ? event.target.checked : value)))
                }
              />
              <span>{detail}</span>
            </label>
          ))}
        </div>
      </section>

      {/* Right after the official site, or any time later for a claim they started. */}
      {(awaitingReturn || claim?.status === "To file") && !confirmOpen && (
        <div className="notice">
          <b>Finished on the official site?</b>
          <button type="button" className="btn-quiet strong" onClick={() => setConfirmOpen(true)}>
            Mark as filed
          </button>
        </div>
      )}

      <button type="button" className="btn block" onClick={file} disabled={!eligible || upcoming}>
        {upcoming ? (
          <>Claims open {opensLabel(settlement)}</>
        ) : store.freeClaimAvailable ? (
          <>
            File free <ExternalIcon />
          </>
        ) : unlocked ? (
          <>
            File on official site <ExternalIcon />
          </>
        ) : (
          <>
            File your claim <LockIcon />
          </>
        )}
      </button>
      {!eligible && !upcoming && (
        <p className="fine-print center">Confirm both statements to continue.</p>
      )}
      {store.freeClaimAvailable && !upcoming && (
        <p className="fine-print center money">Your first claim is on us. Premium unlocks the rest.</p>
      )}
      {isFreeClaim && !store.freeClaimAvailable && !upcoming && (
        <p className="fine-print center money">This is your free claim.</p>
      )}
      <p className="fine-print center">
        Verified settlement administrator link. Rightful is not a law firm and is not affiliated with this company.
      </p>

      <Modal open={confirmOpen} onClose={() => setConfirmOpen(false)} title="Did you submit your claim?">
        <form className="stack" onSubmit={confirmFiled}>
          <p className="muted">Add the claim ID from the confirmation page so you can check its status later.</p>
          <label className="field-label" htmlFor="claim-reference">
            Claim ID (optional)
          </label>
          <input
            id="claim-reference"
            className="field mono"
            value={reference}
            onChange={(event) => setReference(event.target.value.toUpperCase())}
            autoComplete="off"
          />
          <button type="submit" className="btn block">
            Yes, mark as filed
          </button>
          <button
            type="button"
            className="btn-quiet"
            onClick={() => {
              setConfirmOpen(false);
              setAwaitingReturn(false);
            }}
          >
            Not yet
          </button>
        </form>
      </Modal>
    </div>
  );
}
