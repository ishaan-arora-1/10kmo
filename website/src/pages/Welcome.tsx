import { useEffect, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { BrandSeal, ExampleReminder } from "../components/ui";
import { safeNext } from "../lib/models";
import { useStore } from "../lib/store";

/** After checkout: confirm the subscription, offer reminders, then enter the app. */
export function Welcome() {
  const store = useStore();
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const next = safeNext(params.get("next"));
  const fromCheckout = params.get("checkout") === "success";
  const [confirming, setConfirming] = useState(fromCheckout && !store.isPremium);
  const [timedOut, setTimedOut] = useState(false);
  const { refreshPlan } = store;

  // Stripe's webhook usually lands within seconds; poll the plan briefly.
  useEffect(() => {
    if (!confirming) return;
    let stopped = false;
    let attempts = 0;
    const tick = async () => {
      const plan = await refreshPlan();
      if (stopped) return;
      if (plan !== "free") {
        setConfirming(false);
        return;
      }
      attempts += 1;
      if (attempts >= 12) {
        setConfirming(false);
        setTimedOut(true);
        return;
      }
      window.setTimeout(tick, 1500);
    };
    tick();
    return () => {
      stopped = true;
    };
  }, [confirming, refreshPlan]);

  const finish = () => {
    const alreadyOnboarded = store.onboardingCompleted;
    store.completeOnboarding();
    navigate(alreadyOnboarded ? next : "/", { replace: true });
  };

  // People who were already using the app skip the reminders pitch and go back to what they were doing.
  useEffect(() => {
    if (!confirming && !timedOut && store.onboardingCompleted && store.isPremium) {
      navigate(next, { replace: true });
    }
  }, [confirming, timedOut, store.onboardingCompleted, store.isPremium, next, navigate]);

  if (confirming) {
    return (
      <div className="flow narrow">
        <div className="flow-body center-block" aria-live="polite">
          <div className="spinner" aria-hidden="true" />
          <h1 className="flow-title center">Confirming your subscription…</h1>
          <p className="muted center">This usually takes a few seconds.</p>
        </div>
      </div>
    );
  }

  if (timedOut && !store.isPremium) {
    return (
      <div className="flow narrow">
        <div className="flow-body center-block">
          <BrandSeal size={40} />
          <h1 className="flow-title center">Payment received, still confirming</h1>
          <p className="muted center">
            Stripe can take a minute. Filing unlocks automatically once it’s confirmed — refresh this page or
            continue for now.
          </p>
          <button type="button" className="btn block" onClick={finish}>
            Continue to Rightful
          </button>
        </div>
      </div>
    );
  }

  const enableReminders = async () => {
    if (store.session) await store.setEmailReminders(true);
    finish();
  };

  return (
    <div className="flow narrow">
      <div className="flow-body reminders">
        <ExampleReminder settlement={store.nearest} />
        <h1 className="flow-title">Deadlines don’t wait</h1>
        <p className="muted">
          We’ll email you before a claim closes and when a new settlement matches you. On iPhone, Rightful sends
          notifications instead.
        </p>
        <button type="button" className="btn block" onClick={enableReminders}>
          {store.session ? "Email me reminders" : "Continue"}
        </button>
        <button type="button" className="btn-quiet" onClick={finish}>
          Not now
        </button>
      </div>
    </div>
  );
}
