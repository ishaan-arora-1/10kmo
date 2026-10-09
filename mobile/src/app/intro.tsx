import { useRouter } from "expo-router";
import { useEffect, useRef, useState } from "react";
import {
  AccessibilityInfo,
  Animated,
  Easing,
  StyleSheet,
  View,
  useWindowDimensions,
  type LayoutChangeEvent,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Svg, { Circle } from "react-native-svg";
import { Button, FinePrint, Muted, Txt } from "@/components/primitives";
import { isSampleMode } from "@/lib/supabase";
import { GUTTER, useColors } from "@/theme";

const SEAL = 76;
/** The native splash draws the seal about 103pt wide; the intro starts there, then settles. */
const SPLASH_SCALE = 103 / SEAL;

/** The website's "How it works", shortened for a phone. */
const STEPS: [string, string][] = [
  ["Tap the apps you’ve used", "No quiz, no bank login, no email access."],
  ["See what you could claim", "Your matches and estimated payouts, up front."],
  ["File, track, get paid", "Official claim forms, deadline reminders, and a tracker until the money lands."],
];

/**
 * The first screen: the ClaimRightful mark picks up where the splash screen leaves off, rises,
 * and the pitch fades in under it. Shown until the person has started picking companies.
 */
export default function Intro() {
  const c = useColors();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  // Small phones (iPhone SE) get the step titles only, so nothing scrolls.
  const compact = useWindowDimensions().height < 760;
  const headline = compact ? 28 : 32;

  const [screenHeight, setScreenHeight] = useState(0);
  const [sealCenter, setSealCenter] = useState(0);
  const started = useRef(false);
  // Animated values live for the screen's lifetime.
  const [lift] = useState(() => new Animated.Value(0));
  const [sealScale] = useState(() => new Animated.Value(SPLASH_SCALE));
  const [wordmark] = useState(() => new Animated.Value(0));
  const [parts] = useState(() => [0, 1, 2].map(() => new Animated.Value(0)));
  const [visible, setVisible] = useState(false);

  // Once laid out: start with the seal at the center of the screen (where the splash had it).
  useEffect(() => {
    if (started.current || !screenHeight || !sealCenter) return;
    started.current = true;
    const offset = screenHeight / 2 - sealCenter;
    void AccessibilityInfo.isReduceMotionEnabled().then((reduceMotion) => {
      if (reduceMotion) {
        sealScale.setValue(1);
        [wordmark, ...parts].forEach((value) => value.setValue(1));
        setVisible(true);
        return;
      }
      lift.setValue(offset);
      setVisible(true);
      const ease = Easing.out(Easing.cubic);
      Animated.sequence([
        Animated.parallel([
          Animated.timing(sealScale, { toValue: 1, duration: 420, easing: ease, useNativeDriver: true }),
          Animated.timing(wordmark, { toValue: 1, duration: 420, delay: 120, easing: ease, useNativeDriver: true }),
        ]),
        Animated.delay(380),
        Animated.parallel([
          Animated.timing(lift, { toValue: 0, duration: 640, easing: ease, useNativeDriver: true }),
          Animated.stagger(
            110,
            parts.map((value) =>
              Animated.timing(value, { toValue: 1, duration: 460, delay: 220, easing: ease, useNativeDriver: true }),
            ),
          ),
        ]),
      ]).start();
    });
  }, [screenHeight, sealCenter, lift, sealScale, wordmark, parts]);

  const reveal = (value: Animated.Value) => ({
    opacity: value,
    transform: [{ translateY: value.interpolate({ inputRange: [0, 1], outputRange: [18, 0] }) }],
  });

  const onBrandLayout = (event: LayoutChangeEvent) => {
    // The brand block's top, relative to the screen, plus half the seal.
    setSealCenter(event.nativeEvent.layout.y + SEAL / 2);
  };

  return (
    <View
      style={[styles.screen, { backgroundColor: c.paper, paddingTop: insets.top, paddingBottom: Math.max(16, insets.bottom) }]}
      onLayout={(event) => setScreenHeight(event.nativeEvent.layout.height)}
    >
      <Animated.View
        onLayout={onBrandLayout}
        style={[styles.brand, { opacity: visible ? 1 : 0, transform: [{ translateY: lift }] }]}
        accessible
        accessibilityRole="header"
        accessibilityLabel="ClaimRightful"
      >
        <Animated.View style={{ transform: [{ scale: sealScale }] }}>
          <Svg width={SEAL} height={SEAL} viewBox="0 0 64 64">
            <Circle
              cx={32}
              cy={32}
              r={29}
              fill="none"
              stroke={c.money}
              strokeWidth={3}
              strokeDasharray="5 4"
            />
          </Svg>
          <View style={StyleSheet.absoluteFill}>
            <View style={styles.sealLetter}>
              <Txt f="display" w={800} size={SEAL * 0.46} lh={1.1} color="money">
                R
              </Txt>
            </View>
          </View>
        </Animated.View>
        <Animated.View style={reveal(wordmark)}>
          <Txt f="display" w={800} size={34} lh={1.2} ls={-0.02}>
            Claim
            <Txt f="display" w={800} size={34} lh={1.2} ls={-0.02} color="money">
              Rightful
            </Txt>
          </Txt>
        </Animated.View>
      </Animated.View>

      <View style={styles.body}>
        <Animated.View style={[styles.pitch, reveal(parts[0])]}>
          <Txt f="display" w={800} size={headline} lh={1.06} center>
            Money that’s{" "}
            <Txt f="display" w={800} size={headline} lh={1.06} color="money">
              rightfully yours
            </Txt>
            , found and filed.
          </Txt>
          <Muted center size={17}>
            Companies have paid out billions in settlements. Find out which ones owe you.
          </Muted>
        </Animated.View>

        <Animated.View style={[styles.steps, { backgroundColor: c.surface, borderColor: c.line }, reveal(parts[1])]}>
          {STEPS.map(([title, detail], index) => (
            <View key={title} style={[styles.step, index > 0 && { borderTopWidth: 1, borderTopColor: c.line }]}>
              <View style={[styles.stepNumber, { backgroundColor: c.moneySoft }, compact && { marginTop: -3 }]}>
                <Txt f="mono" w={500} size={12} color="money">
                  {String(index + 1).padStart(2, "0")}
                </Txt>
              </View>
              <View style={{ flex: 1, gap: 2 }}>
                <Txt w={700}>{title}</Txt>
                {!compact && (
                  <Txt size={14} color="muted" lh={1.4}>
                    {detail}
                  </Txt>
                )}
              </View>
            </View>
          ))}
        </Animated.View>
      </View>

      <Animated.View style={[styles.footer, reveal(parts[2])]}>
        <Button onPress={() => router.push("/start")}>Check what I’m owed</Button>
        {!isSampleMode && (
          <Muted center size={15}>
            Already have an account?{" "}
            <Txt
              size={15}
              w={600}
              color="ink"
              style={{ textDecorationLine: "underline" }}
              onPress={() => router.push("/sign-in")}
              accessibilityRole="link"
            >
              Sign in
            </Txt>
          </Muted>
        )}
        <FinePrint center>Not a law firm. We never take a cut of your payout.</FinePrint>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, paddingHorizontal: GUTTER },
  brand: { alignItems: "center", gap: 10, paddingTop: 28 },
  sealLetter: { flex: 1, alignItems: "center", justifyContent: "center" },
  body: { flex: 1, justifyContent: "center", gap: 22, width: "100%", maxWidth: 520, alignSelf: "center" },
  pitch: { gap: 10 },
  steps: { borderWidth: 1, borderRadius: 16, overflow: "hidden" },
  step: { flexDirection: "row", gap: 12, paddingVertical: 13, paddingHorizontal: 14, alignItems: "flex-start" },
  stepNumber: { width: 30, height: 30, borderRadius: 15, alignItems: "center", justifyContent: "center", marginTop: 1 },
  footer: { gap: 10, width: "100%", maxWidth: 520, alignSelf: "center" },
});
