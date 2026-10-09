import { useLocalSearchParams } from "expo-router";
import { useCallback, useEffect } from "react";
import { StyleSheet, View } from "react-native";
import { Button, FlowTitle, Muted, QuietButton } from "@/components/primitives";
import { FlowScreen } from "@/components/screens";
import { BrandSeal, ExampleReminder } from "@/components/ui";
import { EMAIL_REMINDERS_ENABLED } from "@/lib/config";
import { pendingCaseFor, safeNext } from "@/lib/models";
import { goTo } from "@/lib/nav";
import { useStore } from "@/lib/store";
import { useColors } from "@/theme";

/** After signing up or subscribing: offer reminders (when email is available), then enter the app. */
export default function Welcome() {
  const store = useStore();
  const c = useColors();
  const params = useLocalSearchParams<{ next?: string }>();
  const next = safeNext(params.next ?? null);
  const { onboardingCompleted, completeOnboarding } = store;

  const finish = useCallback(() => {
    completeOnboarding();
    goTo(onboardingCompleted ? next : "/");
  }, [completeOnboarding, onboardingCompleted, next]);

  const offerReminders = EMAIL_REMINDERS_ENABLED && Boolean(store.session) && !onboardingCompleted;
  const pendingNames = store.brands
    .filter((brand) => store.selectedBrandIds.has(brand.id) && pendingCaseFor(brand))
    .map((brand) => brand.name);

  useEffect(() => {
    if (!offerReminders) finish();
    // Runs once: finishing navigates away from this screen.
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  if (!offerReminders) {
    return (
      <View style={[styles.boot, { backgroundColor: c.paper }]}>
        <BrandSeal size={44} />
      </View>
    );
  }

  const enableReminders = async () => {
    await store.setEmailReminders(true);
    finish();
  };

  return (
    <FlowScreen narrow header={<View />} bodyStyle={{ paddingTop: 24 }}>
      <View style={{ marginVertical: 24 }}>
        <ExampleReminder settlement={store.nearest} />
      </View>
      <FlowTitle>Deadlines don’t wait</FlowTitle>
      <Muted>
        We’ll email you before a claim closes and when a new settlement matches you
        {pendingNames.length > 0 ? `, including the day the ${pendingNames.join(" and ")} case opens for claims.` : "."}
      </Muted>
      <Button onPress={() => void enableReminders()}>Email me reminders</Button>
      <QuietButton onPress={finish}>Not now</QuietButton>
    </FlowScreen>
  );
}

const styles = StyleSheet.create({
  boot: { flex: 1, alignItems: "center", justifyContent: "center" },
});
