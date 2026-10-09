import { useRouter } from "expo-router";
import { useRef, useState } from "react";
import { Pressable, StyleSheet, TextInput, View } from "react-native";
import { Button, EmptyCard, FinePrint, PageTitle, QuietButton, SampleBadge, Sheet, Txt } from "@/components/primitives";
import { PageScreen, Stack } from "@/components/screens";
import { ShareCard } from "@/components/ShareCard";
import { ClaimStatusBadge, MoneyCheck, Monogram } from "@/components/ui";
import { usd, type Claim, type Settlement } from "@/lib/models";
import { sharePaidCheck } from "@/lib/share";
import { useStore } from "@/lib/store";
import { fontFamily, useColors } from "@/theme";

export default function Claims() {
  const store = useStore();
  const c = useColors();
  const router = useRouter();
  const [selected, setSelected] = useState<{ claim: Claim; settlement: Settlement } | null>(null);

  const tracked = [...store.claims]
    .map((claim) => ({ claim, settlement: store.settlementById(claim.settlementId) }))
    .filter((item): item is { claim: Claim; settlement: Settlement } => Boolean(item.settlement))
    .sort((a, b) => (b.claim.filedAt ?? "").localeCompare(a.claim.filedAt ?? ""));

  return (
    <PageScreen>
      <View>
        <PageTitle>My claims</PageTitle>
        <Txt color="muted" style={{ marginTop: 4 }}>
          {store.claims.length} tracked · {usd(store.paidTotal)} paid
        </Txt>
      </View>

      {tracked.length === 0 ? (
        <EmptyCard
          title="No claims filed yet"
          body="When you finish a claim on its official site, it’ll appear here until you’re paid."
          action={
            <Button block={false} onPress={() => router.navigate("/browse")}>
              Browse matches
            </Button>
          }
        />
      ) : (
        <Stack>
          {tracked.map(({ claim, settlement }) => (
            <View key={claim.id} style={[styles.card, { backgroundColor: c.surface, borderColor: c.line }]}>
              <View style={styles.top}>
                <Monogram brand={store.brandById(settlement.brandId)} name={settlement.company} />
                <View style={{ flex: 1, minWidth: 0, gap: 4 }}>
                  <Txt w={700} onPress={() => router.push(`/settlements/${settlement.id}`)} accessibilityRole="link">
                    {settlement.company} · {settlement.title}
                  </Txt>
                  {claim.claimRef && (
                    <Txt f="mono" size={14} color="muted">
                      ID {claim.claimRef}
                    </Txt>
                  )}
                  {settlement.isSample && <SampleBadge />}
                </View>
                <ClaimStatusBadge status={claim.status} />
              </View>
              <View style={[styles.bottom, { borderTopColor: c.line }]}>
                <View style={{ gap: 2 }}>
                  <Txt f="mono" size={10} ls={0.1} upper color="muted">
                    Expected
                  </Txt>
                  <Txt size={14}>{settlement.expectedPayoutDate}</Txt>
                </View>
                {claim.status === "Paid" && claim.paidAmount != null ? (
                  <Pressable
                    onPress={() => setSelected({ claim, settlement })}
                    accessibilityRole="button"
                    accessibilityLabel={`Paid ${usd(claim.paidAmount)}. Share your check`}
                  >
                    <Txt f="display" w={800} size={26} color="money">
                      {usd(claim.paidAmount)}
                    </Txt>
                  </Pressable>
                ) : (
                  <Pressable
                    onPress={() => setSelected({ claim, settlement })}
                    accessibilityRole="button"
                    style={({ pressed }) => [styles.gotPaid, { backgroundColor: c.moneySoft, opacity: pressed ? 0.8 : 1 }]}
                  >
                    <Txt w={700} size={14} color="money">
                      I got paid
                    </Txt>
                  </Pressable>
                )}
              </View>
            </View>
          ))}
        </Stack>
      )}

      {selected && (
        <PaidSheet claim={selected.claim} settlement={selected.settlement} onClose={() => setSelected(null)} />
      )}
    </PageScreen>
  );
}

function PaidSheet({ claim, settlement, onClose }: { claim: Claim; settlement: Settlement; onClose: () => void }) {
  const store = useStore();
  const c = useColors();
  const [amountText, setAmountText] = useState("");
  const [paid, setPaid] = useState<number | null>(claim.status === "Paid" ? claim.paidAmount : null);
  const [shareNote, setShareNote] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const card = useRef<View>(null);

  const amount = Number.parseFloat(amountText);
  const valid = Number.isFinite(amount) && amount > 0;

  const save = async () => {
    if (!valid) return;
    const rounded = Math.round(amount * 100) / 100;
    await store.markPaid(claim.id, rounded);
    setPaid(rounded);
  };

  const share = async () => {
    if (paid == null) return;
    setBusy(true);
    setShareNote(null);
    try {
      await sharePaidCheck(card, `I got ${usd(paid)} from a settlement I didn’t know I was owed. Find yours with Rightful.`);
    } catch {
      setShareNote("The image couldn’t be created on this device.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <Sheet
      open
      onClose={onClose}
      title={paid == null ? "You got paid!" : settlement.isSample ? "Sample payout" : "You got paid"}
    >
      {paid == null ? (
        <>
          <Txt color="muted">How much arrived from the {settlement.company} settlement?</Txt>
          <Txt w={600} size={14}>
            Amount received
          </Txt>
          <View style={[styles.moneyField, { backgroundColor: c.surface, borderColor: c.line }]}>
            <Txt f="display" w={700} size={30} lh={1.2}>
              $
            </Txt>
            <TextInput
              value={amountText}
              onChangeText={(value) => setAmountText(value.replace(/[^0-9.]/g, ""))}
              keyboardType="decimal-pad"
              placeholder="0.00"
              placeholderTextColor={c.muted}
              accessibilityLabel="Amount received"
              autoFocus
              style={[styles.moneyInput, { color: c.ink, fontFamily: fontFamily("display", 700) }]}
            />
          </View>
          <Button onPress={() => void save()} disabled={!valid}>
            Mark as paid
          </Button>
        </>
      ) : (
        <>
          <MoneyCheck
            number="0001"
            payee="Me"
            amountLabel="Amount"
            amount={paid}
            memo={`${settlement.company} settlement`}
            footer={settlement.isSample ? "SAMPLE · NOT A REAL PAYOUT" : "‖ FIND YOURS ‖ RIGHTFUL"}
            stamped
          />
          <Button onPress={() => void share()} disabled={busy}>
            {busy ? "Preparing image…" : settlement.isSample ? "Share product preview" : "Share the win"}
          </Button>
          {shareNote && (
            <FinePrint center accessibilityRole="alert">
              {shareNote}
            </FinePrint>
          )}
          <QuietButton onPress={onClose}>Done</QuietButton>
          {/* Rendered off screen, captured as the share image. */}
          <View style={styles.offscreen} pointerEvents="none" accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
            <ShareCard ref={card} amount={paid} company={settlement.company} isSample={settlement.isSample} />
          </View>
        </>
      )}
    </Sheet>
  );
}

const styles = StyleSheet.create({
  card: { gap: 14, padding: 16, borderRadius: 16, borderWidth: 1 },
  top: { flexDirection: "row", alignItems: "flex-start", gap: 12 },
  bottom: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    gap: 12,
    paddingTop: 12,
    borderTopWidth: 1,
  },
  gotPaid: { paddingVertical: 8, paddingHorizontal: 14, borderRadius: 99 },
  moneyField: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    height: 64,
    paddingHorizontal: 16,
    borderRadius: 14,
    borderWidth: 1,
  },
  moneyInput: { flex: 1, minWidth: 0, fontSize: 30, paddingVertical: 0 },
  offscreen: { position: "absolute", left: -10000, top: 0 },
});
