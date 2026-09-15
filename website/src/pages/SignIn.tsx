import { useEffect, useState, type FormEvent } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { BrandSeal } from "../components/ui";
import { safeNext } from "../lib/models";
import { useStore } from "../lib/store";
import { appleSignInEnabled, supabase } from "../lib/supabase";

export function SignIn() {
  const { session } = useStore();
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const next = safeNext(params.get("next"));
  const [email, setEmail] = useState("");
  const [sentTo, setSentTo] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    if (session) navigate(next, { replace: true });
  }, [session, next, navigate]);

  const redirectTo = `${window.location.origin}/app/sign-in?next=${encodeURIComponent(next)}`;

  const oauth = async (provider: "google" | "apple") => {
    if (!supabase) return;
    setBusy(true);
    setMessage(null);
    const { error } = await supabase.auth.signInWithOAuth({ provider, options: { redirectTo } });
    if (error) {
      setMessage(`We couldn’t start ${provider === "google" ? "Google" : "Apple"} sign-in. Please try again.`);
      setBusy(false);
    }
  };

  const emailLink = async (event: FormEvent) => {
    event.preventDefault();
    if (!supabase || !email.trim()) return;
    setBusy(true);
    setMessage(null);
    const { error } = await supabase.auth.signInWithOtp({
      email: email.trim(),
      options: { emailRedirectTo: redirectTo },
    });
    setBusy(false);
    if (error) setMessage("We couldn’t send the sign-in link. Check the address and try again.");
    else setSentTo(email.trim());
  };

  return (
    <div className="flow narrow">
      <header className="flow-top">
        <Link className="back-link" to={next === "/paywall" ? "/start" : "/"}>
          ← Back
        </Link>
      </header>
      <div className="flow-body">
        <BrandSeal size={40} />
        <h1 className="flow-title">Save your claims</h1>
        <p className="muted">
          Sign in to subscribe securely and keep your companies, claim IDs, and payouts in sync with the Rightful
          iPhone app.
        </p>

        {!supabase ? (
          <button type="button" className="btn block" onClick={() => navigate(next, { replace: true })}>
            Continue in sample mode
          </button>
        ) : sentTo ? (
          <div className="notice" role="status">
            <b>Check your email</b>
            <p>
              We sent a sign-in link to {sentTo}. Open it on this device to continue.
            </p>
            <button type="button" className="btn-quiet" onClick={() => setSentTo(null)}>
              Use a different email
            </button>
          </div>
        ) : (
          <div className="stack">
            {appleSignInEnabled && (
              <button type="button" className="btn block dark" disabled={busy} onClick={() => oauth("apple")}>
                <span aria-hidden="true"></span> Continue with Apple
              </button>
            )}
            <button type="button" className="btn block secondary" disabled={busy} onClick={() => oauth("google")}>
              <b aria-hidden="true">G</b> Continue with Google
            </button>
            <div className="divider">
              <span>or</span>
            </div>
            <form className="stack" onSubmit={emailLink}>
              <label className="field-label" htmlFor="signin-email">
                Email address
              </label>
              <input
                id="signin-email"
                className="field"
                type="email"
                autoComplete="email"
                required
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                placeholder="you@example.com"
              />
              <button type="submit" className="btn block secondary" disabled={busy || !email.trim()}>
                Email me a sign-in link
              </button>
            </form>
          </div>
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
