import "server-only";
import type { ServerClient } from "@/lib/supabase/server";
import { loadClimb, type ClimbState } from "@/lib/climb";
import { loadExchange, type ExchangeState } from "@/lib/exchange";
import { loadElevate, type ElevateState } from "@/lib/elevate";
import { assessWindow, type DayLog } from "@/lib/integrity";
import {
  disciplineScore,
  lifePortfolio,
  momentumScore,
  performanceIndex,
  project,
  simulate,
  statusTier,
  type DisciplineScore,
  type EffortDay,
  type Momentum,
  type PerformanceIndex,
  type PortfolioLine,
  type Projection,
  type SimulationRow,
  type Tier,
} from "@/lib/intelligence";
import {
  countQualifyingSeasons,
  prestigeFrom,
  seasonAt,
  seasonResult,
  type Prestige,
  type Season,
  type SeasonResult,
} from "@/lib/season";
import {
  evaluateTrophies,
  recoveryProtocol,
  summariseVault,
  type AwardedTrophy,
  type Recovery,
  type VaultSummary,
} from "@/lib/trophies";
import { volatility } from "@/lib/position";
import { timed, withTiming, type TimingReport } from "@/lib/timing";

// ─────────────────────────────────────────────────────────────────────────────
// THE LIFE OS — Layer 1's data layer.
//
// Turns real rows into the signals `intelligence.ts` scores. The scoring is
// pure and tested; this file's whole job is to be honest about what feeds it.
//
// ── THE SIGNALS, AND WHERE EACH ONE COMES FROM ───────────────────────────────
//   completion         daily logs vs that day's required rate
//   consistency        days logged / days elapsed
//   momentum           the same effort days, through momentumScore()
//   integrity          assessWindow() — the existing anti-cheat confidence
//   challenge_history  settled challenges hit / settled challenges
//   goal_completion    Climb pitches with a ranked position this week
//   financial          stakes whose EFT was confirmed
//   recovery, sleep    NULL. Permanently, until a wearable integration exists.
//
// The last line is the important one. The brief asks the OS to know sleep, HRV,
// resting heart rate, mood, calendar, spending and workload. Ascend has none of
// those. They are reported as MISSING with their weight rather than dropped,
// so the score never looks more informed than it is — and so the UI can show a
// person exactly what connecting a tracker would add.
// ─────────────────────────────────────────────────────────────────────────────

export interface LifeOs {
  discipline: DisciplineScore;
  momentum: Momentum;
  tier: Tier | null;
  index: PerformanceIndex | null;
  /** Null below the minimum cohort — see the migration for why. */
  percentile: number | null;
  portfolio: PortfolioLine[];
  legacy: Legacy;
  /** Per-challenge projection and simulation, only where there is enough history. */
  outlook: ChallengeOutlook[];
  brief: BriefLine[];
  /** The 90-day window, derived from a fixed epoch — never a stored row. */
  season: Season;
  seasonResult: SeasonResult;
  prestige: Prestige;
  trophies: AwardedTrophy[];
  vault: VaultSummary;
  /** Engages at three consecutive missed days, the same point momentum does. */
  recovery: Recovery;
  climb: ClimbState;
  commit: ExchangeState;
  elevate: ElevateState;
  timing: TimingReport;
}

export interface Legacy {
  totalLogged: number;
  daysLogged: number;
  challengesEntered: number;
  challengesWon: number;
  earned: number;
  staked: number;
  weeksRanked: number;
  routes: number;
  firstDay: string | null;
}

export interface ChallengeOutlook {
  cohortId: string;
  name: string;
  stake: number;
  projection: Projection | null;
  simulation: SimulationRow[] | null;
  /** Why there is no projection, when there isn't one. */
  note: string | null;
}

export interface BriefLine {
  label: string;
  value: string;
  /** Set when the line is a call to action rather than a statement. */
  href?: string;
}

/** Signals with no data source yet. Named so the UI can say what is coming. */
export const UNAVAILABLE_NOTE: Record<string, string> = {
  recovery: "Needs a wearable connection",
  sleep: "Needs a wearable connection",
};

export async function loadLifeOs(supabase: ServerClient, userId: string): Promise<LifeOs> {
  const { result, timing } = await withTiming(async () => {
    const [climb, commit, elevate, snapshots, percentile] = await Promise.all([
      loadClimb(supabase, userId),
      loadExchange(supabase, userId),
      loadElevate(supabase, userId),
      timed(
        "discipline_snapshots",
        async () => {
          const { data } = await supabase
            .from("discipline_snapshots")
            .select("taken_on, score, momentum, coverage")
            .order("taken_on", { ascending: true })
            .limit(400);
          return data ?? [];
        },
        (r) => r.length,
      ),
      timed("rpc.discipline_percentile", async () => {
        const { data } = await supabase.rpc("discipline_percentile");
        return (data as number | null) ?? null;
      }),
    ]);
    return { climb, commit, elevate, snapshots, percentile };
  });

  const { climb, commit, elevate, snapshots, percentile } = result;

  const effort = effortDays(commit);
  const momentum = momentumScore(effort);
  const dayLogs = integrityDays(commit);

  const discipline = disciplineScore(deriveSignals(climb, commit, effort, dayLogs, momentum));

  // Today's snapshot, so tomorrow has something to compare against. Upsert on
  // (user_id, taken_on): opening the app twice must not add a second point.
  if (discipline.score !== null) {
    await timed("discipline_snapshots.upsert", async () =>
      supabase.from("discipline_snapshots").upsert(
        {
          user_id: userId,
          taken_on: new Date().toISOString().slice(0, 10),
          score: discipline.score!,
          momentum: momentum.score,
          coverage: Math.round(discipline.coverage * 1000) / 1000,
        },
        { onConflict: "user_id,taken_on" },
      ),
    );
  }

  const history = snapshots.map((s) => ({ date: s.taken_on, score: s.score }));
  const today = new Date().toISOString().slice(0, 10);
  if (discipline.score !== null && !history.some((h) => h.date === today)) {
    history.push({ date: today, score: discipline.score });
  }

  // ── Layer 5: seasons, prestige, the vault ─────────────────────────────────
  const season = seasonAt(today);
  const snapshotPoints = snapshots.map((s) => ({ takenOn: s.taken_on, score: s.score }));
  const qualifying = countQualifyingSeasons(snapshotPoints, today);

  const heldDays = dayLogs.length ? assessWindow(dayLogs).heldDays : 0;
  const bestSteadiness = commit.positions
    .map((p) => p.volatility?.steadiness ?? null)
    .filter((v): v is number => v !== null)
    .reduce<number | null>((a, b) => (a === null || b > a ? b : a), null);

  const trophies = evaluateTrophies({
    rankedWeeks: climb.weeks,
    positionsOpened: commit.dashboard.active.length + commit.dashboard.history.length,
    payoutsLanded: commit.wallet.payouts.filter((p) => p.state === "paid").length,
    verifiedDays: Math.max(0, dayLogs.length - heldDays),
    heldDays,
    bestSteadiness,
    // The peak the index has ever recorded — a tier trophy cannot be un-earned
    // by a bad fortnight afterwards.
    peakDisciplineScore: snapshotPoints.length
      ? Math.max(...snapshotPoints.map((s) => s.score), discipline.score ?? 0)
      : discipline.score,
    qualifyingSeasons: qualifying,
    longestCleanRun: longestCleanRun(effort),
    recoveredPositions: commit.dashboard.history.filter((h) => h.hitTarget === true).length,
  });

  return {
    discipline,
    momentum,
    season,
    seasonResult: seasonResult(snapshotPoints, season),
    prestige: prestigeFrom(qualifying),
    trophies,
    vault: summariseVault(trophies),
    recovery: recoveryProtocol(momentum.missStreak, commit.positions.length > 0),
    tier: statusTier(discipline.score),
    index: performanceIndex(history),
    percentile,
    portfolio: buildPortfolio(snapshots, discipline, momentum, climb, commit, elevate),
    legacy: buildLegacy(climb, commit),
    outlook: buildOutlook(commit),
    brief: buildBrief(discipline, momentum, commit, climb),
    climb,
    commit,
    elevate,
    timing,
  };
}

/**
 * The signal set, derived from three already-loaded mode states.
 *
 * Exported so the briefing can show the same score in its masthead without
 * issuing a single extra query — the scoring is pure, so the only cost is
 * arithmetic. Two code paths computing a score two ways is how a product ends
 * up showing a person two different numbers for the same thing.
 */
export function deriveSignals(
  climb: ClimbState,
  commit: ExchangeState,
  effort: EffortDay[],
  dayLogs: DayLog[],
  momentum: Momentum,
) {
  return {
    completion: completionRate(effort),
    consistency: consistencyRate(commit, climb),
    momentum: effort.length ? momentum.score / 100 : null,
    integrity: dayLogs.length ? assessWindow(dayLogs).integrityScore / 100 : null,
    challenge_history: challengeHistoryRate(commit),
    goal_completion: goalCompletionRate(climb),
    financial: financialRate(commit),
    // No integration exists. Reported as missing rather than assumed.
    recovery: null,
    sleep: null,
  };
}

/**
 * The longest run of consecutive met days.
 *
 * Counted over the days that actually had a requirement — a day with no target
 * is neither met nor missed, and treating it as either would let a gap between
 * challenges either break a run or silently extend it.
 */
export function longestCleanRun(days: EffortDay[]): number {
  const ordered = [...days]
    .filter((d) => d.required > 0)
    .sort((a, b) => a.date.localeCompare(b.date));
  let best = 0;
  let run = 0;
  for (const d of ordered) {
    if (d.value >= d.required) {
      run += 1;
      best = Math.max(best, run);
    } else {
      run = 0;
    }
  }
  return best;
}

/** Effort days, from logs plus the daily target each log was measured against. */
export function effortDays(commit: ExchangeState): EffortDay[] {
  const targetByCohort = new Map(
    commit.dashboard.active.map((a) => [a.cohortId, a.dailyTarget] as const),
  );
  return commit.dashboard.rawLogs.map((l) => ({
    date: l.log_date,
    value: Number(l.verified_value ?? 0),
    // A log from a settled challenge has no live daily target. Treating it as
    // "required 0, did something" credits the day without inventing a target.
    required: targetByCohort.get(l.cohort_id) ?? 0,
  }));
}

/** The integrity engine's view of the same logs. */
export function integrityDays(commit: ExchangeState): DayLog[] {
  return commit.dashboard.rawLogs.map((l) => ({
    date: l.log_date,
    value: Number(l.verified_value ?? 0),
    source: l.source,
    recordedAt: l.recorded_at ?? `${l.log_date}T23:00:00Z`,
    deviceId: l.device_id,
  }));
}

// ── Signal derivation ────────────────────────────────────────────────────────

function completionRate(effort: EffortDay[]): number | null {
  const scored = effort.filter((d) => d.required > 0);
  if (scored.length === 0) return null;
  return scored.filter((d) => d.value >= d.required).length / scored.length;
}

function consistencyRate(commit: ExchangeState, climb: ClimbState): number | null {
  const elapsed = commit.dashboard.active.reduce((t, a) => t + a.dayNumber, 0);
  const logged = commit.dashboard.rawLogs.length;
  const pitches = climb.routes.flatMap((r) => r.pitches);
  const climbLogged = pitches.filter((p) => p.logged).length;

  if (elapsed === 0 && pitches.length === 0) return null;
  if (elapsed === 0) return climbLogged / pitches.length;
  if (pitches.length === 0) return Math.min(1, logged / elapsed);
  // Both tracks present: the mean of the two rates, so neither one alone can
  // carry a person to a perfect consistency signal.
  return (Math.min(1, logged / elapsed) + climbLogged / pitches.length) / 2;
}

function challengeHistoryRate(commit: ExchangeState): number | null {
  const settled = commit.dashboard.history.filter((h) => h.hitTarget !== null);
  if (settled.length === 0) return null;
  return settled.filter((h) => h.hitTarget).length / settled.length;
}

function goalCompletionRate(climb: ClimbState): number | null {
  const pitches = climb.routes.flatMap((r) => r.pitches);
  if (pitches.length === 0) return null;
  return pitches.filter((p) => p.viewer !== null).length / pitches.length;
}

function financialRate(commit: ExchangeState): number | null {
  const { locked, awaitingEft } = commit.wallet.positions;
  const total = locked + awaitingEft;
  if (total <= 0) return null;
  return locked / total;
}

// ── Composites ───────────────────────────────────────────────────────────────

function buildPortfolio(
  snapshots: { taken_on: string; score: number; momentum: number }[],
  discipline: DisciplineScore,
  momentum: Momentum,
  climb: ClimbState,
  commit: ExchangeState,
  elevate: ElevateState,
): PortfolioLine[] {
  // "Then" is the oldest snapshot inside a 90-day window. With no snapshot
  // older than today, every line correctly reads "no comparison yet" rather
  // than a confident +0%.
  const cutoff = new Date();
  cutoff.setUTCDate(cutoff.getUTCDate() - 90);
  const iso = cutoff.toISOString().slice(0, 10);
  const inWindow = snapshots.filter((s) => s.taken_on >= iso);
  const then = inWindow.length > 1 ? inWindow[0] : null;

  return lifePortfolio([
    { area: "Discipline", now: discipline.score, then: then?.score ?? null },
    { area: "Momentum", now: momentum.score, then: then?.momentum ?? null, unit: "points" as const },
    {
      area: "Climb",
      now: climb.best?.value ?? null,
      // The climber's own earliest ranked value on the same pitch — a real
      // comparison, not a stored aggregate.
      then: climbBaseline(climb),
      // Already a percentage. Reported as a point difference, because a
      // percentage change of a percentage is unreadable — see lifePortfolio().
      unit: "points" as const,
    },
    {
      area: "Earnings",
      now: commit.wallet.positions.lifetimeWon || null,
      then: commit.wallet.positions.lifetimeStaked || null,
    },
    {
      area: "Confidence",
      now: elevate.actions.filter((a) => a.status === "done").length || null,
      then: null,
    },
    // Named explicitly so the absence is visible rather than an omission.
    { area: "Recovery", now: null, then: null },
  ]);
}

function climbBaseline(climb: ClimbState): number | null {
  if (!climb.best) return null;
  const pitch = climb.routes.flatMap((r) => r.pitches).find((p) => p.id === climb.best!.pitchId);
  return pitch && pitch.series.length > 1 ? pitch.series[0] : null;
}

function buildLegacy(climb: ClimbState, commit: ExchangeState): Legacy {
  const logs = commit.dashboard.rawLogs;
  const dates = [...new Set(logs.map((l) => l.log_date))].sort();
  const settled = commit.dashboard.history.filter((h) => h.hitTarget !== null);

  return {
    totalLogged: logs.reduce((t, l) => t + Number(l.verified_value ?? 0), 0),
    daysLogged: dates.length,
    challengesEntered: commit.dashboard.active.length + commit.dashboard.history.length,
    challengesWon: settled.filter((h) => h.hitTarget).length,
    earned: commit.wallet.positions.lifetimeWon,
    staked: commit.wallet.positions.lifetimeStaked,
    weeksRanked: climb.weeks,
    routes: climb.routes.length,
    firstDay: dates[0] ?? null,
  };
}

/** Candidate daily rates for the simulator, spanning the required pace. */
function candidateRates(required: number, current: number): number[] {
  const anchor = Math.max(required, current, 1);
  return [0.6, 0.8, 1, 1.2, 1.5].map((m) => Math.round((anchor * m) / 100) * 100);
}

function buildOutlook(commit: ExchangeState): ChallengeOutlook[] {
  const logsByCohort = new Map<string, number[]>();
  for (const l of commit.dashboard.rawLogs) {
    const arr = logsByCohort.get(l.cohort_id) ?? [];
    arr.push(Number(l.verified_value ?? 0));
    logsByCohort.set(l.cohort_id, arr);
  }

  return commit.dashboard.active.map((a) => {
    const history = logsByCohort.get(a.cohortId) ?? [];
    const remaining = Math.max(0, a.target - a.progress);
    const projection = project(history, remaining, a.daysRemaining, a.dayNumber);
    const required = a.daysRemaining > 0 ? remaining / a.daysRemaining : remaining;

    return {
      cohortId: a.cohortId,
      name: a.name,
      stake: a.stake,
      projection,
      simulation: projection
        ? simulate(history, remaining, a.daysRemaining, candidateRates(required, projection.currentRate))
        : null,
      note: projection
        ? null
        : remaining === 0
          ? "Target already met."
          : `Needs ${8 - history.length} more logged ${8 - history.length === 1 ? "day" : "days"} before a projection means anything.`,
    };
  });
}

/**
 * The morning brief.
 *
 * Every line is a statement about a row that exists. There is no line for sleep
 * or recovery, because there is no sleep or recovery data — and "Your recovery
 * is down 14%" to somebody whose recovery has never been measured is the single
 * most damaging sentence this product could say.
 */
function buildBrief(
  discipline: DisciplineScore,
  momentum: Momentum,
  commit: ExchangeState,
  climb: ClimbState,
): BriefLine[] {
  const lines: BriefLine[] = [];

  if (discipline.score !== null) {
    lines.push({ label: "Discipline", value: `${discipline.score} · ${discipline.band}` });
  }
  if (momentum.score > 0) {
    lines.push({
      label: "Momentum",
      value:
        momentum.delta === null
          ? `${momentum.score}`
          : `${momentum.score} · ${momentum.delta >= 0 ? "+" : "−"}${Math.abs(momentum.delta)} this week`,
    });
  }

  for (const a of commit.dashboard.active) {
    const remaining = Math.max(0, a.target - a.progress);
    if (remaining === 0) continue;
    const perDay = Math.ceil(a.daysRemaining > 0 ? remaining / a.daysRemaining : remaining);
    lines.push({
      label: a.name,
      value: `${perDay.toLocaleString("en")} a day to stay on pace`,
      href: `/commit/${a.cohortId}`,
    });
  }

  const pending = climb.pending[0];
  if (pending) {
    lines.push({
      label: pending.pitchName,
      value: "No number logged this week",
      href: `/groups/${pending.routeId}/categories/${pending.pitchId}/log-entry`,
    });
  }

  return lines;
}
