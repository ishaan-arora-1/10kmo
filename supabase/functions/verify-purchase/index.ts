import { Buffer } from "node:buffer";
import {
  Environment,
  SignedDataVerifier,
} from "npm:@apple/app-store-server-library@3.1.0";
import { withSupabase } from "npm:@supabase/server@1.5.2";
import type { Database } from "../_shared/database.types.ts";

const bundleID = Deno.env.get("APPLE_BUNDLE_ID") ?? "com.rightful.app";
const productionAppID = Number(Deno.env.get("APPLE_APP_ID"));
const validProducts: ReadonlyMap<string, "yearly" | "weekly"> = new Map([
  ["com.rightful.app.yearly", "yearly"],
  ["com.rightful.app.weekly", "weekly"],
]);

const roots = await Promise.all([
  Deno.readFile(new URL("./AppleRootCA-G2.cer", import.meta.url)),
  Deno.readFile(new URL("./AppleRootCA-G3.cer", import.meta.url)),
]);

type RequestBody = {
  signedTransaction?: string;
};

export default {
  fetch: withSupabase<Database>({ auth: "user" }, async (request, context) => {
    if (request.method !== "POST") {
      return Response.json({ error: "Method not allowed" }, { status: 405 });
    }

    const body = await request.json() as RequestBody;
    if (!body.signedTransaction) {
      return Response.json(
        { error: "signedTransaction is required" },
        { status: 400 },
      );
    }

    const transaction = await verifyTransaction(body.signedTransaction);
    if (!transaction) {
      return Response.json(
        { error: "Apple transaction verification failed" },
        { status: 400 },
      );
    }

    const productID = transaction.productId;
    const plan = productID ? validProducts.get(productID) : undefined;
    const userID = context.userClaims?.id;
    const transactionID = transaction.transactionId;
    const originalTransactionID = transaction.originalTransactionId;

    if (
      !productID || !plan || !userID || !transactionID || !originalTransactionID
    ) {
      return Response.json(
        { error: "Transaction is missing required subscription fields" },
        { status: 400 },
      );
    }

    const expiresAt = transaction.expiresDate
      ? new Date(transaction.expiresDate).toISOString()
      : null;
    const revokedAt = transaction.revocationDate
      ? new Date(transaction.revocationDate).toISOString()
      : null;
    const isActive = !revokedAt &&
      (!expiresAt || new Date(expiresAt) > new Date());

    if (!isActive) {
      return Response.json(
        { error: "Subscription is not active" },
        { status: 400 },
      );
    }

    const signedTransactionHash = await sha256(body.signedTransaction);
    const { error: insertError } = await context.supabaseAdmin
      .schema("private")
      .from("purchase_events")
      .upsert(
        {
          transaction_id: transactionID,
          user_id: userID,
          product_id: productID,
          original_transaction_id: originalTransactionID,
          expires_at: expiresAt,
          revoked_at: revokedAt,
          signed_transaction_hash: signedTransactionHash,
        },
        {
          onConflict: "transaction_id",
          ignoreDuplicates: true,
        },
      );

    if (insertError) {
      console.error("purchase event insert failed", insertError);
      return Response.json({ error: "Purchase could not be recorded" }, {
        status: 500,
      });
    }

    const { data: owner, error: ownerError } = await context.supabaseAdmin
      .schema("private")
      .from("purchase_events")
      .select("user_id")
      .eq("transaction_id", transactionID)
      .single();

    if (ownerError || owner?.user_id !== userID) {
      return Response.json(
        { error: "Transaction is already linked to another account" },
        { status: 409 },
      );
    }

    const { error: profileError } = await context.supabaseAdmin
      .from("profiles")
      .update({ plan })
      .eq("user_id", userID);

    if (profileError) {
      console.error("profile plan update failed", profileError);
      return Response.json({ error: "Plan could not be updated" }, {
        status: 500,
      });
    }

    return Response.json({
      verified: true,
      plan,
      expiresAt,
    });
  }),
};

async function verifyTransaction(signedTransaction: string) {
  const environments: Environment[] = [
    Environment.PRODUCTION,
    Environment.SANDBOX,
  ];

  for (const environment of environments) {
    try {
      if (
        environment === Environment.PRODUCTION &&
        !Number.isFinite(productionAppID)
      ) {
        continue;
      }
      const verifier = new SignedDataVerifier(
        roots.map((certificate) => Buffer.from(certificate)),
        true,
        environment,
        bundleID,
        environment === Environment.PRODUCTION ? productionAppID : undefined,
      );
      return await verifier.verifyAndDecodeTransaction(signedTransaction);
    } catch {
      // A sandbox transaction failing production verification is expected.
    }
  }
  return null;
}

async function sha256(value: string): Promise<string> {
  const digest = await crypto.subtle.digest(
    "SHA-256",
    new TextEncoder().encode(value),
  );
  return Array.from(new Uint8Array(digest))
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
}
