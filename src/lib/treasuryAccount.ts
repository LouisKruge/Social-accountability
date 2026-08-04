// Server only. A client component importing a value from this file would drag
// the database client and node: built-ins into the browser bundle — which is
// exactly what happened before src/lib/modules.ts and src/lib/studios.ts
// existed, and it only surfaced as a build error once a node: import appeared.
// This import turns that mistake into a build failure naming the culprit.
import "server-only";
import type { ServerClient } from "@/lib/supabase/server";
import { timed } from "@/lib/timing";
import {
  DEPOSIT_PRESENTATION,
  DISPUTE_PRESENTATION,
  TREASURY,
  WITHDRAWAL_PRESENTATION,
  ZERO_BALANCES,
  checkWithdrawal,
  depositIsTerminal,
  disputeWindowOpen,
  escrowAtRisk,
  nextPayoutRun,
  summariseTaxYear,
  withdrawalIsCancellable,
  withdrawalIsTerminal,
  type Balances,
  type DepositState,
  type DisputeState,
  type EscrowHold,
  type TaxYearSummary,
  type TaxableMovement,
  type WithdrawalCheck,
  type WithdrawalState,
} from "@/lib/treasury";

/**
 * THE TREASURY, loaded.
 *
 * `src/lib/treasury.ts` is the pure engine — state machines, eligibility, the
 * tax year, the payment calendar. This file is the only thing that touches the
 * database, so every rule above it stays testable without a Postgres.
 *
 * ── ONE RULE ─────────────────────────────────────────────────────────────────
 * Every figure on the treasury screens comes from a row. There is no computed
 * "projected balance" and no optimistic credit: money that has not been
 * reconciled against a bank statement is reported as pending, in its own
 * bucket, with the word pending next to it. A product that shows you money you
 * cannot yet spend has lied to you in the one place it cannot afford to.
 */

export interface DepositRow {
  id: string;
  amount: number;
  state: DepositState;
  reference: string;
  label: string;
  blurb: string;
  progress: number;
  needsUser: boolean;
  terminal: boolean;
  failureReason: string | null;
  createdAt: string;
}

export interface WithdrawalRow {
  id: string;
  amount: number;
  amountPaid: number | null;
  state: WithdrawalState;
  label: string;
  blurb: string;
  progress: number;
  cancellable: boolean;
  terminal: boolean;
  scheduledFor: string | null;
  decisionReason: string | null;
  requestedAt: string;
}

export interface DisputeRow {
  id: string;
  state: DisputeState;
  label: string;
  blurb: string;
  category: string;
  summary: string;
  resolution: string | null;
  openedAt: string;
  messages: { author: "user" | "support"; body: string; at: string }[];
}

export interface TreasuryAccount {
  custodial: boolean;
  balances: Balances;
  /** The next sequence number, so the UI can show the reference before paying. */
  nextDepositSequence: number;
  deposits: DepositRow[];
  withdrawals: WithdrawalRow[];
  escrow: { holds: EscrowHold[]; atRisk: number };
  disputes: DisputeRow[];
  /** Whether a withdrawal of the full cleared balance would go through today. */
  eligibility: WithdrawalCheck;
  destination: { holder: string; bank: string; last4: string; verified: boolean } | null;
  /** The date the next payment run leaves, from today. */
  nextRun: string;
  tax: TaxYearSummary;
  /** Settled challenges still inside the 60-day dispute window. */
  disputable: { cohortId: string; name: string; settledOn: string }[];
}

const n = (v: unknown) => Number(v ?? 0);

export async function loadTreasury(
  supabase: ServerClient,
  userId: string,
  today = new Date().toISOString().slice(0, 10),
): Promise<TreasuryAccount> {
  const [balances, deposits, withdrawals, escrow, disputes, destination, movements, settled] =
    await Promise.all([
      timed("treasury.balances", async () => {
        const { data } = await supabase.rpc("treasury_balances");
        const row = Array.isArray(data) ? data[0] : data;
        if (!row) return ZERO_BALANCES;
        return {
          available: n(row.available),
          pending: n(row.pending),
          locked: n(row.locked),
          escrow: n(row.escrow),
          processing: n(row.processing),
          verificationHold: n(row.verification_hold),
          rewards: n(row.rewards),
          referral: n(row.referral),
          withdrawable: n(row.withdrawable),
        } satisfies Balances;
      }),

      timed("treasury.deposits", async () => {
        const { data } = await supabase
          .from("deposits")
          .select("id, amount, state, reference, sequence, failure_reason, created_at")
          .eq("user_id", userId)
          .order("created_at", { ascending: false });
        return data ?? [];
      }, (r) => r.length),

      timed("treasury.withdrawals", async () => {
        const { data } = await supabase
          .from("withdrawals")
          .select(
            "id, amount_requested, amount_paid, state, scheduled_for, decision_reason, requested_at",
          )
          .eq("user_id", userId)
          .order("requested_at", { ascending: false });
        return data ?? [];
      }, (r) => r.length),

      timed("treasury.escrow", async () => {
        const { data } = await supabase
          .from("escrow_holds")
          .select("id, cohort_id, amount, released_to, placed_on")
          .eq("user_id", userId)
          .order("placed_on", { ascending: false });
        return data ?? [];
      }, (r) => r.length),

      timed("treasury.disputes", async () => {
        const { data } = await supabase
          .from("disputes")
          .select(
            "id, state, category, summary, resolution, opened_at, dispute_messages(author, body, created_at)",
          )
          .eq("user_id", userId)
          .order("opened_at", { ascending: false });
        return data ?? [];
      }, (r) => r.length),

      timed("treasury.destination", async () => {
        const { data } = await supabase
          .from("payout_destinations")
          .select("account_holder, bank_name, account_last4, verified")
          .eq("user_id", userId)
          .order("is_default", { ascending: false })
          .limit(1)
          .maybeSingle();
        return data;
      }),

      timed("treasury.movements", async () => {
        const { data } = await supabase
          .from("wallet_transactions")
          .select("kind, amount, effective_at")
          .eq("user_id", userId);
        return data ?? [];
      }, (r) => r.length),

      timed("treasury.settled", async () => {
        const { data } = await supabase
          .from("payouts")
          .select("cohort_id, created_at, stake_cohorts(name)")
          .eq("user_id", userId);
        return data ?? [];
      }, (r) => r.length),
    ]);

  const depositRows: DepositRow[] = deposits.map((d) => {
    const state = d.state as DepositState;
    const p = DEPOSIT_PRESENTATION[state];
    return {
      id: d.id as string,
      amount: n(d.amount),
      state,
      reference: d.reference as string,
      label: p.label,
      blurb: p.blurb,
      progress: p.progress,
      needsUser: p.needsUser,
      terminal: depositIsTerminal(state),
      failureReason: (d.failure_reason as string | null) ?? null,
      createdAt: d.created_at as string,
    };
  });

  const withdrawalRows: WithdrawalRow[] = withdrawals.map((w) => {
    const state = w.state as WithdrawalState;
    const p = WITHDRAWAL_PRESENTATION[state];
    return {
      id: w.id as string,
      amount: n(w.amount_requested),
      amountPaid: w.amount_paid === null ? null : n(w.amount_paid),
      state,
      label: p.label,
      blurb: p.blurb,
      progress: p.progress,
      cancellable: withdrawalIsCancellable(state),
      terminal: withdrawalIsTerminal(state),
      scheduledFor: (w.scheduled_for as string | null) ?? null,
      decisionReason: (w.decision_reason as string | null) ?? null,
      requestedAt: w.requested_at as string,
    };
  });

  const holds: EscrowHold[] = escrow.map((e) => ({
    id: e.id as string,
    cohortId: e.cohort_id as string,
    amount: n(e.amount),
    releasedTo: (e.released_to as "user" | "pool" | null) ?? null,
    placedOn: e.placed_on as string,
  }));

  const disputeRows: DisputeRow[] = disputes.map((d) => {
    const state = d.state as DisputeState;
    const p = DISPUTE_PRESENTATION[state];
    const raw = (d as { dispute_messages?: unknown }).dispute_messages;
    const messages = (Array.isArray(raw) ? raw : []) as {
      author: string;
      body: string;
      created_at: string;
    }[];
    return {
      id: d.id as string,
      state,
      label: p.label,
      blurb: p.blurb,
      category: d.category as string,
      summary: d.summary as string,
      resolution: (d.resolution as string | null) ?? null,
      openedAt: d.opened_at as string,
      messages: messages
        .map((m) => ({
          author: m.author === "support" ? ("support" as const) : ("user" as const),
          body: m.body,
          at: m.created_at,
        }))
        .sort((a, b) => a.at.localeCompare(b.at)),
    };
  });

  const bal = balances;
  const dest = destination
    ? {
        holder: destination.account_holder as string,
        bank: destination.bank_name as string,
        last4: (destination.account_last4 as string) ?? "",
        verified: Boolean(destination.verified),
      }
    : null;

  const taxable: TaxableMovement[] = movements.map((m) => ({
    at: m.effective_at as string,
    kind:
      m.kind === "winnings_credited"
        ? "winnings"
        : m.kind === "fee_charged"
          ? "fee"
          : m.kind === "stake_refunded"
            ? "refund"
            : "stake",
    amount: n(m.amount),
  }));

  // Anything settled inside the window can still be challenged. Showing this
  // rather than burying it in a help page is the difference between a right and
  // a technicality.
  const disputable = settled
    .filter((p) => disputeWindowOpen(String(p.created_at).slice(0, 10), today))
    .map((p) => {
      const joined = (p as { stake_cohorts?: { name?: string } | { name?: string }[] })
        .stake_cohorts;
      const cohort = Array.isArray(joined) ? joined[0] : joined;
      return {
        cohortId: p.cohort_id as string,
        name: cohort?.name ?? "A challenge",
        settledOn: String(p.created_at).slice(0, 10),
      };
    });

  return {
    custodial: TREASURY.custodial,
    balances: bal,
    nextDepositSequence:
      deposits.reduce((max, d) => Math.max(max, Number(d.sequence ?? 0)), 0) + 1,
    deposits: depositRows,
    withdrawals: withdrawalRows,
    escrow: { holds, atRisk: escrowAtRisk(holds) },
    disputes: disputeRows,
    eligibility: checkWithdrawal(bal.withdrawable, bal, dest?.verified ?? false),
    destination: dest,
    nextRun: nextPayoutRun(today),
    tax: summariseTaxYear(taxable, today),
    disputable,
  };
}
