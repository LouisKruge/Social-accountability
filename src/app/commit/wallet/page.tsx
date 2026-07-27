import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { ModulePage } from "@/components/module-shell";
import { loadExchange } from "@/lib/exchange";
import { DashSection } from "@/components/dash";
import { LedgerTable, PayoutTracker, PositionTile, RoiBar } from "@/components/wallet-ui";
import { isOutstanding } from "@/lib/payoutLifecycle";

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

  const state = await loadExchange(supabase, user!.id);
  const { positions, payouts, ledger, trust } = state.wallet;
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
        <p className="text-xs leading-relaxed text-sage">
          <span className="text-snow/90">Ascend doesn&apos;t hold a balance for you.</span> There is
          no wallet to top up and nothing to withdraw. Your stake goes to the challenge&apos;s pool,
          and anything you win is paid straight to your bank account by EFT. The figures above are a
          record of where your money is — not funds we&apos;re keeping.
        </p>
      </div>

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
              className="text-[0.68rem] text-ice transition hover:text-snow"
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

      <p className="mt-2 text-center text-xs leading-relaxed text-sage/80">
        Stakes and payouts move by manual EFT while Ascend is in beta. Every movement above is a
        real bank transfer, recorded here when it happens.
      </p>
    </ModulePage>
  );
}
