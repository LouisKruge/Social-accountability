import { createClient } from "@/lib/supabase/server";
import { AppShell, Header } from "@/components/ui";
import { BankForm } from "./bank-form";

export const dynamic = "force-dynamic";

export default async function BankPage() {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { data } = await supabase
    .from("payout_destinations")
    .select("account_holder, bank_name, account_last4, verified")
    .eq("user_id", user!.id)
    .eq("is_default", true)
    .maybeSingle();

  return (
    <AppShell>
      <Header
        title="Where payouts go"
        back="/commit/wallet"
        subtitle="Winnings are paid straight to your bank account. Nothing is held in the app."
      />
      <BankForm
        existing={
          data
            ? {
                holder: data.account_holder,
                bank: data.bank_name,
                last4: data.account_last4,
                verified: data.verified,
              }
            : null
        }
      />
    </AppShell>
  );
}
