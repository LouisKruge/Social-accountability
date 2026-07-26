import { createClient } from "@/lib/supabase/server";
import { AppShell, Header, Card, Badge, Button, ErrorNote, SuccessNote } from "@/components/ui";
import { FREE_LIMITS } from "@/lib/entitlements";
import { startPremiumCheckout } from "./actions";

export const dynamic = "force-dynamic";

export default async function BillingPage({
  searchParams,
}: {
  searchParams: { checkout?: string; error?: string };
}) {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { data: sub } = await supabase
    .from("subscriptions")
    .select("tier, status, current_period_end")
    .eq("user_id", user!.id)
    .maybeSingle();

  const isPremium = sub?.tier === "premium" && sub.status === "active";

  return (
    <AppShell>
      <Header title="Billing" back="/profile" subtitle="Manage your Ascend plan" />

      {searchParams.checkout === "done" && (
        <div className="mb-4">
          <SuccessNote>
            Thanks! Your payment is processing — premium activates the moment Paystack confirms it.
          </SuccessNote>
        </div>
      )}
      {searchParams.error === "not_configured" && (
        <div className="mb-4">
          <ErrorNote>Billing isn&apos;t configured yet. Please try again later.</ErrorNote>
        </div>
      )}
      {searchParams.error === "init_failed" && (
        <div className="mb-4">
          <ErrorNote>We couldn&apos;t start checkout. Please try again.</ErrorNote>
        </div>
      )}

      <Card className="mb-5">
        <div className="flex items-center justify-between">
          <span className="text-sm font-semibold text-snow">Current plan</span>
          <Badge tone={isPremium ? "summit" : "muted"}>{isPremium ? "Premium" : "Free"}</Badge>
        </div>
        {isPremium && sub?.current_period_end && (
          <p className="mt-2 text-xs text-sage">
            Renews {new Date(sub.current_period_end).toLocaleDateString("en-ZA")}
          </p>
        )}
        {sub?.status === "past_due" && (
          <p className="mt-2 text-xs text-summit">
            Your last payment failed — update your card to keep premium.
          </p>
        )}
      </Card>

      <div className="grid gap-4">
        <Card>
          <p className="font-display text-base font-medium text-snow">Free</p>
          <ul className="mt-2 space-y-1 text-sm text-sage">
            <li>• {FREE_LIMITS.ownedGroups} group you own</li>
            <li>• {FREE_LIMITS.ownedCategories} category</li>
            <li>• Join unlimited friends&apos; groups</li>
            <li>• Weekly leaderboards &amp; rank cards</li>
          </ul>
        </Card>

        <Card className="ring-1 ring-summit/25">
          <div className="flex items-center justify-between">
            <p className="font-display text-base font-medium text-ice">Premium</p>
            <Badge tone="ice">Most popular</Badge>
          </div>
          <ul className="mt-2 space-y-1 text-sm text-snow/90">
            <li>• Unlimited groups &amp; categories</li>
            <li>• Historical trend charts</li>
            <li>• Everything in Free</li>
          </ul>
          <p className="mt-3 text-xs text-sage">Billed monthly in ZAR via Paystack.</p>

          {!isPremium ? (
            <form action={startPremiumCheckout} className="mt-4">
              <Button type="submit">Upgrade to Premium</Button>
            </form>
          ) : (
            <p className="mt-4 text-sm font-medium text-summit">You&apos;re on Premium</p>
          )}
        </Card>
      </div>
    </AppShell>
  );
}
