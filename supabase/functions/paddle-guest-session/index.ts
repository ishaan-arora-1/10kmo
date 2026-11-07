import { withSupabase } from "npm:@supabase/server@1.5.2";
import type { Database } from "../_shared/database.types.ts";
import { withCors } from "../_shared/cors.ts";
import { guestAccount, isGuestCheckout, paddle } from "../_shared/paddle.ts";

// Signs someone in right after they pay on the website without an account.
// POST {"transaction_id": "txn_..."} (from Paddle's checkout.completed event in their browser).
//   {"token_hash": "..."}            a new account made for this checkout: the browser verifies it
//                                    with supabase.auth.verifyOtp and is signed in
//   {"needs_code": true, "email"}    the email already had an account: sign in with a code as usual
//                                    (the payment is already attached to that account)
// Paddle doesn't verify emails, so only an account created by this very checkout is signed in
// without a code; otherwise anyone could pay $1.99 with someone else's email to get into it.

const MAX_AGE_MS = 2 * 60 * 60 * 1000; // the checkout must be recent
const CREATED_SLACK_MS = 60 * 1000;

type Transaction = {
  id: string;
  status: string;
  customer_id: string | null;
  custom_data: Record<string, unknown> | null;
  created_at: string;
};

const handler = withSupabase<Database>({ auth: "none" }, async (request, context) => {
  if (request.method !== "POST") {
    return Response.json({ error: "Method not allowed" }, { status: 405 });
  }
  let transactionID = "";
  try {
    transactionID = String(((await request.json()) as { transaction_id?: unknown }).transaction_id ?? "");
  } catch {
    // handled below
  }
  if (!/^txn_[a-z0-9]{10,40}$/.test(transactionID)) {
    return Response.json({ error: "bad_request" }, { status: 400 });
  }

  try {
    const transaction = await paddle<Transaction>(`/transactions/${encodeURIComponent(transactionID)}`);
    const recent = Date.now() - Date.parse(transaction.created_at) < MAX_AGE_MS;
    if (
      !["paid", "completed"].includes(transaction.status) ||
      !isGuestCheckout(transaction.custom_data) ||
      !transaction.customer_id ||
      !recent
    ) {
      return Response.json({ error: "not_eligible" }, { status: 403 });
    }

    const account = await guestAccount(context.supabaseAdmin, transaction.customer_id);
    const madeForThisCheckout = account.madeByGuestCheckout &&
      Date.parse(account.createdAt) >= Date.parse(transaction.created_at) - CREATED_SLACK_MS;
    if (!madeForThisCheckout) {
      return Response.json({ needs_code: true, email: account.email });
    }

    const { data, error } = await context.supabaseAdmin.auth.admin.generateLink({
      type: "magiclink",
      email: account.email,
    });
    const tokenHash = data?.properties?.hashed_token;
    if (error || !tokenHash) throw error ?? new Error("no token");
    console.log("paddle guest signed in", transaction.id);
    return Response.json({ token_hash: tokenHash });
  } catch (error) {
    console.error("paddle guest session failed", transactionID, error);
    return Response.json({ error: "failed" }, { status: 502 });
  }
});

export default { fetch: withCors(handler) };
