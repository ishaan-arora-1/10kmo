import { useState, type FormEvent } from "react";
import { Link } from "react-router-dom";
import { ClaimStatusBadge, Modal, MoneyCheck, Monogram, SampleBadge } from "../components/ui";
import { usd, type Claim, type Settlement } from "../lib/models";
import { renderPaidCheckImage, shareOrDownload } from "../lib/share";
import { useStore } from "../lib/store";

export function Claims() {
  const store = useStore();
  const [selected, setSelected] = useState<{ claim: Claim; settlement: Settlement } | null>(null);

  const tracked = [...store.claims]
    .map((claim) => ({ claim, settlement: store.settlementById(claim.settlementId) }))
    .filter((item): item is { claim: Claim; settlement: Settlement } => Boolean(item.settlement))
    .sort((a, b) => (b.claim.filedAt ?? "").localeCompare(a.claim.filedAt ?? ""));

  return (
    <div className="page">
      <header className="page-head">
        <h1>My claims</h1>
        <p>
          {store.claims.length} tracked · {usd(store.paidTotal)} paid
        </p>
      </header>

      {tracked.length === 0 ? (
        <div className="empty-card">
          <b>No claims filed yet</b>
          <p className="muted">When you finish a claim on its official site, it’ll appear here until you’re paid.</p>
          <Link to="/browse" className="btn">
            Browse matches
          </Link>
        </div>
      ) : (
        <div className="stack">
          {tracked.map(({ claim, settlement }) => (
            <article key={claim.id} className="claim-card">
              <div className="cc-top">
                <Monogram brand={store.brandById(settlement.brandId)} name={settlement.company} />
                <div className="cc-body">
                  <Link to={`/settlements/${settlement.id}`} className="cc-title">
                    {settlement.company} · {settlement.title}
                  </Link>
                  {claim.claimRef && <span className="mono small muted">ID {claim.claimRef}</span>}
                  {settlement.isSample && <SampleBadge />}
                </div>
                <ClaimStatusBadge status={claim.status} />
              </div>
              <div className="cc-bottom">
                <span>
                  <span className="mono-label">Expected</span>
                  <span>{settlement.expectedPayoutDate}</span>
                </span>
                {claim.status === "Paid" && claim.paidAmount != null ? (
                  <button
                    type="button"
                    className="paid-amount"
                    onClick={() => setSelected({ claim, settlement })}
                    aria-label={`Paid ${usd(claim.paidAmount)}. Share your check`}
                  >
                    {usd(claim.paidAmount)}
                  </button>
                ) : (
                  <button type="button" className="pill-money" onClick={() => setSelected({ claim, settlement })}>
                    I got paid
                  </button>
                )}
              </div>
            </article>
          ))}
        </div>
      )}

      {selected && (
        <PaidModal claim={selected.claim} settlement={selected.settlement} onClose={() => setSelected(null)} />
      )}
    </div>
  );
}

function PaidModal({ claim, settlement, onClose }: { claim: Claim; settlement: Settlement; onClose: () => void }) {
  const store = useStore();
  const [amountText, setAmountText] = useState("");
  const [paid, setPaid] = useState<number | null>(claim.status === "Paid" ? claim.paidAmount : null);
  const [shareNote, setShareNote] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const amount = Number.parseFloat(amountText);
  const valid = Number.isFinite(amount) && amount > 0;

  const save = async (event: FormEvent) => {
    event.preventDefault();
    if (!valid) return;
    await store.markPaid(claim.id, Math.round(amount * 100) / 100);
    setPaid(Math.round(amount * 100) / 100);
  };

  const share = async () => {
    if (paid == null) return;
    setBusy(true);
    setShareNote(null);
    try {
      const image = await renderPaidCheckImage(paid, settlement.company, settlement.isSample);
      const outcome = await shareOrDownload(
        image,
        "rightful-paid-check.png",
        `I got ${usd(paid)} from a settlement I didn’t know I was owed. Find yours with Rightful.`,
      );
      if (outcome === "downloaded") setShareNote("Image saved. Post it anywhere.");
    } catch {
      setShareNote("The image couldn’t be created in this browser.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal open onClose={onClose} title={paid == null ? "You got paid!" : settlement.isSample ? "Sample payout" : "You got paid"}>
      {paid == null ? (
        <form className="stack" onSubmit={save}>
          <p className="muted">
            How much arrived from the {settlement.company} settlement?
          </p>
          <label className="field-label" htmlFor="paid-amount">
            Amount received
          </label>
          <div className="money-field">
            <span aria-hidden="true">$</span>
            <input
              id="paid-amount"
              inputMode="decimal"
              placeholder="0.00"
              value={amountText}
              onChange={(event) => setAmountText(event.target.value.replace(/[^0-9.]/g, ""))}
            />
          </div>
          <button type="submit" className="btn block" disabled={!valid}>
            Mark as paid
          </button>
        </form>
      ) : (
        <div className="stack">
          <MoneyCheck
            number="0001"
            payee="Me"
            amountLabel="Amount"
            amount={paid}
            memo={`${settlement.company} settlement`}
            footer={settlement.isSample ? "SAMPLE · NOT A REAL PAYOUT" : "‖ FIND YOURS ‖ RIGHTFUL"}
            stamped
          />
          <button type="button" className="btn block" onClick={share} disabled={busy}>
            {busy ? "Preparing image…" : settlement.isSample ? "Share product preview" : "Share the win"}
          </button>
          {shareNote && (
            <p className="fine-print center" role="status">
              {shareNote}
            </p>
          )}
          <button type="button" className="btn-quiet" onClick={onClose}>
            Done
          </button>
        </div>
      )}
    </Modal>
  );
}
