import { Redirect } from "expo-router";
import Tabs from "expo-router/js-tabs";
import type { ReactNode } from "react";
import { Pressable, StyleSheet, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { ClaimsIcon, HomeIcon, ProfileIcon, SearchIcon, type IconProps } from "@/components/icons";
import { Txt } from "@/components/primitives";
import { useStore } from "@/lib/store";
import { isSampleMode } from "@/lib/supabase";
import { useColors } from "@/theme";

const TABS: Record<string, { label: string; icon: (props: IconProps) => ReactNode }> = {
  index: { label: "Home", icon: HomeIcon },
  browse: { label: "Browse", icon: SearchIcon },
  claims: { label: "Claims", icon: ClaimsIcon },
  profile: { label: "Profile", icon: ProfileIcon },
};

/** The dashboard needs an account, not a membership: filing is what's locked behind the paywall. */
export default function TabsLayout() {
  const { isPremium, session, onboardingCompleted } = useStore();
  const c = useColors();
  const insets = useSafeAreaInsets();

  // The website opens on its landing page; the app opens on company picking until there's a dashboard.
  if (!(isPremium || session || (isSampleMode && onboardingCompleted))) return <Redirect href="/start" />;

  return (
    <Tabs
      screenOptions={{ headerShown: false, sceneStyle: { backgroundColor: c.paper } }}
      tabBar={({ state, navigation }) => (
        <View
          accessibilityRole="tablist"
          style={[
            styles.tabbar,
            { backgroundColor: c.surface, borderTopColor: c.line, paddingBottom: Math.max(8, insets.bottom) },
          ]}
        >
          {state.routes.map((route, index) => {
            const tab = TABS[route.name];
            if (!tab) return null;
            const focused = state.index === index;
            const color = focused ? c.money : c.muted;
            const Icon = tab.icon;
            return (
              <Pressable
                key={route.key}
                accessibilityRole="tab"
                accessibilityState={{ selected: focused }}
                accessibilityLabel={tab.label}
                onPress={() => {
                  const event = navigation.emit({ type: "tabPress", target: route.key, canPreventDefault: true });
                  if (!focused && !event.defaultPrevented) navigation.navigate(route.name);
                }}
                style={styles.tab}
              >
                <Icon color={color} />
                <Txt w={600} size={12} lh={1.3} style={{ color }}>
                  {tab.label}
                </Txt>
              </Pressable>
            );
          })}
        </View>
      )}
    >
      <Tabs.Screen name="index" />
      <Tabs.Screen name="browse" />
      <Tabs.Screen name="claims" />
      <Tabs.Screen name="profile" />
    </Tabs>
  );
}

const styles = StyleSheet.create({
  tabbar: { flexDirection: "row", paddingTop: 6, paddingHorizontal: 8, borderTopWidth: 1 },
  tab: { flex: 1, alignItems: "center", gap: 2, paddingVertical: 6 },
});
