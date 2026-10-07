import type { WebPlan } from "./config";
import { supabase } from "./supabase";

/** Steps we watch, from landing on the app to paying. */
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

/**
 * Records a step anonymously: no IP, no personal data, just the step plus the browser's
 * time zone and language so we can tell roughly where people are. Never blocks the UI.
 */
export function track(
  name: FunnelEvent,
  options: { plan?: WebPlan; detail?: string; userId?: string | null } = {},
): void {
  const client = supabase;
  if (!client) return;
  let timeZone: string | null = null;
  try {
    timeZone = Intl.DateTimeFormat().resolvedOptions().timeZone ?? null;
  } catch {
    timeZone = null;
  }
  void client
    .from("funnel_events")
    .insert({
      name,
      user_id: options.userId ?? null,
      time_zone: timeZone,
      language: typeof navigator === "undefined" ? null : navigator.language.slice(0, 20),
      plan: options.plan ?? null,
      detail: options.detail?.slice(0, 200) ?? null,
    })
    .then(undefined, () => {
      // Analytics must never break the app.
    });
}
