import { Redirect, useLocalSearchParams, useRouter } from "expo-router";
import { useEffect, useState } from "react";
import { StyleSheet, View } from "react-native";
import { ActivityToast } from "@/components/ActivityToast";
import { Button, CloseButton, FinePrint, FlowTitle, LinkText, Txt } from "@/components/primitives";
import { FlowScreen } from "@/components/screens";
import { BrandSeal, historyHeadline } from "@/components/ui";
import { track } from "@/lib/analytics";
import { type WebPlan } from "@/lib/config";
import { IAP_AVAILABLE } from "@/lib/iap";
import {
  cappedTotal,
  daysUntil,
  deadlineLabel,
  isUpcoming,
  maxTotal,
  payoutRange,
  pendingCaseFor,
  plural,
  safeNext,
  usd,
  type Settlement,
} from "@/lib/models";
import { goTo, openWebsite } from "@/lib/nav";
import { useStore } from "@/lib/store";
import { isSampleMode } from "@/lib/supabase";
import { useColors } from "@/theme";

/** Above this, a payout is a documented-loss cap most people won't get. */
const BIG_CLAIM = 1000;

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
  const [restoring, setRestoring] = useState(false);
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

  // Website subscriptions belong to an account, so sign-in comes first there (and on Android).
  // The App Store lets people subscribe without an account (App Review Guideline 5.1.1).
  if (store.purchaseNeedsAccount && !store.session) {
    const back = `/paywall?next=${encodeURIComponent(next)}`;
    return <Redirect href={`/sign-in?next=${encodeURIComponent(back)}`} />;
  }

  const count = store.toFile.length;
  // Same total as the results screen and dashboard.
  const upTo = store.waitingMax + store.estimateMax + store.featuredMax;
  const nearest = target && !isUpcoming(target) ? target : store.nearest;
  const restMax = maxTotal(store.toFile);

  // The bill: claims they can file now, the one they came from first, then biggest first.
  // Caps over $1,000 (documented losses, e.g. car theft) count at their typical payout.
  const fileable = store.toFile
    .filter((s) => !isUpcoming(s))
    .sort(
      (a, b) =>
        Number(b.id === target?.id) - Number(a.id === target?.id) ||
        Number(b.payoutMax > 0) - Number(a.payoutMax > 0) ||
        b.payoutMax - a.payoutMax,
    );
  const counted = (s: Settlement) => (s.payoutMax <= BIG_CLAIM ? s.payoutMax : (s.payoutTypical ?? 0));
  const billTotal = fileable.reduce((total, s) => total + counted(s), 0);
  const shown = fileable.slice(0, 5);
  const rest = fileable.slice(5);
  const restTotal = rest.reduce((total, s) => total + counted(s), 0);
  const anyBig = fileable.some((s) => s.payoutMax > BIG_CLAIM);
  // On iPhone these are the App Store's own localized prices.
  const { monthly, yearly } = store.prices;
  const price = store.prices[plan];
  // Whole dollars, rounded down, so it never overstates.
  const keep = Math.floor(billTotal - price.value);
  const closingSoon = fileable.filter((s) => daysUntil(s.deadline) <= 30).length;
  const showBill = billTotal > 0;

  // Accounts go back to where they were; the dashboard stays open to them.
  const close = () => {
    if (router.canGoBack()) router.back();
    else goTo(store.session || isSampleMode || store.onboardingCompleted ? next : "/start");
  };

  const openBrandIds = new Set(store.matched.map((s) => s.brandId));
  const pendingNames = store.brands
    .filter((brand) => store.selectedBrandIds.has(brand.id) && !openBrandIds.has(brand.id) && pendingCaseFor(brand))
    .map((brand) => brand.name);
  const yearlySaving = monthly.value > 0 ? Math.floor((1 - yearly.value / (monthly.value * 12)) * 100) : 0;

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

  const restore = async () => {
    setRestoring(true);
    setMessage(null);
    const result = await store.restorePurchases();
    setRestoring(false);
    // A restored plan makes isPremium true, and the effect above moves on to the dashboard.
    if (result === "none") setMessage("No active subscription was found for this Apple ID.");
    if (result === "failed") setMessage("Purchases couldn’t be restored. Check your connection and try again.");
  };

  // The billing period stays on the purchase button (App Review Guideline 3.1.2), unlike the website's.
  const period = plan === "yearly" ? "year" : "month";
  const buttonLabel = busy
    ? IAP_AVAILABLE
      ? "Connecting to the App Store…"
      : "Opening secure checkout…"
    : isSampleMode
      ? "Unlock sample"
      : showBill
        ? `Claim my ${usd(billTotal)} for ${price.label}/${period}`
        : `Subscribe for ${price.label}/${period}`;

  const chosen = plan === "yearly" ? `${yearly.label} per year` : `${monthly.label} per month`;
  const terms = isSampleMode
    ? "Sample mode: no payment is taken."
    : IAP_AVAILABLE
      ? `Payment is charged to your Apple ID at confirmation of purchase. Your subscription renews automatically at ${chosen} unless you cancel at least 24 hours before the end of the current period. Manage or cancel it anytime in your App Store account settings.`
      : plan === "yearly"
        ? `Payments are processed securely by Razorpay. ${yearly.label} is charged today and every year until you cancel in Profile.`
        : `Payments are processed securely by Razorpay. ${monthly.label} is charged today and every month until you cancel in Profile.`;

  const title = showBill
    ? `Pay ${price.label}. Claim up to ${usd(billTotal)}.`
    : afterFreeClaim
      ? "Be first when your companies settle"
      : count > 0
        ? `Your ${count} ${plural(count, "claim is", "claims are")} ready`
        : store.history.total > 0
          ? `${historyHeadline(store.history)}. Don’t miss the next one.`
          : "Be first when your companies settle";

  const features = [
    count > 0
      ? `Step-by-step filing for ${count === 1 ? "your claim" : count === 2 ? "both of your claims" : `all ${count} of your claims`}`
      : `We watch your ${store.selectedBrandIds.size} ${plural(store.selectedBrandIds.size, "company", "companies")} for new settlements`,
    "Verified official claim links, so you never land on a fake site",
    pendingNames.length > 0
      ? `First to know when the ${pendingNames.join(" and ")} case opens for claims`
      : "A tracker for every claim until you’re paid",
  ];

  return (
    <View style={{ flex: 1 }}>
      <FlowScreen
        narrow
        header={
          <>
            <BrandSeal />
            <CloseButton onPress={close} />
          </>
        }
      >
        {afterFreeClaim && (
          <View style={[styles.done, { backgroundColor: c.moneySoft }]}>
            <Txt w={700} size={14} color="money">
              ✓ Claim filed. Nice work.
            </Txt>
          </View>
        )}
        <FlowTitle>{title}</FlowTitle>

        {showBill ? (
          <>
            {target && !isUpcoming(target) && (
              <Txt size={18} color="muted">
                Starting with your {target.company} claim.
              </Txt>
            )}
            <View
              style={[styles.bill, { backgroundColor: c.surface, borderColor: c.line }]}
              accessibilityLabel="Your claims compared with the price of Rightful"
            >
              <Txt f="mono" size={12} ls={0.1} upper color="muted" style={{ marginBottom: 6 }}>
                Your claims
              </Txt>
              {shown.map((s) => (
                <BillRow
                  key={s.id}
                  label={`${s.company} · ${s.title}`}
                  amount={`${s.payoutMax > 0 ? payoutRange(s) : "Varies"}${s.payoutMax > BIG_CLAIM ? "*" : ""}`}
                  bold={s.id === target?.id}
                />
              ))}
              {rest.length > 0 && (
                <BillRow
                  label={`+ ${rest.length} more ${plural(rest.length, "claim", "claims")}`}
                  amount={restTotal > 0 ? `up to ${usd(restTotal)}` : "Varies"}
                />
              )}
              <BillRow label="You could claim" amount={`up to ${usd(billTotal)}`} kind="sum" />
              <BillRow
                label={`Rightful, ${plan === "yearly" ? "1 year" : "1 month"}`}
                amount={`−${price.label}`}
                kind="minus"
              />
              {keep > 0 && <BillRow label="You could keep" amount={`up to ${usd(keep)}`} kind="keep" />}
              {anyBig && (
                <Txt size={12} color="muted" style={{ marginTop: 8 }}>
                  * Counted at its typical payout in your total. The maximum needs proof of loss.
                </Txt>
              )}
            </View>
            <Txt w={600} lh={1.5}>
              {plan === "monthly" ? "File them all this month, cancel anytime." : "File them all, and every new claim this year."}
              {"\n"}
              {closingSoon > 0
                ? `${closingSoon === fileable.length && closingSoon === 1 ? "Your claim closes" : `${closingSoon} of your claims close`} in the next 30 days.`
                : nearest && `Your first claim closes ${deadlineLabel(nearest)}.`}
            </Txt>
          </>
        ) : (
          upTo > 0 &&
          !afterFreeClaim && (
            <Txt size={18} color="muted">
              Up to{" "}
              <Txt f="display" w={700} size={26} color="money">
                {cappedTotal(upTo)}
              </Txt>{" "}
              {restMax > 0 ? "waiting for you" : "tied to your companies"}
            </Txt>
          )
        )}

        {message && (
          <Txt size={14} color="danger" accessibilityRole="alert">
            {message}
          </Txt>
        )}

        <Button onPress={() => void subscribe()} disabled={busy || restoring}>
          {buttonLabel}
        </Button>
        <View style={styles.plan}>
          <Txt size={14} color="muted" center lh={1.7}>
            {plan === "monthly" ? `${monthly.label}/month · cancel anytime` : `${yearly.label} billed yearly · cancel anytime`}
          </Txt>
          <LinkText size={14} onPress={() => setPlan(plan === "monthly" ? "yearly" : "monthly")}>
            {plan === "monthly"
              ? `or ${yearly.label}/year${yearlySaving > 0 ? ` (save ${yearlySaving}%)` : ""}`
              : `or ${monthly.label}/month`}
          </LinkText>
        </View>

        <View style={[styles.features, { backgroundColor: c.surface }]}>
          {features.map((feature) => (
            <View key={feature} style={styles.feature}>
              <Txt size={14} w={800} color="money" style={{ width: 22 }}>
                ✓
              </Txt>
              <Txt size={14} w={600} style={{ flex: 1 }}>
                {feature}
              </Txt>
            </View>
          ))}
        </View>

        <FinePrint center>
          US settlements only. Amounts are the most each settlement pays, from court filings; most people get less.
          Payouts come from each settlement’s administrator, usually months after its deadline.
        </FinePrint>
        <FinePrint center>{terms}</FinePrint>
        <FinePrint center>
          {afterFreeClaim && (
            <>
              <LinkText onPress={close}>Maybe later</LinkText>
              {" · "}
            </>
          )}
          {IAP_AVAILABLE && !isSampleMode && (
            <>
              <LinkText onPress={() => void restore()}>{restoring ? "Restoring…" : "Restore purchases"}</LinkText>
              {" · "}
            </>
          )}
          <LinkText onPress={() => openWebsite("/terms")}>Terms of Use</LinkText>
          {" · "}
          <LinkText onPress={() => openWebsite("/privacy")}>Privacy Policy</LinkText>
          {store.session && (
            <>
              {" · "}
              <LinkText onPress={() => void store.signOut()}>Sign out</LinkText>
            </>
          )}
        </FinePrint>
      </FlowScreen>
      <ActivityToast />
    </View>
  );
}

/** One line of the bill (.bill-row): a label on the left, an amount on the right. */
function BillRow({
  label,
  amount,
  bold,
  kind,
}: {
  label: string;
  amount: string;
  bold?: boolean;
  kind?: "sum" | "minus" | "keep";
}) {
  const c = useColors();
  const keep = kind === "keep";
  return (
    <View
      style={[
        styles.billRow,
        kind === "sum" && { borderTopWidth: 1, borderTopColor: c.line, marginTop: 6, paddingTop: 11 },
        keep && { borderTopWidth: 2, borderTopColor: c.ink, marginTop: 6, paddingTop: 11 },
      ]}
    >
      <Txt size={keep ? 18 : 15} w={keep ? 800 : kind === "sum" || bold ? 700 : 400} style={{ flex: 1 }}>
        {label}
      </Txt>
      <Txt f="mono" size={keep ? 20 : 15} w={keep || kind === "sum" ? 700 : 400} color={kind === "minus" ? "ink" : "money"}>
        {amount}
      </Txt>
    </View>
  );
}

const styles = StyleSheet.create({
  done: { alignSelf: "flex-start", paddingVertical: 6, paddingHorizontal: 12, borderRadius: 99 },
  bill: { paddingVertical: 16, paddingHorizontal: 18, borderRadius: 16, borderWidth: 1 },
  billRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "baseline", gap: 12, paddingVertical: 7 },
  plan: { marginTop: -6, alignItems: "center" },
  features: { paddingVertical: 14, paddingHorizontal: 16, gap: 9, borderRadius: 16 },
  feature: { flexDirection: "row", gap: 10 },
});
