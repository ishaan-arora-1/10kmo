import { useRouter } from "expo-router";
import { useEffect, useState } from "react";
import { Pressable, StyleSheet, View } from "react-native";
import { ArrowRightIcon, GiftIcon, LockIcon } from "@/components/icons";
import { Button, FinePrint, PageTitle, SampleBadge, SectionLabel, Sheet, Txt, EmptyCard } from "@/components/primitives";
import { PageScreen, Section, Stack } from "@/components/screens";
import { StatePicker } from "@/components/StatePicker";
import { CardNote, CardRow, CardTop, MoneyCheck, Monogram, PayoutList } from "@/components/ui";
import { track } from "@/lib/analytics";
import {
  cappedTotal,
  daysUntil,
  isUpcoming,
  maxTotal,
  opensLabel,
  payoutRange,
  plural,
  type Settlement,
} from "@/lib/models";
import { useStore } from "@/lib/store";
import { alpha, useColors } from "@/theme";

export default function Home() {
  const store = useStore();
  const c = useColors();
  const router = useRouter();
  const [statesOpen, setStatesOpen] = useState(false);

  useEffect(() => {
    track("dashboard_seen", { userId: store.session?.user.id ?? null, detail: store.isPremium ? "member" : "free" });
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // The spotlight claim first, then their own matches, then claims open to everyone; within each,
  // soonest deadline first, with claims whose site hasn't opened yet last.
  const featuredIds = new Set(store.featured.map((settlement) => settlement.id));
  const toFile = [...store.toFile].sort(
    (a, b) =>
      Number(b.isSpotlight) - Number(a.isSpotlight) ||
      Number(featuredIds.has(a.id)) - Number(featuredIds.has(b.id)) ||
      Number(isUpcoming(a)) - Number(isUpcoming(b)) ||
      a.deadline.localeCompare(b.deadline),
  );
  const filedCount = store.claims.filter((claim) => claim.status !== "Paid").length;
  const firstOpen = toFile.find((settlement) => !isUpcoming(settlement));
  // Highlight the spotlight claim; without one, the most urgent claim.
  const spotlight = toFile.find((settlement) => settlement.isSpotlight && !isUpcoming(settlement));
  const flagFor = (settlement: Settlement, index: number): string | null =>
    spotlight
      ? settlement === spotlight
        ? "Top pick"
        : null
      : index === 0 && settlement === firstOpen && daysUntil(settlement.deadline) <= 30
        ? "Most urgent"
        : null;
  const needsStates = store.selectedStates.size === 0;
  const missedTotal = store.missed.reduce((total, payout) => total + payout.amountMax, 0);
  const watching = store.estimates.filter(({ brand }) => !toFile.some((s) => s.brandId === brand.id));

  // Never show $0 or "Varies": their matches, pending/past figures and claims open to everyone,
  // else what they missed, else what settlements paid this year. Same total as the results screen.
  const upTo = store.waitingMax + store.estimateMax + store.featuredMax;
  const hero =
    upTo > 0
      ? { headline: `You may qualify for up to ${cappedTotal(upTo)}`, payee: "You", label: "Up to", amount: upTo }
      : missedTotal > 0
        ? { headline: `You missed up to ${cappedTotal(missedTotal)}`, payee: "You", label: "Missed", amount: missedTotal }
        : {
            headline: `People got up to ${cappedTotal(store.history.total)} this past year`,
            payee: "People like you",
            label: "Paid this past year",
            amount: store.history.total,
          };

  // Their own companies first, then the claims open to everyone.
  const payees = [
    ...new Set([
      ...toFile.filter((s) => !featuredIds.has(s.id)).map((s) => s.company),
      ...watching.map(({ brand }) => brand.name),
      ...toFile.filter((s) => featuredIds.has(s.id)).map((s) => s.company),
    ]),
  ];
  const memo =
    payees.length > 0
      ? `${payees.slice(0, 3).join(", ")}${payees.length > 3 ? ` + ${payees.length - 3} more` : ""}`
      : "Settlements you could have claimed";

  // Free accounts see everything; the plan unlocks filing.
  const unlock = () => router.push(`/paywall?next=${encodeURIComponent("/")}`);
  const locked = toFile.filter((settlement) => !store.canFile(settlement));
  const lockedMax = maxTotal(locked);
  // Accounts that used a free claim while it was offered keep that one claim unlocked.
  const usedFreeClaim = store.claims.length > 0;

  return (
    <PageScreen>
      <View>
        <PageTitle>{hero.headline}</PageTitle>
        {store.isSampleData && (
          <Txt color="muted" style={{ marginTop: 4 }}>
            Previewing Rightful with sample data
          </Txt>
        )}
      </View>

      <MoneyCheck
        number={String(toFile.length).padStart(4, "0")}
        payee={hero.payee}
        amountLabel={hero.label}
        amount={hero.amount}
        capped
        memo={memo}
        footer={`‖ ${toFile.length} TO FILE ‖ ${filedCount} FILED`}
      />

      {!store.isPremium &&
        (store.freeClaimAvailable && toFile.some((settlement) => !isUpcoming(settlement)) ? (
          <View style={[styles.unlock, { backgroundColor: c.moneySoft, borderColor: alpha(c.money, 0.3) }]}>
            <GiftIcon color={c.money} />
            <View style={{ flex: 1, gap: 2 }}>
              <Txt f="mono" w={500} size={12} ls={0.1} upper color="money">
                Your first claim is free
              </Txt>
              <Txt size={15}>Pick any claim below and file it now.</Txt>
            </View>
          </View>
        ) : (
          <Pressable
            onPress={unlock}
            accessibilityRole="link"
            style={({ pressed }) => [
              styles.unlock,
              { backgroundColor: c.moneySoft, borderColor: alpha(c.money, 0.3), opacity: pressed ? 0.8 : 1 },
            ]}
          >
            <LockIcon color={c.money} />
            <View style={{ flex: 1, gap: 2 }}>
              <Txt f="mono" w={500} size={12} ls={0.1} upper color="money">
                {usedFreeClaim ? "Free claim used" : "Free plan"}
              </Txt>
              <Txt size={15}>
                {locked.length > 0
                  ? `Unlock your ${
                      !usedFreeClaim
                        ? `${locked.length} ${plural(locked.length, "claim", "claims")}`
                        : locked.length === 1
                          ? "other claim"
                          : `other ${locked.length} claims`
                    }${lockedMax > 0 ? ` (up to ${cappedTotal(lockedMax)})` : ""}`
                  : "Get emailed the day your companies settle"}
              </Txt>
            </View>
            <ArrowRightIcon color={c.money} />
          </Pressable>
        ))}

      <Section>
        <SectionLabel>Ready to file{toFile.length > 0 && ` · ${toFile.length}`}</SectionLabel>
        {toFile.length === 0 ? (
          <EmptyCard title="You’re caught up" body="We’ll keep checking for new matches." />
        ) : (
          <Stack>
            {toFile.map((settlement, index) => (
              <ClaimTile
                key={settlement.id}
                settlement={settlement}
                flag={flagFor(settlement, index)}
                openToAll={featuredIds.has(settlement.id)}
                locked={!store.canFile(settlement)}
                free={store.freeClaimAvailable}
              />
            ))}
          </Stack>
        )}
      </Section>

      {watching.length > 0 && (
        <Section>
          <SectionLabel>Watching for you</SectionLabel>
          <Stack>
            {watching.map(({ brand, estimate }) => (
              <CardRow key={brand.id} brand={brand} name={brand.name}>
                <CardTop title={`${brand.name} · ${estimate.label}`} amount={`Up to ${cappedTotal(estimate.amount)}`} />
                <CardNote>{estimate.note}</CardNote>
              </CardRow>
            ))}
          </Stack>
        </Section>
      )}

      {store.missed.length > 0 && (
        <Section>
          <SectionLabel>You missed up to {cappedTotal(missedTotal)}</SectionLabel>
          <PayoutList payouts={store.missed} />
        </Section>
      )}

      <Pressable
        onPress={() => (needsStates ? setStatesOpen(true) : router.navigate("/browse"))}
        accessibilityRole="button"
        style={({ pressed }) => [
          styles.findMore,
          { backgroundColor: c.surface, borderColor: pressed ? c.checkLine : c.line },
        ]}
      >
        <View style={{ flex: 1, gap: 3 }}>
          <Txt w={700}>Find more money</Txt>
          <Txt color="muted">
            {needsStates
              ? "Add the states you’ve lived in to check state-only settlements."
              : "Browse open settlements and add companies you’ve used."}
          </Txt>
        </View>
        <ArrowRightIcon color={c.money} />
      </Pressable>

      <FinePrint>
        Amounts are the most each settlement pays, from court filings. Most people get less. Rightful is not a law firm
        and is not affiliated with settlement administrators.
      </FinePrint>

      <Sheet open={statesOpen} onClose={() => setStatesOpen(false)} title="States you’ve lived in">
        <StatePicker />
        <Button onPress={() => setStatesOpen(false)}>Done</Button>
      </Sheet>
    </PageScreen>
  );
}

/** One claim to file: what it pays, how long is left, and whether proof is needed. */
function ClaimTile({
  settlement,
  flag,
  openToAll,
  locked,
  free,
}: {
  settlement: Settlement;
  flag: string | null;
  openToAll: boolean;
  locked: boolean;
  free: boolean;
}) {
  const { brandById } = useStore();
  const c = useColors();
  const router = useRouter();
  const upcoming = isUpcoming(settlement);
  const days = daysUntil(settlement.deadline);
  const action = upcoming ? "Details" : free ? "File free" : "File";
  return (
    <Pressable
      onPress={() => router.push(`/settlements/${settlement.id}`)}
      accessibilityRole="link"
      accessibilityLabel={`${settlement.company}, ${settlement.title}, ${payoutRange(settlement)}. ${action}`}
      style={({ pressed }) => [
        styles.tile,
        flag
          ? { backgroundColor: c.deadlineSoft, borderColor: alpha(c.deadline, 0.35) }
          : { backgroundColor: c.surface, borderColor: pressed ? c.checkLine : c.line },
        pressed && { opacity: 0.92 },
      ]}
    >
      <View style={styles.tileRow}>
        <Monogram brand={brandById(settlement.brandId)} name={settlement.company} size={44} />
        <View style={{ flex: 1, minWidth: 0, gap: 3 }}>
          {flag && (
            <Txt f="mono" size={11} ls={0.1} upper color="deadline">
              {flag}
            </Txt>
          )}
          <Txt w={700}>{settlement.company}</Txt>
          <Txt size={14} color="muted">
            {settlement.title}
          </Txt>
          <View style={styles.tags}>
            {upcoming ? (
              <Tag>Opens {opensLabel(settlement)}</Tag>
            ) : (
              <Tag tone={days <= 14 ? "hot" : undefined}>{closesIn(days)}</Tag>
            )}
            {!settlement.proofRequired && <Tag tone="money">No proof needed</Tag>}
            {openToAll && <Tag>Open to most people</Tag>}
            {settlement.isSample && <SampleBadge />}
          </View>
        </View>
      </View>
      <View style={styles.tileSide}>
        <Txt f="mono" w={500} size={15} color="money">
          {payoutRange(settlement)}
        </Txt>
        <View style={[styles.pillDark, { backgroundColor: free && !upcoming ? c.money : c.ink }]}>
          <Txt w={700} size={13} lh={1.2} style={{ color: free && !upcoming ? c.onMoney : c.onInk }}>
            {action}
          </Txt>
          {locked && !upcoming && <LockIcon color={c.onInk} size={13} />}
        </View>
      </View>
    </Pressable>
  );
}

function Tag({ children, tone }: { children: React.ReactNode; tone?: "hot" | "money" }) {
  const c = useColors();
  const colors =
    tone === "hot"
      ? { fg: c.deadline, bg: alpha(c.deadline, 0.14) }
      : tone === "money"
        ? { fg: c.money, bg: c.moneySoft }
        : { fg: c.muted, bg: c.sunk };
  return (
    <View style={[styles.tag, { backgroundColor: colors.bg }]}>
      <Txt f="mono" w={500} size={11} lh={1.3} style={{ color: colors.fg }}>
        {children}
      </Txt>
    </View>
  );
}

function dayCount(days: number): string {
  return `${days} ${plural(days, "day", "days")}`;
}

function closesIn(days: number): string {
  return days === 0 ? "Closes today" : `${dayCount(days)} left`;
}

const styles = StyleSheet.create({
  unlock: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingVertical: 14,
    paddingHorizontal: 16,
    borderRadius: 16,
    borderWidth: 1,
  },
  tile: { padding: 16, borderRadius: 16, borderWidth: 1, gap: 10 },
  tileRow: { flexDirection: "row", gap: 14, alignItems: "flex-start" },
  tags: { flexDirection: "row", flexWrap: "wrap", gap: 6, marginTop: 5 },
  tag: { paddingVertical: 3, paddingHorizontal: 8, borderRadius: 99 },
  tileSide: { marginLeft: 58, flexDirection: "row", justifyContent: "space-between", alignItems: "center", gap: 10 },
  pillDark: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    paddingVertical: 7,
    paddingHorizontal: 14,
    borderRadius: 99,
  },
  findMore: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingVertical: 16,
    paddingHorizontal: 18,
    borderRadius: 16,
    borderWidth: 1,
  },
});
