import { forwardRef } from "react";
import { StyleSheet, View } from "react-native";
import Svg, { Circle, Defs, Line, Pattern, Rect } from "react-native-svg";
import { usd, usdCents } from "@/lib/models";
import { palettes } from "@/theme";
import { Txt } from "./primitives";

// Light-theme colors so the shared image looks the same everywhere it's posted (like the website's).
const { paper: PAPER, ink: INK, muted: MUTED, money: MONEY, check: CHECK, checkLine: CHECK_LINE } = palettes.light;

/** Logical size; captured at 3x for a 1080×1260 image, the same size the website shares. */
export const SHARE_WIDTH = 360;
export const SHARE_HEIGHT = 420;

/** The PAID check as a poster for Stories, Messages, and posts. */
export const ShareCard = forwardRef<View, { amount: number; company: string; isSample: boolean }>(function ShareCard(
  { amount, company, isSample },
  ref,
) {
  const checkWidth = SHARE_WIDTH - 48;
  return (
    <View ref={ref} collapsable={false} style={styles.card}>
      <View style={styles.brandRow}>
        <View style={styles.seal}>
          <Txt f="display" w={800} size={13} lh={1.1} style={{ color: MONEY }}>
            R
          </Txt>
        </View>
        <Txt f="mono" w={500} size={11.3} style={{ color: MUTED }}>
          Rightful
        </Txt>
      </View>

      <Txt f="display" w={700} size={23} lh={1.17} style={{ color: INK, marginTop: 30 }}>
        I got {usd(amount)} from a settlement I didn’t know I was owed.
      </Txt>

      <View style={[styles.check, { width: checkWidth }]}>
        <Svg style={StyleSheet.absoluteFill}>
          <Defs>
            <Pattern id="share-lines" patternUnits="userSpaceOnUse" width={6.7} height={6.7} patternTransform="rotate(45)">
              <Line x1={6.2} y1={0} x2={6.2} y2={6.7} stroke="rgba(159, 191, 169, 0.28)" strokeWidth={0.7} />
            </Pattern>
          </Defs>
          <Rect x={0} y={0} width="100%" height="100%" rx={6} fill="url(#share-lines)" />
        </Svg>
        <Svg width={checkWidth} height={5} style={styles.perforation}>
          {Array.from({ length: Math.ceil(checkWidth / 8) }, (_, index) => (
            <Circle key={index} cx={5.3 + index * 8} cy={0} r={2.3} fill={PAPER} />
          ))}
        </Svg>

        <View style={styles.row}>
          <Txt f="mono" size={8.7} style={{ color: MUTED }}>
            PAY TO THE ORDER OF
          </Txt>
          <Txt f="mono" size={8.7} style={{ color: MUTED }}>
            NO. 0001
          </Txt>
        </View>
        <Txt f="display" w={700} size={20} lh={1.2} style={[styles.ruled, { color: INK }]}>
          Me
        </Txt>
        <View style={[styles.row, { alignItems: "flex-end" }]}>
          <Txt f="mono" size={8.7} style={{ color: MUTED }}>
            AMOUNT
          </Txt>
          <Txt
            f="display"
            w={800}
            size={34.7}
            lh={1.05}
            numberOfLines={1}
            adjustsFontSizeToFit
            style={{ color: MONEY, flexShrink: 1 }}
          >
            {usdCents(amount)}
          </Txt>
        </View>
        <Txt size={12} style={[styles.ruled, { color: INK }]}>
          {company} settlement
        </Txt>
        <Txt f="mono" size={8.7} numberOfLines={1} style={{ color: MUTED }}>
          {isSample ? "SAMPLE · NOT A REAL PAYOUT" : "‖ FIND YOURS ‖ RIGHTFUL"}
        </Txt>

        <View style={styles.stamp}>
          <Txt f="display" w={800} size={20} lh={1.3} style={{ color: MONEY }}>
            PAID
          </Txt>
        </View>
      </View>
    </View>
  );
});

const styles = StyleSheet.create({
  card: { width: SHARE_WIDTH, height: SHARE_HEIGHT, backgroundColor: PAPER, paddingHorizontal: 24, paddingTop: 26 },
  brandRow: { flexDirection: "row", alignItems: "center", gap: 7 },
  seal: {
    width: 25,
    height: 25,
    borderRadius: 12.5,
    borderWidth: 1.3,
    borderStyle: "dashed",
    borderColor: MONEY,
    alignItems: "center",
    justifyContent: "center",
  },
  check: {
    position: "absolute",
    left: 24,
    top: 220,
    height: 167,
    backgroundColor: CHECK,
    borderColor: CHECK_LINE,
    borderWidth: 0.7,
    borderRadius: 6,
    paddingHorizontal: 16,
    paddingTop: 18,
    gap: 9,
  },
  perforation: { position: "absolute", top: -1, left: 0 },
  row: { flexDirection: "row", justifyContent: "space-between", alignItems: "baseline", gap: 10 },
  ruled: { borderBottomWidth: 0.7, borderBottomColor: CHECK_LINE, paddingBottom: 2 },
  stamp: {
    position: "absolute",
    right: 16,
    top: 30,
    transform: [{ rotate: "-12deg" }],
    borderWidth: 2,
    borderColor: MONEY,
    borderRadius: 3.3,
    width: 73,
    alignItems: "center",
  },
});
