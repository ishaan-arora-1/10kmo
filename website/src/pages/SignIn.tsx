import { useEffect, useState, type FormEvent } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { BrandSeal } from "../components/ui";
import { track } from "../lib/analytics";
import { pixel } from "../lib/pixel";
import { safeNext } from "../lib/models";
import { useStore } from "../lib/store";
import { supabase } from "../lib/supabase";

const RESEND_WAIT_SECONDS = 60;
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const METHOD_KEY = "rightful.signinMethod";

/** Remembers how someone signed in: the screen reloads after Google's redirect and while the account syncs. */
function rememberMethod(method: "email" | "google") {
  try {
    sessionStorage.setItem(METHOD_KEY, method);
  } catch {
    // Storage can be blocked; the sign-up event then just says "google".
  }
}

function recalledMethod(): string {
  try {
    return sessionStorage.getItem(METHOD_KEY) ?? "google";
  } catch {
    return "google";
  }
}

/** Instagram and Facebook open ad links in their own browser, where Google blocks sign-in. */
function browserKind(): string {
  const agent = navigator.userAgent;
  if (/Instagram/i.test(agent)) return "instagram";
  if (/FBAN|FBAV|FB_IAB/i.test(agent)) return "facebook";
  return "browser";
}

export function SignIn() {
  const { session } = useStore();
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const next = safeNext(params.get("next"));
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [codeSentTo, setCodeSentTo] = useState<string | null>(null);
  const [resendIn, setResendIn] = useState(0);

  useEffect(() => {
    track("signin_seen", { detail: browserKind() });
  }, []);

  useEffect(() => {
    if (session) {
      pixel("CompleteRegistration", { content_name: `${recalledMethod()} sign-in` });
      navigate(next, { replace: true });
    }
  }, [session, next, navigate]);

  useEffect(() => {
    if (resendIn <= 0) return;
    const timer = window.setTimeout(() => setResendIn((seconds) => seconds - 1), 1000);
    return () => window.clearTimeout(timer);
  }, [resendIn]);

  const sendCode = async (address: string) => {
    if (!supabase) return;
    setBusy(true);
    setMessage(null);
    const { error } = await supabase.auth.signInWithOtp({ email: address, options: { shouldCreateUser: true } });
    setBusy(false);
    if (error) {
      track("signin_code_failed", { detail: `send: ${error.status ?? "error"}` });
      setMessage(
        error.status === 429
          ? "Too many codes requested. Wait a minute and try again."
          : "We couldn’t send a code to that email. Check it and try again.",
      );
      return;
    }
    track("signin_code_sent", { detail: browserKind() });
    setCodeSentTo(address);
    setCode("");
    setResendIn(RESEND_WAIT_SECONDS);
  };

  const submitEmail = (event: FormEvent) => {
    event.preventDefault();
    const address = email.trim().toLowerCase();
    if (!EMAIL_PATTERN.test(address)) {
      setMessage("Enter a valid email address.");
      return;
    }
    void sendCode(address);
  };

  const submitCode = async (event: FormEvent) => {
    event.preventDefault();
    if (!supabase || !codeSentTo) return;
    const token = code.replace(/\D/g, "");
    if (token.length < 6) {
      setMessage("Enter the 6-digit code from the email.");
      return;
    }
    setBusy(true);
    setMessage(null);
    rememberMethod("email");
    const { error } = await supabase.auth.verifyOtp({ email: codeSentTo, token, type: "email" });
    if (error) {
      setBusy(false);
      track("signin_code_failed", { detail: `verify: ${error.status ?? "error"}` });
      setMessage("That code didn’t work. It may be mistyped or expired. Try again or send a new code.");
      return;
    }
    track("signin_code_verified");
    // The session listener in the store picks this up and the effect above moves on.
  };

  const changeEmail = () => {
    setCodeSentTo(null);
    setCode("");
    setMessage(null);
  };

  const signInWithGoogle = async () => {
    if (!supabase) return;
    setBusy(true);
    setMessage(null);
    track("signin_started", { detail: browserKind() });
    rememberMethod("google");
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
        <h1 className="flow-title">{codeSentTo ? "Check your email" : "Save your claims"}</h1>

        {!supabase ? (
          <button type="button" className="btn block" onClick={() => navigate(next, { replace: true })}>
            Continue in sample mode
          </button>
        ) : codeSentTo ? (
          <>
            <p className="muted">
              We sent a 6-digit code to <b>{codeSentTo}</b>. It can take a minute, and it may land in spam.
            </p>
            <form className="signin-form" onSubmit={submitCode}>
              <label className="field-label" htmlFor="signin-code">
                Code
              </label>
              <input
                id="signin-code"
                className="field code-field"
                inputMode="numeric"
                autoComplete="one-time-code"
                maxLength={6}
                placeholder="123456"
                value={code}
                onChange={(event) => setCode(event.target.value.replace(/\D/g, ""))}
                autoFocus
              />
              <button type="submit" className="btn block" disabled={busy}>
                {busy ? "Checking…" : "Verify and continue"}
              </button>
            </form>
            <div className="signin-links">
              <button
                type="button"
                className="btn-quiet"
                disabled={busy || resendIn > 0}
                onClick={() => void sendCode(codeSentTo)}
              >
                {resendIn > 0 ? `Resend code in ${resendIn}s` : "Resend code"}
              </button>
              <button type="button" className="btn-quiet" onClick={changeEmail}>
                Use a different email
              </button>
            </div>
          </>
        ) : (
          <>
            <p className="muted">
              Sign in to subscribe securely and keep your companies, claim IDs, and payouts in sync across your
              devices.
            </p>
            <form className="signin-form" onSubmit={submitEmail}>
              <label className="field-label" htmlFor="signin-email">
                Email
              </label>
              <input
                id="signin-email"
                className="field"
                type="email"
                inputMode="email"
                autoComplete="email"
                placeholder="you@example.com"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
              />
              <button type="submit" className="btn block" disabled={busy}>
                {busy ? "Sending…" : "Email me a code"}
              </button>
            </form>
            <p className="divider">or</p>
            <button type="button" className="btn block secondary" disabled={busy} onClick={signInWithGoogle}>
              <b aria-hidden="true">G</b> Continue with Google
            </button>
          </>
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
