import { useRouter } from "expo-router";
import { useEffect, useState } from "react";
import { AccessibilityInfo, Animated, Easing, StyleSheet, View, useWindowDimensions } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Button, Muted, Txt } from "@/components/primitives";
import { isSampleMode } from "@/lib/supabase";
import { GUTTER, useColors } from "@/theme";

/**
 * The first screen: the ClaimRightful name on top, the pitch in the middle, and the way in.
 * Shown until the person has started picking companies.
 */
export default function Intro() {
  const c = useColors();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  // Small phones (iPhone SE) get a smaller headline.
  const headline = useWindowDimensions().height < 760 ? 34 : 40;

  // Animated values live for the screen's lifetime.
  const [parts] = useState(() => [0, 1, 2].map(() => new Animated.Value(0)));

  useEffect(() => {
    void AccessibilityInfo.isReduceMotionEnabled().then((reduceMotion) => {
      if (reduceMotion) {
        parts.forEach((value) => value.setValue(1));
        return;
      }
      const ease = Easing.out(Easing.cubic);
      Animated.stagger(
        140,
        parts.map((value) => Animated.timing(value, { toValue: 1, duration: 520, easing: ease, useNativeDriver: true })),
      ).start();
    });
  }, [parts]);

  const reveal = (value: Animated.Value) => ({
    opacity: value,
    transform: [{ translateY: value.interpolate({ inputRange: [0, 1], outputRange: [18, 0] }) }],
  });

  return (
    <View
      style={[styles.screen, { backgroundColor: c.paper, paddingTop: insets.top, paddingBottom: Math.max(16, insets.bottom) }]}
    >
      <Animated.View style={[styles.brand, reveal(parts[0])]} accessible accessibilityRole="header" accessibilityLabel="ClaimRightful">
        <Txt f="display" w={800} size={30} lh={1.2} ls={-0.02}>
          Claim
          <Txt f="display" w={800} size={30} lh={1.2} ls={-0.02} color="money">
            Rightful
          </Txt>
        </Txt>
      </Animated.View>

      <Animated.View style={[styles.body, reveal(parts[1])]}>
        <Txt f="display" w={800} size={headline} lh={1.06} center>
          Money that’s{" "}
          <Txt f="display" w={800} size={headline} lh={1.06} color="money">
            rightfully yours
          </Txt>
          , found and filed.
        </Txt>
      </Animated.View>

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
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, paddingHorizontal: GUTTER },
  brand: { alignItems: "center", paddingTop: 28 },
  body: { flex: 1, justifyContent: "center", width: "100%", maxWidth: 520, alignSelf: "center" },
  footer: { gap: 10, width: "100%", maxWidth: 520, alignSelf: "center" },
});
