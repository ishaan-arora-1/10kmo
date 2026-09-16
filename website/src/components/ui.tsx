import { useEffect, useRef, type ReactNode } from "react";
import {
  daysUntil,
  payoutRange,
  plural,
  recentAmount,
  recentWhen,
  usdCents,
  type Brand,
  type ClaimStatus,
  type RecentPayout,
  type Settlement,
} from "../lib/models";
import { useStore } from "../lib/store";

export function BrandSeal({ size = 32 }: { size?: number }) {
  return (
    <span className="seal" style={{ width: size, height: size, fontSize: size * 0.46 }} aria-hidden="true">
      R
    </span>
  );
}

export function SampleBadge() {
  return <span className="sample-badge">Sample data</span>;
}

export function Monogram({ brand, name, size = 40 }: { brand?: Brand; name: string; size?: number }) {
  return (
    <span
      className="monogram"
      style={{
        width: size,
        height: size,
        borderRadius: size * 0.28,
        background: brand?.monogramColor ?? "var(--money)",
        fontSize: size * 0.38,
      }}
      aria-hidden="true"
    >
      {(brand?.name ?? name).slice(0, 1).toUpperCase()}
    </span>
  );
}

export function SettlementCard({ settlement, action }: { settlement: Settlement; action?: string }) {
  const { brandById } = useStore();
  const days = daysUntil(settlement.deadline);
  return (
    <div className="settlement-card">
      <Monogram brand={brandById(settlement.brandId)} name={settlement.company} />
      <div className="sc-body">
        <div className="sc-top">
          <span className="sc-title">
            {settlement.company} · {settlement.title}
          </span>
          <span className="sc-amount">{payoutRange(settlement)}</span>
        </div>
        <div className="sc-meta">
          <span className={settlement.proofRequired ? "" : "money"}>
            {settlement.proofRequired ? "Proof needed" : "No proof"}
          </span>
          <span aria-hidden="true">·</span>
          <span className="deadline">
            {days} {plural(days, "day", "days")} left
          </span>
          {settlement.isSample && <SampleBadge />}
        </div>
        {action && <span className="sc-action">{action}</span>}
      </div>
    </div>
  );
}

/** What people who used the chosen companies could get in the last 12 months. */
export function PastYearPayouts({ payouts, total, showCheck }: { payouts: RecentPayout[]; total: number; showCheck: boolean }) {
  const { brandById } = useStore();
  if (payouts.length === 0) return null;
  return (
    <section className="past-year" aria-label="Payouts in the last 12 months">
      {showCheck ? (
        <MoneyCheck
          number="0012"
          payee="Users of your apps"
          amountLabel="Past 12 months, up to"
          amount={total}
          memo={`${payouts.length} ${plural(payouts.length, "settlement", "settlements")} · now closed`}
          footer="‖ LAST 12 MONTHS ‖ PER PERSON MAXIMUMS"
        />
      ) : (
        <h2 className="past-year-title">
          In the last 12 months, people who used your apps could get up to {usdCents(total).replace(/\.00$/, "")}
        </h2>
      )}
      <div className="stack">
        {payouts.map((payout) => (
          <div key={payout.id} className="settlement-card past">
            <Monogram brand={brandById(payout.brandId)} name={payout.company} />
            <div className="sc-body">
              <div className="sc-top">
                <span className="sc-title">
                  {payout.company} · {payout.title}
                </span>
                <span className="sc-amount">{recentAmount(payout)}</span>
              </div>
              <div className="sc-meta">
                <span>{recentWhen(payout)}</span>
                <span aria-hidden="true">·</span>
                <span>{payout.amountNote}</span>
              </div>
            </div>
          </div>
        ))}
      </div>
      <p className="fine-print">
        These settlements have closed. They show what these companies paid recently, so you don’t miss the next one.
      </p>
    </section>
  );
}

export function ClaimStatusBadge({ status }: { status: ClaimStatus }) {
  const warn = status === "To file" || status === "Rejected";
  return <span className={`status-badge${warn ? " warn" : ""}`}>{status}</span>;
}

interface MoneyCheckProps {
  number: string;
  payee: string;
  amountLabel: string;
  amount: number;
  memo: string;
  footer: string;
  stamped?: boolean;
}

/** The Rightful signature: found money shown as a check made out to you. */
export function MoneyCheck({ number, payee, amountLabel, amount, memo, footer, stamped = false }: MoneyCheckProps) {
  const amountText = amount > 0 ? usdCents(amount) : "Varies";
  return (
    <div
      className="money-check"
      role="img"
      aria-label={`Check made out to ${payee}. ${amountLabel} ${amountText}. ${memo}.${stamped ? " Paid." : ""}`}
    >
      <div className="mc-row">
        <span className="mc-label">Pay to the order of</span>
        <span className="mc-label">No. {number}</span>
      </div>
      <div className="mc-payee">{payee}</div>
      <div className="mc-row mc-amount-row">
        <span className="mc-label">{amountLabel}</span>
        <span className="mc-amount">{amountText}</span>
      </div>
      <div className="mc-memo">{memo}</div>
      <div className="mc-footer">{footer}</div>
      {stamped && <span className="mc-stamp">PAID</span>}
    </div>
  );
}

export function Modal({
  open,
  onClose,
  title,
  children,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  children: ReactNode;
}) {
  const dialogRef = useRef<HTMLDivElement>(null);
  const closeRef = useRef(onClose);
  closeRef.current = onClose;

  useEffect(() => {
    if (!open) return;
    const previouslyFocused = document.activeElement as HTMLElement | null;
    dialogRef.current?.querySelector<HTMLElement>("input, textarea, button:not(.icon-btn), a")?.focus();
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") closeRef.current();
    };
    document.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
      previouslyFocused?.focus();
    };
  }, [open]);

  if (!open) return null;
  return (
    <div
      className="modal-backdrop"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <div className="modal" role="dialog" aria-modal="true" aria-labelledby="modal-title" ref={dialogRef}>
        <div className="modal-head">
          <h2 id="modal-title">{title}</h2>
          <button type="button" className="icon-btn" onClick={onClose} aria-label="Close">
            ×
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}

export function Toggle({
  id,
  checked,
  onChange,
  label,
  description,
  disabled,
}: {
  id: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
  label: string;
  description?: string;
  disabled?: boolean;
}) {
  return (
    <label className="toggle-row" htmlFor={id}>
      <span className="toggle-text">
        <span className="toggle-label">{label}</span>
        {description && <span className="toggle-desc">{description}</span>}
      </span>
      <input
        id={id}
        type="checkbox"
        role="switch"
        className="switch"
        checked={checked}
        disabled={disabled}
        onChange={(event) => onChange(event.target.checked)}
      />
    </label>
  );
}

export function ExampleReminder({ settlement }: { settlement: Settlement | null }) {
  const title = settlement
    ? `${settlement.company} settlement closes in 3 days`
    : "A settlement you match closes in 3 days";
  const detail = settlement && settlement.payoutMax > 0
    ? `Est. ${payoutRange(settlement)}. Filing takes about 3 minutes.`
    : "Filing takes about 3 minutes.";
  return (
    <div className="example-reminder" aria-label={`Example reminder: ${title}. ${detail}`}>
      <span className="er-icon" aria-hidden="true">
        R
      </span>
      <div>
        <div className="er-head">
          <b>Rightful</b>
          <span>now</span>
        </div>
        <div className="er-title">{title}</div>
        <div className="er-detail">{detail}</div>
      </div>
    </div>
  );
}
