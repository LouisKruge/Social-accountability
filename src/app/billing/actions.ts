"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { initTransaction } from "@/lib/paystack";

/**
 * Kick off the premium upgrade: create a Paystack subscription transaction for
 * the signed-in user and redirect them to Paystack's hosted checkout.
 */
export async function startPremiumCheckout() {
  const planCode = process.env.PAYSTACK_PREMIUM_PLAN_CODE;
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "";
  if (!planCode) redirect("/billing?error=not_configured");

  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user?.email) redirect("/login");

  let authorizationUrl: string;
  try {
    const result = await initTransaction({
      email: user.email,
      userId: user.id,
      planCode,
      callbackUrl: `${siteUrl}/billing?checkout=done`,
    });
    authorizationUrl = result.authorizationUrl;
  } catch {
    redirect("/billing?error=init_failed");
  }

  redirect(authorizationUrl);
}
