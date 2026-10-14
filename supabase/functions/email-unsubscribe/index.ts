import { withSupabase } from "npm:@supabase/server@1.5.2";
import type { Database } from "../_shared/database.types.ts";
import { validUnsubscribeToken } from "../_shared/marketing_email.ts";

// The unsubscribe link in marketing emails (GET from the link, POST from the mail app's
// one-click button). The token is an HMAC of the account id, so links can't be guessed.

const secret = Deno.env.get("MARKETING_SECRET") ?? "";
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function reply(message: string, status = 200): Response {
  return new Response(message, { status, headers: { "content-type": "text/plain; charset=utf-8" } });
}

export default {
  fetch: withSupabase<Database>({ auth: "none" }, async (request, context) => {
    if (request.method !== "GET" && request.method !== "POST") return reply("Method not allowed", 405);
    const url = new URL(request.url);
    const userId = url.searchParams.get("u") ?? "";
    const token = url.searchParams.get("t") ?? "";
    if (!UUID.test(userId) || !(await validUnsubscribeToken(secret, userId, token))) {
      return reply("This unsubscribe link isn't valid. Reply to any of our emails with \"stop\" and we'll remove you.", 400);
    }
    const { error } = await context.supabaseAdmin.rpc("marketing_unsubscribe", { p_user_id: userId });
    if (error) {
      console.error("unsubscribe failed", userId, error);
      return reply("Something went wrong. Please try the link again in a minute.", 500);
    }
    return reply("You're unsubscribed. ClaimRightful won't send you these emails again.");
  }),
};
