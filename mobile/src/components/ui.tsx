import { useRouter } from "expo-router";
import { useState } from "react";
import { Pressable, StyleSheet, View, useWindowDimensions, type StyleProp, type ViewStyle } from "react-native";
import Svg, { Circle, Defs, Line, Pattern, Rect } from "react-native-svg";
import {
  cappedTotal,
  daysUntil,
  isUpcoming,
  opensLabel,
  payoutRange,
  plural,
  recentAmount,
  recentWhen,
  usdCents,
  type Brand,
  type ClaimStatus,
  type PayoutHistory,
  type PayoutScope,
  type RecentPayout,
  type Settlement,
} from "@/lib/models";
import { useStore } from "@/lib/store";
import { alpha, RADIUS, useColors } from "@/theme";
import { Pill, SampleBadge, Txt } from "./primitives";

/** The dashed "R" seal, the website's favicon and logo mark. */
export function BrandSeal({ size = 32 }: { size?: number }) {
  const c = useColors();
  return (
    <View
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      style={{
        width: size,
        height: size,
        borderRadius: size / 2,
        borderWidth: 1.5,
        borderStyle: "dashed",
        borderColor: c.money,
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      <Txt f="display" w={800} size={size * 0.46} lh={1.1} color="money">
        R
      </Txt>
    </View>
  );
}

/** The two-color ClaimRightful wordmark. Goes to the dashboard for accounts. */
export function Wordmark() {
  const { isPremium, session, onboardingCompleted } = useStore();
  const router = useRouter();
  const text = (
    <Txt f="display" w={800} size={21} lh={1.2} ls={-0.02}>
      Claim<Txt f="display" w={800} size={21} lh={1.2} ls={-0.02} color="money">Rightful</Txt>
    </Txt>
  );
  const hasDashboard = isPremium || session || onboardingCompleted;
  return hasDashboard ? (
    <Pressable onPress={() => router.navigate("/")} accessibilityRole="link" accessibilityLabel="ClaimRightful dashboard" hitSlop={8}>
      {text}
    </Pressable>
  ) : (
    <View accessible accessibilityLabel="ClaimRightful">
      {text}
    </View>
  );
}

export function Monogram({ brand, name, size = 40 }: { brand?: Brand; name: string; size?: number }) {
  const c = useColors();
  return (
    <View
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      style={{
        width: size,
        height: size,
        borderRadius: size * 0.28,
        backgroundColor: brand?.monogramColor ?? c.money,
        borderWidth: 1,
        borderColor: alpha(c.ink, 0.14),
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      <Txt w={700} size={size * 0.38} lh={1.15} style={{ color: "#FFFFFF" }}>
        {(brand?.name ?? name).slice(0, 1).toUpperCase()}
      </Txt>
    </View>
  );
}

/** One settlement: company, title, amount, proof, and time left (.settlement-card). */
export function SettlementCard({
  settlement,
  action,
  past,
}: {
  settlement: Settlement;
  action?: string;
  past?: boolean;
}) {
  const { brandById } = useStore();
  const days = daysUntil(settlement.deadline);
  return (
    <CardRow brand={brandById(settlement.brandId)} name={settlement.company}>
      <CardTop title={`${settlement.company} · ${settlement.title}`} amount={payoutRange(settlement)} past={past} />
      <View style={styles.meta}>
        <Txt f="mono" size={12} color={settlement.proofRequired ? "muted" : "money"}>
          {settlement.proofRequired ? "Proof needed" : "No proof"}
        </Txt>
        <Txt f="mono" size={12} color="muted">
          ·
        </Txt>
        {isUpcoming(settlement) ? (
          <Txt f="mono" size={12} color="money">
            Claims open {opensLabel(settlement)}
          </Txt>
        ) : (
          <Txt f="mono" size={12} color="deadline">
            {days} {plural(days, "day", "days")} left
          </Txt>
        )}
        {settlement.isSample && <SampleBadge />}
      </View>
      {action && (
        <Txt w={700} size={14} color="money" style={{ marginTop: 2 }}>
          {action}
        </Txt>
      )}
    </CardRow>
  );
}

/** The card frame used by settlement, payout, and estimate rows. */
export function CardRow({
  brand,
  name,
  children,
  style,
}: {
  brand?: Brand;
  name: string;
  children: React.ReactNode;
  style?: StyleProp<ViewStyle>;
}) {
  const c = useColors();
  return (
    <View style={[styles.card, { backgroundColor: c.surface, borderColor: c.line }, style]}>
      <Monogram brand={brand} name={name} />
      <View style={styles.cardBody}>{children}</View>
    </View>
  );
}

export function CardTop({ title, amount, past }: { title: string; amount?: React.ReactNode; past?: boolean }) {
  return (
    <View style={styles.cardTop}>
      <Txt w={700} size={15} lh={1.35} style={{ flex: 1 }}>
        {title}
      </Txt>
      {typeof amount === "string" ? (
        <Txt f="mono" w={500} size={13} color={past ? "muted" : "money"} numberOfLines={1}>
          {amount}
        </Txt>
      ) : (
        amount
      )}
    </View>
  );
}

export const CardNote = ({ children }: { children: React.ReactNode }) => (
  <Txt size={14} color="muted" lh={1.4}>
    {children}
  </Txt>
);

export const CardAction = ({ children }: { children: React.ReactNode }) => (
  <Txt w={700} size={14} color="money" style={{ marginTop: 2 }}>
    {children}
  </Txt>
);

const HISTORY_COPY: Record<PayoutScope, { payee: string; label: string; footer: string }> = {
  past_year: { payee: "You", label: "Missed this past year", footer: "‖ LAST 12 MONTHS" },
  recent: { payee: "You", label: "Missed, up to", footer: "‖ PAST SETTLEMENTS" },
  everyone: { payee: "People like you", label: "Paid this past year", footer: "‖ LAST 12 MONTHS" },
};

export function historyHeadline(history: PayoutHistory): string {
  const amount = cappedTotal(history.total);
  if (history.scope === "past_year") return `You could have gotten up to ${amount} this past year`;
  if (history.scope === "recent") return `You could have gotten up to ${amount}`;
  return `People got up to ${amount} from settlements this past year`;
}

/** Past payouts: company, amount, and the date it closed. */
export function PayoutList({ payouts }: { payouts: RecentPayout[] }) {
  const { brandById } = useStore();
  return (
    <View style={{ gap: 12 }}>
      {payouts.map((payout) => (
        <CardRow key={payout.id} brand={brandById(payout.brandId)} name={payout.company}>
          <CardTop title={`${payout.company} · ${payout.title}`} amount={recentAmount(payout)} past />
          <Txt f="mono" size={12} color="muted">
            {recentWhen(payout)}
          </Txt>
        </CardRow>
      ))}
    </View>
  );
}

/** Real money from past settlements, shown so no one sees $0. */
export function PayoutHistoryCard({ history }: { history: PayoutHistory }) {
  if (history.payouts.length === 0) return null;
  const copy = HISTORY_COPY[history.scope];
  return (
    <View style={{ gap: 12 }} accessibilityLabel="Past settlement payouts">
      <MoneyCheck
        number="0012"
        payee={copy.payee}
        amountLabel={copy.label}
        amount={history.total}
        capped
        memo={`${history.payouts.length} ${plural(history.payouts.length, "settlement", "settlements")}`}
        footer={copy.footer}
      />
      <PayoutList payouts={history.payouts} />
    </View>
  );
}

export function ClaimStatusBadge({ status }: { status: ClaimStatus }) {
  const warn = status === "To file" || status === "Rejected";
  return (
    <Pill tone={warn ? "deadline" : "money"} style={{ paddingVertical: 4 }}>
      {status}
    </Pill>
  );
}

interface MoneyCheckProps {
  number: string;
  payee: string;
  amountLabel: string;
  amount: number;
  memo: string;
  footer: string;
  stamped?: boolean;
  /** Show totals over $5,000 as "$5,000+". */
  capped?: boolean;
  /** Fixed amount size, for the share image. */
  amountSize?: number;
}

/** The Rightful signature: found money shown as a check made out to you. */
export function MoneyCheck({
  number,
  payee,
  amountLabel,
  amount,
  memo,
  footer,
  stamped = false,
  capped = false,
  amountSize,
}: MoneyCheckProps) {
  const c = useColors();
  const { width } = useWindowDimensions();
  const [boxWidth, setBoxWidth] = useState(0);
  const amountText = amount <= 0 ? "Varies" : capped ? cappedTotal(amount) : usdCents(amount);
  // clamp(34px, 9vw, 50px), like the website.
  const size = amountSize ?? Math.min(50, Math.max(34, width * 0.09));
  const label = (text: string) => (
    <Txt f="mono" size={11} ls={0.1} upper color="muted">
      {text}
    </Txt>
  );

  return (
    <View
      accessible
      accessibilityRole="image"
      accessibilityLabel={`Check made out to ${payee}. ${amountLabel} ${amountText}. ${memo}.${stamped ? " Paid." : ""}`}
      onLayout={(event) => setBoxWidth(event.nativeEvent.layout.width)}
      style={[
        styles.check,
        { backgroundColor: c.check, borderColor: c.checkLine, boxShadow: "0 26px 50px -34px rgba(10, 30, 20, 0.5)" },
      ]}
    >
      {/* Diagonal security lines. */}
      <Svg style={[StyleSheet.absoluteFill, { borderRadius: 10 }]} pointerEvents="none">
        <Defs>
          <Pattern id="check-lines" patternUnits="userSpaceOnUse" width={10} height={10} patternTransform="rotate(45)">
            <Line x1={9.5} y1={0} x2={9.5} y2={10} stroke={alpha(c.checkLine, 0.2)} strokeWidth={1} />
          </Pattern>
        </Defs>
        <Rect x={0} y={0} width="100%" height="100%" rx={10} fill="url(#check-lines)" />
      </Svg>
      {/* Perforated top edge. */}
      {boxWidth > 0 && (
        <Svg width={boxWidth} height={6} style={styles.perforation} pointerEvents="none">
          {Array.from({ length: Math.ceil(boxWidth / 12) }, (_, index) => (
            <Circle key={index} cx={6 + index * 12} cy={6} r={3.4} fill={c.paper} />
          ))}
        </Svg>
      )}

      <View style={styles.row}>
        {label("Pay to the order of")}
        {label(`No. ${number}`)}
      </View>
      <Txt
        f="display"
        w={700}
        size={26}
        lh={1.2}
        style={{ paddingBottom: 3, borderBottomWidth: 1, borderBottomColor: c.checkLine }}
      >
        {payee}
      </Txt>
      <View style={[styles.row, { alignItems: "flex-end" }]}>
        {label(amountLabel)}
        <Txt
          f="display"
          w={800}
          size={size}
          lh={1.05}
          ls={-0.03}
          color="money"
          numberOfLines={1}
          adjustsFontSizeToFit
          style={{ fontVariant: ["tabular-nums"], flexShrink: 1, textAlign: "right" }}
        >
          {amountText}
        </Txt>
      </View>
      <Txt size={15} style={{ paddingBottom: 4, borderBottomWidth: 1, borderBottomColor: c.checkLine }}>
        {memo}
      </Txt>
      <Txt f="mono" size={12} ls={0.16} color="muted" numberOfLines={1} ellipsizeMode="tail">
        {footer}
      </Txt>
      {stamped && (
        <View style={[styles.stamp, { borderColor: c.money, backgroundColor: alpha(c.check, 0.7) }]}>
          <Txt f="display" w={800} size={24} ls={0.14} lh={1.3} color="money">
            PAID
          </Txt>
        </View>
      )}
    </View>
  );
}

/** A preview of the reminder email members get (.example-reminder). */
export function ExampleReminder({ settlement }: { settlement: Settlement | null }) {
  const c = useColors();
  const title = settlement
    ? `${settlement.company} settlement closes in 3 days`
    : "A settlement you match closes in 3 days";
  const detail =
    settlement && settlement.payoutMax > 0
      ? `Est. ${payoutRange(settlement)}. Filing takes about 3 minutes.`
      : "Filing takes about 3 minutes.";
  return (
    <View
      accessible
      accessibilityLabel={`Example reminder: ${title}. ${detail}`}
      style={[
        styles.reminder,
        { backgroundColor: c.surface, borderColor: c.line, boxShadow: "0 18px 36px -24px rgba(0, 0, 0, 0.35)" },
      ]}
    >
      <View style={[styles.reminderIcon, { backgroundColor: c.money }]}>
        <Txt f="display" w={800} size={18} style={{ color: c.onMoney }}>
          R
        </Txt>
      </View>
      <View style={{ flex: 1 }}>
        <View style={styles.row}>
          <Txt w={700} size={14}>
            Rightful
          </Txt>
          <Txt size={14} color="muted">
            now
          </Txt>
        </View>
        <Txt w={700}>{title}</Txt>
        <Txt size={14} color="muted">
          {detail}
        </Txt>
      </View>
    </View>
  );
}


const styles = StyleSheet.create({
  card: {
    flexDirection: "row",
    gap: 12,
    padding: 14,
    borderWidth: 1,
    borderRadius: RADIUS,
  },
  cardBody: { flex: 1, minWidth: 0, gap: 5 },
  cardTop: { flexDirection: "row", justifyContent: "space-between", alignItems: "baseline", gap: 10 },
  meta: { flexDirection: "row", flexWrap: "wrap", alignItems: "center", gap: 6 },
  check: {
    gap: 12,
    marginVertical: 6,
    paddingTop: 26,
    paddingHorizontal: 22,
    paddingBottom: 18,
    borderRadius: 10,
    borderWidth: 1,
  },
  perforation: { position: "absolute", top: -7, left: -1 },
  row: { flexDirection: "row", justifyContent: "space-between", alignItems: "baseline", gap: 12 },
  stamp: {
    position: "absolute",
    right: 22,
    top: 56,
    transform: [{ rotate: "-12deg" }],
    borderWidth: 2.5,
    borderRadius: 6,
    paddingHorizontal: 10,
  },
  reminder: {
    flexDirection: "row",
    gap: 12,
    padding: 14,
    borderWidth: 1,
    borderRadius: 20,
  },
  reminderIcon: { width: 40, height: 40, borderRadius: 10, alignItems: "center", justifyContent: "center" },
});
