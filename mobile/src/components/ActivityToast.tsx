import { useEffect, useRef, useState } from "react";
import { AccessibilityInfo, Animated, Easing, Pressable, StyleSheet, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Txt } from "@/components/primitives";
import { useColors } from "@/theme";

/** A real person who filed, shown on the paywall (with their permission). Same as the website. */
export const RECENT_FILER = { name: "Aryan G.", place: "California", company: "Apple", amount: "up to $95" };

const SHOW_AFTER_MS = 2000;
const SEEN_KEY = "rightful.recentFilerSeen";
const VISIBLE_MS = 5000;
const SLIDE_MS = 350;

function seenBefore(): boolean {
  try {
    return localStorage.getItem(SEEN_KEY) === "1";
  } catch {
    return false;
  }
}

/**
 * Slides up from the bottom the first time someone opens the paywall (not on later visits),
 * shows a thin bar counting down how long it stays, then slides away. It can be closed early.
 * Render it as the last child of a full-screen view; it positions itself over the bottom edge.
 */
export function ActivityToast() {
  const c = useColors();
  const insets = useSafeAreaInsets();
  const [phase, setPhase] = useState<"waiting" | "in" | "out">("waiting");
  const [height, setHeight] = useState(120);
  // Animated values live for the screen's lifetime.
  const [slide] = useState(() => new Animated.Value(0));
  const [progress] = useState(() => new Animated.Value(1));
  const reduceMotion = useRef(false);

  useEffect(() => {
    void AccessibilityInfo.isReduceMotionEnabled().then((on) => (reduceMotion.current = on));
    if (seenBefore()) return;
    const show = setTimeout(() => {
      setPhase("in");
      try {
        localStorage.setItem(SEEN_KEY, "1");
      } catch {
        // Storage unavailable: it may show again, which is fine.
      }
    }, SHOW_AFTER_MS);
    const hide = setTimeout(() => setPhase("out"), SHOW_AFTER_MS + VISIBLE_MS);
    return () => {
      clearTimeout(show);
      clearTimeout(hide);
    };
  }, []);

  useEffect(() => {
    if (phase === "waiting") return;
    const duration = reduceMotion.current ? 0 : SLIDE_MS;
    Animated.timing(slide, {
      toValue: phase === "in" ? 1 : 0,
      duration,
      easing: Easing.out(Easing.ease),
      useNativeDriver: true,
    }).start();
    if (phase === "in") {
      Animated.timing(progress, { toValue: 0, duration: VISIBLE_MS, easing: Easing.linear, useNativeDriver: true }).start();
    } else {
      progress.stopAnimation();
    }
  }, [phase, slide, progress]);

  if (phase === "waiting") return null;
  const { name, place, company, amount } = RECENT_FILER;
  const bottom = Math.max(16, insets.bottom + 8);
  return (
    <Animated.View
      accessibilityLiveRegion="polite"
      pointerEvents={phase === "in" ? "box-none" : "none"}
      onLayout={(event) => setHeight(event.nativeEvent.layout.height)}
      style={[
        styles.wrap,
        {
          bottom,
          transform: [{ translateY: slide.interpolate({ inputRange: [0, 1], outputRange: [height + bottom + 8, 0] }) }],
        },
      ]}
    >
      <View style={[styles.shadow, { backgroundColor: c.surface }]}>
        <View style={[styles.card, { backgroundColor: c.surface, borderColor: c.line }]}>
          <View style={[styles.avatar, { backgroundColor: c.moneySoft }]} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
            <Txt w={800} color="money">
              {name.slice(0, 1)}
            </Txt>
          </View>
          <Txt size={14} lh={1.35} style={{ flex: 1 }} accessibilityRole="text">
            <Txt size={14} w={700}>
              {name}
            </Txt>{" "}
            from {place} filed his {company} claim ·{" "}
            <Txt size={14} color="money">
              {amount}
            </Txt>
          </Txt>
          <Pressable onPress={() => setPhase("out")} accessibilityRole="button" accessibilityLabel="Dismiss" hitSlop={10} style={styles.close}>
            <Txt size={20} lh={1} color="muted">
              ×
            </Txt>
          </Pressable>
          <Animated.View
            style={[styles.progress, { backgroundColor: c.money, transform: [{ scaleX: progress }] }]}
            accessibilityElementsHidden
            importantForAccessibility="no-hide-descendants"
          />
        </View>
      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  wrap: { position: "absolute", left: 16, right: 16, alignItems: "center", zIndex: 40 },
  // iOS clips shadows on views with overflow hidden, so the shadow sits on its own layer.
  shadow: {
    width: "100%",
    maxWidth: 420,
    borderRadius: 14,
    shadowColor: "#000",
    shadowOpacity: 0.25,
    shadowRadius: 15,
    shadowOffset: { width: 0, height: 10 },
    elevation: 8,
  },
  card: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingTop: 12,
    paddingBottom: 14,
    paddingLeft: 14,
    paddingRight: 12,
    borderRadius: 14,
    borderWidth: 1,
    overflow: "hidden",
  },
  avatar: { width: 32, height: 32, borderRadius: 16, alignItems: "center", justifyContent: "center" },
  close: { paddingVertical: 4, paddingHorizontal: 6 },
  progress: { position: "absolute", left: 0, right: 0, bottom: 0, height: 3, transformOrigin: "left" },
});
