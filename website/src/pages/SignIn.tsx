import { useEffect, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { browserKind, EmailCodeForm } from "../components/EmailCodeForm";
import { BrandSeal } from "../components/ui";
import { track } from "../lib/analytics";
import { pixel } from "../lib/pixel";
import { safeNext } from "../lib/models";
import { useStore } from "../lib/store";
import { supabase } from "../lib/supabase";

export function SignIn() {
  const { session } = useStore();
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const next = safeNext(params.get("next"));
  const [codeSentTo, setCodeSentTo] = useState<string | null>(null);
  // Just paid without signing in, with an email that already has an account.
  const paid = params.get("paid") === "1";
  const paidEmail = params.get("email") ?? "";

  useEffect(() => {
    track("signin_seen", { detail: browserKind() });
  }, []);

  useEffect(() => {
    if (session) {
      pixel("CompleteRegistration", { content_name: "email sign-in" });
      navigate(next, { replace: true });
    }
  }, [session, next, navigate]);

  return (
    <div className="flow narrow">
      <header className="flow-top">
        <Link className="back-link" to={next.startsWith("/paywall") ? "/start" : "/"}>
          ← Back
        </Link>
      </header>
      <div className="flow-body">
        <BrandSeal size={40} />
        <h1 className="flow-title">
          {codeSentTo ? "Check your email" : paid ? "Payment received. One last step" : "Save your claims"}
        </h1>

        {!supabase ? (
          <button type="button" className="btn block" onClick={() => navigate(next, { replace: true })}>
            Continue in sample mode
          </button>
        ) : (
          <>
            {!codeSentTo && paid && (
              <p className="muted">
                {paidEmail} already has a ClaimRightful account, and your plan is now on it. Sign in with the code
                we email you to see your claims.
              </p>
            )}
            {!codeSentTo && !paid && (
              <p className="muted">
                Sign in to subscribe securely and keep your companies, claim IDs, and payouts in sync across your
                devices.
              </p>
            )}
            <EmailCodeForm onCodeSent={setCodeSentTo} initialEmail={paidEmail} />
          </>
        )}

        <p className="fine-print center">ClaimRightful never asks for your bank, card, or email password.</p>
      </div>
    </div>
  );
}
