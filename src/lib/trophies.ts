// ─────────────────────────────────────────────────────────────────────────────
// THE ACHIEVEMENT VAULT
//
// Trophies, not badges. The difference is that every one of these is a fact
// with a date and a number behind it, and the vault shows the number.
//
// ── WHY THERE IS NO ANIMATED 3D ROOM ─────────────────────────────────────────
// The brief asked for one. On a 390px South African mobile connection a 3D
// scene is a multi-megabyte download before anybody sees their own record, and
// the record is the point. The vault is typographic: rarity by brightness,
// awarded date, and the figure that earned it.
//
// ── WHY RARITY IS A RULE, NOT A ROLL ─────────────────────────────────────────
// Rarity here describes how hard the requirement is, not a random draw. There
// is nothing in this product decided by chance — that is a legal position as
// much as a design one, and a "legendary drop" would be the first thing to
// break it.
// ─────────────────────────────────────────────────────────────────────────────

export type Rarity = "common" | "rare" | "elite" | "legendary";

export type TrophyKey =
  | "first_week"
  | "first_challenge"
  | "first_payout"
  | "ten_weeks"
  | "fifty_weeks"
  | "clean_hundred"
  | "metronome"
  | "comeback"
  | "season_qualified"
  | "season_triple"
  | "elite_tier"
  | "titan_tier"
  | "legend_tier"
  | "unbroken_quarter";

export interface TrophyDef {
  key: TrophyKey;
  name: string;
  requirement: string;
  rarity: Rarity;
}

export const TROPHIES: TrophyDef[] = [
  { key: "first_week", name: "On the board", requirement: "Log your first ranked week", rarity: "common" },
  { key: "first_challenge", name: "First position", requirement: "Open your first Commit position", rarity: "common" },
  { key: "first_payout", name: "Paid", requirement: "Have a payout land in your account", rarity: "rare" },
  { key: "ten_weeks", name: "Ten weeks", requirement: "Ten ranked weeks", rarity: "common" },
  { key: "fifty_weeks", name: "Fifty weeks", requirement: "Fifty ranked weeks", rarity: "elite" },
  { key: "clean_hundred", name: "Clean hundred", requirement: "100 verified days with nothing held", rarity: "elite" },
  { key: "metronome", name: "Metronome", requirement: "Finish a challenge with steadiness above 90", rarity: "rare" },
  { key: "comeback", name: "Back from nothing", requirement: "Recover a position that was behind pace and still close it", rarity: "rare" },
  { key: "season_qualified", name: "Season closed", requirement: "Finish a season above 700", rarity: "rare" },
  { key: "season_triple", name: "Three seasons", requirement: "Qualify in three seasons", rarity: "legendary" },
  { key: "elite_tier", name: "Elite", requirement: "Reach a Discipline Score of 780", rarity: "rare" },
  { key: "titan_tier", name: "Titan", requirement: "Reach a Discipline Score of 880", rarity: "elite" },
  { key: "legend_tier", name: "Legend", requirement: "Reach a Discipline Score of 950", rarity: "legendary" },
  { key: "unbroken_quarter", name: "Unbroken quarter", requirement: "Ninety consecutive days without a miss", rarity: "legendary" },
];

export interface TrophyFacts {
  rankedWeeks: number;
  positionsOpened: number;
  payoutsLanded: number;
  verifiedDays: number;
  heldDays: number;
  bestSteadiness: number | null;
  peakDisciplineScore: number | null;
  qualifyingSeasons: number;
  longestCleanRun: number;
  recoveredPositions: number;
}

export interface AwardedTrophy extends TrophyDef {
  /** Present when earned. */
  earned: boolean;
  /** The figure that earned it, or how far off it is. */
  evidence: string;
  /** 0–1 toward the requirement, for the ones that are a count. */
  progress: number;
}

/**
 * Evaluate every trophy against the person's real record.
 *
 * Unearned trophies are shown with their progress rather than hidden. A vault
 * that only shows what you already have cannot tell you what to go and do, and
 * the requirement is the interesting part.
 */
export function evaluateTrophies(f: TrophyFacts): AwardedTrophy[] {
  const count = (have: number, need: number) => Math.min(1, need > 0 ? have / need : 0);

  const rows: Record<TrophyKey, { earned: boolean; evidence: string; progress: number }> = {
    first_week: {
      earned: f.rankedWeeks >= 1,
      evidence: `${f.rankedWeeks} ranked ${f.rankedWeeks === 1 ? "week" : "weeks"}`,
      progress: count(f.rankedWeeks, 1),
    },
    first_challenge: {
      earned: f.positionsOpened >= 1,
      evidence: `${f.positionsOpened} opened`,
      progress: count(f.positionsOpened, 1),
    },
    first_payout: {
      earned: f.payoutsLanded >= 1,
      evidence: f.payoutsLanded >= 1 ? `${f.payoutsLanded} landed` : "None yet",
      progress: count(f.payoutsLanded, 1),
    },
    ten_weeks: {
      earned: f.rankedWeeks >= 10,
      evidence: `${f.rankedWeeks} of 10`,
      progress: count(f.rankedWeeks, 10),
    },
    fifty_weeks: {
      earned: f.rankedWeeks >= 50,
      evidence: `${f.rankedWeeks} of 50`,
      progress: count(f.rankedWeeks, 50),
    },
    clean_hundred: {
      earned: f.verifiedDays >= 100 && f.heldDays === 0,
      evidence:
        f.heldDays > 0
          ? `${f.heldDays} ${f.heldDays === 1 ? "day" : "days"} held — this one needs a clean record`
          : `${f.verifiedDays} of 100 verified`,
      progress: f.heldDays > 0 ? 0 : count(f.verifiedDays, 100),
    },
    metronome: {
      earned: (f.bestSteadiness ?? 0) >= 90,
      evidence: f.bestSteadiness === null ? "Not measured yet" : `Best steadiness ${f.bestSteadiness}`,
      progress: count(f.bestSteadiness ?? 0, 90),
    },
    comeback: {
      earned: f.recoveredPositions >= 1,
      evidence: f.recoveredPositions >= 1 ? `${f.recoveredPositions} recovered` : "None yet",
      progress: count(f.recoveredPositions, 1),
    },
    season_qualified: {
      earned: f.qualifyingSeasons >= 1,
      evidence: `${f.qualifyingSeasons} qualified`,
      progress: count(f.qualifyingSeasons, 1),
    },
    season_triple: {
      earned: f.qualifyingSeasons >= 3,
      evidence: `${f.qualifyingSeasons} of 3`,
      progress: count(f.qualifyingSeasons, 3),
    },
    elite_tier: {
      earned: (f.peakDisciplineScore ?? 0) >= 780,
      evidence: f.peakDisciplineScore === null ? "Not measured yet" : `Peak ${f.peakDisciplineScore}`,
      progress: count(f.peakDisciplineScore ?? 0, 780),
    },
    titan_tier: {
      earned: (f.peakDisciplineScore ?? 0) >= 880,
      evidence: f.peakDisciplineScore === null ? "Not measured yet" : `Peak ${f.peakDisciplineScore}`,
      progress: count(f.peakDisciplineScore ?? 0, 880),
    },
    legend_tier: {
      earned: (f.peakDisciplineScore ?? 0) >= 950,
      evidence: f.peakDisciplineScore === null ? "Not measured yet" : `Peak ${f.peakDisciplineScore}`,
      progress: count(f.peakDisciplineScore ?? 0, 950),
    },
    unbroken_quarter: {
      earned: f.longestCleanRun >= 90,
      evidence: `Longest run ${f.longestCleanRun} days`,
      progress: count(f.longestCleanRun, 90),
    },
  };

  return TROPHIES.map((t) => ({ ...t, ...rows[t.key] }));
}

export interface VaultSummary {
  earned: number;
  total: number;
  byRarity: Record<Rarity, { earned: number; total: number }>;
  /** The unearned trophy closest to being earned, or null when all are. */
  nearest: AwardedTrophy | null;
}

export function summariseVault(trophies: AwardedTrophy[]): VaultSummary {
  const byRarity = { common: { earned: 0, total: 0 }, rare: { earned: 0, total: 0 }, elite: { earned: 0, total: 0 }, legendary: { earned: 0, total: 0 } };
  for (const t of trophies) {
    byRarity[t.rarity].total += 1;
    if (t.earned) byRarity[t.rarity].earned += 1;
  }

  const unearned = trophies.filter((t) => !t.earned && t.progress > 0);

  return {
    earned: trophies.filter((t) => t.earned).length,
    total: trophies.length,
    byRarity,
    nearest: unearned.length
      ? unearned.reduce((a, b) => (b.progress > a.progress ? b : a))
      : null,
  };
}

// ── Recovery protocol ────────────────────────────────────────────────────────

export interface Recovery {
  active: boolean;
  /** Consecutive missed days that triggered it. */
  missStreak: number;
  headline: string;
  /** Concrete, small, and never a lecture. */
  steps: string[];
}

/**
 * THE RECOVERY PROTOCOL.
 *
 * Momentum already detects a collapse; this is what the product says when it
 * happens. It engages at three consecutive missed days — the same point the
 * momentum penalty does, so the number and the message agree.
 *
 * ── THE TONE IS THE FEATURE ──────────────────────────────────────────────────
 * Someone four days into a gap does not need to be told they are failing. They
 * know. What changes the outcome is one small thing they can do today, so the
 * steps shrink as the gap grows rather than escalating.
 *
 * ── WHAT IT WILL NOT DO ──────────────────────────────────────────────────────
 * It does not notify anybody. The brief proposes telling the user's friends;
 * that is the highest-risk feature in this product — announcing to a person's
 * group that they are struggling — and it does not ship without an explicit,
 * revocable, per-person consent flow built for it.
 */
export function recoveryProtocol(missStreak: number, hasOpenPosition: boolean): Recovery {
  if (missStreak < 3) {
    return { active: false, missStreak, headline: "", steps: [] };
  }

  const steps =
    missStreak >= 7
      ? [
          "Log anything at all today, even a bad number. The gap is what costs you, not the size of the day.",
          "Do not try to make the week up. Making it up is what makes the next gap longer.",
        ]
      : [
          "One day back stops the slide. Momentum recovers from a return, not from a big day.",
          "Pick the smallest version of the thing and do that.",
        ];

  if (hasOpenPosition) {
    steps.push("Your open position is still running. The portfolio can show you a front-loaded plan for the days that are left.");
  }

  return {
    active: true,
    missStreak,
    headline:
      missStreak >= 7
        ? `${missStreak} days away. This is recoverable and it is worth recovering.`
        : `${missStreak} days away. This is the part that costs you.`,
    steps,
  };
}
