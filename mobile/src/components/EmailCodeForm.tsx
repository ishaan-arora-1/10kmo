import { useEffect, useState } from "react";
import { StyleSheet, View } from "react-native";
import { clientKind, track } from "@/lib/analytics";
import { REVIEW_EMAIL } from "@/lib/config";
import { supabase } from "@/lib/supabase";
import { Button, Field, QuietButton, Txt } from "./primitives";

const RESEND_WAIT_SECONDS = 60;
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/**
 * Email → 6-digit code → signed in, exactly like the website. Supabase creates the account on the
 * first code. Once the code checks out, the store's session listener takes over.
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
  const [reviewPassword, setReviewPassword] = useState<string | null>(null);

  useEffect(() => {
    if (resendIn <= 0) return;
    const timer = setTimeout(() => setResendIn((seconds) => seconds - 1), 1000);
    return () => clearTimeout(timer);
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
    track("signin_code_sent", { detail: clientKind() });
    setCodeSentTo(address);
    onCodeSent?.(address);
    setCode("");
    setResendIn(RESEND_WAIT_SECONDS);
  };

  const submitEmail = () => {
    const address = email.trim().toLowerCase();
    if (!EMAIL_PATTERN.test(address)) {
      setMessage("Enter a valid email address.");
      return;
    }
    if (REVIEW_EMAIL && address === REVIEW_EMAIL) {
      setMessage(null);
      setReviewPassword("");
      return;
    }
    void sendCode(address);
  };

  const submitReviewPassword = async () => {
    if (!supabase || !reviewPassword) return;
    setBusy(true);
    setMessage(null);
    const { error } = await supabase.auth.signInWithPassword({ email: REVIEW_EMAIL, password: reviewPassword });
    if (error) {
      setBusy(false);
      setMessage("That password didn’t work.");
      return;
    }
    onVerified?.();
  };

  const submitCode = async () => {
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
      setMessage("That code didn’t work. It may be mistyped or expired. Try again or send a new code.");
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

  if (reviewPassword !== null) {
    return (
      <>
        <View style={styles.form}>
          <Txt w={600} size={14}>
            Password
          </Txt>
          <Field
            value={reviewPassword}
            onChangeText={setReviewPassword}
            secureTextEntry
            autoFocus
            autoCapitalize="none"
            textContentType="password"
            accessibilityLabel="Password"
            returnKeyType="go"
            onSubmitEditing={() => void submitReviewPassword()}
          />
          <Button onPress={() => void submitReviewPassword()} disabled={busy || !reviewPassword}>
            {busy ? "Signing in…" : "Sign in"}
          </Button>
        </View>
        <QuietButton onPress={() => setReviewPassword(null)}>Use a different email</QuietButton>
        {message && (
          <Txt size={14} color="danger" accessibilityRole="alert">
            {message}
          </Txt>
        )}
      </>
    );
  }

  return (
    <>
      {codeSentTo ? (
        <>
          <Txt color="muted">
            We sent a 6-digit code to <Txt w={700}>{codeSentTo}</Txt>. It can take a minute, and it may land in spam.
          </Txt>
          <View style={styles.form}>
            <Txt w={600} size={14}>
              Code
            </Txt>
            <Field
              mono
              value={code}
              onChangeText={(value) => setCode(value.replace(/\D/g, "").slice(0, 6))}
              keyboardType="number-pad"
              textContentType="oneTimeCode"
              autoComplete="one-time-code"
              maxLength={6}
              placeholder="123456"
              autoFocus
              accessibilityLabel="Code"
              returnKeyType="done"
              onSubmitEditing={() => void submitCode()}
              style={styles.code}
            />
            <Button onPress={() => void submitCode()} disabled={busy}>
              {busy ? "Checking…" : "Verify and continue"}
            </Button>
          </View>
          <View style={styles.links}>
            <QuietButton disabled={busy || resendIn > 0} onPress={() => void sendCode(codeSentTo)}>
              {resendIn > 0 ? `Resend code in ${resendIn}s` : "Resend code"}
            </QuietButton>
            <QuietButton onPress={changeEmail}>Use a different email</QuietButton>
          </View>
        </>
      ) : (
        <View style={styles.form}>
          <Txt w={600} size={14}>
            Email
          </Txt>
          <Field
            value={email}
            onChangeText={setEmail}
            keyboardType="email-address"
            textContentType="emailAddress"
            autoComplete="email"
            autoCapitalize="none"
            autoCorrect={false}
            placeholder="you@example.com"
            accessibilityLabel="Email"
            returnKeyType="send"
            onSubmitEditing={submitEmail}
          />
          <Button onPress={submitEmail} disabled={busy}>
            {busy ? "Sending…" : submitLabel}
          </Button>
        </View>
      )}
      {message && (
        <Txt size={14} color="danger" accessibilityRole="alert">
          {message}
        </Txt>
      )}
    </>
  );
}

const styles = StyleSheet.create({
  form: { gap: 10 },
  code: { fontSize: 24, letterSpacing: 7, textAlign: "center" },
  links: { flexDirection: "row", flexWrap: "wrap", justifyContent: "space-between", gap: 8 },
});
