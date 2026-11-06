import * as Notifications from "expo-notifications";
import { Linking, Platform } from "react-native";
import { parseDay, payoutRange, type Settlement } from "./models";

/** Phone reminders are local notifications scheduled on the device; nothing is sent from a server. */
export const PHONE_REMINDERS_AVAILABLE = Platform.OS === "ios" || Platform.OS === "android";

/** iOS keeps at most 64 pending local notifications per app. */
const MAX_SCHEDULED = 60;
/** Reminders arrive at 10 AM local time. */
const SEND_HOUR = 10;

if (PHONE_REMINDERS_AVAILABLE) {
  Notifications.setNotificationHandler({
    handleNotification: async () => ({
      shouldShowBanner: true,
      shouldShowList: true,
      shouldPlaySound: false,
      shouldSetBadge: false,
    }),
  });
}

export interface PlannedReminder {
  id: string;
  at: Date;
  title: string;
  body: string;
  settlementId: string;
}

function dayAt(day: string, offsetDays: number): Date {
  const at = parseDay(day);
  at.setDate(at.getDate() + offsetDays);
  at.setHours(SEND_HOUR, 0, 0, 0);
  return at;
}

const longDay = (day: string) => parseDay(day).toLocaleDateString("en-US", { month: "long", day: "numeric" });

/**
 * For each claim still to file: the day claims open (if not open yet), then 7 days and 1 day before
 * the deadline. Past times are skipped; the soonest come first.
 */
export function planReminders(settlements: Settlement[], now = new Date()): PlannedReminder[] {
  const planned: PlannedReminder[] = [];
  const seen = new Set<string>();
  for (const s of settlements) {
    if (seen.has(s.id) || s.status === "closed") continue;
    seen.add(s.id);
    const amount = s.payoutMax > 0 ? ` ${payoutRange(s)}.` : "";
    if (s.opensOn) {
      planned.push({
        id: `${s.id}:opens`,
        at: dayAt(s.opensOn, 0),
        title: `${s.company} claims are open`,
        body: `You can now file the ${s.company} ${s.title} claim.${amount} Deadline ${longDay(s.deadline)}.`,
        settlementId: s.id,
      });
    }
    for (const [daysBefore, when] of [
      [7, "in 7 days"],
      [1, "tomorrow"],
    ] as const) {
      planned.push({
        id: `${s.id}:${daysBefore}d`,
        at: dayAt(s.deadline, -daysBefore),
        title: `${s.company} claim closes ${when}`,
        body: `File the ${s.company} ${s.title} claim before ${longDay(s.deadline)}.${amount}`,
        settlementId: s.id,
      });
    }
  }
  return planned
    .filter((reminder) => reminder.at > now)
    .sort((a, b) => a.at.getTime() - b.at.getTime())
    .slice(0, MAX_SCHEDULED);
}

export type PermissionState = "granted" | "denied" | "undetermined";

export async function permissionState(): Promise<PermissionState> {
  if (!PHONE_REMINDERS_AVAILABLE) return "denied";
  const { status } = await Notifications.getPermissionsAsync();
  return status === "granted" ? "granted" : status === "denied" ? "denied" : "undetermined";
}

/** Shows the system prompt the first time; afterwards returns what the person chose. */
export async function requestPermission(): Promise<boolean> {
  if (!PHONE_REMINDERS_AVAILABLE) return false;
  const current = await Notifications.getPermissionsAsync();
  if (current.status === "granted") return true;
  if (!current.canAskAgain) return false;
  const { status } = await Notifications.requestPermissionsAsync({
    ios: { allowAlert: true, allowSound: true, allowBadge: false },
  });
  return status === "granted";
}

/** Notifications were turned off in Settings: only Settings can turn them back on. */
export function openNotificationSettings() {
  void Linking.openSettings().catch(() => undefined);
}

/** Replaces every scheduled reminder with this plan (or clears them when reminders are off). */
export async function syncReminders(settlements: Settlement[], enabled: boolean): Promise<void> {
  if (!PHONE_REMINDERS_AVAILABLE) return;
  await Notifications.cancelAllScheduledNotificationsAsync();
  if (!enabled || (await permissionState()) !== "granted") return;
  for (const reminder of planReminders(settlements)) {
    await Notifications.scheduleNotificationAsync({
      identifier: reminder.id,
      content: { title: reminder.title, body: reminder.body, data: { url: `/settlements/${reminder.settlementId}` } },
      trigger: { type: Notifications.SchedulableTriggerInputTypes.DATE, date: reminder.at },
    });
  }
}

/** Tapping a reminder opens that claim. Returns the unsubscribe function. */
export function onReminderTapped(open: (url: string) => void): () => void {
  if (!PHONE_REMINDERS_AVAILABLE) return () => undefined;
  const handle = (response: Notifications.NotificationResponse | null) => {
    const url = response?.notification.request.content.data?.url;
    if (typeof url === "string" && url.startsWith("/settlements/")) open(url);
  };
  void Notifications.getLastNotificationResponseAsync().then(handle);
  const subscription = Notifications.addNotificationResponseReceivedListener(handle);
  return () => subscription.remove();
}
