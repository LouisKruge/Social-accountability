import "server-only";

import crypto from "node:crypto";

const PAYSTACK_BASE = "https://api.paystack.co";

function secretKey(): string {
  const key = process.env.PAYSTACK_SECRET_KEY;
  if (!key) throw new Error("PAYSTACK_SECRET_KEY is not configured.");
  return key;
}

export interface InitTransactionArgs {
  email: string;
  userId: string;
  planCode: string;
  callbackUrl: string;
}

/**
 * Initialize a Paystack subscription transaction for the premium plan. Returns
 * the hosted checkout URL to redirect the user to. `metadata.user_id` lets the
 * webhook map the resulting charge back to our user without storing emails.
 */
export async function initTransaction({
  email,
  userId,
  planCode,
  callbackUrl,
}: InitTransactionArgs): Promise<{ authorizationUrl: string }> {
  const res = await fetch(`${PAYSTACK_BASE}/transaction/initialize`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${secretKey()}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      email,
      plan: planCode,
      callback_url: callbackUrl,
      metadata: { user_id: userId },
    }),
  });

  const json = (await res.json()) as {
    status: boolean;
    message: string;
    data?: { authorization_url: string };
  };
  if (!res.ok || !json.status || !json.data) {
    throw new Error(`Paystack init failed: ${json.message ?? res.statusText}`);
  }
  return { authorizationUrl: json.data.authorization_url };
}

/**
 * Verify a Paystack webhook signature: HMAC-SHA512 of the raw body, keyed by the
 * secret key, compared to the `x-paystack-signature` header (timing-safe).
 */
export function verifyWebhookSignature(rawBody: string, signature: string | null): boolean {
  if (!signature) return false;
  const expected = crypto
    .createHmac("sha512", secretKey())
    .update(rawBody)
    .digest("hex");
  const a = Buffer.from(expected);
  const b = Buffer.from(signature);
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}
