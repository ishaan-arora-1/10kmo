import { Platform } from "react-native";
import type { WebPlan } from "./config";
import { supabase } from "./supabase";

/** Steps we watch, from opening the app to paying. Same names as the website's funnel. */
export type FunnelEvent =
  | "app_open"
  | "brands_picked"
  | "results_seen"
  | "pending_case_seen"
  | "question_answered"
  | "reminders_seen"
  | "signin_seen"
  | "signin_started"
  | "signin_code_sent"
  | "signin_code_failed"
  | "signin_code_verified"
  | "dashboard_seen"
  | "file_locked_tap"
  | "free_claim_started"
  | "free_claim_filed"
  | "paywall_seen"
  | "checkout_opened"
  | "checkout_dismissed"
  | "checkout_failed"
  | "checkout_paid"
  | "account_deleted"
  | "account_delete_failed";

/** Where the event came from, so app and website funnels can be told apart. */
export const clientKind = (): string => (Platform.OS === "web" ? "browser" : `${Platform.OS}-app`);

/**
 * Records a step anonymously: no IP, no personal data, just the step plus the device's
 * time zone and language. Never blocks the UI.
 */
export function track(
  name: FunnelEvent,
  options: { plan?: WebPlan; detail?: string; userId?: string | null } = {},
): void {
  const client = supabase;
  if (!client) return;
  let timeZone: string | null = null;
  let language: string | null = null;
  try {
    const resolved = Intl.DateTimeFormat().resolvedOptions();
    timeZone = resolved.timeZone ?? null;
    language = resolved.locale?.slice(0, 20) ?? null;
  } catch {
    timeZone = null;
  }
  void client
    .from("funnel_events")
    .insert({
      name,
      user_id: options.userId ?? null,
      time_zone: timeZone,
      language,
      plan: options.plan ?? null,
      detail: options.detail?.slice(0, 200) ?? null,
    })
    .then(undefined, () => {
      // Analytics must never break the app.
    });
}
