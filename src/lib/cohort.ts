/**
 * Challenge creation — validation, kept pure and away from the database.
 *
 * Every rule below mirrors a CHECK constraint in
 * supabase/migrations/20260726000000_habit_stakes.sql. The database stays the
 * authority; this exists so a person gets "Stakes run from R50 to R500" instead
 * of a constraint violation, and so the rules can be unit-tested without a
 * Postgres to hand. If the two ever drift, the database wins and the insert
 * fails — which is the right way round.
 *
 * The bounds that are NOT in the schema (name length, a sane step range, how
 * far ahead a challenge may start) are product judgement, and are documented as
 * such rather than smuggled in as if they were constraints.
 */

export interface CohortInput {
  name: string;
  /** Cumulative steps over the whole window. */
  targetValue: number;
  /** Length of the window in days, inclusive of the first day. */
  days: number;
  /** Rand each participant stakes. Schema allows 50–500. */
  stakeAmount: number;
  /** ISO date the challenge opens. */
  startDate: string;
}

export interface CohortDraft {
  name: string;
  target_value: number;
  start_date: string;
  end_date: string;
  stake_amount: number;
  habit_type: "steps";
  status: "open";
}

export type CohortErrors = Partial<Record<keyof CohortInput, string>>;

// Schema-backed limits.
export const STAKE_MIN = 50;
export const STAKE_MAX = 500;

// Product judgement, not schema.
export const NAME_MAX = 60;
export const DAYS_MIN = 3;
export const DAYS_MAX = 90;
export const TARGET_MIN = 10_000;
export const TARGET_MAX = 2_000_000;
/** A challenge that opens more than this far out is almost certainly a typo. */
export const START_MAX_DAYS_AHEAD = 60;

const DAY = 86_400_000;

export function addDays(iso: string, n: number): string {
  return new Date(Date.parse(iso) + n * DAY).toISOString().slice(0, 10);
}

function isIsoDate(v: string): boolean {
  return /^\d{4}-\d{2}-\d{2}$/.test(v) && !Number.isNaN(Date.parse(v));
}

export function validateCohort(input: CohortInput, today: string): CohortErrors {
  const errors: CohortErrors = {};

  const name = input.name.trim();
  if (name.length === 0) errors.name = "Give the challenge a name.";
  else if (name.length > NAME_MAX) errors.name = `Keep the name under ${NAME_MAX} characters.`;

  if (!Number.isFinite(input.targetValue) || input.targetValue <= 0) {
    errors.targetValue = "Set a step target.";
  } else if (input.targetValue < TARGET_MIN) {
    errors.targetValue = `A target under ${TARGET_MIN.toLocaleString("en")} steps isn't much of a challenge.`;
  } else if (input.targetValue > TARGET_MAX) {
    errors.targetValue = "That target isn't realistically walkable. Check the number.";
  }

  if (!Number.isInteger(input.days)) {
    errors.days = "Set how many days it runs.";
  } else if (input.days < DAYS_MIN) {
    errors.days = `Challenges run for at least ${DAYS_MIN} days.`;
  } else if (input.days > DAYS_MAX) {
    errors.days = `Challenges run for at most ${DAYS_MAX} days.`;
  }

  if (!Number.isFinite(input.stakeAmount)) {
    errors.stakeAmount = "Set the stake.";
  } else if (input.stakeAmount < STAKE_MIN || input.stakeAmount > STAKE_MAX) {
    errors.stakeAmount = `Stakes run from R${STAKE_MIN} to R${STAKE_MAX}.`;
  }

  if (!isIsoDate(input.startDate)) {
    errors.startDate = "Pick a start date.";
  } else if (input.startDate < today) {
    errors.startDate = "A challenge can't start in the past.";
  } else if (daysApart(today, input.startDate) > START_MAX_DAYS_AHEAD) {
    errors.startDate = `Start it within the next ${START_MAX_DAYS_AHEAD} days.`;
  }

  // The one cross-field rule worth surfacing: a target nobody could walk is a
  // challenge nobody should be able to stake money on.
  if (!errors.targetValue && !errors.days) {
    const perDay = input.targetValue / input.days;
    if (perDay > 40_000) {
      errors.targetValue = `That works out to ${Math.round(perDay).toLocaleString("en")} steps a day. Lengthen the window or lower the target.`;
    }
  }

  return errors;
}

function daysApart(from: string, to: string): number {
  return Math.round((Date.parse(to) - Date.parse(from)) / DAY);
}

/** Turn validated input into the exact row shape the table expects. */
export function toCohortDraft(input: CohortInput): CohortDraft {
  return {
    name: input.name.trim(),
    target_value: Math.round(input.targetValue),
    start_date: input.startDate,
    // `days` is inclusive of the start day, and the schema requires
    // end_date > start_date, so a 30-day challenge ends on day 30.
    end_date: addDays(input.startDate, input.days - 1),
    stake_amount: input.stakeAmount,
    habit_type: "steps",
    status: "open",
  };
}

/** What the creator is actually asking of people, in plain daily terms. */
export function dailyPace(targetValue: number, days: number): number {
  if (!Number.isFinite(targetValue) || !Number.isFinite(days) || days <= 0) return 0;
  return Math.round(targetValue / days);
}
