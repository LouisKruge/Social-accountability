// ─────────────────────────────────────────────────────────────────────────────
// SEASONS AND PRESTIGE
//
// A 90-day cycle with its own standings, and a prestige level that survives it.
//
// ── WHY THERE IS NO `seasons` TABLE ──────────────────────────────────────────
// A season is a date window, and a date window is arithmetic. Storing one
// creates a row that can disagree with the calendar — a season that "hasn't
// started" because a cron did not run, or two overlapping because someone
// inserted a fix by hand. Derived from a fixed epoch, every client agrees
// forever and there is nothing to keep in sync.
//
// What IS stored is what a season PRODUCED: trophies awarded, prestige earned.
// Those are facts about a person, not facts about the calendar.
//
// ── WHY A SEASON RESET IS NOT A DELETION ─────────────────────────────────────
// Season standings reset. Discipline scores, momentum, wallet history and the
// integrity record do not. A product that wipes somebody's record every quarter
// to manufacture a fresh race has told them their first two years did not
// count — which is the opposite of what a long-term accountability product is
// selling.
// ─────────────────────────────────────────────────────────────────────────────

/** Season 1 opened on this Monday. Every season is 90 days from here. */
export const SEASON_EPOCH = "2026-01-05";
export const SEASON_DAYS = 90;

export interface Season {
  /** 1-based. */
  number: number;
  start: string;
  end: string;
  /** Days from today to the close, or 0 on the final day. */
  daysRemaining: number;
  /** 0–1 through the window. */
  progress: number;
}

export function seasonAt(today: string): Season {
  const elapsed = daysBetween(SEASON_EPOCH, today);
  // Before the epoch there is no season 0; everything clamps to season 1.
  const index = Math.max(0, Math.floor(elapsed / SEASON_DAYS));
  const start = shiftDays(SEASON_EPOCH, index * SEASON_DAYS);
  const end = shiftDays(start, SEASON_DAYS - 1);
  const dayInSeason = Math.max(0, daysBetween(start, today));

  return {
    number: index + 1,
    start,
    end,
    daysRemaining: Math.max(0, daysBetween(today, end)),
    progress: Math.min(1, Math.max(0, dayInSeason / (SEASON_DAYS - 1))),
  };
}

/** Whether an ISO date falls inside a season's window. */
export function inSeason(season: Season, date: string): boolean {
  return date >= season.start && date <= season.end;
}

// ── Prestige ─────────────────────────────────────────────────────────────────

export const PRESTIGE_TITLES = [
  "Explorer",
  "Achiever",
  "Disciplined",
  "Elite",
  "Master",
  "Legend",
  "Icon",
] as const;

export type PrestigeTitle = (typeof PRESTIGE_TITLES)[number];

export interface Prestige {
  level: number;
  title: PrestigeTitle;
  /** Seasons completed with a qualifying result. */
  qualifyingSeasons: number;
  /** What the next level asks for, or null at the top. */
  next: { title: PrestigeTitle; seasonsAway: number } | null;
}

/**
 * Prestige from qualifying seasons.
 *
 * A season qualifies when the person finished it with a discipline score at or
 * above the threshold — not by playing, and not by paying. Prestige is the one
 * thing in this product that cannot be bought, and the only way it stays
 * meaningful is if the requirement is a result.
 *
 * Deliberately slow: seven titles across roughly five years of sustained use.
 * A ladder somebody tops out in a quarter is a progress bar with names on it.
 */
export const PRESTIGE_THRESHOLD = 700;

export function prestigeFrom(qualifyingSeasons: number): Prestige {
  const level = Math.min(PRESTIGE_TITLES.length, Math.max(1, qualifyingSeasons + 1));
  const idx = level - 1;
  const nextIdx = idx + 1;

  return {
    level,
    title: PRESTIGE_TITLES[idx],
    qualifyingSeasons,
    next:
      nextIdx < PRESTIGE_TITLES.length
        ? { title: PRESTIGE_TITLES[nextIdx], seasonsAway: 1 }
        : null,
  };
}

// ── Season standings ─────────────────────────────────────────────────────────

export interface SeasonResult {
  /** Best discipline score reached inside the window, or null if never scored. */
  peakScore: number | null;
  /** Score on the most recent day inside the window. */
  closingScore: number | null;
  /** Days with a snapshot inside the window. */
  daysMeasured: number;
  /** True when the season counts toward prestige. */
  qualified: boolean;
}

export interface Snapshot {
  /** YYYY-MM-DD */
  takenOn: string;
  score: number;
}

/**
 * What a person did in one season.
 *
 * Qualification uses the CLOSING score, not the peak: prestige is for finishing
 * a season disciplined, not for touching a number once in week two and then
 * stopping. The peak is still reported, because it is a real fact and people
 * want to see their best.
 */
export function seasonResult(snapshots: Snapshot[], season: Season): SeasonResult {
  const inside = snapshots
    .filter((s) => inSeason(season, s.takenOn))
    .sort((a, b) => a.takenOn.localeCompare(b.takenOn));

  if (inside.length === 0) {
    return { peakScore: null, closingScore: null, daysMeasured: 0, qualified: false };
  }

  const closing = inside[inside.length - 1].score;

  return {
    peakScore: Math.max(...inside.map((s) => s.score)),
    closingScore: closing,
    daysMeasured: inside.length,
    // A season nobody measured cannot qualify, however good the one day was.
    qualified: closing >= PRESTIGE_THRESHOLD && inside.length >= 30,
  };
}

/** How many past seasons qualified, for the prestige count. */
export function countQualifyingSeasons(snapshots: Snapshot[], today: string): number {
  const current = seasonAt(today);
  let count = 0;
  for (let n = 1; n < current.number; n++) {
    const start = shiftDays(SEASON_EPOCH, (n - 1) * SEASON_DAYS);
    const s: Season = {
      number: n,
      start,
      end: shiftDays(start, SEASON_DAYS - 1),
      daysRemaining: 0,
      progress: 1,
    };
    if (seasonResult(snapshots, s).qualified) count += 1;
  }
  return count;
}

// ── Elite eligibility ────────────────────────────────────────────────────────

export interface EliteGate {
  /** Minimum discipline score the challenge requires. */
  minScore: number;
  /** Minimum verification confidence, 0–100. */
  minIntegrity: number;
}

export interface Eligibility {
  eligible: boolean;
  /** Every requirement, and whether it is met — so a refusal is never opaque. */
  checks: { label: string; required: number; actual: number | null; met: boolean }[];
}

/**
 * Whether somebody can enter an invite-only challenge.
 *
 * Returns every check with its numbers, met or not. A gate that says only "you
 * are not eligible" is a gate people assume is arbitrary — and this one stands
 * between them and a challenge with real money in it, so it has to show its
 * reasoning.
 */
export function checkEligibility(
  gate: EliteGate,
  disciplineScore: number | null,
  integrityScore: number | null,
): Eligibility {
  const checks = [
    {
      label: "Discipline Score",
      required: gate.minScore,
      actual: disciplineScore,
      met: disciplineScore !== null && disciplineScore >= gate.minScore,
    },
    {
      label: "Verification confidence",
      required: gate.minIntegrity,
      actual: integrityScore,
      met: integrityScore !== null && integrityScore >= gate.minIntegrity,
    },
  ];

  return { eligible: checks.every((c) => c.met), checks };
}

// ── Dates ────────────────────────────────────────────────────────────────────

function daysBetween(from: string, to: string): number {
  return Math.round(
    (Date.parse(`${to}T00:00:00Z`) - Date.parse(`${from}T00:00:00Z`)) / 86_400_000,
  );
}

function shiftDays(iso: string, days: number): string {
  const d = new Date(`${iso}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}
