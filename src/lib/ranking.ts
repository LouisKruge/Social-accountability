// ─────────────────────────────────────────────────────────────────────────────
// Ranking business logic — pure, dependency-free, unit-tested.
//
// Ranking is by RATE OF IMPROVEMENT from each user's own baseline, so a person
// starting low competes on equal footing with someone already ahead.
//
//   pct_change = ((current − baseline) ÷ |baseline|) × 100
//
// Edge case (baseline = 0, e.g. saving from R0): we cannot divide by zero, so we
// fall back to reporting the ABSOLUTE change and flag it (`isAbsolute`) so the UI
// can mark it distinctly instead of showing an infinite/undefined rank.
// ─────────────────────────────────────────────────────────────────────────────

export type MetricType = "percentage_change" | "streak";

/**
 * For `percentage_change` categories, does a HIGHER raw value mean improvement
 * (savings, steps) or a LOWER one (debt paydown, weight loss)?
 */
export type Direction = "increase" | "decrease";

export interface ScoreInput {
  metricType: MetricType;
  direction: Direction;
  /** The user's baseline; may be null if none captured yet. */
  baselineValue: number | null;
  /** This period's self-reported raw value. */
  currentValue: number;
}

export interface ScoreResult {
  /** Percentage change, OR absolute change, OR (for streaks) the streak length. */
  score: number;
  /** True when a percentage could not be computed (baseline 0, or a streak). */
  isAbsolute: boolean;
}

/**
 * Compute a single user's score for a category+period. Higher is always better.
 */
export function computeScore({
  metricType,
  direction,
  baselineValue,
  currentValue,
}: ScoreInput): ScoreResult {
  // Streaks: the raw value IS the streak length (e.g. consecutive days). No
  // baseline maths — longer streak wins. Flagged absolute (it's a raw count).
  if (metricType === "streak") {
    return { score: currentValue, isAbsolute: true };
  }

  const baseline = baselineValue ?? 0;

  // Signed improvement: for `decrease` categories (debt, weight) getting the
  // number DOWN is progress, so we flip the delta to keep "higher score = better".
  const delta =
    direction === "decrease" ? baseline - currentValue : currentValue - baseline;

  // Divide-by-zero guard: report absolute change, flagged.
  if (baseline === 0) {
    return { score: delta, isAbsolute: true };
  }

  return { score: (delta / Math.abs(baseline)) * 100, isAbsolute: false };
}

export interface RankableEntry {
  userId: string;
  score: number;
  isAbsolute: boolean;
  /** Tie-breaker: the earliest submission wins the higher rank. */
  submittedAt: string | Date;
}

export interface RankedEntry extends RankableEntry {
  rank: number;
}

/**
 * Rank a period's entries. Sort by score descending; ties broken by earliest
 * submission time, so ranks are always distinct (no shared positions).
 */
export function rankEntries(entries: RankableEntry[]): RankedEntry[] {
  const sorted = [...entries].sort((a, b) => {
    if (b.score !== a.score) return b.score - a.score;
    return toMillis(a.submittedAt) - toMillis(b.submittedAt);
  });
  return sorted.map((entry, index) => ({ ...entry, rank: index + 1 }));
}

function toMillis(value: string | Date): number {
  return value instanceof Date ? value.getTime() : new Date(value).getTime();
}

// ── Higher-level helper used by the ranking job ──────────────────────────────

export interface RawParticipant {
  userId: string;
  currentValue: number;
  baselineValue: number | null;
  submittedAt: string | Date;
}

export interface ComputedRanking {
  userId: string;
  pctChange: number;
  isAbsolute: boolean;
  rank: number;
}

/**
 * Turn a period's raw participants into ranked leaderboard rows for one
 * (group, category). Used by the weekly reset / ranking-compute job.
 */
export function computeRankings(
  category: { metricType: MetricType; direction: Direction },
  participants: RawParticipant[],
): ComputedRanking[] {
  const scored: RankableEntry[] = participants.map((p) => {
    const { score, isAbsolute } = computeScore({
      metricType: category.metricType,
      direction: category.direction,
      baselineValue: p.baselineValue,
      currentValue: p.currentValue,
    });
    return { userId: p.userId, score, isAbsolute, submittedAt: p.submittedAt };
  });

  return rankEntries(scored).map((r) => ({
    userId: r.userId,
    pctChange: round2(r.score),
    isAbsolute: r.isAbsolute,
    rank: r.rank,
  }));
}

function round2(n: number): number {
  return Math.round((n + Number.EPSILON) * 100) / 100;
}
