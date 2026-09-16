import { useEffect, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { BrandSeal } from "../components/ui";
import { safeNext } from "../lib/models";
import { useStore } from "../lib/store";
import { supabase } from "../lib/supabase";

export function SignIn() {
  const { session } = useStore();
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const next = safeNext(params.get("next"));
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    if (session) navigate(next, { replace: true });
  }, [session, next, navigate]);

  const signInWithGoogle = async () => {
    if (!supabase) return;
    setBusy(true);
    setMessage(null);
    const { error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: { redirectTo: `${window.location.origin}/app/sign-in?next=${encodeURIComponent(next)}` },
    });
    if (error) {
      setMessage("We couldn’t start Google sign-in. Please try again.");
      setBusy(false);
    }
  };

  return (
    <div className="flow narrow">
      <header className="flow-top">
        <Link className="back-link" to={next.startsWith("/paywall") ? "/start" : "/"}>
          ← Back
        </Link>
      </header>
      <div className="flow-body">
        <BrandSeal size={40} />
        <h1 className="flow-title">Save your claims</h1>
        <p className="muted">
          Sign in to subscribe securely and keep your companies, claim IDs, and payouts in sync across your devices.
        </p>

        {supabase ? (
          <button type="button" className="btn block secondary" disabled={busy} onClick={signInWithGoogle}>
            <b aria-hidden="true">G</b> {busy ? "Opening Google…" : "Continue with Google"}
          </button>
        ) : (
          <button type="button" className="btn block" onClick={() => navigate(next, { replace: true })}>
            Continue in sample mode
          </button>
        )}

        {message && (
          <p className="error-text" role="alert">
            {message}
          </p>
        )}
        <p className="fine-print center">Rightful never asks for your bank, card, or email password.</p>
      </div>
    </div>
  );
}
