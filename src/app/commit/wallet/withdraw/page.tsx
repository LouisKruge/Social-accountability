import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { AppShell, Header } from "@/components/ui";
import { DashSection } from "@/components/dash";
import { EligibilityPanel, WithdrawalCard, longDate } from "@/components/treasury-ui";
import { loadTreasury } from "@/lib/treasuryAccount";
import { PAYOUT_CUTOFF_HOUR } from "@/lib/treasury";
import { zar } from "@/lib/format";
import { WithdrawForm } from "./withdraw-form";

export const dynamic = "force-dynamic";

/**
 * WITHDRAW.
 *
 * The checks come BEFORE the form, not after a rejection. Somebody who cannot
 * withdraw today should learn why while they are still deciding, not by filling
 * in an amount and being turned away — and the reason is always the specific
 * line, with its own numbers.
 */
export default async function WithdrawPage() {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const treasury = await loadTreasury(supabase, user!.id);
  const history = treasury.withdrawals;

  return (
    <AppShell>
      <Header
        title="Withdraw"
        back="/commit/wallet"
        subtitle="Cleared money, paid to the bank account on file."
      />

      <section className="mb-chapter">
        <p className="text-micro uppercase text-sage">Cleared and withdrawable</p>
        <p
          className={`tnum -ml-1 mt-2 font-display text-hero font-semibold ${
            treasury.balances.withdrawable > 0 ? "text-summit" : "text-snow"
          }`}
        >
          {zar(treasury.balances.withdrawable)}
        </p>
        <p className="mt-3 max-w-[23rem] text-body text-sage">
          Payment runs leave every Tuesday and Thursday. Anything approved before{" "}
          {PAYOUT_CUTOFF_HOUR}:00 on a run day goes out that day — the next one is{" "}
          <span className="text-snow">{longDate(treasury.nextRun)}</span>.
        </p>
      </section>

      <div className="mb-chapter">
        <EligibilityPanel check={treasury.eligibility} />
      </div>

      {!treasury.destination?.verified && (
        <div className="mb-chapter">
          <Link
            href="/commit/wallet/bank"
            className="block rounded-field bg-ridge px-4 py-3.5 text-center text-body text-snow ring-1 ring-scree transition hover:bg-scree"
          >
            {treasury.destination ? "Bank details are awaiting verification" : "Add your bank details"}
          </Link>
        </div>
      )}

      <div className="mb-chapter">
        <WithdrawForm
          allowed={treasury.eligibility.allowed}
          ceiling={treasury.eligibility.ceiling}
          nextRun={longDate(treasury.nextRun)}
        />
      </div>

      {history.length > 0 && (
        <DashSection title="Your withdrawals">
          <ul>
            {history.map((w) => (
              <WithdrawalCard key={w.id} w={w} />
            ))}
          </ul>
        </DashSection>
      )}

      <p className="mt-2 text-meta text-sage/80">
        A payout is a real bank transfer made by a person, not an API call. That is slower than a
        card refund and it is the honest description of what happens — nothing here moves money on
        its own.
      </p>
    </AppShell>
  );
}
