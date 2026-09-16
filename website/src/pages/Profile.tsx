import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { BrandPicker } from "../components/BrandPicker";
import { StatePicker } from "../components/StatePicker";
import { Modal, Toggle } from "../components/ui";
import { EMAIL_REMINDERS_ENABLED, SUPPORT_EMAIL } from "../lib/config";
import { useStore } from "../lib/store";
import { isSampleMode } from "../lib/supabase";

const longDate = (iso: string) =>
  new Date(iso).toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" });

export function Profile() {
  const store = useStore();
  const navigate = useNavigate();
  const [brandsOpen, setBrandsOpen] = useState(false);
  const [statesOpen, setStatesOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [cancelOpen, setCancelOpen] = useState(false);
  const [working, setWorking] = useState(false);
  const [cancelNote, setCancelNote] = useState<string | null>(null);

  const email = store.session?.user.email ?? null;
  const planName = store.plan === "free" ? null : store.plan === "yearly" ? "Yearly" : "Weekly";

  const upgrade = () => {
    const paywall = `/paywall?next=${encodeURIComponent("/profile")}`;
    navigate(store.session || isSampleMode ? paywall : `/sign-in?next=${encodeURIComponent(paywall)}`);
  };

  const confirmCancel = async () => {
    setWorking(true);
    const accessUntil = await store.cancelSubscription();
    setWorking(false);
    if (accessUntil === null) return;
    setCancelOpen(false);
    setCancelNote(
      accessUntil
        ? `Canceled. You keep Premium until ${longDate(accessUntil)} and won’t be charged again.`
        : "Canceled. You won’t be charged again.",
    );
  };

  const confirmDelete = async () => {
    setWorking(true);
    const deleted = await store.deleteAccount();
    setWorking(false);
    if (deleted) {
      setDeleteOpen(false);
      navigate("/start", { replace: true });
    }
  };

  const membershipDetail =
    store.planSource === "razorpay"
      ? store.planRenews === false && store.planExpiresAt
        ? `Ends ${longDate(store.planExpiresAt)}`
        : store.planExpiresAt
          ? `Renews ${longDate(store.planExpiresAt)}`
          : "Active"
      : store.planSource === "apple"
        ? "Subscribed on iPhone"
        : store.planSource === "grant"
          ? "Complimentary access"
          : "Active";

  return (
    <div className="page">
      <header className="page-head">
        <h1>Profile</h1>
        <p>{email ? `Signed in as ${email}` : "Your progress is saved in this browser"}</p>
      </header>

      {!store.session && !isSampleMode && (
        <Link to={`/sign-in?next=${encodeURIComponent("/profile")}`} className="find-more">
          <span>
            <b>Protect your claims</b>
            <span className="muted">Sign in with Google to keep your claims safe across devices.</span>
          </span>
          <span aria-hidden="true">→</span>
        </Link>
      )}

      <section className="settings-group">
        <h2 className="section-label">Your matches</h2>
        <button type="button" className="setting-row" onClick={() => setBrandsOpen(true)}>
          <span>Companies you’ve used</span>
          <span className="muted">{store.selectedBrandIds.size} selected ›</span>
        </button>
        <button type="button" className="setting-row" onClick={() => setStatesOpen(true)}>
          <span>States you’ve lived in</span>
          <span className="muted">
            {store.selectedStates.size === 0 ? "Add ›" : `${[...store.selectedStates].sort().join(", ")} ›`}
          </span>
        </button>
      </section>

      <section className="settings-group">
        <h2 className="section-label">Membership</h2>
        {planName ? (
          <>
            <div className="setting-row static">
              <span>Rightful Premium · {planName}</span>
              <span className="muted">{membershipDetail}</span>
            </div>
            {store.planSource === "razorpay" && store.planRenews !== false && (
              <button type="button" className="setting-row" onClick={() => setCancelOpen(true)}>
                <span>Cancel subscription</span>
                <span className="muted">›</span>
              </button>
            )}
            {store.planSource === "apple" && (
              <p className="muted small setting-note">
                Manage your iPhone subscription in Settings → [your name] → Subscriptions.
              </p>
            )}
          </>
        ) : store.isPremium ? (
          <div className="setting-row static">
            <span>Sample premium</span>
            <span className="muted">No payment taken</span>
          </div>
        ) : (
          <button type="button" className="setting-row" onClick={upgrade}>
            <span>Free plan</span>
            <span className="money strong">Upgrade to file and track ›</span>
          </button>
        )}
        {cancelNote && (
          <p className="muted small setting-note" role="status">
            {cancelNote}
          </p>
        )}
      </section>

      {EMAIL_REMINDERS_ENABLED && store.session && (
        <section className="settings-group">
          <h2 className="section-label">Reminders</h2>
          <Toggle
            id="email-reminders"
            checked={store.emailReminders}
            onChange={(on) => store.setEmailReminders(on)}
            label="Email reminders"
            description={`New matches, deadlines, and payout windows, sent to ${email ?? "your email"}`}
          />
        </section>
      )}

      <section className="settings-group">
        <h2 className="section-label">About</h2>
        <a className="setting-row" href="/privacy">
          <span>Privacy policy</span>
          <span className="muted">›</span>
        </a>
        <a className="setting-row" href="/terms">
          <span>Terms of use</span>
          <span className="muted">›</span>
        </a>
        <a className="setting-row" href="/support">
          <span>Help &amp; support</span>
          <span className="muted">{SUPPORT_EMAIL} ›</span>
        </a>
      </section>

      <section className="settings-group">
        <h2 className="section-label">Account</h2>
        {store.session && (
          <button
            type="button"
            className="setting-row"
            onClick={async () => {
              await store.signOut();
              navigate("/start", { replace: true });
            }}
          >
            <span>Sign out</span>
            <span className="muted">›</span>
          </button>
        )}
        {isSampleMode ? (
          <button
            type="button"
            className="setting-row danger"
            onClick={() => {
              store.resetSample();
              navigate("/start", { replace: true });
            }}
          >
            <span>Reset sample experience</span>
          </button>
        ) : (
          <button type="button" className="setting-row danger" onClick={() => setDeleteOpen(true)}>
            <span>{store.session ? "Delete account and data" : "Clear data in this browser"}</span>
          </button>
        )}
      </section>

      <p className="fine-print center">Rightful 1.0 · Not a law firm. Not affiliated with settlement administrators.</p>

      <Modal open={brandsOpen} onClose={() => setBrandsOpen(false)} title="Companies you’ve used">
        <BrandPicker idPrefix="profile-brands" />
        <button type="button" className="btn block" onClick={() => setBrandsOpen(false)}>
          Done
        </button>
      </Modal>

      <Modal open={statesOpen} onClose={() => setStatesOpen(false)} title="States you’ve lived in">
        <StatePicker />
        <button type="button" className="btn block" onClick={() => setStatesOpen(false)}>
          Done
        </button>
      </Modal>

      <Modal open={cancelOpen} onClose={() => setCancelOpen(false)} title="Cancel your subscription?">
        <div className="stack">
          <p className="muted">
            You’ll keep Premium until the end of the period you’ve paid for, and you won’t be charged again.
          </p>
          <button type="button" className="btn block danger" onClick={confirmCancel} disabled={working}>
            {working ? "Canceling…" : "Cancel subscription"}
          </button>
          <button type="button" className="btn-quiet" onClick={() => setCancelOpen(false)}>
            Keep Premium
          </button>
        </div>
      </Modal>

      <Modal
        open={deleteOpen}
        onClose={() => setDeleteOpen(false)}
        title={store.session ? "Delete your account?" : "Clear this browser’s data?"}
      >
        <div className="stack">
          <p className="muted">
            {store.session
              ? "This permanently deletes your profile, companies, and claims, and cancels any web subscription."
              : "This removes your selected companies and claims from this browser."}
          </p>
          <button type="button" className="btn block danger" onClick={confirmDelete} disabled={working}>
            {working ? "Deleting…" : store.session ? "Delete account and all data" : "Clear data"}
          </button>
          <button type="button" className="btn-quiet" onClick={() => setDeleteOpen(false)}>
            Cancel
          </button>
        </div>
      </Modal>
    </div>
  );
}
