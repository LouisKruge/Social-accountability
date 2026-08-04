import "server-only";

import { createAdminClient } from "@/lib/supabase/admin";
import { canDeposit, nextPayoutRun, settleForCohort, type DepositState } from "@/lib/treasury";

/**
 * THE TREASURY RECONCILIATION JOB.
 *
 * ── WHAT IT IS ALLOWED TO DO ─────────────────────────────────────────────────
 * Bookkeeping, and only bookkeeping. It places escrow holds against stakes that
 * were already confirmed, settles those holds when the challenge they belong to
 * closes, and puts approved withdrawals into the next payment run.
 *
 * ── WHAT IT IS NOT ALLOWED TO DO ─────────────────────────────────────────────
 * Move money. It cannot collect and it cannot pay: there is no payment API call
 * anywhere in this file, by design and not by omission. A deposit reaches
 * `received` only when a human has seen it on a bank statement, and a
 * withdrawal reaches `paid` the same way. That constraint stays until the
 * escrow/custody question has had a real compliance review — automating
 * collection or payout before then is the one shortcut that turns a product
 * risk into a licensing one.
 *
 * Runs with the SERVICE ROLE, so it bypasses RLS and must never be reachable by
 * untrusted input. The route that calls it is bearer-gated, same as the ranking
 * job.
 */

export interface TreasuryJobResult {
  /** Deposits nudged from `instructed` to `awaiting_transfer`. */
  depositsAdvanced: number;
  /** Escrow holds newly placed against confirmed stakes. */
  holdsPlaced: number;
  /** Escrow holds settled because their challenge closed. */
  holdsSettled: number;
  /** Approved withdrawals given a payment-run date. */
  withdrawalsScheduled: number;
  notes: string[];
}

const DEFAULT_FEE_RATE = 0.1;

export async function runTreasuryJob(
  today = new Date().toISOString().slice(0, 10),
): Promise<TreasuryJobResult> {
  const db = createAdminClient();
  const notes: string[] = [];

  // ── 1. Deposits: instructed → awaiting_transfer ────────────────────────────
  // A reference has been issued and shown; from here we are waiting on the
  // person's bank, not on ourselves. The transition is checked against the same
  // whitelist the UI uses rather than written blind.
  const { data: fresh } = await db
    .from("deposits")
    .select("id, user_id, state")
    .eq("state", "instructed");

  let depositsAdvanced = 0;
  for (const d of fresh ?? []) {
    if (!canDeposit(d.state as DepositState, "awaiting_transfer")) continue;
    const { error } = await db
      .from("deposits")
      .update({ state: "awaiting_transfer" })
      .eq("id", d.id);
    if (error) continue;
    await db.from("deposit_events").insert({
      deposit_id: d.id,
      user_id: d.user_id,
      from_state: "instructed",
      to_state: "awaiting_transfer",
      reason: "Reference issued and shown to the account holder.",
      actor: "system",
    });
    depositsAdvanced += 1;
  }

  // ── 2. Place escrow against confirmed stakes on live challenges ────────────
  const { data: liveStakes } = await db
    .from("stakes")
    .select("id, user_id, cohort_id, amount, payment_confirmed")
    .eq("payment_confirmed", true);

  const { data: cohorts } = await db
    .from("stake_cohorts")
    .select("id, status, fee_rate, target_value, end_date");
  const cohortById = new Map((cohorts ?? []).map((c) => [c.id, c]));

  const { data: existing } = await db.from("escrow_holds").select("id, stake_id, released_to");
  const heldByStake = new Map((existing ?? []).map((h) => [h.stake_id, h]));

  let holdsPlaced = 0;
  for (const s of liveStakes ?? []) {
    const cohort = cohortById.get(s.cohort_id);
    if (!cohort || heldByStake.has(s.id)) continue;
    if (cohort.status !== "open" && cohort.status !== "active") continue;

    const { error } = await db.from("escrow_holds").insert({
      user_id: s.user_id,
      stake_id: s.id,
      cohort_id: s.cohort_id,
      amount: s.amount,
    });
    if (!error) holdsPlaced += 1;
  }

  // ── 3. Settle escrow for challenges that have closed ───────────────────────
  // Whether somebody hit their target is read from their own verified effort,
  // never from anything else. There is no randomness anywhere in this path and
  // there must never be: an outcome decided even partly by chance changes what
  // Commit legally is.
  const { data: openHolds } = await db
    .from("escrow_holds")
    .select("id, user_id, stake_id, cohort_id, amount")
    .is("released_to", null);

  let holdsSettled = 0;
  for (const h of openHolds ?? []) {
    const cohort = cohortById.get(h.cohort_id);
    if (!cohort || (cohort.status !== "completed" && cohort.status !== "cancelled")) continue;

    // Whether the target was hit is read from this person's own verified
    // effort. A cancelled challenge skips the question entirely — see
    // settleForCohort().
    let hitTarget = false;
    if (cohort.status === "completed") {
      const { data: logs } = await db
        .from("daily_verification_logs")
        .select("verified_value")
        .eq("stake_id", h.stake_id);
      const total = (logs ?? []).reduce((t, l) => t + Number(l.verified_value ?? 0), 0);
      hitTarget = total >= Number(cohort.target_value ?? 0);
    }

    const split = settleForCohort(
      Number(h.amount),
      cohort.status,
      hitTarget,
      Number(cohort.fee_rate ?? DEFAULT_FEE_RATE),
    );
    const hit = split.toUser > 0;

    const { error } = await db
      .from("escrow_holds")
      .update({
        released_to: hit ? "user" : "pool",
        amount_to_user: split.toUser,
        amount_to_pool: split.toPool,
        fee: split.fee,
        released_at: new Date().toISOString(),
      })
      .eq("id", h.id);

    if (error) {
      // The CHECK constraint refuses a split that does not account for every
      // cent. If that ever fires it is a bug in the arithmetic, not bad data,
      // so it is surfaced rather than swallowed.
      notes.push(`escrow ${h.id}: ${error.message}`);
      continue;
    }
    holdsSettled += 1;
  }

  // ── 4. Put approved withdrawals into the next payment run ──────────────────
  // Scheduling is not paying. The run date tells the person when to expect it;
  // an operator still makes the transfer and marks it paid.
  const run = nextPayoutRun(today);
  const { data: approved } = await db
    .from("withdrawals")
    .select("id, user_id, state, scheduled_for")
    .eq("state", "approved")
    .is("scheduled_for", null);

  let withdrawalsScheduled = 0;
  for (const w of approved ?? []) {
    const { error } = await db
      .from("withdrawals")
      .update({ state: "scheduled", scheduled_for: run })
      .eq("id", w.id);
    if (error) continue;
    await db.from("withdrawal_events").insert({
      withdrawal_id: w.id,
      user_id: w.user_id,
      from_state: "approved",
      to_state: "scheduled",
      reason: `Queued for the payment run on ${run}.`,
      actor: "system",
    });
    withdrawalsScheduled += 1;
  }

  return { depositsAdvanced, holdsPlaced, holdsSettled, withdrawalsScheduled, notes };
}
