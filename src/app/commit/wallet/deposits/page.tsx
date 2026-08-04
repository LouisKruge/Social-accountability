import { createClient } from "@/lib/supabase/server";
import { AppShell, Header } from "@/components/ui";
import { DashSection } from "@/components/dash";
import { DepositCard } from "@/components/treasury-ui";
import { loadTreasury } from "@/lib/treasuryAccount";
import { TREASURY } from "@/lib/treasury";
import { DepositForm } from "./deposit-form";

export const dynamic = "force-dynamic";

/**
 * PAYMENTS IN.
 *
 * In non-custodial mode this screen is honest about what it is: a way to get a
 * reference so a transfer you make yourself can be matched to you. It is not a
 * top-up, and it does not pretend to be one — the button says "get my payment
 * reference", because that is all that happens when you press it.
 */
export default async function DepositsPage() {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const treasury = await loadTreasury(supabase, user!.id);
  const open = treasury.deposits.filter((d) => !d.terminal);
  const done = treasury.deposits.filter((d) => d.terminal);

  return (
    <AppShell>
      <Header
        title="Payments in"
        back="/commit/wallet"
        subtitle={
          treasury.custodial
            ? "Top up your balance."
            : "Ascend holds no balance. This gives you a reference so the money you send is matched to you."
        }
      />

      <div className="mb-chapter">
        <DepositForm custodial={treasury.custodial} beneficiary={TREASURY.beneficiary} />
      </div>

      {open.length > 0 && (
        <DashSection title="Waiting">
          <ul>
            {open.map((d) => (
              <DepositCard key={d.id} d={d} />
            ))}
          </ul>
        </DashSection>
      )}

      {done.length > 0 && (
        <DashSection title="Done">
          <ul>
            {done.map((d) => (
              <DepositCard key={d.id} d={d} />
            ))}
          </ul>
        </DashSection>
      )}

      <p className="mt-2 text-meta text-sage/80">
        Transfers between South African banks usually clear in one working day. We reconcile against
        the bank statement each working day, and your wallet updates the moment yours is matched.
      </p>
    </AppShell>
  );
}
