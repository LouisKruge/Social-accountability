// ─────────────────────────────────────────────────────────────────────────────
// Habit-stakes settlement math — pure, dependency-free, unit-tested.
//
//   Total Pool         = Σ confirmed stakes
//   Platform Fee       = Total Pool × fee_rate
//   Distributable Pool = Total Pool − Platform Fee
//   Payout per Winner  = Distributable Pool ÷ Number of Winners
//
// Outcome is determined ONLY by each participant's own verified effort. There is
// no randomness, bonus or multiplier anywhere in this module, by design — adding
// one would change the product's legal classification.
//
// The two edge cases are explicit, named outcomes rather than emergent behaviour:
//
//   • ZERO WINNERS  → nobody can be paid out of a pool nobody won. Every
//     participant is refunded their full stake and NO platform fee is charged.
//     The platform must not simply retain the pool.
//
//   • ALL WINNERS   → there are no forfeitures to redistribute, so the post-fee
//     pool split evenly returns LESS than each person staked. That is a
//     mechanical consequence of the fee, not a bug, and is surfaced to the UI
//     via `everyoneWon` so it can be explained rather than looking broken.
// ─────────────────────────────────────────────────────────────────────────────

export interface Participant {
  userId: string;
  /** Confirmed stake amount in ZAR. Unconfirmed stakes must be excluded upstream. */
  amount: number;
  /** Verified cumulative progress over the cohort window. */
  progress: number;
}

export type SettlementOutcome = "mixed" | "no_winners" | "all_winners";

export interface PayoutLine {
  userId: string;
  amount: number;
  kind: "winnings" | "refund";
}

export interface Settlement {
  outcome: SettlementOutcome;
  totalPool: number;
  /** Zero when there are no winners — no fee is charged on a refunded cohort. */
  platformFee: number;
  distributablePool: number;
  winnerCount: number;
  participantCount: number;
  payoutPerWinner: number;
  /** True when every participant hit the target (payout < stake, by design). */
  everyoneWon: boolean;
  lines: PayoutLine[];
}

/** Round to cents, avoiding binary float drift on .005 boundaries. */
function toCents(n: number): number {
  return Math.round((n + Number.EPSILON) * 100) / 100;
}

/**
 * Settle a cohort. `targetValue` is the cumulative value a participant had to
 * reach; anyone at or above it is a winner.
 */
export function settleCohort(
  participants: Participant[],
  targetValue: number,
  feeRate: number,
): Settlement {
  if (feeRate < 0 || feeRate >= 1) {
    throw new Error(`fee_rate must be in [0, 1). Received ${feeRate}.`);
  }

  const participantCount = participants.length;
  const totalPool = toCents(participants.reduce((sum, p) => sum + p.amount, 0));
  const winners = participants.filter((p) => p.progress >= targetValue);
  const winnerCount = winners.length;

  // ── Edge case: nobody won. Refund everyone in full, charge no fee. ─────────
  if (winnerCount === 0) {
    return {
      outcome: "no_winners",
      totalPool,
      platformFee: 0,
      distributablePool: 0,
      winnerCount: 0,
      participantCount,
      payoutPerWinner: 0,
      everyoneWon: false,
      lines: participants.map((p) => ({
        userId: p.userId,
        amount: toCents(p.amount),
        kind: "refund" as const,
      })),
    };
  }

  const platformFee = toCents(totalPool * feeRate);
  const distributablePool = toCents(totalPool - platformFee);
  const payoutPerWinner = toCents(distributablePool / winnerCount);
  const everyoneWon = participantCount > 0 && winnerCount === participantCount;

  return {
    outcome: everyoneWon ? "all_winners" : "mixed",
    totalPool,
    platformFee,
    distributablePool,
    winnerCount,
    participantCount,
    payoutPerWinner,
    everyoneWon,
    lines: winners.map((w) => ({
      userId: w.userId,
      amount: payoutPerWinner,
      kind: "winnings" as const,
    })),
  };
}

/** Remaining distance to the target, for the WhatsApp nudge copy. */
export function remainingToTarget(progress: number, targetValue: number): number {
  return Math.max(0, toCents(targetValue - progress));
}
