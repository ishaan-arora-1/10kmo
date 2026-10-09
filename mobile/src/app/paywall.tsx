import { Redirect, useLocalSearchParams, useRouter } from "expo-router";
import { useEffect, useState } from "react";
import { Pressable, StyleSheet, View } from "react-native";
import {
  Button,
  CloseButton,
  FinePrint,
  FlowTitle,
  LinkText,
  Muted,
  Pill,
  Radio,
  SubTitle,
  Txt,
} from "@/components/primitives";
import { FlowScreen } from "@/components/screens";
import { BrandSeal, historyHeadline, Monogram } from "@/components/ui";
import { track } from "@/lib/analytics";
import { PRICE_LABELS, PRICE_VALUES, type WebPlan } from "@/lib/config";
import {
  cappedTotal,
  daysUntil,
  deadlineLabel,
  isUpcoming,
  maxTotal,
  pendingCaseFor,
  plural,
  reminderSchedule,
  safeNext,
  shortDay,
  usd,
  usdCents,
} from "@/lib/models";
import { goTo, openWebsite } from "@/lib/nav";
import { useStore } from "@/lib/store";
import { isSampleMode } from "@/lib/supabase";
import { useColors } from "@/theme";

export default function Paywall() {
  const store = useStore();
  const c = useColors();
  const router = useRouter();
  const params = useLocalSearchParams<{ next?: string; from?: string }>();
  const next = safeNext(params.next ?? null);
  // Shown right after they file their free claim.
  const afterFreeClaim = params.from === "free_claim";
  const [plan, setPlan] = useState<WebPlan>("monthly");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  // Opened from a settlement's "File your claim" button: lead with that claim.
  const target = store.settlementById(/^\/settlements\/([^/?#]+)/.exec(next)?.[1] ?? "") ?? null;

  useEffect(() => {
    track("paywall_seen", {
      userId: store.session?.user.id ?? null,
      detail: afterFreeClaim ? "after_free_claim" : target ? target.company : next === "/" ? "dashboard" : next,
    });
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (store.isPremium && !busy) router.replace(`/welcome?next=${encodeURIComponent(next)}`);
  }, [store.isPremium, busy, next, router]);

  // Subscriptions belong to an account, so sign-in comes first, like on the website.
  if (!isSampleMode && !store.session) {
    const back = `/paywall?next=${encodeURIComponent(next)}`;
    return <Redirect href={`/sign-in?next=${encodeURIComponent(back)}`} />;
  }

  const count = store.toFile.length;
  // Same total as the results screen and dashboard.
  const upTo = store.waitingMax + store.estimateMax + store.featuredMax;
  const nearest = target && !isUpcoming(target) ? target : store.nearest;
  const otherClaims = store.toFile.filter((s) => s.id !== target?.id).length;
  const restMax = maxTotal(store.toFile);
  const filingFeature =
    count === 0
      ? `We watch your ${store.selectedBrandIds.size} ${plural(store.selectedBrandIds.size, "company", "companies")} for new settlements`
      : count === 1
        ? "Step-by-step filing for your match"
        : count === 2
          ? "Step-by-step filing for both of your matches"
          : `Step-by-step filing for all ${count} of your matches`;

  // Accounts go back to where they were; the dashboard stays open to them.
  const close = () => {
    if (router.canGoBack()) router.back();
    else goTo(store.session || isSampleMode ? next : "/start");
  };

  // Display only: personalizes what the plan includes. Nothing here affects checkout.
  const filingBrands = [...new Set(store.toFile.map((s) => s.brandId))]
    .map((id) => store.brandById(id))
    .filter((brand) => brand !== undefined);
  const filingNames = filingBrands.slice(0, 3).map((brand) => brand.name);
  const reminderDays = [...new Set(reminderSchedule([...store.matched, ...store.featured]).map((r) => r.sendOn))]
    .slice(0, 3)
    .map(shortDay);
  const openBrandIds = new Set(store.matched.map((s) => s.brandId));
  const pendingNames = store.brands
    .filter((brand) => store.selectedBrandIds.has(brand.id) && !openBrandIds.has(brand.id) && pendingCaseFor(brand))
    .map((brand) => brand.name);
  const biggestClaim = Math.max(0, ...store.toFile.map((s) => s.payoutMax));
  const yearlyPrice = PRICE_VALUES.yearly;
  // Yearly shown per month, and what it saves against paying monthly for a year.
  const yearlyPerMonth = usdCents(Math.floor((PRICE_VALUES.yearly / 12) * 100) / 100);
  const yearlySaving = Math.floor((1 - PRICE_VALUES.yearly / (PRICE_VALUES.monthly * 12)) * 100);

  const subscribe = async () => {
    setBusy(true);
    setMessage(null);
    const result = await store.startCheckout(plan);
    setBusy(false);
    if (result.ok) {
      router.replace(`/welcome?next=${encodeURIComponent(next)}`);
    } else if (!result.cancelled) {
      setMessage(result.message ?? "Checkout couldn’t start. Please try again.");
    }
  };

  const buttonLabel = busy
    ? "Opening secure checkout…"
    : isSampleMode
      ? "Unlock sample"
      : plan === "yearly"
        ? `Subscribe for ${PRICE_LABELS.yearly}/year`
        : `Subscribe for ${PRICE_LABELS.monthly}/month`;

  const title = afterFreeClaim
    ? count > 0
      ? count === 1
        ? "Now file your other claim"
        : `Now file your other ${count} claims`
      : "Be first when your companies settle"
    : target
      ? `Unlock your ${target.company} claim`
      : count > 0
        ? `Your ${count} ${plural(count, "claim is", "claims are")} ready`
        : store.history.total > 0
          ? `${historyHeadline(store.history)}. Don’t miss the next one.`
          : "Be first when your companies settle";

  const totalLine = (amount: string, rest: string) => (
    <Txt size={18} color="muted">
      Up to{" "}
      <Txt f="display" w={700} size={26} color="money">
        {amount}
      </Txt>{" "}
      {rest}
    </Txt>
  );

  const features: React.ReactNode[] = [
    count > 0 && filingNames.length > 0 ? (
      <View key="filing" style={{ gap: 8 }}>
        <Txt w={600}>
          Step-by-step filing guides for {filingNames.join(", ")}
          {filingBrands.length > filingNames.length && ` (+${filingBrands.length - filingNames.length} more)`}
        </Txt>
        <View style={styles.logos} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
          {filingBrands.slice(0, 6).map((brand) => (
            <Monogram key={brand.id} brand={brand} name={brand.name} size={26} />
          ))}
        </View>
      </View>
    ) : (
      filingFeature
    ),
    "Verified official claim links, so you never land on a fake site",
    reminderDays.length > 0
      ? `Email reminders before your deadlines: ${reminderDays.join(" · ")}`
      : "Email reminders before every deadline",
    pendingNames.length > 0
      ? `First to know when the ${pendingNames.join(" and ")} case opens for claims`
      : "First to know when your companies settle",
    "A tracker for every claim until you’re paid",
  ];

  return (
    <FlowScreen narrow header={
      <>
        <BrandSeal />
        <CloseButton onPress={close} />
      </>
    }>
      {afterFreeClaim && (
        <View style={[styles.done, { backgroundColor: c.moneySoft }]}>
          <Txt w={700} size={14} color="money">
            ✓ Claim filed. Nice work.
          </Txt>
        </View>
      )}
      <FlowTitle>{title}</FlowTitle>
      {afterFreeClaim ? (
        count > 0 &&
        restMax > 0 && (
          <Txt size={18} color="muted">
            Up to{" "}
            <Txt f="display" w={700} size={26} color="money">
              {cappedTotal(restMax)}
            </Txt>{" "}
            more waiting for you. Unlock {count === 1 ? "it" : "them all"} for {PRICE_LABELS.monthly}/month.
          </Txt>
        )
      ) : target && target.payoutMax > 0 ? (
        totalLine(
          usd(target.payoutMax),
          `from this claim${otherClaims > 0 ? `, plus ${otherClaims} more ${plural(otherClaims, "claim", "claims")} ready to file` : ""}`,
        )
      ) : (
        upTo > 0 &&
        totalLine(cappedTotal(upTo), store.waitingMax + store.featuredMax > 0 ? "waiting for you" : "tied to your companies")
      )}
      {nearest ? (
        <View style={[styles.deadline, { backgroundColor: c.deadlineSoft }]}>
          <Txt w={700}>{nearest === target ? "Deadline to file" : "Your first deadline"}</Txt>
          <Txt f="mono" size={13} color="deadline">
            {deadlineLabel(nearest)} · {daysUntil(nearest.deadline)} {plural(daysUntil(nearest.deadline), "day", "days")}
          </Txt>
        </View>
      ) : (
        <Muted>Rightful guides every filing and keeps each claim on track until you’re paid.</Muted>
      )}

      <SubTitle style={{ marginTop: 8 }}>What you get with Rightful</SubTitle>
      <View style={[styles.features, { backgroundColor: c.surface }]}>
        {features.map((feature, index) => (
          <View key={index} style={styles.feature}>
            <Txt w={800} color="money" style={{ width: 22 }}>
              ✓
            </Txt>
            <View style={{ flex: 1 }}>{typeof feature === "string" ? <Txt w={600}>{feature}</Txt> : feature}</View>
          </View>
        ))}
      </View>
      {count > 0 && yearlyPrice > 0 && biggestClaim >= yearlyPrice && (
        <Txt w={600} color="money" center>
          Just one of your claims (up to {usd(biggestClaim)}) could cover a whole year of Rightful.
        </Txt>
      )}

      <View style={{ gap: 10 }} accessibilityRole="radiogroup" accessibilityLabel="Choose a plan">
        <PlanOption on={plan === "monthly"} onPress={() => setPlan("monthly")} title="Monthly">
          {PRICE_LABELS.monthly}/month · cancel anytime
        </PlanOption>
        <PlanOption
          on={plan === "yearly"}
          onPress={() => setPlan("yearly")}
          title="Yearly"
          badge={yearlySaving > 0 ? `Best value · save ${yearlySaving}%` : "Best value"}
        >
          {yearlyPerMonth}/month, billed {PRICE_LABELS.yearly}/year
        </PlanOption>
      </View>

      {message && (
        <Txt size={14} color="danger" accessibilityRole="alert">
          {message}
        </Txt>
      )}

      <FinePrint center>US settlements only. You qualify if you used these companies while living in the United States.</FinePrint>

      <Button onPress={() => void subscribe()} disabled={busy}>
        {buttonLabel}
      </Button>
      <FinePrint center>
        {isSampleMode
          ? "Sample mode: no payment is taken."
          : plan === "yearly"
            ? `Payments are processed securely by Razorpay. ${PRICE_LABELS.yearly} is charged today and every year until you cancel in Profile.`
            : `Payments are processed securely by Razorpay. ${PRICE_LABELS.monthly} is charged today and every month until you cancel in Profile.`}
      </FinePrint>
      <FinePrint center>
        {afterFreeClaim && (
          <>
            <LinkText onPress={close}>Maybe later</LinkText>
            {" · "}
          </>
        )}
        <LinkText onPress={() => openWebsite("/terms")}>Terms</LinkText>
        {" · "}
        <LinkText onPress={() => openWebsite("/privacy")}>Privacy</LinkText>
        {store.session && (
          <>
            {" · "}
            <LinkText onPress={() => void store.signOut()}>Sign out</LinkText>
          </>
        )}
      </FinePrint>
    </FlowScreen>
  );
}

function PlanOption({
  on,
  onPress,
  title,
  badge,
  children,
}: {
  on: boolean;
  onPress: () => void;
  title: string;
  badge?: string;
  children: React.ReactNode;
}) {
  const c = useColors();
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="radio"
      accessibilityState={{ checked: on }}
      style={[
        styles.plan,
        { backgroundColor: c.surface, borderColor: on ? c.money : c.line, borderWidth: on ? 2 : 1, padding: on ? 15 : 16 },
      ]}
    >
      <Radio checked={on} />
      <View style={{ flex: 1, gap: 2 }}>
        <View style={styles.planTitle}>
          <Txt w={700}>{title}</Txt>
          {badge && (
            <Pill size={10} style={{ paddingVertical: 2, paddingHorizontal: 7 }}>
              {badge}
            </Pill>
          )}
        </View>
        <Txt size={14} color="muted">
          {children}
        </Txt>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  done: { alignSelf: "flex-start", paddingVertical: 6, paddingHorizontal: 12, borderRadius: 99 },
  deadline: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "space-between",
    alignItems: "center",
    gap: 10,
    paddingVertical: 13,
    paddingHorizontal: 16,
    borderRadius: 12,
  },
  features: { padding: 18, gap: 12, borderRadius: 16 },
  feature: { flexDirection: "row", gap: 10 },
  logos: { flexDirection: "row", flexWrap: "wrap", gap: 6 },
  plan: { flexDirection: "row", alignItems: "center", gap: 14, borderRadius: 14 },
  planTitle: { flexDirection: "row", alignItems: "center", flexWrap: "wrap", gap: 6 },
});
