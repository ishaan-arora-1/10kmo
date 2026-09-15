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
  Deno.readFile(new URL("../_shared/AppleRootCA-G2.cer", import.meta.url)),
  Deno.readFile(new URL("../_shared/AppleRootCA-G3.cer", import.meta.url)),
]);

export default {
  fetch: withSupabase<Database>({ auth: "none" }, async (request, context) => {
    if (request.method !== "POST") {
      return Response.json({ error: "Method not allowed" }, { status: 405 });
    }

    const { signedPayload } = await request.json() as {
      signedPayload?: string;
    };
    if (!signedPayload) {
      return Response.json({ error: "signedPayload is required" }, {
        status: 400,
      });
    }

    const verified = await verifyNotification(signedPayload);
    if (!verified) {
      return Response.json({ error: "Invalid Apple signature" }, {
        status: 400,
      });
    }

    const signedTransaction = verified.payload.data?.signedTransactionInfo;
    if (!signedTransaction) {
      // TEST and a small number of informational notifications have no transaction.
      return Response.json({ received: true, updated: false });
    }

    let transaction;
    try {
      transaction = await verified.verifier.verifyAndDecodeTransaction(
        signedTransaction,
      );
    } catch {
      return Response.json({ error: "Invalid transaction signature" }, {
        status: 400,
      });
    }

    const productID = transaction.productId;
    const plan = productID ? validProducts.get(productID) : undefined;
    const transactionID = transaction.transactionId;
    const originalTransactionID = transaction.originalTransactionId;
    if (!productID || !plan || !transactionID || !originalTransactionID) {
      return Response.json({ received: true, updated: false });
    }

    const expiresAt = transaction.expiresDate
      ? new Date(transaction.expiresDate).toISOString()
      : null;
    const revokedAt = transaction.revocationDate
      ? new Date(transaction.revocationDate).toISOString()
      : null;
    const hash = await sha256(signedTransaction);

    const { data: ownerID, error } = await context.supabaseAdmin.rpc(
      "apply_subscription_status",
      {
        p_original_transaction_id: originalTransactionID,
        p_transaction_id: transactionID,
        p_product_id: productID,
        p_expires_at: expiresAt,
        p_revoked_at: revokedAt,
        p_signed_transaction_hash: hash,
      },
    );

    if (error) {
      console.error("subscription notification update failed", error);
      return Response.json({ error: "Subscription could not be updated" }, {
        status: 500,
      });
    }

    return Response.json({
      received: true,
      updated: ownerID !== null,
      notificationType: verified.payload.notificationType,
    });
  }),
};

async function verifyNotification(signedPayload: string) {
  for (const environment of configuredEnvironments()) {
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
      const payload = await verifier.verifyAndDecodeNotification(signedPayload);
      return { payload, verifier };
    } catch {
      // Trying the configured fallback environment is expected for sandbox traffic.
    }
  }
  return null;
}

function configuredEnvironments(): Environment[] {
  const value = Deno.env.get("APPLE_TRANSACTION_ENVIRONMENT") ?? "production";
  if (value === "sandbox") return [Environment.SANDBOX];
  if (value === "both") return [Environment.PRODUCTION, Environment.SANDBOX];
  return [Environment.PRODUCTION];
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
