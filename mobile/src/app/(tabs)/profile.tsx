import { useRouter } from "expo-router";
import { useState, type ReactNode } from "react";
import { Pressable, StyleSheet, View } from "react-native";
import { BrandPicker } from "@/components/BrandPicker";
import { ArrowRightIcon } from "@/components/icons";
import { Button, FinePrint, PageTitle, QuietButton, SectionLabel, Sheet, Toggle, Txt } from "@/components/primitives";
import { PageScreen } from "@/components/screens";
import { StatePicker } from "@/components/StatePicker";
import { APP_VERSION, EMAIL_REMINDERS_ENABLED, SUPPORT_EMAIL } from "@/lib/config";
import { goTo, openWebsite } from "@/lib/nav";
import { useStore } from "@/lib/store";
import { isSampleMode } from "@/lib/supabase";
import { useColors } from "@/theme";

const longDate = (iso: string) =>
  new Date(iso).toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" });

export default function Profile() {
  const store = useStore();
  const c = useColors();
  const router = useRouter();
  const [brandsOpen, setBrandsOpen] = useState(false);
  const [statesOpen, setStatesOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [cancelOpen, setCancelOpen] = useState(false);
  const [working, setWorking] = useState(false);
  const [cancelNote, setCancelNote] = useState<string | null>(null);

  const email = store.session?.user.email ?? null;
  const planName = store.plan === "free" ? null : { yearly: "Yearly", monthly: "Monthly", weekly: "Weekly" }[store.plan];

  const upgrade = () => {
    const paywall = `/paywall?next=${encodeURIComponent("/profile")}`;
    router.push(store.session || isSampleMode ? paywall : `/sign-in?next=${encodeURIComponent(paywall)}`);
  };

  const confirmCancel = async () => {
    setWorking(true);
    const accessUntil = await store.cancelSubscription();
    setWorking(false);
    if (accessUntil === null) return;
    setCancelOpen(false);
    setCancelNote(
      accessUntil
        ? `Canceled. You keep Premium until ${longDate(accessUntil)} and won’t be charged again.`
        : "Canceled. You won’t be charged again.",
    );
  };

  const confirmDelete = async () => {
    setWorking(true);
    const deleted = await store.deleteAccount();
    setWorking(false);
    if (deleted) {
      setDeleteOpen(false);
      goTo("/start");
    }
  };

  const membershipDetail =
    store.planSource === "razorpay"
      ? store.planRenews === false && store.planExpiresAt
        ? `Ends ${longDate(store.planExpiresAt)}`
        : store.planExpiresAt
          ? `Renews ${longDate(store.planExpiresAt)}`
          : "Active"
      : store.planSource === "apple"
        ? "Subscribed on iPhone"
        : store.planSource === "grant"
          ? "Complimentary access"
          : "Active";

  return (
    <PageScreen>
      <View>
        <PageTitle>Profile</PageTitle>
        <Txt color="muted" style={{ marginTop: 4 }}>
          {email ? `Signed in as ${email}` : "Your progress is saved on this device"}
        </Txt>
      </View>

      {!store.session && !isSampleMode && (
        <Pressable
          onPress={() => router.push(`/sign-in?next=${encodeURIComponent("/profile")}`)}
          accessibilityRole="link"
          style={[styles.findMore, { backgroundColor: c.surface, borderColor: c.line }]}
        >
          <View style={{ flex: 1, gap: 3 }}>
            <Txt w={700}>Protect your claims</Txt>
            <Txt color="muted">Sign in with your email to keep your claims safe across devices.</Txt>
          </View>
          <ArrowRightIcon color={c.money} />
        </Pressable>
      )}

      <Group label="Your matches">
        <Row label="Companies you’ve used" detail={`${store.selectedBrandIds.size} selected ›`} onPress={() => setBrandsOpen(true)} />
        <Row
          label="States you’ve lived in"
          detail={store.selectedStates.size === 0 ? "Add ›" : `${[...store.selectedStates].sort().join(", ")} ›`}
          onPress={() => setStatesOpen(true)}
        />
      </Group>

      <Group label="Membership">
        {planName ? (
          <>
            <Row label={`Rightful Premium · ${planName}`} detail={membershipDetail} />
            {store.planSource === "razorpay" && store.planRenews !== false && (
              <Row label="Cancel subscription" detail="›" onPress={() => setCancelOpen(true)} />
            )}
            {store.planSource === "apple" && (
              <Note>Manage your iPhone subscription in Settings → [your name] → Subscriptions.</Note>
            )}
          </>
        ) : store.isPremium ? (
          <Row label="Sample premium" detail="No payment taken" />
        ) : (
          <Row
            label="Free plan"
            detail={
              <Txt w={700} size={14} color="money">
                Upgrade to file and track ›
              </Txt>
            }
            onPress={upgrade}
          />
        )}
        {cancelNote && <Note>{cancelNote}</Note>}
      </Group>

      {EMAIL_REMINDERS_ENABLED && store.session && (
        <View style={{ gap: 8 }}>
          <SectionLabel>Reminders</SectionLabel>
          <Toggle
            value={store.emailReminders}
            onValueChange={(on) => void store.setEmailReminders(on)}
            label="Email reminders"
            description={`New matches, deadlines, and payout windows, sent to ${email ?? "your email"}`}
          />
        </View>
      )}

      <Group label="About">
        <Row label="Privacy policy" detail="›" onPress={() => openWebsite("/privacy")} />
        <Row label="Terms of use" detail="›" onPress={() => openWebsite("/terms")} />
        <Row label="Help & support" detail={`${SUPPORT_EMAIL} ›`} onPress={() => openWebsite("/support")} />
      </Group>

      <Group label="Account">
        {store.session && (
          <Row
            label="Sign out"
            detail="›"
            onPress={async () => {
              await store.signOut();
              goTo("/start");
            }}
          />
        )}
        {isSampleMode ? (
          <Row
            label="Reset sample experience"
            danger
            onPress={() => {
              store.resetSample();
              goTo("/start");
            }}
          />
        ) : (
          <Row
            label={store.session ? "Delete account and data" : "Clear data on this device"}
            danger
            onPress={() => setDeleteOpen(true)}
          />
        )}
      </Group>

      <FinePrint center>Rightful {APP_VERSION} · Not a law firm. Not affiliated with settlement administrators.</FinePrint>

      <Sheet open={brandsOpen} onClose={() => setBrandsOpen(false)} title="Companies you’ve used">
        <BrandPicker />
        <Button onPress={() => setBrandsOpen(false)}>Done</Button>
      </Sheet>

      <Sheet open={statesOpen} onClose={() => setStatesOpen(false)} title="States you’ve lived in">
        <StatePicker />
        <Button onPress={() => setStatesOpen(false)}>Done</Button>
      </Sheet>

      <Sheet open={cancelOpen} onClose={() => setCancelOpen(false)} title="Cancel your subscription?">
        <Txt color="muted">
          You’ll keep Premium until the end of the period you’ve paid for, and you won’t be charged again.
        </Txt>
        <Button kind="danger" onPress={() => void confirmCancel()} disabled={working}>
          {working ? "Canceling…" : "Cancel subscription"}
        </Button>
        <QuietButton onPress={() => setCancelOpen(false)}>Keep Premium</QuietButton>
      </Sheet>

      <Sheet
        open={deleteOpen}
        onClose={() => setDeleteOpen(false)}
        title={store.session ? "Delete your account?" : "Clear this device’s data?"}
      >
        <Txt color="muted">
          {store.session
            ? "This permanently deletes your profile, companies, and claims, and cancels any web subscription."
            : "This removes your selected companies and claims from this device."}
        </Txt>
        <Button kind="danger" onPress={() => void confirmDelete()} disabled={working}>
          {working ? "Deleting…" : store.session ? "Delete account and all data" : "Clear data"}
        </Button>
        <QuietButton onPress={() => setDeleteOpen(false)}>Cancel</QuietButton>
      </Sheet>
    </PageScreen>
  );
}

/** A settings group (.settings-group): a label and rows joined into one rounded card. */
function Group({ label, children }: { label: string; children: ReactNode }) {
  const c = useColors();
  return (
    <View style={{ gap: 8 }}>
      <SectionLabel>{label}</SectionLabel>
      <View style={[styles.group, { borderColor: c.line, backgroundColor: c.line }]}>{children}</View>
    </View>
  );
}

function Row({
  label,
  detail,
  onPress,
  danger,
}: {
  label: string;
  detail?: ReactNode;
  onPress?: () => void;
  danger?: boolean;
}) {
  const c = useColors();
  const content = (
    <>
      <Txt w={600} color={danger ? "danger" : "ink"} style={{ flexShrink: 1 }}>
        {label}
      </Txt>
      {typeof detail === "string" ? (
        <Txt w={500} size={14} color="muted" style={{ textAlign: "right", flexShrink: 1 }}>
          {detail}
        </Txt>
      ) : (
        detail
      )}
    </>
  );
  if (!onPress) return <View style={[styles.row, { backgroundColor: c.surface }]}>{content}</View>;
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      style={({ pressed }) => [styles.row, { backgroundColor: pressed ? c.sunk : c.surface }]}
    >
      {content}
    </Pressable>
  );
}

function Note({ children }: { children: ReactNode }) {
  const c = useColors();
  return (
    <View style={[styles.row, { backgroundColor: c.surface }]} accessibilityLiveRegion="polite">
      <Txt size={14} color="muted">
        {children}
      </Txt>
    </View>
  );
}

const styles = StyleSheet.create({
  group: { borderWidth: 1, borderRadius: 14, overflow: "hidden", gap: 1 },
  row: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    gap: 12,
    paddingVertical: 15,
    paddingHorizontal: 16,
  },
  findMore: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingVertical: 16,
    paddingHorizontal: 18,
    borderRadius: 16,
    borderWidth: 1,
  },
});
