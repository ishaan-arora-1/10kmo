import { useLocalSearchParams, useRouter, type Href } from "expo-router";
import { useEffect, useState } from "react";
import { Pressable } from "react-native";
import { EmailCodeForm } from "@/components/EmailCodeForm";
import { Button, FinePrint, FlowTitle, Muted, Txt } from "@/components/primitives";
import { FlowScreen } from "@/components/screens";
import { BrandSeal } from "@/components/ui";
import { clientKind, track } from "@/lib/analytics";
import { safeNext } from "@/lib/models";
import { useStore } from "@/lib/store";
import { supabase } from "@/lib/supabase";

export default function SignIn() {
  const { session } = useStore();
  const router = useRouter();
  const params = useLocalSearchParams<{ next?: string }>();
  const next = safeNext(params.next ?? null);
  const [codeSentTo, setCodeSentTo] = useState<string | null>(null);

  useEffect(() => {
    track("signin_seen", { detail: clientKind() });
  }, []);

  useEffect(() => {
    if (session) router.replace(next as Href);
  }, [session, next, router]);

  const back = () => (router.canGoBack() ? router.back() : router.replace("/start"));

  return (
    <FlowScreen
      narrow
      header={
        <Pressable onPress={back} accessibilityRole="button" hitSlop={8}>
          <Txt w={600} size={15} color="muted">
            ← Back
          </Txt>
        </Pressable>
      }
    >
      <BrandSeal size={40} />
      <FlowTitle>{codeSentTo ? "Check your email" : "Save your claims"}</FlowTitle>

      {!supabase ? (
        <Button onPress={() => router.replace(next as Href)}>Continue in sample mode</Button>
      ) : (
        <>
          {!codeSentTo && (
            <Muted>
              Sign in to subscribe securely and keep your companies, claim IDs, and payouts in sync across your devices.
            </Muted>
          )}
          <EmailCodeForm onCodeSent={setCodeSentTo} />
        </>
      )}

      <FinePrint center>Rightful never asks for your bank, card, or email password.</FinePrint>
    </FlowScreen>
  );
}
