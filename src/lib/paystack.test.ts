import { describe, expect, it, vi, beforeAll } from "vitest";
import crypto from "node:crypto";

// paystack.ts guards itself with `import "server-only"`, which throws outside an
// RSC server context. Stub it so we can unit-test the pure crypto logic.
vi.mock("server-only", () => ({}));

const SECRET = "sk_test_unit_secret";

let verifyWebhookSignature: typeof import("./paystack").verifyWebhookSignature;

beforeAll(async () => {
  process.env.PAYSTACK_SECRET_KEY = SECRET;
  ({ verifyWebhookSignature } = await import("./paystack"));
});

function sign(body: string) {
  return crypto.createHmac("sha512", SECRET).update(body).digest("hex");
}

describe("verifyWebhookSignature", () => {
  const body = JSON.stringify({ event: "charge.success", data: { status: "success" } });

  it("accepts a correctly signed body", () => {
    expect(verifyWebhookSignature(body, sign(body))).toBe(true);
  });

  it("rejects a tampered body", () => {
    const tampered = body.replace("success", "failed");
    expect(verifyWebhookSignature(tampered, sign(body))).toBe(false);
  });

  it("rejects a wrong/short signature (no length crash)", () => {
    expect(verifyWebhookSignature(body, "deadbeef")).toBe(false);
  });

  it("rejects a missing signature", () => {
    expect(verifyWebhookSignature(body, null)).toBe(false);
  });

  it("rejects a signature made with a different secret", () => {
    const other = crypto.createHmac("sha512", "sk_test_other").update(body).digest("hex");
    expect(verifyWebhookSignature(body, other)).toBe(false);
  });
});
