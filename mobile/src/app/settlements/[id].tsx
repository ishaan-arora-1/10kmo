import { useLocalSearchParams, useRouter } from "expo-router";
import * as WebBrowser from "expo-web-browser";
import { useEffect, useState } from "react";
import { AppState, Platform, Pressable, StyleSheet, View } from "react-native";
import { ExternalIcon, LockIcon } from "@/components/icons";
import {
  Button,
  Checkbox,
  EmptyCard,
  Eyebrow,
  Field,
  FinePrint,
  Notice,
  QuietButton,
  SampleBadge,
  SectionLabel,
  Sheet,
  Txt,
} from "@/components/primitives";
import { PageScreen, Section } from "@/components/screens";
import { ClaimStatusBadge, Monogram } from "@/components/ui";
import { track } from "@/lib/analytics";
import { deadlineLabel, daysUntil, isUpcoming, opensLabel, payoutRange, plural } from "@/lib/models";
import { useStore } from "@/lib/store";
import { isSampleMode } from "@/lib/supabase";
import { useColors } from "@/theme";

export default function SettlementDetail() {
  const { id = "" } = useLocalSearchParams<{ id: string }>();
  const store = useStore();
  const c = useColors();
  const router = useRouter();
  const settlement = store.settlementById(id);
  // Ticks belong to one settlement, so opening another starts unticked.
  const [ticked, setTicked] = useState<{ id: string; values: boolean[] }>({ id: "", values: [] });
  const [awaitingReturn, setAwaitingReturn] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [reference, setReference] = useState("");

  // Android opens the official site in a separate browser tab: ask when they come back to the app.
  useEffect(() => {
    if (!awaitingReturn || Platform.OS !== "android") return;
    const subscription = AppState.addEventListener("change", (state) => {
      if (state === "active") setConfirmOpen(true);
    });
    return () => subscription.remove();
  }, [awaitingReturn]);

  const back = () => (router.canGoBack() ? router.back() : router.navigate("/browse"));

  if (!settlement) {
    return (
      <PageScreen>
        <EmptyCard
          title="Settlement not found"
          body="It may have closed or been removed."
          action={
            <Button block={false} onPress={() => router.navigate("/browse")}>
              Browse open settlements
            </Button>
          }
        />
      </PageScreen>
    );
  }

  const checks =
    ticked.id === settlement.id ? ticked.values : settlement.eligibilityDetails.map(() => false);
  const toggleCheck = (index: number) =>
    setTicked({ id: settlement.id, values: checks.map((value, i) => (i === index ? !value : value)) });
  const claim = store.claimFor(settlement.id);
  const eligible = checks.length > 0 && checks.every(Boolean);
  const days = daysUntil(settlement.deadline);
  const upcoming = isUpcoming(settlement);
  const unlocked = store.canFile(settlement);
  const isFreeClaim = !store.isPremium && unlocked;

  const file = async () => {
    if (!unlocked) {
      track("file_locked_tap", { userId: store.session?.user.id ?? null, detail: settlement.company });
      const paywall = `/paywall?next=${encodeURIComponent(`/settlements/${settlement.id}`)}`;
      router.push(store.session || isSampleMode ? paywall : `/sign-in?next=${encodeURIComponent(paywall)}`);
      return;
    }
    if (store.freeClaimAvailable) {
      track("free_claim_started", { userId: store.session?.user.id ?? null, detail: settlement.company });
      void store.startFreeClaim(settlement);
    }
    setAwaitingReturn(true);
    const result = await WebBrowser.openBrowserAsync(settlement.claimUrl, {
      controlsColor: c.money,
      toolbarColor: c.paper,
      dismissButtonStyle: "done",
    });
    // iOS returns once they close the official site; ask whether they submitted.
    if (result.type !== "opened") setConfirmOpen(true);
  };

  const confirmFiled = async () => {
    await store.markFiled(settlement, reference);
    setConfirmOpen(false);
    setAwaitingReturn(false);
    if (store.isPremium) {
      router.navigate("/claims");
      return;
    }
    // Their free claim is in: the moment to offer the rest.
    track("free_claim_filed", { userId: store.session?.user.id ?? null, detail: settlement.company });
    router.push(`/paywall?from=free_claim&next=${encodeURIComponent("/claims")}`);
  };

  const fileLabel = upcoming
    ? `Claims open ${opensLabel(settlement)}`
    : store.freeClaimAvailable
      ? "File free"
      : unlocked
        ? "File on official site"
        : "File your claim";

  const facts: [string, string, "money" | "deadline" | "ink"][] = [
    ["Est. payout", payoutRange(settlement), "money"],
    ["Deadline", `${deadlineLabel(settlement)} · ${days} ${plural(days, "day", "days")}`, "deadline"],
    ["Proof", settlement.proofRequired ? "Needed" : "Not needed", "ink"],
    ["Paid out", settlement.expectedPayoutDate, "ink"],
  ];

  return (
    <PageScreen>
      <Pressable onPress={back} accessibilityRole="button" hitSlop={8} style={{ alignSelf: "flex-start" }}>
        <Txt w={600} size={15} color="muted">
          ← Back
        </Txt>
      </Pressable>

      <View style={styles.head}>
        <Monogram brand={store.brandById(settlement.brandId)} name={settlement.company} size={52} />
        <View style={{ flex: 1 }}>
          <Eyebrow>{settlement.company}</Eyebrow>
          <Txt f="display" w={800} size={30} lh={1.07} accessibilityRole="header">
            {settlement.title}
          </Txt>
        </View>
        {claim && <ClaimStatusBadge status={claim.status} />}
      </View>

      {settlement.isSample && (
        <Notice warn>
          <SampleBadge />
          <Txt size={14} color="muted" style={{ flex: 1 }}>
            This is demonstration content, not a live claim. The filing button opens the FTC refunds hub.
          </Txt>
        </Notice>
      )}

      {upcoming && (
        <Notice>
          <Txt w={700}>Claims open {opensLabel(settlement)}</Txt>
          <Txt color="muted" style={{ width: "100%" }}>
            The court has approved this settlement, but the administrator hasn’t opened its claim site yet. We’ll add the
            official link here as soon as it’s live, and it’s on your dashboard until then.
          </Txt>
        </Notice>
      )}

      <View style={[styles.facts, { backgroundColor: c.line, borderColor: c.line }]}>
        {[facts.slice(0, 2), facts.slice(2)].map((row, rowIndex) => (
          <View key={rowIndex} style={styles.factRow}>
            {row.map(([label, value, color]) => (
              <View key={label} style={[styles.fact, { backgroundColor: c.surface }]}>
                <Txt f="mono" size={11} ls={0.08} upper color="muted">
                  {label}
                </Txt>
                <Txt w={700} color={color} style={{ fontVariant: ["tabular-nums"] }}>
                  {value}
                </Txt>
              </View>
            ))}
          </View>
        ))}
      </View>

      <Section>
        <SectionLabel>Who qualifies</SectionLabel>
        <Txt>{settlement.qualifiesSummary}</Txt>
      </Section>

      <Section>
        <SectionLabel>Before you file</SectionLabel>
        <View style={{ gap: 10 }}>
          {settlement.eligibilityDetails.map((detail, index) => {
            const checked = checks[index] ?? false;
            return (
              <Pressable
                key={detail}
                onPress={() => toggleCheck(index)}
                accessibilityRole="checkbox"
                accessibilityState={{ checked }}
                style={[styles.checkRow, { backgroundColor: c.surface, borderColor: c.line }]}
              >
                <View style={{ paddingTop: 2 }}>
                  <Checkbox checked={checked} />
                </View>
                <Txt style={{ flex: 1 }}>{detail}</Txt>
              </Pressable>
            );
          })}
        </View>
      </Section>

      {/* Right after the official site, or any time later for a claim they started. */}
      {(awaitingReturn || claim?.status === "To file") && !confirmOpen && (
        <Notice>
          <Txt w={700} style={{ flex: 1 }}>
            Finished on the official site?
          </Txt>
          <QuietButton color="ink" strong onPress={() => setConfirmOpen(true)}>
            Mark as filed
          </QuietButton>
        </Notice>
      )}

      <Button
        onPress={() => void file()}
        disabled={!eligible || upcoming}
        icon={upcoming ? undefined : (color) => (unlocked ? <ExternalIcon color={color} /> : <LockIcon color={color} />)}
      >
        {fileLabel}
      </Button>
      {!eligible && !upcoming && <FinePrint center>Confirm both statements to continue.</FinePrint>}
      {store.freeClaimAvailable && !upcoming && (
        <Txt size={13} w={600} color="money" center>
          Your first claim is on us. Premium unlocks the rest.
        </Txt>
      )}
      {isFreeClaim && !store.freeClaimAvailable && !upcoming && (
        <Txt size={13} w={600} color="money" center>
          This is your free claim.
        </Txt>
      )}
      <FinePrint center>
        Verified settlement administrator link. Rightful is not a law firm and is not affiliated with this company.
      </FinePrint>

      <Sheet open={confirmOpen} onClose={() => setConfirmOpen(false)} title="Did you submit your claim?">
        <Txt color="muted">Add the claim ID from the confirmation page so you can check its status later.</Txt>
        <Txt w={600} size={14}>
          Claim ID (optional)
        </Txt>
        <Field
          mono
          value={reference}
          onChangeText={(value) => setReference(value.toUpperCase())}
          autoCapitalize="characters"
          autoCorrect={false}
          accessibilityLabel="Claim ID (optional)"
          returnKeyType="done"
          onSubmitEditing={() => void confirmFiled()}
        />
        <Button onPress={() => void confirmFiled()}>Yes, mark as filed</Button>
        <QuietButton
          onPress={() => {
            setConfirmOpen(false);
            setAwaitingReturn(false);
          }}
        >
          Not yet
        </QuietButton>
      </Sheet>
    </PageScreen>
  );
}

const styles = StyleSheet.create({
  head: { flexDirection: "row", alignItems: "center", gap: 14 },
  facts: { gap: 1, borderWidth: 1, borderRadius: 14, overflow: "hidden" },
  factRow: { flexDirection: "row", gap: 1 },
  fact: { flex: 1, paddingVertical: 14, paddingHorizontal: 16, gap: 3 },
  checkRow: { flexDirection: "row", gap: 12, padding: 14, borderRadius: 12, borderWidth: 1 },
});
