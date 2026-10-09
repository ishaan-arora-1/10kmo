import { useEffect, useState, type FormEvent } from "react";
import { track } from "../lib/analytics";
import { supabase } from "../lib/supabase";

const RESEND_WAIT_SECONDS = 60;
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const SENT_KEY = "rightful.codeSentAt";

/**
 * When we last sent a code to each address. Supabase refuses a new code to the same address
 * within 60 seconds, so this survives "Use a different email" and page reloads in this tab.
 */
function lastSent(address: string): number {
  try {
    const map = JSON.parse(sessionStorage.getItem(SENT_KEY) ?? "{}") as Record<string, number>;
    return map[address] ?? 0;
  } catch {
    return 0;
  }
}

function rememberSent(address: string): void {
  try {
    const map = JSON.parse(sessionStorage.getItem(SENT_KEY) ?? "{}") as Record<string, number>;
    map[address] = Date.now();
    sessionStorage.setItem(SENT_KEY, JSON.stringify(map));
  } catch {
    // Storage blocked: the in-page countdown still works.
  }
}

function secondsUntilResend(address: string): number {
  return Math.max(0, Math.ceil(RESEND_WAIT_SECONDS - (Date.now() - lastSent(address)) / 1000));
}

/** Instagram and Facebook open ad links in their own browser; recorded so we can compare sign-in rates. */
export function browserKind(): string {
  const agent = navigator.userAgent;
  if (/Instagram/i.test(agent)) return "instagram";
  if (/FBAN|FBAV|FB_IAB/i.test(agent)) return "facebook";
  return "browser";
}

/**
 * Email → 6-digit code → signed in. Supabase creates the account on the first code.
 * Once the code checks out, the store's session listener takes over; `onVerified` lets the page move on.
 */
export function EmailCodeForm({
  submitLabel = "Email me a code",
  onCodeSent,
  onVerified,
}: {
  submitLabel?: string;
  onCodeSent?: (email: string | null) => void;
  onVerified?: () => void;
}) {
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [codeSentTo, setCodeSentTo] = useState<string | null>(null);
  const [resendIn, setResendIn] = useState(0);

  useEffect(() => {
    if (resendIn <= 0) return;
    const timer = window.setTimeout(() => setResendIn((seconds) => seconds - 1), 1000);
    return () => window.clearTimeout(timer);
  }, [resendIn]);

  const showCodeStep = (address: string) => {
    setCodeSentTo(address);
    onCodeSent?.(address);
    setCode("");
    setResendIn(secondsUntilResend(address));
  };

  const sendCode = async (address: string) => {
    if (!supabase || busy) return;
    // A code went to this address under a minute ago: reuse it instead of asking Supabase again.
    if (secondsUntilResend(address) > 0) {
      setMessage(null);
      showCodeStep(address);
      return;
    }
    setBusy(true);
    setMessage(null);
    const { error } = await supabase.auth.signInWithOtp({ email: address, options: { shouldCreateUser: true } });
    setBusy(false);
    if (error) {
      track("signin_code_failed", { detail: `send: ${error.status ?? "error"}` });
      if (error.status === 429) {
        // Supabase is still holding a recent code for this address: wait it out on the code screen.
        rememberSent(address);
        showCodeStep(address);
        setMessage("A code was sent to this email moments ago. Check your inbox (and spam), or resend when the timer ends.");
      } else {
        setMessage("We couldn’t send a code to that email. Check it and try again.");
      }
      return;
    }
    track("signin_code_sent", { detail: browserKind() });
    rememberSent(address);
    showCodeStep(address);
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
    const { error } = await supabase.auth.verifyOtp({ email: codeSentTo, token, type: "email" });
    if (error) {
      setBusy(false);
      track("signin_code_failed", { detail: `verify: ${error.status ?? "error"}` });
      setMessage("That code didn’t work. Check for a typo, and use the code from the newest email.");
      return;
    }
    track("signin_code_verified");
    onVerified?.();
  };

  const changeEmail = () => {
    setCodeSentTo(null);
    onCodeSent?.(null);
    setCode("");
    setMessage(null);
  };

  return (
    <>
      {codeSentTo ? (
        <>
          <p className="muted">
            We sent a 6-digit code to <b>{codeSentTo}</b>. It can take a minute, and it may land in spam. If
            you asked for more than one, use the code in the newest email.
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
              {resendIn > 0
                ? `Didn’t get it? Resend in ${Math.floor(resendIn / 60)}:${String(resendIn % 60).padStart(2, "0")}`
                : "Resend code"}
            </button>
            <button type="button" className="btn-quiet" onClick={changeEmail}>
              Use a different email
            </button>
          </div>
        </>
      ) : (
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
            {busy ? "Sending…" : submitLabel}
          </button>
        </form>
      )}
      {message && (
        <p className="error-text" role="alert">
          {message}
        </p>
      )}
    </>
  );
}
