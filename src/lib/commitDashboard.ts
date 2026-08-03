import type { ServerClient } from "@/lib/supabase/server";
import { num } from "@/lib/format";
import { getCohorts, getMarket, getMyBoards, getMyLogs, getMyPayouts, getMyStakes } from "@/lib/queries";
import type { ActiveBetData, ChallengeCardData } from "@/components/commit-cards";

/**
 * COMMIT DASHBOARD — the whole view model, assembled in one place.
 *
 * Two rules run through this file:
 *
 *  1. NOTHING IS INVENTED. Every figure on the dashboard is either read from the
 *     database or derived arithmetically from figures that were. There are no
 *     placeholder balances, no fabricated XP, no "typical" completion rates.
 *     Where a figure genuinely cannot be known yet — the payout on a challenge
 *     that has not started — the loader returns null and the UI says so.
 *
 *  2. NO OTHER USER'S MONEY, EVER. `stakes` and `payouts` are owner-only under
 *     RLS, so every money query here can only return the caller's own rows.
 *     Everything shown about other people comes from cohort_progress() (steps
 *     and rank) or cohort_market() (headcount). Both are structurally incapable
 *     of carrying an amount. That is why the leaderboards in Commit rank effort
 *     and never earnings.
 */

// ── Small date helpers. Everything is date-only; no timezone maths needed. ───

const DAY = 86_400_000;

export function todayIso(now = new Date()): string {
  return now.toISOString().slice(0, 10);
}

export function daysBetween(from: string, to: string): number {
  return Math.round((Date.parse(to) - Date.parse(from)) / DAY);
}

function addDays(iso: string, n: number): string {
  return new Date(Date.parse(iso) + n * DAY).toISOString().slice(0, 10);
}

const WEEKDAY = ["S", "M", "T", "W", "T", "F", "S"];

function weekdayLabel(iso: string): string {
  return WEEKDAY[new Date(`${iso}T00:00:00Z`).getUTCDay()];
}

// ── Pure derivations. Unit-tested in commitDashboard.test.ts. ────────────────

/**
 * Consecutive days, counting back from today, on which the daily target was met.
 *
 * Today is a grace day: a day that has not finished yet cannot break a streak,
 * so an unlogged or short today is skipped rather than counted as a miss. Any
 * earlier day must be present and at or above target.
 */
export function currentStreak(
  logs: { date: string; value: number }[],
  dailyTarget: number,
  today: string,
): number {
  const byDate = new Map(logs.map((l) => [l.date, l.value]));
  let streak = 0;
  let cursor = today;

  const todayValue = byDate.get(today) ?? 0;
  if (todayValue >= dailyTarget && dailyTarget > 0) streak = 1;
  cursor = addDays(today, -1);

  while (dailyTarget > 0) {
    const v = byDate.get(cursor);
    if (v === undefined || v < dailyTarget) break;
    streak += 1;
    cursor = addDays(cursor, -1);
  }
  return streak;
}

/**
 * How many participants are on course to finish, projecting each person's
 * verified progress so far linearly to the end of the window.
 *
 * This is arithmetic on real logged effort, not a prediction model, and it is
 * always labelled as an estimate in the UI. Before the first day has elapsed
 * there is nothing to project from, so it returns null.
 */
export function projectWinners(
  progress: number[],
  target: number,
  dayNumber: number,
  totalDays: number,
): number | null {
  if (dayNumber <= 0 || totalDays <= 0 || target <= 0) return null;
  return progress.filter((p) => (p / dayNumber) * totalDays >= target).length;
}

/** Payout per winner at a given pool, fee and winner count. Mirrors settleCohort. */
export function payoutPerWinner(
  poolTotal: number,
  feeRate: number,
  winners: number,
): number | null {
  if (winners <= 0 || poolTotal <= 0) return null;
  return Math.round(((poolTotal * (1 - feeRate)) / winners) * 100) / 100;
}

/** Cumulative logged effort per day against the straight line needed to finish. */
export function paceSeries(
  logs: { date: string; value: number }[],
  startDate: string,
  totalDays: number,
  target: number,
  today: string,
): { actual: number[]; required: number[] } {
  const elapsed = Math.max(1, Math.min(totalDays, daysBetween(startDate, today) + 1));
  const byDate = new Map(logs.map((l) => [l.date, l.value]));
  const actual: number[] = [];
  const required: number[] = [];
  let running = 0;
  for (let i = 0; i < elapsed; i += 1) {
    running += byDate.get(addDays(startDate, i)) ?? 0;
    actual.push(running);
    required.push((target / totalDays) * (i + 1));
  }
  return { actual, required };
}

export interface Achievement {
  key: string;
  label: string;
  detail: string;
  unlocked: boolean;
  /** 0–1 toward unlocking. 1 when unlocked. */
  progress: number;
}

/** Badges, every one of them computed from something the user actually did. */
export function buildAchievements(input: {
  stakeCount: number;
  confirmedStakes: number;
  bestStreak: number;
  targetsHit: number;
  totalLogged: number;
  paidPayouts: number;
  cohortsCompleted: number;
}): Achievement[] {
  const at = (have: number, need: number) => Math.max(0, Math.min(1, have / need));
  return [
    {
      key: "first-stake",
      label: "Skin in the game",
      detail: "Stake on your first challenge",
      unlocked: input.stakeCount >= 1,
      progress: at(input.stakeCount, 1),
    },
    {
      key: "paid-up",
      label: "Paid up",
      detail: "Get a stake confirmed",
      unlocked: input.confirmedStakes >= 1,
      progress: at(input.confirmedStakes, 1),
    },
    {
      key: "week-one",
      label: "Seven straight",
      detail: "Hit your daily target 7 days running",
      unlocked: input.bestStreak >= 7,
      progress: at(input.bestStreak, 7),
    },
    {
      key: "target-hit",
      label: "Called it",
      detail: "Reach a challenge target",
      unlocked: input.targetsHit >= 1,
      progress: at(input.targetsHit, 1),
    },
    {
      key: "six-figures",
      label: "100k club",
      detail: "Log 100 000 verified steps",
      unlocked: input.totalLogged >= 100_000,
      progress: at(input.totalLogged, 100_000),
    },
    {
      key: "banked",
      label: "Banked",
      detail: "Receive your first payout",
      unlocked: input.paidPayouts >= 1,
      progress: at(input.paidPayouts, 1),
    },
    {
      key: "thirty",
      label: "Thirty straight",
      detail: "Hit your daily target 30 days running",
      unlocked: input.bestStreak >= 30,
      progress: at(input.bestStreak, 30),
    },
    {
      key: "regular",
      label: "Regular",
      detail: "See three challenges through to the end",
      unlocked: input.cohortsCompleted >= 3,
      progress: at(input.cohortsCompleted, 3),
    },
  ];
}

/** "2h ago" / "3d ago" / "12 Aug" — never a fabricated timestamp. */
export function relativeTime(iso: string, now = Date.now()): string {
  const diff = now - Date.parse(iso);
  if (Number.isNaN(diff)) return "";
  if (diff < 0) return "soon";
  const mins = Math.floor(diff / 60_000);
  if (mins < 1) return "now";
  if (mins < 60) return `${mins}m`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h`;
  const days = Math.floor(hrs / 24);
  if (days < 7) return `${days}d`;
  return new Date(iso).toLocaleDateString("en-ZA", { day: "numeric", month: "short" });
}

// ── The assembled view model ─────────────────────────────────────────────────

export interface HeroStats {
  atStake: number;
  awaitingEft: number;
  lifetimeWon: number;
  net: number;
  activeCount: number;
  targetsHit: number;
  cohortsCompleted: number;
  winRate: number | null;
  streak: number;
  totalLogged: number;
}

export interface BoardRow {
  userId: string;
  name: string;
  progress: number;
  target: number;
  pct: number;
  hitTarget: boolean;
  rank: number;
  isMe: boolean;
}

export interface ActivityItem {
  id: string;
  text: string;
  when: string;
  kind: "progress" | "join" | "pool";
  at: string;
}

export interface Analytics {
  cohortName: string;
  actual: number[];
  required: number[];
  target: number;
  consistency: number | null;
  loggedDays: number;
  elapsedDays: number;
  bestDay: number;
  avgDay: number;
  projectedTotal: number | null;
}

export interface HistoryItem {
  id: string;
  name: string;
  endDate: string;
  hitTarget: boolean | null;
  progress: number;
  target: number;
  /** The caller's own payout only. Owner-only under RLS. */
  payout: number | null;
  payoutStatus: "pending" | "paid" | "failed" | null;
  payoutKind: "winnings" | "refund" | null;
}

export interface CommitDashboard {
  hero: HeroStats;
  active: ActiveBetData[];
  open: ChallengeCardData[];
  activity: ActivityItem[];
  standings: { cohortName: string; rows: BoardRow[] } | null;
  climbers: BoardRow[];
  analytics: Analytics | null;
  achievements: Achievement[];
  history: HistoryItem[];
  feeRate: number;
  /** Raw logs with provenance, so the integrity pass needs no second query. */
  rawLogs: {
    log_date: string;
    verified_value: number | null;
    source: "manual" | "google_fit" | "apple_health" | "fitbit";
    recorded_at: string;
    device_id: string | null;
  }[];
  /** How many cohorts the caller has been in. Below two, the cross-cohort
   *  board is just the cohort board again, so the page hides it. */
  cohortsJoined: number;
}

export async function loadCommitDashboard(
  supabase: ServerClient,
  userId: string,
  now = new Date(),
): Promise<CommitDashboard> {
  const today = todayIso(now);

  // All five reads go out at once and are deduped across the other loaders on
  // this request (see src/lib/queries.ts) — previously these fired again inside
  // loadWallet and loadExchange on the very same page.
  const [myStakes, allCohorts, myPayouts, market, logRows, boardsRaw] = await Promise.all([
    getMyStakes(supabase, userId),
    getCohorts(supabase),
    getMyPayouts(supabase, userId),
    getMarket(supabase),
    getMyLogs(supabase, userId),
    getMyBoards(supabase, userId),
  ]);

  const headcount = new Map<string, number>();
  for (const m of market ?? []) headcount.set(m.cohort_id, Number(m.participant_count));

  const stakeByCohort = new Map(myStakes.map((s) => [s.cohort_id, s]));
  const logsByStake = new Map<string, { date: string; value: number; at: string }[]>();
  for (const l of logRows ?? []) {
    const list = logsByStake.get(l.stake_id) ?? [];
    list.push({
      date: l.log_date,
      value: Number(l.verified_value ?? 0),
      at: l.created_at,
    });
    logsByStake.set(l.stake_id, list);
  }

  // Boards for the cohorts I'm actually in. Progress and rank only.
  const boards = new Map<string, BoardRow[]>();
  for (const [cohortId, rows] of Array.from(boardsRaw.entries())) {
    boards.set(
      cohortId,
      rows.map((r) => {
        const target = Number(r.target_value);
        const progress = Number(r.current_progress);
        return {
          userId: r.user_id,
          name: r.display_name,
          progress,
          target,
          pct: target > 0 ? progress / target : 0,
          hitTarget: r.hit_target,
          rank: Number(r.rank),
          isMe: r.user_id === userId,
        };
      }),
    );
  }

  // ── Per-cohort shaping ────────────────────────────────────────────────────
  const active: ActiveBetData[] = [];
  const open: ChallengeCardData[] = [];
  const history: HistoryItem[] = [];
  const activity: ActivityItem[] = [];
  let totalLogged = 0;
  let bestStreak = 0;
  let bestDay = 0;
  let analytics: Analytics | null = null;
  let standings: { cohortName: string; rows: BoardRow[] } | null = null;

  for (const c of allCohorts) {
    const stake = stakeByCohort.get(c.id);
    const target = Number(c.target_value);
    const stakeAmount = Number(c.stake_amount);
    const feeRate = Number(c.fee_rate);
    const totalDays = Math.max(1, daysBetween(c.start_date, c.end_date) + 1);
    const dayNumber = Math.max(0, Math.min(totalDays, daysBetween(c.start_date, today) + 1));
    const daysRemaining = Math.max(0, daysBetween(today, c.end_date));
    const dailyTarget = target / totalDays;
    const participants = headcount.get(c.id) ?? boards.get(c.id)?.length ?? 0;
    const poolTotal = participants * stakeAmount;
    const board = boards.get(c.id) ?? [];
    const me = board.find((r) => r.isMe);

    // The public start of a challenge is a real, dated event anyone can see.
    if (Date.parse(c.start_date) <= now.getTime() && c.status !== "open") {
      activity.push({
        id: `start-${c.id}`,
        text: `${c.name} got under way`,
        when: relativeTime(`${c.start_date}T06:00:00Z`, now.getTime()),
        kind: "join",
        at: `${c.start_date}T06:00:00Z`,
      });
    }

    if (!stake) {
      if (c.status === "open") {
        open.push({
          id: c.id,
          name: c.name,
          difficulty: difficultyFor(target, totalDays),
          targetLabel: `${num(target)} steps · ${totalDays}d`,
          stakeAmount,
          participants,
          poolTotal,
          daysRemaining: Math.max(0, daysBetween(today, c.start_date)),
          // Not a member, so there is no verified progress to project from.
          completionRate: null,
          projectedReturn: null,
          joined: false,
        });
      }
      continue;
    }

    const logs = logsByStake.get(stake.id) ?? [];
    const progress = me?.progress ?? logs.reduce((t, l) => t + l.value, 0);
    totalLogged += logs.reduce((t, l) => t + l.value, 0);
    bestDay = Math.max(bestDay, ...logs.map((l) => l.value), 0);
    const streak = currentStreak(logs, dailyTarget, today);
    bestStreak = Math.max(bestStreak, streak);

    for (const l of logs.slice(-4)) {
      activity.push({
        id: `log-${stake.id}-${l.date}`,
        text: `You logged ${num(l.value)} steps`,
        when: relativeTime(l.at, now.getTime()),
        kind: "progress",
        at: l.at,
      });
    }
    activity.push({
      id: `stake-${stake.id}`,
      text: `You staked into ${c.name}`,
      when: relativeTime(stake.created_at, now.getTime()),
      kind: "join",
      at: stake.created_at,
    });

    if (c.status === "completed" || daysRemaining === 0) {
      const p = myPayouts.find((x) => x.cohort_id === c.id);
      history.push({
        id: c.id,
        name: c.name,
        endDate: c.end_date,
        hitTarget: me ? me.hitTarget : progress >= target,
        progress,
        target,
        payout: p ? Number(p.amount) : null,
        payoutStatus: (p?.status as HistoryItem["payoutStatus"]) ?? null,
        payoutKind: (p?.kind as HistoryItem["payoutKind"]) ?? null,
      });
      continue;
    }

    const projected = projectWinners(
      board.map((r) => r.progress),
      target,
      dayNumber,
      totalDays,
    );

    active.push({
      cohortId: c.id,
      name: c.name,
      stake: Number(stake.amount),
      progress,
      target,
      dayNumber,
      totalDays,
      daysRemaining,
      rank: me?.rank ?? board.length + 1,
      cohortSize: Math.max(participants, board.length),
      streak,
      projectedPayout: projected ? payoutPerWinner(poolTotal, feeRate, projected) : null,
      poolTotal,
      participants,
      recentDays: lastSevenDays(logs, today),
      dailyTarget: Math.round(dailyTarget),
    });

    // The richest active cohort drives the analytics panel and the standings.
    if (!analytics || dayNumber > 0) {
      const series = paceSeries(logs, c.start_date, totalDays, target, today);
      const loggedDays = logs.filter((l) => l.value >= dailyTarget).length;
      const elapsedDays = Math.max(1, dayNumber);
      analytics = {
        cohortName: c.name,
        actual: series.actual,
        required: series.required,
        target,
        consistency: elapsedDays > 0 ? loggedDays / elapsedDays : null,
        loggedDays,
        elapsedDays,
        bestDay: Math.max(...logs.map((l) => l.value), 0),
        avgDay: logs.length ? progress / elapsedDays : 0,
        projectedTotal: dayNumber > 0 ? (progress / dayNumber) * totalDays : null,
      };
      if (board.length) standings = { cohortName: c.name, rows: board };
    }
  }

  for (const p of myPayouts) {
    const at = p.paid_at ?? p.created_at;
    activity.push({
      id: `payout-${p.id}`,
      text:
        p.status === "paid"
          ? `Payout of R${num(Number(p.amount))} landed`
          : `Payout of R${num(Number(p.amount))} being processed`,
      when: relativeTime(at, now.getTime()),
      kind: p.status === "paid" ? "pool" : "join",
      at,
    });
  }

  activity.sort((a, b) => Date.parse(b.at) - Date.parse(a.at));

  // Everyone I have ever shared a cohort with, ranked by how much of their own
  // target they covered. Effort, never earnings.
  const bestPct = new Map<string, BoardRow>();
  for (const rows of Array.from(boards.values())) {
    for (const r of rows) {
      const prev = bestPct.get(r.userId);
      if (!prev || r.pct > prev.pct) bestPct.set(r.userId, r);
    }
  }
  const climbers = Array.from(bestPct.values())
    .sort((a, b) => b.pct - a.pct)
    .map((r, i) => ({ ...r, rank: i + 1 }));

  const confirmed = myStakes.filter((s) => s.payment_confirmed);
  const activeCohortIds = new Set(active.map((a) => a.cohortId));
  const atStake = confirmed
    .filter((s) => activeCohortIds.has(s.cohort_id))
    .reduce((t, s) => t + Number(s.amount), 0);
  const awaitingEft = myStakes
    .filter((s) => !s.payment_confirmed && activeCohortIds.has(s.cohort_id))
    .reduce((t, s) => t + Number(s.amount), 0);
  const lifetimeWon = myPayouts
    .filter((p) => p.status === "paid" && p.kind === "winnings")
    .reduce((t, p) => t + Number(p.amount), 0);
  const spent = myStakes.reduce((t, s) => t + Number(s.amount), 0);
  const returned = myPayouts
    .filter((p) => p.status === "paid")
    .reduce((t, p) => t + Number(p.amount), 0);
  const targetsHit = history.filter((h) => h.hitTarget).length;

  return {
    hero: {
      atStake,
      awaitingEft,
      lifetimeWon,
      net: returned - spent,
      activeCount: active.length,
      targetsHit,
      cohortsCompleted: history.length,
      winRate: history.length ? targetsHit / history.length : null,
      streak: bestStreak,
      totalLogged,
    },
    active,
    open,
    activity: activity.slice(0, 8),
    standings,
    climbers,
    analytics,
    achievements: buildAchievements({
      stakeCount: myStakes.length,
      confirmedStakes: confirmed.length,
      bestStreak,
      targetsHit,
      totalLogged,
      paidPayouts: myPayouts.filter((p) => p.status === "paid").length,
      cohortsCompleted: history.length,
    }),
    history: history.sort((a, b) => Date.parse(b.endDate) - Date.parse(a.endDate)),
    feeRate: Number(allCohorts[0]?.fee_rate ?? 0.1),
    cohortsJoined: myStakes.length,
    rawLogs: logRows,
  };
}

/** Seven-day window ending today, gaps filled with a real zero. */
export function lastSevenDays(
  logs: { date: string; value: number }[],
  today: string,
): { label: string; value: number }[] {
  const byDate = new Map(logs.map((l) => [l.date, l.value]));
  return Array.from({ length: 7 }, (_, i) => {
    const d = addDays(today, i - 6);
    return { label: weekdayLabel(d), value: byDate.get(d) ?? 0 };
  });
}

/** A challenge's demand on you, stated from its own terms rather than a guess. */
export function difficultyFor(
  target: number,
  totalDays: number,
): ChallengeCardData["difficulty"] {
  const perDay = target / Math.max(1, totalDays);
  if (perDay < 6_000) return "Starter";
  if (perDay < 9_000) return "Steady";
  if (perDay < 13_000) return "Serious";
  return "Elite";
}
