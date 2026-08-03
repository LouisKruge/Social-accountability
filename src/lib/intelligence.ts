// ─────────────────────────────────────────────────────────────────────────────
// LAYER 1 — INTELLIGENCE
//
// The scoring engines behind the Life OS: Momentum, the Discipline Score, the
// Personal Performance Index, the Goal Simulator, projections and the Life
// Portfolio.
//
// Pure functions, no database, no model. Every one of them is a formula a user
// could reproduce with their own data and a calculator — which is the whole
// reason they are allowed to exist. A score you cannot explain is a score you
// cannot appeal, and this one gates access to challenges.
//
// ── THE COVERAGE RULE ────────────────────────────────────────────────────────
// The brief lists sleep, HRV, resting heart rate, mood, calendar, spending and
// productivity as inputs. Ascend has none of them: there is no wearable
// integration (blocked on provider credentials) and no calendar or banking
// connection.
//
// So every score here reports COVERAGE — which signals contributed, and which
// are absent. A score is computed over the weight that is actually available
// and rescaled, so a user is never punished for an integration the product has
// not shipped. The UI must show the coverage next to the number.
//
// The alternative — treating a missing signal as a zero, or worse, generating a
// plausible one — would produce the single most damaging sentence this product
// could say: "Your recovery is down 14%" to someone whose recovery has never
// been measured. Every figure traces to a row, or it does not appear.
// ─────────────────────────────────────────────────────────────────────────────

/** A day of effort against that day's requirement. */
export interface EffortDay {
  /** YYYY-MM-DD */
  date: string;
  /** What was actually done. */
  value: number;
  /** What the day asked for. A day with no requirement is not a miss. */
  required: number;
}

// ── Momentum ─────────────────────────────────────────────────────────────────

export interface Momentum {
  /** 0–100. */
  score: number;
  /** Consecutive missed days ending at the most recent day. */
  missStreak: number;
  direction: "building" | "holding" | "slipping";
  /** Change against the score seven days earlier, when there is that much history. */
  delta: number | null;
}

const MOMENTUM_HALF_LIFE = 10;

/**
 * MOMENTUM — the replacement for the streak.
 *
 * The brief's requirement, exactly: "You fail one day. Momentum barely drops.
 * You fail seven days. Momentum crashes."
 *
 * A streak cannot do that, because a streak is a boolean with a counter
 * attached: one missed day destroys thirty days of work, which is why streak
 * culture makes people quit after a single bad Tuesday rather than after a bad
 * month. That is a product deciding to punish the exact moment a person most
 * needs to be kept.
 *
 * Two terms:
 *
 *   base     an exponentially-weighted moving average of daily completion with
 *            a ten-day half-life. Forgiving and continuous — one miss after a
 *            good run costs about seven points.
 *
 *   penalty  a multiplier that only engages from the THIRD consecutive miss,
 *            then compounds at 0.85 per further day. This is what makes the
 *            curve non-linear in the way the brief describes: sustained absence
 *            is a different fact about a person than a single bad day, and the
 *            number should say so.
 *
 * Seven consecutive misses off a perfect run lands near 27. One miss lands
 * near 93. Both are asserted in the tests.
 */
export function momentumScore(days: EffortDay[]): Momentum {
  if (days.length === 0) {
    return { score: 0, missStreak: 0, direction: "holding", delta: null };
  }

  const ordered = [...days].sort((a, b) => a.date.localeCompare(b.date));
  const at = (upto: number) => ewma(ordered.slice(0, upto));

  const base = at(ordered.length);
  const missStreak = trailingMisses(ordered);
  const score = Math.round(100 * base * missPenalty(missStreak));

  // The comparison point is the score as it stood seven days of DATA ago, not
  // seven calendar days — otherwise a gap in logging reads as a collapse when
  // it is simply an absence of rows.
  let delta: number | null = null;
  if (ordered.length > 7) {
    const past = ordered.slice(0, ordered.length - 7);
    const then = Math.round(100 * ewma(past) * missPenalty(trailingMisses(past)));
    delta = score - then;
  }

  return {
    score,
    missStreak,
    direction: delta === null ? "holding" : delta > 2 ? "building" : delta < -2 ? "slipping" : "holding",
    delta,
  };
}

function ewma(days: EffortDay[]): number {
  if (days.length === 0) return 0;
  const alpha = 1 - Math.pow(2, -1 / MOMENTUM_HALF_LIFE);
  // Seeded with the first day rather than 0, so a person's first logged day
  // does not read as a 90% failure they then have to climb out of.
  let m = completion(days[0]);
  for (let i = 1; i < days.length; i++) {
    m = alpha * completion(days[i]) + (1 - alpha) * m;
  }
  return m;
}

/** Credit is capped at 1: a 3× day is excellent, but it cannot bank a miss. */
function completion(d: EffortDay): number {
  if (d.required <= 0) return d.value > 0 ? 1 : 0;
  return Math.max(0, Math.min(1, d.value / d.required));
}

function trailingMisses(days: EffortDay[]): number {
  let n = 0;
  for (let i = days.length - 1; i >= 0; i--) {
    if (completion(days[i]) >= 0.5) break;
    n += 1;
  }
  return n;
}

function missPenalty(missStreak: number): number {
  if (missStreak < 3) return 1;
  return Math.pow(0.85, missStreak - 2);
}

// ── Discipline Score ─────────────────────────────────────────────────────────

export type SignalKey =
  | "completion"
  | "consistency"
  | "momentum"
  | "integrity"
  | "challenge_history"
  | "goal_completion"
  | "financial"
  | "recovery"
  | "sleep";

export interface Signal {
  key: SignalKey;
  label: string;
  weight: number;
  /** 0–1, or null when Ascend has no data for it. */
  value: number | null;
}

export interface DisciplineScore {
  /** 300–1000, or null when nothing at all has been measured. */
  score: number | null;
  band: string;
  contributions: { key: SignalKey; label: string; value: number; share: number }[];
  missing: { key: SignalKey; label: string; weight: number }[];
  /** Fraction of total weight that had data behind it. */
  coverage: number;
}

/**
 * The signal set and its weights.
 *
 * `recovery` and `sleep` carry real weight and are permanently null until a
 * wearable integration exists. That is deliberate: showing them as missing,
 * with their weight, is what tells a user what connecting a tracker would buy
 * them. Quietly dropping them from the model would hide a real limitation and
 * make the score look more complete than it is.
 */
export const SIGNALS: { key: SignalKey; label: string; weight: number }[] = [
  { key: "completion", label: "Completion rate", weight: 22 },
  { key: "consistency", label: "Consistency", weight: 18 },
  { key: "momentum", label: "Momentum", weight: 15 },
  { key: "integrity", label: "Verification confidence", weight: 15 },
  { key: "challenge_history", label: "Challenge history", weight: 10 },
  { key: "goal_completion", label: "Goal completion", weight: 8 },
  { key: "financial", label: "Financial accountability", weight: 4 },
  { key: "recovery", label: "Recovery", weight: 5 },
  { key: "sleep", label: "Sleep", weight: 3 },
];

/**
 * DISCIPLINE SCORE — 300 to 1000.
 *
 * Deliberately shaped like a credit score, because the comparison is the point:
 * it is a portable, slow-moving summary of whether you do what you said you
 * would. It gates access to challenges, which is exactly why it may only ever
 * be built from signals a person can see and dispute.
 *
 * ── WHY THE FLOOR IS 300, NOT 0 ──────────────────────────────────────────────
 * Someone who has logged one week is not a 40/1000 person. The floor exists so
 * a new account starts at a number that reads as "beginning" rather than
 * "failing" — the same reason credit scores do it.
 *
 * ── HOW MISSING SIGNALS ARE HANDLED ──────────────────────────────────────────
 * Rescaled over available weight, never zero-filled. Someone with no wearable
 * is not less disciplined; Ascend simply knows less about them, and `coverage`
 * says so out loud.
 */
export function disciplineScore(values: Partial<Record<SignalKey, number | null>>): DisciplineScore {
  return weightedScore(SIGNALS, values, disciplineBand);
}

/**
 * The shared engine behind every score in this product.
 *
 * Extracted rather than copied when the Transformation Score arrived: two
 * scoring implementations drift, and the one that drifts is always the one
 * nobody re-reads. Both scores therefore share the floor, the rescaling, the
 * contribution attribution and the coverage reporting — so a fix to any of
 * those is a fix to both.
 */
export function weightedScore<K extends string>(
  signals: { key: K; label: string; weight: number }[],
  values: Partial<Record<K, number | null>>,
  band: (score: number) => string,
): {
  score: number | null;
  band: string;
  contributions: { key: K; label: string; value: number; share: number }[];
  missing: { key: K; label: string; weight: number }[];
  coverage: number;
} {
  const present = signals
    .map((s) => ({ ...s, value: values[s.key] ?? null }))
    .filter((s): s is typeof s & { value: number } => s.value !== null);
  const missing = signals
    .filter((s) => (values[s.key] ?? null) === null)
    .map((s) => ({ key: s.key, label: s.label, weight: s.weight }));

  const totalWeight = signals.reduce((t, s) => t + s.weight, 0);
  const availableWeight = present.reduce((t, s) => t + s.weight, 0);

  if (availableWeight === 0) {
    return { score: null, band: "Not measured yet", contributions: [], missing, coverage: 0 };
  }

  const weighted = present.reduce((t, s) => t + clamp01(s.value) * s.weight, 0) / availableWeight;
  const score = Math.round(300 + 700 * weighted);

  // Exact contribution of each signal, in points above the 300 floor.
  const exact = present.map((s) => (clamp01(s.value) * s.weight * 700) / availableWeight);

  return {
    score,
    band: band(score),
    contributions: present
      .map((s, i) => ({
        key: s.key,
        label: s.label,
        value: clamp01(s.value),
        share: 0,
        _exact: exact[i],
      }))
      // Largest-remainder apportionment. Rounding each share independently lets
      // the displayed contributions sum to one or two points either side of the
      // score — and the panel's whole promise is that they RECONSTRUCT it. A
      // person checking the arithmetic and finding it off by one has been given
      // a reason to distrust the number.
      .map(distributeShares(score - 300))
      .sort((a, b) => b.share - a.share),
    missing,
    coverage: availableWeight / totalWeight,
  };
}

/**
 * Round a set of exact values to integers that sum to exactly `total`.
 *
 * Floor everything, then hand the remaining points to whichever signals lost
 * the most to flooring.
 */
function distributeShares<T extends { share: number; _exact: number }>(
  total: number,
): (row: T, i: number, all: T[]) => Omit<T, "_exact"> & { share: number } {
  let assigned: number[] | null = null;
  return (row, i, all) => {
    if (assigned === null) {
      const floors = all.map((r) => Math.floor(r._exact));
      let remaining = total - floors.reduce((t, f) => t + f, 0);
      const order = all
        .map((r, idx) => ({ idx, frac: r._exact - Math.floor(r._exact) }))
        .sort((a, b) => b.frac - a.frac);
      for (const { idx } of order) {
        if (remaining <= 0) break;
        floors[idx] += 1;
        remaining -= 1;
      }
      assigned = floors;
    }
    const { _exact, ...rest } = row;
    return { ...rest, share: assigned[i] };
  };
}

export function disciplineBand(score: number): string {
  if (score >= 900) return "Exceptional";
  if (score >= 800) return "Strong";
  if (score >= 700) return "Reliable";
  if (score >= 600) return "Building";
  if (score >= 450) return "Inconsistent";
  return "Just started";
}

// ── Status tiers ─────────────────────────────────────────────────────────────

export const TIERS = [
  { key: "explorer", name: "Explorer", floor: 300 },
  { key: "builder", name: "Builder", floor: 500 },
  { key: "performer", name: "Performer", floor: 650 },
  { key: "elite", name: "Elite", floor: 780 },
  { key: "titan", name: "Titan", floor: 880 },
  { key: "legend", name: "Legend", floor: 950 },
] as const;

export type TierKey = (typeof TIERS)[number]["key"];

export interface Tier {
  key: TierKey;
  name: string;
  floor: number;
  /** The next tier and the points to it, or null at the top. */
  next: { name: string; pointsAway: number } | null;
}

/**
 * Status tier from the discipline score.
 *
 * Tiers are an identity, not a purchase — they cannot be bought with a
 * subscription, only earned by doing what you said you would. That is the only
 * version of a status system that means anything in an accountability product.
 */
export function statusTier(score: number | null): Tier | null {
  if (score === null) return null;
  const idx = Math.max(
    0,
    TIERS.reduce((best, t, i) => (score >= t.floor ? i : best), 0),
  );
  const t = TIERS[idx];
  const nextTier = TIERS[idx + 1];
  return {
    key: t.key,
    name: t.name,
    floor: t.floor,
    next: nextTier ? { name: nextTier.name, pointsAway: nextTier.floor - score } : null,
  };
}

// ── Goal simulator ───────────────────────────────────────────────────────────

export interface SimulationRow {
  /** The daily rate being tested. */
  rate: number;
  /** 0–1. */
  probability: number;
  /** Whether this rate even reaches the target in the days remaining. */
  reachesTarget: boolean;
}

/**
 * GOAL SIMULATOR — "8k/day → 72%, 10k/day → 91%, 12k/day → 98%".
 *
 * ── THE METHOD, STATED SO IT CAN BE ARGUED WITH ──────────────────────────────
 * The user's own daily values are the sample. Their mean and standard deviation
 * describe how they actually behave, and the total over the remaining days is
 * approximated as a normal sum (mean × n, sd × √n). The probability is that the
 * sum clears what is still needed.
 *
 * Two deliberate properties:
 *
 * - It is conditioned on the PERSON, not on a population. Someone who walks
 *   12,000 steps on a good day and 3,000 on a bad one gets a wider distribution
 *   and lower confidence than someone who walks 9,000 every single day, even
 *   though both average the same.
 * - Below eight logged days it returns nothing at all. A standard deviation
 *   over three points is not a description of anybody's behaviour, and a
 *   confident-looking "91%" built on it is worse than no answer, because
 *   someone might stake money on it.
 */
export const MIN_DAYS_TO_SIMULATE = 8;

export function simulate(
  history: number[],
  remainingTarget: number,
  daysRemaining: number,
  rates: number[],
): SimulationRow[] | null {
  if (history.length < MIN_DAYS_TO_SIMULATE || daysRemaining <= 0) return null;

  const sd = stdev(history);

  return rates.map((rate) => {
    const projected = rate * daysRemaining;
    const reachesTarget = projected >= remainingTarget;
    // The rate is the intent; the person's own variance is what happens to it.
    const sigma = Math.max(1e-6, sd * Math.sqrt(daysRemaining));
    return {
      rate,
      probability: round3(normalCdf((projected - remainingTarget) / sigma)),
      reachesTarget,
    };
  });
}

export interface Projection {
  /** 0–1 chance of hitting the target at the current pace. */
  probability: number;
  /** The daily rate still required. */
  requiredRate: number;
  /** The user's own recent daily rate. */
  currentRate: number;
  /** Day number the target is reached at the current rate, or null if never. */
  expectedCompletionDay: number | null;
  risk: "low" | "moderate" | "high";
}

/**
 * Where the current pace lands.
 *
 * Returns a probability only when there is enough history to have one — the
 * same eight-day floor as the simulator, and for the same reason.
 */
export function project(
  history: number[],
  remainingTarget: number,
  daysRemaining: number,
  dayNumber: number,
): Projection | null {
  if (history.length < MIN_DAYS_TO_SIMULATE || daysRemaining <= 0) return null;

  const currentRate = mean(history);
  const requiredRate = remainingTarget / daysRemaining;
  const sim = simulate(history, remainingTarget, daysRemaining, [currentRate]);
  const probability = sim ? sim[0].probability : 0;
  const daysNeeded = currentRate > 0 ? Math.ceil(remainingTarget / currentRate) : null;

  return {
    probability,
    requiredRate: Math.round(requiredRate),
    currentRate: Math.round(currentRate),
    expectedCompletionDay:
      daysNeeded !== null && daysNeeded <= daysRemaining ? dayNumber + daysNeeded : null,
    risk: probability >= 0.8 ? "low" : probability >= 0.5 ? "moderate" : "high",
  };
}

// ── Life portfolio ───────────────────────────────────────────────────────────

export interface PortfolioLine {
  area: string;
  /** The movement over the window, or null when there is no comparison. */
  change: number | null;
  /** How to read `change`: a percentage, or a difference in points. */
  unit: "pct" | "points";
  /** Why there is no number, when there isn't one. */
  note: string | null;
}

/**
 * LIFE PORTFOLIO — each area's movement over the window.
 *
 * ── WHY SOME LINES ARE POINTS AND NOT PERCENTAGES ────────────────────────────
 * An area whose underlying value is ALREADY a percentage cannot honestly report
 * a percentage change. Climb moving from +4% to +23.4% is a 485% change, which
 * is arithmetically true and unreadable — nobody looking at "+485%" learns that
 * their rate of improvement went up by nineteen points. Those areas report the
 * difference in points instead, and say so.
 *
 * Counts, scores and rand keep percentage change, where it means what people
 * expect it to mean.
 *
 * ── ABSENCE IS NOT ZERO ──────────────────────────────────────────────────────
 * A line with no prior period reads "no comparison yet" rather than "+0%". Zero
 * is a measurement; absence is not, and the difference matters most in exactly
 * the first month, when a new user would otherwise see a wall of confident
 * zeroes.
 */
export function lifePortfolio(
  areas: { area: string; now: number | null; then: number | null; unit?: "pct" | "points" }[],
): PortfolioLine[] {
  return areas.map(({ area, now, then, unit = "pct" }) => {
    const base = { area, unit };
    if (now === null) return { ...base, change: null, note: "not measured" };
    if (then === null) return { ...base, change: null, note: "no comparison yet" };

    if (unit === "points") {
      return now === then
        ? { ...base, change: null, note: "no movement" }
        : { ...base, change: round1(now - then), note: null };
    }

    if (then === 0) {
      return now === 0
        ? { ...base, change: null, note: "no movement" }
        : { ...base, change: null, note: "from zero" };
    }
    return { ...base, change: round1(((now - then) / Math.abs(then)) * 100), note: null };
  });
}

// ── Personal Performance Index ───────────────────────────────────────────────

export interface IndexPoint {
  date: string;
  score: number;
}

export interface PerformanceIndex {
  /** Indexed to 1000 at the first recorded point. */
  value: number;
  /** Percentage change over the window, or null with a single point. */
  changePct: number | null;
  /** Standard deviation of daily index moves — how steady the person is. */
  volatility: number | null;
  points: { date: string; value: number }[];
}

/**
 * PERSONAL PERFORMANCE INDEX — the discipline score, rebased to 1000.
 *
 * The brief asked for "an S&P 500 for yourself". An index is a rebasing, not a
 * new measurement: it says nothing the discipline score does not, and it is
 * useful precisely because of that — it makes "up 7.3% this month" expressible
 * without inventing a second underlying quantity.
 *
 * Building it out of anything else would mean a user has two numbers that
 * disagree, and no way to tell which one is lying.
 */
export function performanceIndex(history: IndexPoint[]): PerformanceIndex | null {
  if (history.length === 0) return null;

  const ordered = [...history].sort((a, b) => a.date.localeCompare(b.date));
  const basis = ordered[0].score;
  if (basis <= 0) return null;

  const exact = ordered.map((p) => (p.score / basis) * 1000);
  const points = ordered.map((p, i) => ({ date: p.date, value: Math.round(exact[i]) }));

  const value = points[points.length - 1].value;
  const changePct = points.length > 1 ? round1(((value - 1000) / 1000) * 100) : null;

  let volatility: number | null = null;
  if (points.length > 2) {
    // Computed from the UNROUNDED index, not the displayed integers. Rounding
    // a perfectly linear climb of +14.28 a day to 14, 15, 14 manufactures a
    // spread of 0.6 out of nothing, and volatility reading non-zero for the
    // steadiest possible person is precisely backwards.
    const moves = exact.slice(1).map((v, i) => v - exact[i]);
    volatility = round1(stdev(moves));
  }

  return { value, changePct, volatility, points };
}

// ── Small statistics, kept honest ────────────────────────────────────────────

function mean(xs: number[]): number {
  return xs.length ? xs.reduce((t, x) => t + x, 0) / xs.length : 0;
}

/** Sample standard deviation (n−1). With n < 2 there is no spread to report. */
function stdev(xs: number[]): number {
  if (xs.length < 2) return 0;
  const m = mean(xs);
  return Math.sqrt(xs.reduce((t, x) => t + (x - m) ** 2, 0) / (xs.length - 1));
}

/** Abramowitz & Stegun 7.1.26 — accurate to ~1e-7, which is far past what a displayed percentage needs. */
function normalCdf(z: number): number {
  const sign = z < 0 ? -1 : 1;
  const x = Math.abs(z) / Math.SQRT2;
  const t = 1 / (1 + 0.3275911 * x);
  const y =
    1 -
    ((((1.061405429 * t - 1.453152027) * t + 1.421413741) * t - 0.284496736) * t + 0.254829592) *
      t *
      Math.exp(-x * x);
  return 0.5 * (1 + sign * y);
}

function clamp01(v: number): number {
  return Math.max(0, Math.min(1, v));
}

function round1(v: number): number {
  return Math.round(v * 10) / 10;
}

function round3(v: number): number {
  return Math.round(v * 1000) / 1000;
}
