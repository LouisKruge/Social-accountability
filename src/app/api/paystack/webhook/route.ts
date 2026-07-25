import { NextResponse, type NextRequest } from "next/server";
import { verifyWebhookSignature } from "@/lib/paystack";
import { createAdminClient } from "@/lib/supabase/admin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type PaystackEvent = {
  event: string;
  data: {
    customer?: { customer_code?: string };
    metadata?: { user_id?: string } | null;
    subscription_code?: string;
    next_payment_date?: string | null;
    status?: string;
  };
};

/**
 * Resolve our user id from a Paystack event: prefer the metadata.user_id we set
 * at checkout; otherwise map the customer code back via a subscription row we
 * already stored. Avoids storing user emails to satisfy the mapping.
 */
async function resolveUserId(
  admin: ReturnType<typeof createAdminClient>,
  metadataUserId: string | undefined,
  customerCode: string | undefined,
): Promise<string | null> {
  if (metadataUserId) return metadataUserId;
  if (!customerCode) return null;
  const { data } = await admin
    .from("subscriptions")
    .select("user_id")
    .eq("paystack_customer_id", customerCode)
    .maybeSingle();
  return data?.user_id ?? null;
}

export async function POST(req: NextRequest) {
  const raw = await req.text();
  const signature = req.headers.get("x-paystack-signature");

  let valid = false;
  try {
    valid = verifyWebhookSignature(raw, signature);
  } catch {
    return NextResponse.json({ error: "Webhook not configured" }, { status: 500 });
  }
  if (!valid) return NextResponse.json({ error: "Invalid signature" }, { status: 401 });

  let event: PaystackEvent;
  try {
    event = JSON.parse(raw);
  } catch {
    return NextResponse.json({ error: "Bad payload" }, { status: 400 });
  }

  const admin = createAdminClient();
  const customerCode = event.data.customer?.customer_code;
  const userId = await resolveUserId(admin, event.data.metadata?.user_id, customerCode);

  // Nothing we can map — acknowledge so Paystack doesn't retry forever.
  if (!userId) return NextResponse.json({ ok: true, ignored: "unmapped" });

  const grants = new Set(["charge.success", "subscription.create", "subscription.enable"]);
  const revokes = new Set(["subscription.disable", "subscription.not_renew"]);

  if (grants.has(event.event)) {
    await admin.from("subscriptions").upsert(
      {
        user_id: userId,
        tier: "premium",
        status: "active",
        paystack_customer_id: customerCode ?? null,
        paystack_subscription_code: event.data.subscription_code ?? null,
        current_period_end: event.data.next_payment_date ?? null,
      },
      { onConflict: "user_id" },
    );
  } else if (revokes.has(event.event)) {
    await admin
      .from("subscriptions")
      .update({ tier: "free", status: "cancelled" })
      .eq("user_id", userId);
  } else if (event.event === "invoice.payment_failed") {
    await admin.from("subscriptions").update({ status: "past_due" }).eq("user_id", userId);
  }

  return NextResponse.json({ ok: true });
}
