import { project, simulate, type Projection } from "@/lib/intelligence";

// ─────────────────────────────────────────────────────────────────────────────
// THE PERFORMANCE POSITION
//
// Commit's central claim is that a challenge is a position, not a bet. The
// difference is not vocabulary — it is that a position has measurable state you
// can act on, and a bet has an outcome you wait for.
//
// So every open challenge reports: exposure, velocity, required output, health,
// probability, expected return and volatility. All of it computed from the
// user's own logged days.
//
// ── WHY THERE IS NO "AI CONFIDENCE" FIELD ────────────────────────────────────
// The brief asks for one. There is no model in this path and adding a number
// labelled "AI confidence" over a rule-based projection would be a lie about
// where the number came from. What the brief actually wants — a stated
// confidence — is `Projection.probability`, which comes from the person's own
// mean and variance, and it says so on screen.
//
// ── AND NO WEATHER, GPS OR RECOVERY IMPACT ───────────────────────────────────
// Ascend has no weather feed, no location data and no wearable. Those fields
// would each require inventing a number about somebody's body or their city.
// They are absent rather than estimated. See docs/COMMIT_PLATFORM.md.
// ─────────────────────────────────────────────────────────────────────────────

export interface PositionInput {
  cohortId: string;
  name: string;
  /** Rand committed. */
  stake: number;
  progress: number;
  target: number;
  dayNumber: number;
  totalDays: number;
  daysRemaining: number;
  /** The caller's own logged daily values for this cohort, oldest first. */
  history: number[];
  poolTotal: number;
  participants: number;
  feeRate: number;
}

export type PositionHealth = "ahead" | "on_pace" | "behind" | "critical" | "closed";

export interface Position {
  cohortId: string;
  name: string;
  /** Rand at risk. */
  exposure: number;
  /** The full target, carried through so callers never reconstruct it. */
  target: number;
  /** How much of the target is still outstanding. */
  remaining: number;
  /** Fraction of the target completed, 0–1. */
  completion: number;
  /** Where the user should be by now if pace were even, 0–1. */
  expected: number;
  /** completion − expected. Positive is ahead. */
  delta: number;
  health: PositionHealth;
  /** Average logged output per day so far. */
  velocity: number;
  /** What each remaining day now has to produce. */
  requiredVelocity: number;
  /** Required over current, as a multiple. 1.0 means "keep doing what you do". */
  strain: number | null;
  /** How steady this person has been on this position. Null under 3 days. */
  volatility: Volatility | null;
  /** Null until there is enough history to say anything honest. */
  projection: Projection | null;
  /** Gross return if the position closes successfully, net of fee. */
  expectedReturn: number;
  daysRemaining: number;
  dayNumber: number;
  totalDays: number;
}

export interface Volatility {
  /** Coefficient of variation: standard deviation over the mean. */
  cv: number;
  /** 0–100, where 100 is perfectly even. */
  steadiness: number;
  label: "metronomic" | "steady" | "uneven" | "erratic";
}

/**
 * DISCIPLINE VOLATILITY.
 *
 * Two people average 10,000 steps a day. One walks 10,000 every day; the other
 * alternates 2,000 and 18,000. Every mean-based metric in this product calls
 * them identical, and they are not: the second person is one bad day from
 * missing, and their projection carries far more risk at the same average.
 *
 * Measured as the coefficient of variation — standard deviation over the mean —
 * because that is scale-free. A CV of 0.2 means the same thing for steps and
 * for rand, which a raw standard deviation does not.
 *
 * Returns null under three days. A "volatility" over two points is the gap
 * between two numbers with a Greek letter attached.
 */
export function volatility(history: number[]): Volatility | null {
  if (history.length < 3) return null;
  const m = mean(history);
  if (m <= 0) return null;

  const cv = stdev(history) / m;
  // Mapped so a metronome lands near 100 and a 2k/18k alternator near 20.
  const steadiness = Math.max(0, Math.min(100, Math.round(100 * Math.exp(-1.6 * cv))));

  return {
    cv: round2(cv),
    steadiness,
    label: cv < 0.1 ? "metronomic" : cv < 0.25 ? "steady" : cv < 0.5 ? "uneven" : "erratic",
  };
}

export function buildPosition(i: PositionInput): Position {
  const completion = i.target > 0 ? Math.min(1, i.progress / i.target) : 0;
  const expected = i.totalDays > 0 ? Math.min(1, i.dayNumber / i.totalDays) : 0;
  const delta = round3(completion - expected);

  const remaining = Math.max(0, i.target - i.progress);
  const velocity = i.dayNumber > 0 ? i.progress / i.dayNumber : 0;
  const requiredVelocity = i.daysRemaining > 0 ? remaining / i.daysRemaining : remaining;

  return {
    cohortId: i.cohortId,
    name: i.name,
    exposure: i.stake,
    target: i.target,
    remaining,
    completion: round3(completion),
    expected: round3(expected),
    delta,
    health: health(completion, delta, i.daysRemaining),
    velocity: Math.round(velocity),
    requiredVelocity: Math.round(requiredVelocity),
    // Null rather than Infinity when nothing has been logged yet: "you need
    // ∞× your current pace" is true and useless.
    strain: velocity > 0 ? round2(requiredVelocity / velocity) : null,
    volatility: volatility(i.history),
    projection: project(i.history, remaining, i.daysRemaining, i.dayNumber),
    expectedReturn: expectedReturn(i),
    daysRemaining: i.daysRemaining,
    dayNumber: i.dayNumber,
    totalDays: i.totalDays,
  };
}

/**
 * Health, from how far ahead or behind pace the position is.
 *
 * `critical` needs BOTH a real deficit and little time left — being 15% behind
 * on day two of thirty is noise, and colouring it red on day two is how a
 * product teaches people to ignore its warnings.
 */
function health(completion: number, delta: number, daysRemaining: number): PositionHealth {
  if (completion >= 1) return "closed";
  if (delta >= 0.05) return "ahead";
  if (delta >= -0.05) return "on_pace";
  if (delta < -0.15 && daysRemaining <= 7) return "critical";
  return "behind";
}

/**
 * What the position pays if it closes successfully.
 *
 * The honest version of "expected payout": the pool split evenly among
 * finishers, net of fee. Ascend cannot know how many others will finish, so the
 * only defensible assumption is that everyone who is in, finishes — which
 * produces the LOWEST payout per person. Erring toward the smaller number is
 * the only direction that cannot disappoint somebody who counted on it.
 */
export function expectedReturn(i: PositionInput): number {
  if (i.participants <= 0) return 0;
  const net = i.poolTotal * (1 - i.feeRate);
  return Math.round(net / i.participants);
}

/**
 * A probability, as a percentage a person should read.
 *
 * Clamped to 1–99. A normal approximation over a couple of weeks of somebody's
 * step count genuinely returns 0.997 and 0.001, and rendering those as "100%
 * likely" and "0% likely" asserts a certainty the method does not have. The
 * arithmetic keeps its precision; the sentence does not overclaim.
 */
export function probabilityPct(p: number): number {
  return Math.min(99, Math.max(1, Math.round(p * 100)));
}

/** Total rand at risk across every open position. */
export function totalExposure(positions: Position[]): number {
  return positions.reduce((t, p) => t + p.exposure, 0);
}

/**
 * The portfolio's overall state.
 *
 * Weighted by exposure, not by count: a R2,000 position that is failing matters
 * more than three R100 positions that are fine, and an unweighted average would
 * say the opposite.
 */
export function portfolioHealth(positions: Position[]): {
  exposure: number;
  weightedCompletion: number | null;
  atRisk: number;
  criticalCount: number;
} {
  const exposure = totalExposure(positions);
  const atRisk = positions
    .filter((p) => p.health === "behind" || p.health === "critical")
    .reduce((t, p) => t + p.exposure, 0);

  return {
    exposure,
    weightedCompletion:
      exposure > 0
        ? round3(positions.reduce((t, p) => t + p.completion * p.exposure, 0) / exposure)
        : null,
    atRisk,
    criticalCount: positions.filter((p) => p.health === "critical").length,
  };
}

// ── Strategy comparison ──────────────────────────────────────────────────────

export interface Strategy {
  key: string;
  name: string;
  detail: string;
  /** Output required on each remaining day, in order. */
  schedule: number[];
}

export interface StrategyResult extends Strategy {
  /** 0–1, or null when there is not enough history to say. */
  probability: number | null;
  /** The heaviest single day this strategy asks for. */
  peakDay: number;
  /** Total across the schedule. */
  total: number;
  reachesTarget: boolean;
}

/**
 * STRATEGY COMPARISON.
 *
 * "10,000 daily" versus "12,000 weekdays and 8,000 weekends" — the same total,
 * distributed differently, and the difference matters because people are not
 * uniform across a week.
 *
 * ── HOW THE PROBABILITY IS CALCULATED ────────────────────────────────────────
 * Each strategy is evaluated as its own required total against the person's own
 * mean and variance over the remaining days. A strategy that front-loads is not
 * "safer" by assertion — it is safer because it needs less from the days
 * furthest away, which is where uncertainty compounds.
 *
 * ── WHAT THIS WILL NOT DO ────────────────────────────────────────────────────
 * It will not claim a strategy fits somebody's week better than another. Ascend
 * has no calendar, so it cannot know that Wednesdays are impossible. The
 * weekday/weekend split is offered as an OPTION a person chooses, never as a
 * recommendation derived from data that does not exist.
 */
export function buildStrategies(remainingTarget: number, daysRemaining: number, startDow: number): Strategy[] {
  if (daysRemaining <= 0) return [];

  const flat = remainingTarget / daysRemaining;
  const isWeekend = (offset: number) => {
    const dow = (startDow + offset) % 7;
    return dow === 0 || dow === 6;
  };
  const weekendDays = Array.from({ length: daysRemaining }, (_, d) => isWeekend(d)).filter(Boolean).length;
  const weekdayDays = daysRemaining - weekendDays;

  const strategies: Strategy[] = [
    {
      key: "flat",
      name: "Even",
      detail: "The same output every day. Simplest to hold, and the least forgiving of a bad day.",
      schedule: Array.from({ length: daysRemaining }, () => Math.round(flat)),
    },
    {
      key: "front",
      name: "Front-loaded",
      detail: "Heavier now, lighter later. Buys you slack for the days you cannot predict yet.",
      // Linear taper from 1.35× down to 0.65×, so the total is unchanged.
      schedule: Array.from({ length: daysRemaining }, (_, d) =>
        Math.round(flat * (1.35 - (0.7 * d) / Math.max(1, daysRemaining - 1))),
      ),
    },
  ];

  // Only offer the weekday split when the window actually contains both.
  if (weekendDays > 0 && weekdayDays > 0) {
    // Weekdays carry 1.25× a weekend day, solved so the total still lands.
    const weekendRate = remainingTarget / (weekdayDays * 1.25 + weekendDays);
    strategies.push({
      key: "weekday",
      name: "Weekday-heavy",
      detail: "More on weekdays, less at the weekend. Only worth picking if that is genuinely your week.",
      schedule: Array.from({ length: daysRemaining }, (_, d) =>
        Math.round(isWeekend(d) ? weekendRate : weekendRate * 1.25),
      ),
    });
  }

  return strategies;
}

export function compareStrategies(
  history: number[],
  remainingTarget: number,
  strategies: Strategy[],
): StrategyResult[] {
  return strategies.map((s) => {
    const total = s.schedule.reduce((t, v) => t + v, 0);
    const sim = simulate(history, remainingTarget, s.schedule.length, [total / s.schedule.length]);
    return {
      ...s,
      total,
      peakDay: s.schedule.length ? Math.max(...s.schedule) : 0,
      reachesTarget: total >= remainingTarget,
      probability: sim ? sim[0].probability : null,
    };
  });
}

// ── Statistics ───────────────────────────────────────────────────────────────

function mean(xs: number[]): number {
  return xs.length ? xs.reduce((t, x) => t + x, 0) / xs.length : 0;
}

function stdev(xs: number[]): number {
  if (xs.length < 2) return 0;
  const m = mean(xs);
  return Math.sqrt(xs.reduce((t, x) => t + (x - m) ** 2, 0) / (xs.length - 1));
}

function round2(v: number): number {
  return Math.round(v * 100) / 100;
}

function round3(v: number): number {
  return Math.round(v * 1000) / 1000;
}
