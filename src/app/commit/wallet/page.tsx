import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { ModulePage } from "@/components/module-shell";
import { loadExchange } from "@/lib/exchange";
import { loadTreasury } from "@/lib/treasuryAccount";
import { DashSection } from "@/components/dash";
import { LedgerTable, PayoutTracker, PositionTile, RoiBar } from "@/components/wallet-ui";
import {
  BucketGrid,
  DepositCard,
  DisputeCard,
  WithdrawalCard,
  longDate,
} from "@/components/treasury-ui";
import { isOutstanding } from "@/lib/payoutLifecycle";
import { zar } from "@/lib/format";

export const dynamic = "force-dynamic";

/**
 * THE WALLET.
 *
 * The question this page exists to answer is "where is every rand I've put into
 * this app". It answers it in four positions, a live tracker per outstanding
 * payout, and a full ledger — and it is explicit that Ascend holds no balance,
 * because implying custody that does not exist is the fastest way to lose the
 * trust the rest of the page is trying to build.
 */
export default async function WalletPage() {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const [state, treasury] = await Promise.all([
    loadExchange(supabase, user!.id),
    loadTreasury(supabase, user!.id),
  ]);
  const { positions, payouts, ledger, trust } = state.wallet;
  const openDeposits = treasury.deposits.filter((d) => !d.terminal);
  const openWithdrawals = treasury.withdrawals.filter((w) => !w.terminal);
  const openDisputes = treasury.disputes.filter(
    (d) => d.state === "open" || d.state === "evidence" || d.state === "review",
  );
  const outstanding = payouts.filter((p) => isOutstanding(p.state));
  const settled = payouts.filter((p) => !isOutstanding(p.state));

  return (
    <ModulePage
      state={state}
      moduleKey="treasury"
      action={
        ledger.length > 0 ? (
          <a
            href="/api/commit/statement"
            className="shrink-0 text-xs text-ice transition hover:text-snow"
          >
            Statement
          </a>
        ) : undefined
      }
    >
      {/* ── Positions ────────────────────────────────────────────────────── */}
      <div className="mb-3 grid grid-cols-2 gap-2">
        <PositionTile
          label="On the line"
          amount={positions.locked}
          tone="risk"
          hint="Staked on challenges still running"
          big
        />
        <PositionTile
          label="Coming to you"
          amount={positions.comingToYou}
          tone="incoming"
          hint="Settled, not yet paid"
          big
        />
      </div>
      <div className="mb-3 grid grid-cols-2 gap-2">
        <PositionTile
          label="Paid to you"
          amount={positions.paidOut}
          tone="paid"
          hint="Landed in your account"
        />
        <PositionTile
          label="Awaiting your EFT"
          amount={positions.awaitingEft}
          hint="Committed, payment not received"
        />
      </div>

      <div className="mb-6">
        <RoiBar
          roi={positions.roi}
          staked={positions.lifetimeStaked}
          won={positions.lifetimeWon}
        />
      </div>

      {/* The custody statement. Stated plainly, high on the page, unprompted. */}
      <div className="mb-7 rounded-card bg-slope/50 p-4 ring-1 ring-scree/50">
        {treasury.custodial ? (
          <p className="text-meta text-sage">
            <span className="text-snow/90">Your balance is held by Ascend.</span> You can top it up,
            spend it on challenges and withdraw what has cleared. Every movement is on the ledger
            below.
          </p>
        ) : (
          <p className="text-meta text-sage">
            <span className="text-snow/90">Ascend doesn&apos;t hold a balance for you.</span> There
            is no wallet to top up. Money you commit is paid by EFT straight into the
            challenge&apos;s pool with a reference that identifies it as yours, and anything you win
            is paid straight back to your bank account. The buckets below are a record of where your
            money is — not funds we&apos;re keeping.
          </p>
        )}
      </div>

      {/* ── The buckets ──────────────────────────────────────────────────── */}
      <DashSection
        title="Where every rand sits"
        action={
          <Link href="/commit/wallet/tax" className="text-caption text-ice transition hover:text-snow">
            Tax year →
          </Link>
        }
      >
        <BucketGrid balances={treasury.balances} />
        {treasury.escrow.atRisk > 0 && (
          <p className="mt-3 text-meta text-sage">
            {zar(treasury.escrow.atRisk)} is escrowed against{" "}
            {treasury.escrow.holds.filter((h) => h.releasedTo === null).length} undecided{" "}
            {treasury.escrow.holds.filter((h) => h.releasedTo === null).length === 1
              ? "challenge"
              : "challenges"}
            . Hit the target and all of it comes back to you — the fee only ever comes out of a
            forfeit, never out of your own returned stake.
          </p>
        )}
      </DashSection>

      {/* ── Payments in ──────────────────────────────────────────────────── */}
      {openDeposits.length > 0 && (
        <DashSection
          title="Payments in"
          action={
            <Link
              href="/commit/wallet/deposits"
              className="text-caption text-ice transition hover:text-snow"
            >
              All →
            </Link>
          }
        >
          <ul>
            {openDeposits.map((d) => (
              <DepositCard key={d.id} d={d} />
            ))}
          </ul>
        </DashSection>
      )}

      {/* ── Payments out ─────────────────────────────────────────────────── */}
      <DashSection
        title="Payments out"
        action={
          <Link
            href="/commit/wallet/withdraw"
            className="text-caption text-ice transition hover:text-snow"
          >
            Withdraw →
          </Link>
        }
      >
        {openWithdrawals.length > 0 ? (
          <ul>
            {openWithdrawals.map((w) => (
              <WithdrawalCard key={w.id} w={w} />
            ))}
          </ul>
        ) : (
          <p className="text-meta text-sage">
            {treasury.eligibility.allowed ? (
              <>
                {zar(treasury.balances.withdrawable)} is cleared and ready. The next payment run
                leaves on <span className="text-snow">{longDate(treasury.nextRun)}</span>.
              </>
            ) : (
              <>
                Nothing is on its way out. Payment runs leave every Tuesday and Thursday — the next
                one is <span className="text-snow">{longDate(treasury.nextRun)}</span>.
              </>
            )}
          </p>
        )}
      </DashSection>

      {/* ── Disputes ─────────────────────────────────────────────────────── */}
      {(openDisputes.length > 0 || treasury.disputable.length > 0) && (
        <DashSection
          title="Disputes"
          action={
            <Link
              href="/commit/wallet/disputes"
              className="text-caption text-ice transition hover:text-snow"
            >
              All →
            </Link>
          }
        >
          {openDisputes.length > 0 ? (
            <ul>
              {openDisputes.map((d) => (
                <DisputeCard key={d.id} d={d} />
              ))}
            </ul>
          ) : (
            <p className="text-meta text-sage">
              {treasury.disputable.length}{" "}
              {treasury.disputable.length === 1 ? "settlement is" : "settlements are"} still inside
              the 60-day window. If one of them is wrong,{" "}
              <Link href="/commit/wallet/disputes/new" className="text-snow underline decoration-scree underline-offset-4">
                say so
              </Link>
              .
            </p>
          )}
        </DashSection>
      )}

      {/* ── Outstanding payouts ──────────────────────────────────────────── */}
      {outstanding.length > 0 && (
        <DashSection title="On its way to you">
          <div className="space-y-3">
            {outstanding.map((p) => (
              <PayoutTracker key={p.id} p={p} />
            ))}
          </div>
        </DashSection>
      )}

      {/* ── Ledger ───────────────────────────────────────────────────────── */}
      <DashSection
        title="Every movement"
        action={
          ledger.length > 0 ? (
            <a
              href="/api/commit/statement"
              className="text-caption text-ice transition hover:text-snow"
            >
              Download CSV →
            </a>
          ) : undefined
        }
      >
        <LedgerTable lines={ledger} />
      </DashSection>

      {/* ── Settled payouts ──────────────────────────────────────────────── */}
      {settled.length > 0 && (
        <DashSection title="Settled">
          <div className="space-y-3">
            {settled.map((p) => (
              <PayoutTracker key={p.id} p={p} />
            ))}
          </div>
        </DashSection>
      )}

      <div className="mb-7 flex gap-2">
        <Link
          href="/commit/wallet/bank"
          className="flex-1 rounded-field bg-ridge px-4 py-3 text-center text-xs text-snow ring-1 ring-scree transition hover:bg-scree"
        >
          Bank details
        </Link>
        <Link
          href="/commit/trust"
          className="flex-1 rounded-field bg-ridge px-4 py-3 text-center text-xs text-snow ring-1 ring-scree transition hover:bg-scree"
        >
          Trust centre
        </Link>
      </div>

      <p className="mt-2 text-center text-meta text-sage/80">
        Stakes and payouts move by manual EFT while Ascend is in beta. Every movement above is a
        real bank transfer, recorded here when it happens.
      </p>
    </ModulePage>
  );
}
