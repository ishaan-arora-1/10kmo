import { forwardRef, type ReactNode } from "react";
import { KeyboardAvoidingView, Platform, ScrollView, StyleSheet, View, type StyleProp, type ViewStyle } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Svg, { Defs, LinearGradient, Rect, Stop } from "react-native-svg";
import { useStore } from "@/lib/store";
import { GUTTER, useColors } from "@/theme";
import { SampleBadge } from "./primitives";
import { Wordmark } from "./ui";

/** Fades content into the paper color above a pinned button, like the website's .sticky-cta. */
function Fade() {
  const c = useColors();
  return (
    <Svg height={24} width="100%" style={styles.fade} pointerEvents="none">
      <Defs>
        <LinearGradient id="fade" x1="0" y1="0" x2="0" y2="1">
          <Stop offset="0" stopColor={c.paper} stopOpacity={0} />
          <Stop offset="1" stopColor={c.paper} stopOpacity={1} />
        </LinearGradient>
      </Defs>
      <Rect x="0" y="0" width="100%" height="24" fill="url(#fade)" />
    </Svg>
  );
}

/**
 * Onboarding, sign-in, and paywall pages (.flow): a header row, a scrolling body,
 * and an optional call to action pinned to the bottom.
 */
export const FlowScreen = forwardRef<
  ScrollView,
  {
    header?: ReactNode;
    children: ReactNode;
    footer?: ReactNode;
    narrow?: boolean;
    bodyStyle?: StyleProp<ViewStyle>;
  }
>(function FlowScreen({ header, children, footer, narrow, bodyStyle }, ref) {
  const c = useColors();
  const insets = useSafeAreaInsets();
  const maxWidth = narrow ? 520 : 640;
  return (
    <KeyboardAvoidingView
      style={{ flex: 1, backgroundColor: c.paper }}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
    >
      <View style={{ paddingTop: insets.top }}>
        <View style={[styles.flowTop, { maxWidth }]}>{header ?? <Wordmark />}</View>
      </View>
      <ScrollView
        ref={ref}
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={[
          styles.flowBody,
          { maxWidth, paddingBottom: footer ? 28 : Math.max(28, insets.bottom + 16) },
          bodyStyle,
        ]}
      >
        {children}
      </ScrollView>
      {footer && (
        <View style={[styles.sticky, { backgroundColor: c.paper, paddingBottom: Math.max(16, insets.bottom) }]}>
          <Fade />
          <View style={[styles.stickyInner, { maxWidth }]}>{footer}</View>
        </View>
      )}
    </KeyboardAvoidingView>
  );
});

/** The top bar on dashboard pages (.app-top): wordmark, plus a badge in sample mode. */
export function AppTop() {
  const c = useColors();
  const insets = useSafeAreaInsets();
  const { isSampleData } = useStore();
  return (
    <View style={{ paddingTop: insets.top, backgroundColor: c.paper, borderBottomWidth: 1, borderBottomColor: c.line }}>
      <View style={styles.appTop}>
        <Wordmark />
        {isSampleData && <SampleBadge />}
      </View>
    </View>
  );
}

/** Dashboard pages (.page): the top bar and a scrolling column of sections. */
export const PageScreen = forwardRef<ScrollView, { children: ReactNode; top?: boolean }>(function PageScreen(
  { children, top = true },
  ref,
) {
  const c = useColors();
  return (
    <View style={{ flex: 1, backgroundColor: c.paper }}>
      {top && <AppTop />}
      <ScrollView ref={ref} keyboardShouldPersistTaps="handled" contentContainerStyle={styles.page}>
        {children}
      </ScrollView>
    </View>
  );
});

/** A titled group inside a page (.section). */
export function Section({ children, style }: { children: ReactNode; style?: StyleProp<ViewStyle> }) {
  return <View style={[{ gap: 10 }, style]}>{children}</View>;
}

/** A plain vertical stack (.stack). */
export function Stack({ children, gap = 12, style }: { children: ReactNode; gap?: number; style?: StyleProp<ViewStyle> }) {
  return <View style={[{ gap }, style]}>{children}</View>;
}

const styles = StyleSheet.create({
  flowTop: {
    width: "100%",
    alignSelf: "center",
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: GUTTER,
    paddingVertical: 18,
  },
  flowBody: {
    width: "100%",
    alignSelf: "center",
    paddingHorizontal: GUTTER,
    gap: 16,
  },
  sticky: { paddingTop: 12 },
  stickyInner: { width: "100%", alignSelf: "center", paddingHorizontal: GUTTER, gap: 6, alignItems: "center" },
  fade: { position: "absolute", top: -24, left: 0, right: 0 },
  appTop: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: GUTTER,
    paddingVertical: 14,
  },
  page: {
    width: "100%",
    maxWidth: 680,
    alignSelf: "center",
    paddingHorizontal: GUTTER,
    paddingTop: 24,
    paddingBottom: 32,
    gap: 18,
  },
});
