import { useState } from "react";
import { Link } from "react-router-dom";
import { ArrowRightIcon } from "../components/icons";
import { StatePicker } from "../components/StatePicker";
import { Modal, Monogram, SampleBadge, SettlementCard } from "../components/ui";
import { daysUntil, payoutRange, plural, usd } from "../lib/models";
import { useStore } from "../lib/store";

export function Home() {
  const store = useStore();
  const [statesOpen, setStatesOpen] = useState(false);

  const toFile = store.matched.filter((settlement) => !store.claimFor(settlement.id));
  const urgent = toFile[0];
  const rest = toFile.slice(1);
  const filedCount = store.claims.filter((claim) => claim.status !== "Paid").length;
  const paidCount = store.claims.filter((claim) => claim.status === "Paid").length;
  const needsStates = store.selectedStates.size === 0;

  return (
    <div className="page">
      <header className="page-head">
        <h1>Hi there</h1>
        <p>{store.isSampleData ? "Previewing Rightful with sample data" : "Here’s what’s waiting for you"}</p>
      </header>

      <section className="waiting-card" aria-label="Money waiting for you">
        <div className="wc-top">
          <span className="wc-label">Waiting for you</span>
          {store.isSampleData && <span className="wc-sample">Sample</span>}
        </div>
        <div className="wc-amount">
          {store.waitingMax > 0 || store.matched.length === 0 ? usd(store.waitingMax) : "Varies"}
        </div>
        <div className="wc-bar" aria-hidden="true">
          <i className="to-file" style={{ flexGrow: toFile.length }} />
          <i className="filed" style={{ flexGrow: filedCount }} />
          <i className="paid" style={{ flexGrow: paidCount }} />
        </div>
        <div className="wc-metrics">
          <span>
            <b>{toFile.length}</b> to file
          </span>
          <span>
            <b>{filedCount}</b> filed
          </span>
          <span>
            <b>{usd(store.paidTotal)}</b> paid
          </span>
        </div>
      </section>

      {urgent && (
        <section className="section">
          <h2 className="section-label">Most urgent</h2>
          <Link to={`/settlements/${urgent.id}`} className="urgent-card">
            <Monogram brand={store.brandById(urgent.brandId)} name={urgent.company} size={44} />
            <span className="uc-body">
              <b>
                {urgent.company} · {urgent.title}
              </b>
              <span className="deadline">
                Closes in {daysUntil(urgent.deadline)} {plural(daysUntil(urgent.deadline), "day", "days")}
              </span>
              {urgent.isSample && <SampleBadge />}
            </span>
            <span className="uc-side">
              <span className="sc-amount">{payoutRange(urgent)}</span>
              <span className="pill-dark">File</span>
            </span>
          </Link>
        </section>
      )}

      <section className="section">
        <h2 className="section-label">Ready to file</h2>
        {toFile.length === 0 ? (
          <div className="empty-card">
            <b>You’re caught up</b>
            <p className="muted">We’ll keep checking for new matches.</p>
          </div>
        ) : rest.length === 0 ? (
          <p className="muted small">Your most urgent claim is the only one left to file.</p>
        ) : (
          <div className="stack">
            {rest.map((settlement) => (
              <Link key={settlement.id} to={`/settlements/${settlement.id}`} className="card-link">
                <SettlementCard settlement={settlement} action="Review eligibility" />
              </Link>
            ))}
          </div>
        )}
      </section>

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

      <p className="fine-print">Rightful is not a law firm and is not affiliated with settlement administrators.</p>

      <Modal open={statesOpen} onClose={() => setStatesOpen(false)} title="States you’ve lived in">
        <StatePicker />
        <button type="button" className="btn block" onClick={() => setStatesOpen(false)}>
          Done
        </button>
      </Modal>
    </div>
  );
}
