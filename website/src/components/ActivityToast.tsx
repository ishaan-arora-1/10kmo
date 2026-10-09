import { useEffect, useState } from "react";

/** A real person who filed, shown on the paywall (with their permission). */
export const RECENT_FILER = { name: "Aryan G.", place: "California", company: "Apple", amount: "up to $95" };

const SHOW_AFTER_MS = 2000;
const SEEN_KEY = "rightful.recentFilerSeen";
const VISIBLE_MS = 5000;

function seenBefore(): boolean {
  try {
    return localStorage.getItem(SEEN_KEY) === "1";
  } catch {
    return false;
  }
}

/**
 * Slides up from the bottom the first time someone opens the paywall (not on later visits),
 * shows a thin bar counting down how long it stays, then slides away. It can be closed early.
 */
export function ActivityToast() {
  const [phase, setPhase] = useState<"waiting" | "in" | "out">("waiting");

  useEffect(() => {
    if (seenBefore()) return;
    const show = window.setTimeout(() => {
      setPhase("in");
      try {
        localStorage.setItem(SEEN_KEY, "1");
      } catch {
        // Storage blocked (private mode): it may show again, which is fine.
      }
    }, SHOW_AFTER_MS);
    const hide = window.setTimeout(() => setPhase("out"), SHOW_AFTER_MS + VISIBLE_MS);
    return () => {
      window.clearTimeout(show);
      window.clearTimeout(hide);
    };
  }, []);

  if (phase === "waiting") return null;
  const { name, place, company, amount } = RECENT_FILER;
  return (
    <div className={`activity-toast${phase === "in" ? " in" : ""}`} role="status" aria-live="polite">
      <span className="at-avatar" aria-hidden="true">
        {name.slice(0, 1)}
      </span>
      <span className="at-text">
        <b>{name}</b> from {place} filed his {company} claim · <span className="money">{amount}</span>
      </span>
      <button type="button" className="at-close" onClick={() => setPhase("out")} aria-label="Dismiss">
        ×
      </button>
      <span className="at-progress" style={{ animationDuration: `${VISIBLE_MS}ms` }} aria-hidden="true" />
    </div>
  );
}
