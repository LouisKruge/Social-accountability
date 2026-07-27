import { CommitDashboardView } from "@/components/commit-dashboard";
import {
  buildAchievements,
  lastSevenDays,
  paceSeries,
  payoutPerWinner,
  projectWinners,
  type CommitDashboard,
} from "@/lib/commitDashboard";

/**
 * The Commit dashboard with a populated account, so the dense state can be
 * reviewed and screenshotted before any real cohort exists.
 *
 * This renders the SAME component the live page renders — the harness supplies
 * the view model, nothing more. Every derived figure below (pace, projected
 * payout, streak, standings) is produced by the same functions the loader uses,
 * so a number that looks wrong here is wrong in production too.
 */

const START = "2026-07-05";
const TODAY = "2026-07-26";
const TOTAL_DAYS = 30;
const TARGET = 300_000;
const STAKE = 150;
const FEE = 0.1;
const PARTICIPANTS = 14;
const POOL = PARTICIPANTS * STAKE;

// 22 days of real-looking logs: a strong start, one skipped Sunday, a recovery.
const DAILY = [
  11_200, 12_400, 9_800, 13_100, 10_400, 8_200, 14_600, 12_900, 11_050, 10_800, 3_400, 12_100,
  13_800, 11_600, 12_250, 9_950, 14_100, 12_700, 11_900, 13_400, 12_050, 7_400,
];

const LOGS = DAILY.map((value, i) => ({
  date: new Date(Date.parse(START) + i * 86_400_000).toISOString().slice(0, 10),
  value,
}));

const PROGRESS = DAILY.reduce((t, v) => t + v, 0);
const DAY_NUMBER = DAILY.length;
const DAYS_REMAINING = TOTAL_DAYS - DAY_NUMBER;

// The rest of the cohort, as the safe derived board would return them.
const BOARD_RAW: [string, number][] = [
  ["Thandiwe", 268_400],
  ["Ayanda", PROGRESS],
  ["Sipho", 231_900],
  ["Nomvula", 204_500],
  ["Kabelo", 188_300],
  ["Lerato", 141_700],
  ["Johan", 96_200],
];

const ROWS = BOARD_RAW.map(([name, progress]) => ({ name, progress }))
  .sort((a, b) => b.progress - a.progress)
  .map((r, i) => ({
    userId: r.name,
    name: r.name,
    progress: r.progress,
    target: TARGET,
    pct: r.progress / TARGET,
    hitTarget: r.progress >= TARGET,
    rank: i + 1,
    isMe: r.name === "Ayanda",
  }));

const WINNERS = projectWinners(
  ROWS.map((r) => r.progress),
  TARGET,
  DAY_NUMBER,
  TOTAL_DAYS,
);

const SERIES = paceSeries(LOGS, START, TOTAL_DAYS, TARGET, TODAY);
const DAILY_TARGET = TARGET / TOTAL_DAYS;
const AT_TARGET = LOGS.filter((l) => l.value >= DAILY_TARGET).length;

export const COMMIT_PREVIEW_DATA: CommitDashboard = {
  hero: {
    atStake: STAKE,
    awaitingEft: 0,
    lifetimeWon: 405,
    net: 405 - 300,
    activeCount: 1,
    targetsHit: 1,
    cohortsCompleted: 2,
    winRate: 0.5,
    streak: 8,
    totalLogged: PROGRESS + 214_000,
  },
  active: [
    {
      cohortId: "preview",
      name: "30-day steps · July",
      stake: STAKE,
      progress: PROGRESS,
      target: TARGET,
      dayNumber: DAY_NUMBER,
      totalDays: TOTAL_DAYS,
      daysRemaining: DAYS_REMAINING,
      rank: ROWS.find((r) => r.isMe)!.rank,
      cohortSize: PARTICIPANTS,
      streak: 8,
      projectedPayout: WINNERS ? payoutPerWinner(POOL, FEE, WINNERS) : null,
      poolTotal: POOL,
      participants: PARTICIPANTS,
      recentDays: lastSevenDays(LOGS, TODAY),
      dailyTarget: Math.round(DAILY_TARGET),
    },
  ],
  open: [
    {
      id: "open-1",
      name: "August 10k a day",
      icon: "steps",
      difficulty: "Serious",
      targetLabel: "310,000 steps · 31d",
      stakeAmount: 200,
      participants: 9,
      poolTotal: 1_800,
      daysRemaining: 6,
      completionRate: null,
      projectedReturn: null,
      joined: false,
      trend: "most-joined",
    },
    {
      id: "open-2",
      name: "Weekend hills",
      icon: "run",
      difficulty: "Elite",
      targetLabel: "180,000 steps · 12d",
      stakeAmount: 500,
      participants: 4,
      poolTotal: 2_000,
      daysRemaining: 2,
      completionRate: null,
      projectedReturn: null,
      joined: false,
      trend: "highest-paying",
    },
    {
      id: "open-3",
      name: "Easy does it",
      icon: "target",
      difficulty: "Starter",
      targetLabel: "120,000 steps · 30d",
      stakeAmount: 50,
      participants: 21,
      poolTotal: 1_050,
      daysRemaining: 9,
      completionRate: null,
      projectedReturn: null,
      joined: false,
    },
  ],
  activity: [
    { id: "a1", text: "You logged 7,400 steps", when: "3h", kind: "progress", at: TODAY },
    { id: "a2", text: "You logged 12,050 steps", when: "1d", kind: "progress", at: TODAY },
    { id: "a3", text: "Payout of R405 landed", when: "5d", kind: "pool", at: TODAY },
    { id: "a4", text: "30-day steps · July got under way", when: "21d", kind: "join", at: START },
    { id: "a5", text: "You staked into 30-day steps · July", when: "22d", kind: "join", at: START },
  ],
  standings: { cohortName: "30-day steps · July", rows: ROWS },
  // Best run each person has had across every challenge shared with the viewer —
  // so these are different numbers from the current cohort's standings.
  climbers: [
    ["Sipho", 262_000, 250_000],
    ["Ayanda", 271_400, 250_000],
    ["Thandiwe", 268_400, 300_000],
    ["Nomvula", 204_500, 300_000],
    ["Kabelo", 231_000, 350_000],
  ]
    .map(([name, progress, target]) => ({
      userId: String(name),
      name: String(name),
      progress: Number(progress),
      target: Number(target),
      pct: Number(progress) / Number(target),
      hitTarget: Number(progress) >= Number(target),
      rank: 0,
      isMe: name === "Ayanda",
    }))
    .sort((a, b) => b.pct - a.pct)
    .map((r, i) => ({ ...r, rank: i + 1 })),
  analytics: {
    cohortName: "30-day steps · July",
    actual: SERIES.actual,
    required: SERIES.required,
    target: TARGET,
    consistency: AT_TARGET / DAY_NUMBER,
    loggedDays: AT_TARGET,
    elapsedDays: DAY_NUMBER,
    bestDay: Math.max(...DAILY),
    avgDay: PROGRESS / DAY_NUMBER,
    projectedTotal: (PROGRESS / DAY_NUMBER) * TOTAL_DAYS,
  },
  achievements: buildAchievements({
    stakeCount: 3,
    confirmedStakes: 3,
    bestStreak: 8,
    targetsHit: 1,
    totalLogged: PROGRESS + 214_000,
    paidPayouts: 1,
    cohortsCompleted: 2,
  }),
  history: [
    {
      id: "h1",
      name: "June steps sprint",
      endDate: "2026-06-30",
      hitTarget: true,
      progress: 271_400,
      target: 250_000,
      payout: 405,
      payoutStatus: "paid",
      payoutKind: "winnings",
    },
    {
      id: "h2",
      name: "May 8k daily",
      endDate: "2026-05-31",
      hitTarget: false,
      progress: 189_600,
      target: 240_000,
      payout: null,
      payoutStatus: null,
      payoutKind: null,
    },
  ],
  feeRate: FEE,
  cohortsJoined: 3,
};

export function CommitDashPreview() {
  return <CommitDashboardView data={COMMIT_PREVIEW_DATA} />;
}
