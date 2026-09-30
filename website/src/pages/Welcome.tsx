import { useCallback, useEffect } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { BrandSeal, ExampleReminder } from "../components/ui";
import { EMAIL_REMINDERS_ENABLED } from "../lib/config";
import { pendingCaseFor, safeNext } from "../lib/models";
import { useStore } from "../lib/store";

/** After subscribing: offer reminders (when email is available), then enter the app. */
export function Welcome() {
  const store = useStore();
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const next = safeNext(params.get("next"));
  const { onboardingCompleted, completeOnboarding } = store;

  const finish = useCallback(() => {
    completeOnboarding();
    navigate(onboardingCompleted ? next : "/", { replace: true });
  }, [completeOnboarding, navigate, onboardingCompleted, next]);

  const offerReminders = EMAIL_REMINDERS_ENABLED && Boolean(store.session) && !onboardingCompleted;
  const pendingNames = store.brands
    .filter((brand) => store.selectedBrandIds.has(brand.id) && pendingCaseFor(brand))
    .map((brand) => brand.name);

  useEffect(() => {
    if (!offerReminders) finish();
  }, [offerReminders, finish]);

  if (!offerReminders) {
    return (
      <div className="boot" aria-busy="true">
        <BrandSeal size={44} />
      </div>
    );
  }

  const enableReminders = async () => {
    await store.setEmailReminders(true);
    finish();
  };

  return (
    <div className="flow narrow">
      <div className="flow-body reminders">
        <ExampleReminder settlement={store.nearest} />
        <h1 className="flow-title">Deadlines don’t wait</h1>
        <p className="muted">
          We’ll email you before a claim closes and when a new settlement matches you
          {pendingNames.length > 0
            ? `, including the day the ${pendingNames.join(" and ")} case opens for claims.`
            : "."}
        </p>
        <button type="button" className="btn block" onClick={enableReminders}>
          Email me reminders
        </button>
        <button type="button" className="btn-quiet" onClick={finish}>
          Not now
        </button>
      </div>
    </div>
  );
}
