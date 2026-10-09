import { BricolageGrotesque_500Medium } from "@expo-google-fonts/bricolage-grotesque/500Medium";
import { BricolageGrotesque_700Bold } from "@expo-google-fonts/bricolage-grotesque/700Bold";
import { BricolageGrotesque_800ExtraBold } from "@expo-google-fonts/bricolage-grotesque/800ExtraBold";
import { HankenGrotesk_400Regular } from "@expo-google-fonts/hanken-grotesk/400Regular";
import { HankenGrotesk_500Medium } from "@expo-google-fonts/hanken-grotesk/500Medium";
import { HankenGrotesk_600SemiBold } from "@expo-google-fonts/hanken-grotesk/600SemiBold";
import { HankenGrotesk_700Bold } from "@expo-google-fonts/hanken-grotesk/700Bold";
import { HankenGrotesk_800ExtraBold } from "@expo-google-fonts/hanken-grotesk/800ExtraBold";
import { IBMPlexMono_400Regular } from "@expo-google-fonts/ibm-plex-mono/400Regular";
import { IBMPlexMono_500Medium } from "@expo-google-fonts/ibm-plex-mono/500Medium";
import { useFonts } from "expo-font";
import { DarkTheme, DefaultTheme, Stack, ThemeProvider } from "expo-router";
import * as SplashScreen from "expo-splash-screen";
import { StatusBar } from "expo-status-bar";
import * as SystemUI from "expo-system-ui";
import { useEffect } from "react";
import { Pressable, StyleSheet, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Txt } from "@/components/primitives";
import { BrandSeal } from "@/components/ui";
import { track } from "@/lib/analytics";
import { CheckoutProvider } from "@/lib/checkout";
import { StoreProvider, useStore } from "@/lib/store";
import { useColors, useIsDark } from "@/theme";

void SplashScreen.preventAutoHideAsync();

export default function RootLayout() {
  const [fontsLoaded, fontError] = useFonts({
    BricolageGrotesque_500Medium,
    BricolageGrotesque_700Bold,
    BricolageGrotesque_800ExtraBold,
    HankenGrotesk_400Regular,
    HankenGrotesk_500Medium,
    HankenGrotesk_600SemiBold,
    HankenGrotesk_700Bold,
    HankenGrotesk_800ExtraBold,
    IBMPlexMono_400Regular,
    IBMPlexMono_500Medium,
  });
  const c = useColors();
  const dark = useIsDark();

  useEffect(() => {
    void SystemUI.setBackgroundColorAsync(c.paper);
  }, [c.paper]);

  // Fall back to system fonts rather than never starting.
  if (!fontsLoaded && !fontError) return null;

  const base = dark ? DarkTheme : DefaultTheme;
  const theme = {
    ...base,
    colors: { ...base.colors, background: c.paper, card: c.paper, text: c.ink, border: c.line, primary: c.money },
  };

  return (
    <ThemeProvider value={theme}>
      <CheckoutProvider>
        <StoreProvider>
          <StatusBar style={dark ? "light" : "dark"} />
          <App />
        </StoreProvider>
      </CheckoutProvider>
    </ThemeProvider>
  );
}

function App() {
  const { ready, error, dismissError } = useStore();
  const c = useColors();
  const insets = useSafeAreaInsets();

  useEffect(() => {
    track("app_open");
  }, []);

  useEffect(() => {
    if (ready) void SplashScreen.hideAsync();
  }, [ready]);

  if (!ready) {
    return (
      <View style={[styles.boot, { backgroundColor: c.paper }]} accessibilityLabel="Loading Rightful">
        <BrandSeal size={44} />
      </View>
    );
  }

  return (
    <>
      <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: c.paper } }}>
        <Stack.Screen name="(tabs)" />
        <Stack.Screen name="start" options={{ animation: "fade" }} />
        <Stack.Screen name="sign-in" />
        <Stack.Screen name="paywall" options={{ animation: "slide_from_bottom" }} />
        <Stack.Screen name="welcome" options={{ animation: "fade" }} />
        <Stack.Screen name="settlements/[id]" />
      </Stack>

      {error && (
        <View
          accessibilityRole="alert"
          style={[styles.toast, { backgroundColor: c.ink, bottom: 64 + insets.bottom + 16 }]}
        >
          <Txt size={14} style={{ flex: 1, color: c.paper }}>
            {error}
          </Txt>
          <Pressable onPress={dismissError} accessibilityRole="button" hitSlop={8}>
            <Txt w={700} size={14} style={{ color: c.paper, opacity: 0.8 }}>
              Dismiss
            </Txt>
          </Pressable>
        </View>
      )}
    </>
  );
}

const styles = StyleSheet.create({
  boot: { flex: 1, alignItems: "center", justifyContent: "center" },
  toast: {
    position: "absolute",
    left: 16,
    right: 16,
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
    paddingVertical: 12,
    paddingLeft: 16,
    paddingRight: 14,
    borderRadius: 14,
  },
});
