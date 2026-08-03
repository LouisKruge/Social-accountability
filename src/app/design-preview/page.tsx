import { notFound } from "next/navigation";
import { ClimbFace } from "@/components/climb-face";
import { ClimbRouteView } from "@/components/climb-route";
import { ClimbPitchView } from "@/components/climb-pitch";
import { BriefingHome } from "@/components/briefing-home";
import { CommitPreview, ElevatePreview } from "./modes-preview";
import type { Briefing } from "@/lib/briefing";
import { LifeOsView } from "@/components/life-os";
import {
  disciplineScore,
  momentumScore,
  performanceIndex,
  project,
  simulate,
  statusTier,
  lifePortfolio,
  type EffortDay,
} from "@/lib/intelligence";
import type { LifeOs } from "@/lib/lifeOs";
import { ElevateCommand } from "@/components/elevate-command";
import { EventPlanView } from "@/components/event-plan";
import { planEvent, readiness, todayIso, shiftDays } from "@/lib/events";
import { transformationScore } from "@/lib/transformation";
import type { ElevateOs, EventWithPlan } from "@/lib/elevateOs";
import { momentum, type ClimbPitch, type ClimbRoute, type ClimbState, type PitchRow } from "@/lib/climb";

/**
 * DESIGN HARNESS — renders the real Climb components with fixed data so the
 * design can be reviewed and screenshotted without a database.
 *
 * It renders the REAL components rather than copies of them. A harness holding
 * a second implementation of the screen drifts within a week and then lies
 * about what the app looks like, which is worse than having no harness.
 *
 * Gated behind ALLOW_DESIGN_PREVIEW=1, which is only ever set locally, so this
 * route does not exist on the deployed site.
 */
export const dynamic = "force-dynamic";

const ME = "me";

const row = (
  displayName: string,
  rank: number,
  pctChange: number,
  series: number[],
  extra: Partial<PitchRow> = {},
): PitchRow => ({
  userId: displayName === "Kabelo" ? ME : displayName.toLowerCase(),
  displayName,
  rank,
  pctChange,
  isAbsolute: false,
  series,
  ...extra,
});

const SAVINGS_ROWS: PitchRow[] = [
  row("Thandiwe", 1, 41.2, [8, 19, 27, 41.2]),
  row("Sipho", 2, 28.6, [12, 15, 22, 28.6], { sharedValue: 12400 }),
  row("Kabelo", 3, 23.4, [4, 9, 8, 15, 23.4]),
  row("Nomvula", 4, 9.8, [3, 6, 7, 9.8]),
  row("Johan", 5, 500, [120, 300, 500], { isAbsolute: true }),
  row("Lerato", 6, -6.3, [5, 2, -1, -6.3]),
];

const SAVINGS: ClimbPitch = {
  id: "p-savings",
  groupId: "g-1",
  routeName: "Payday Warriors",
  name: "Savings",
  metricType: "percentage_change",
  direction: "increase",
  unit: "ZAR",
  rows: SAVINGS_ROWS,
  viewer: SAVINGS_ROWS[2],
  gap: 5.2,
  logged: true,
  series: [4, 9, 8, 15, 23.4],
};

const STEPS_ROWS: PitchRow[] = [
  row("Kabelo", 1, 18, [6, 11, 18]),
  row("Sipho", 2, 12.5, [9, 10, 12.5]),
  row("Thandiwe", 3, 2, [14, 8, 2]),
];

const STEPS: ClimbPitch = {
  id: "p-steps",
  groupId: "g-1",
  routeName: "Payday Warriors",
  name: "Steps",
  metricType: "percentage_change",
  direction: "increase",
  unit: "steps",
  rows: STEPS_ROWS,
  viewer: STEPS_ROWS[0],
  gap: null,
  logged: true,
  series: [6, 11, 18],
};

const HABIT: ClimbPitch = {
  id: "p-habit",
  groupId: "g-2",
  routeName: "6am Club",
  name: "Up before six",
  metricType: "streak",
  direction: "increase",
  unit: "days",
  rows: [],
  viewer: null,
  gap: null,
  logged: false,
  series: [],
};

const ROUTES: ClimbRoute[] = [
  {
    id: "g-1",
    name: "Payday Warriors",
    inviteCode: "a1b2c3d4",
    isOwner: true,
    memberCount: 6,
    members: [
      { userId: "thandiwe", displayName: "Thandiwe", isOwner: false, isViewer: false },
      { userId: ME, displayName: "Kabelo", isOwner: true, isViewer: true },
      { userId: "sipho", displayName: "Sipho", isOwner: false, isViewer: false },
    ],
    pitches: [SAVINGS, STEPS],
    bestRank: 1,
    unlogged: 0,
  },
  {
    id: "g-2",
    name: "6am Club",
    inviteCode: "z9y8x7w6",
    isOwner: false,
    memberCount: 3,
    members: [{ userId: ME, displayName: "Kabelo", isOwner: false, isViewer: true }],
    pitches: [HABIT],
    bestRank: null,
    unlogged: 1,
  },
];

const STATE: ClimbState = {
  period: { start: "2026-07-20", end: "2026-07-26" },
  routes: ROUTES,
  best: {
    pitchId: "p-savings",
    routeId: "g-1",
    routeName: "Payday Warriors",
    pitchName: "Savings",
    metricType: "percentage_change",
    unit: "ZAR",
    value: 23.4,
    isAbsolute: false,
    rank: 3,
    fieldSize: 6,
  },
  momentum: momentum([4, 9, 8, 15, 23.4]),
  weeks: 5,
  pending: [
    { routeId: "g-2", routeName: "6am Club", pitchId: "p-habit", pitchName: "Up before six" },
  ],
};

/**
 * The briefing, with one of each kind of item on it. Typed as the real
 * `Briefing`, so a change to the shape breaks the harness at compile time
 * rather than leaving it silently rendering a stale screen.
 */
const BRIEFING: Briefing = {
  greeting: "Kabelo",
  items: [
    {
      id: "payout-blocked",
      mode: "commit",
      text: "R900 is waiting on your bank details.",
      href: "/commit/wallet/bank",
      priority: 10,
      kind: "blocked",
    },
    {
      id: "at-risk-c1",
      mode: "commit",
      text: "12,500 a day for 20 days to save your R500 in 10k a day.",
      href: "/commit/c1",
      priority: 20,
      kind: "at_risk",
    },
    {
      id: "climb-pending",
      mode: "climb",
      text: "Up before six in 6am Club has no number this week.",
      href: "/groups/g-2/categories/p-habit/log-entry",
      priority: 30,
      kind: "due",
    },
  ],
  modes: [
    { mode: "climb", name: "Climb", href: "/groups", value: "+23.4%", caption: "Savings · 2 routes" },
    { mode: "commit", name: "Commit", href: "/commit", value: "R500", caption: "on the line · 1 open" },
    { mode: "elevate", name: "Elevate", href: "/elevate", value: "2", caption: "reviews · 14 in wardrobe" },
  ],
  discipline: disciplineScore({
    completion: 0.86,
    consistency: 0.74,
    momentum: 0.91,
    integrity: 0.97,
    challenge_history: 0.5,
    goal_completion: 0.67,
    financial: 1,
  }),
  tier: statusTier(
    disciplineScore({
      completion: 0.86,
      consistency: 0.74,
      momentum: 0.91,
      integrity: 0.97,
      challenge_history: 0.5,
      goal_completion: 0.67,
      financial: 1,
    }).score,
  ),
  climb: STATE,
  commit: {} as Briefing["commit"],
  elevate: {} as Briefing["elevate"],
  timing: { totalMs: 0, slowest: null, spanCount: 0, spans: [], byName: [] },
};

/** A person 34 days in: strong but with a recent three-day gap. */
const OS_EFFORT: EffortDay[] = Array.from({ length: 34 }, (_, i) => ({
  date: `2026-06-${String(i + 1).padStart(2, "0")}`,
  value: i >= 31 ? 2_100 : 9_000 + ((i * 977) % 4_000),
  required: 10_000,
}));

const OS_HISTORY = Array.from({ length: 30 }, (_, i) => ({
  date: `2026-06-${String(i + 1).padStart(2, "0")}`,
  score: 690 + Math.round(Math.sin(i / 4) * 18) + i * 3,
}));

const OS_LOGS = OS_EFFORT.map((d) => d.value);

const OS_SIGNALS = {
  completion: 0.71,
  consistency: 0.88,
  momentum: momentumScore(OS_EFFORT).score / 100,
  integrity: 0.96,
  challenge_history: 0.5,
  goal_completion: 0.67,
  financial: 1,
};

const OS_DISCIPLINE = disciplineScore(OS_SIGNALS);

const OS: LifeOs = {
  discipline: OS_DISCIPLINE,
  momentum: momentumScore(OS_EFFORT),
  tier: statusTier(OS_DISCIPLINE.score),
  index: performanceIndex(OS_HISTORY),
  percentile: null,
  portfolio: lifePortfolio([
    { area: "Discipline", now: OS_DISCIPLINE.score, then: 690 },
    { area: "Momentum", now: momentumScore(OS_EFFORT).score, then: 71, unit: "points" as const },
    { area: "Climb", now: 23.4, then: 4, unit: "points" as const },
    { area: "Earnings", now: 1450, then: 1000 },
    { area: "Confidence", now: 3, then: null },
    { area: "Recovery", now: null, then: null },
  ]),
  legacy: {
    totalLogged: 318_400,
    daysLogged: 34,
    challengesEntered: 3,
    challengesWon: 1,
    earned: 1_450,
    staked: 1_000,
    weeksRanked: 5,
    routes: 2,
    firstDay: "2026-06-01",
  },
  outlook: [
    {
      cohortId: "c1",
      name: "10k a day, 30 days",
      stake: 500,
      projection: project(OS_LOGS, 78_000, 9, 21),
      simulation: simulate(OS_LOGS, 78_000, 9, [6_000, 8_000, 10_000, 12_000, 14_000]),
      note: null,
    },
  ],
  brief: [
    { label: "Discipline", value: `${OS_DISCIPLINE.score} · ${OS_DISCIPLINE.band}` },
    { label: "10k a day", value: "8,667 a day to stay on pace", href: "/commit/c1" },
    {
      label: "Up before six",
      value: "No number logged this week",
      href: "/groups/g-2/categories/p-habit/log-entry",
    },
  ],
  climb: STATE,
  commit: {} as LifeOs["commit"],
  elevate: {} as LifeOs["elevate"],
  timing: { totalMs: 0, slowest: null, spanCount: 0, spans: [], byName: [] },
};

// Two events: one with room to prepare, one close enough that windows have shut.
const T = todayIso();
const mkEvent = (
  id: string,
  kind: Parameters<typeof planEvent>[0],
  title: string,
  daysOut: number,
  done: Parameters<typeof planEvent>[3] = [],
): EventWithPlan => {
  const eventDate = shiftDays(T, daysOut);
  const plan = planEvent(kind, eventDate, T, done);
  return { id, kind, title, eventDate, notes: null, plan, readiness: readiness(plan) };
};

const EVENTS: EventWithPlan[] = [
  mkEvent("e1", "interview", "Standard Bank, second round", 12, ["outfit_chosen", "gap_check"]),
  mkEvent("e2", "wedding", "Lerato & Sipho", 4),
  mkEvent("e3", "photoshoot", "Headshots for LinkedIn", 34),
];

const ELEVATE_OS: ElevateOs = {
  state: {
    ageConfirmed: true,
    profile: null,
    wardrobe: [],
    actions: [],
    timeline: [],
    reportCount: 2,
    looksCount: 5,
    studios: {
      style: { key: "style", value: "18", caption: "items catalogued", alert: false },
      look: { key: "look", value: null, caption: "No routine yet", alert: false },
      photo: { key: "photo", value: "3", caption: "shot lists run", alert: false },
      confidence: { key: "confidence", value: "4", caption: "actions open", alert: true },
      timeline: { key: "timeline", value: "9", caption: "entries", alert: false },
    },
    nextStep: null,
    wardrobeStats: { total: 18, neverWornCount: 5, bestValue: { name: "Navy overshirt", cpw: 42 } },
  } as ElevateOs["state"],
  events: EVENTS,
  focus: EVENTS[1],
  transformation: transformationScore({
    wardrobeItems: 18,
    wardrobeWorn: 13,
    looks: 5,
    actionsTotal: 9,
    actionsDone: 5,
    reports: 2,
    timelineEntries: 9,
    recordSpanWeeks: 7,
    eventsPrepared: 1,
    eventsTotal: 2,
  }),
  timing: { totalMs: 0, slowest: null, spanCount: 0, spans: [], byName: [] },
};

export default function DesignPreview({ searchParams }: { searchParams: { view?: string } }) {
  if (process.env.ALLOW_DESIGN_PREVIEW !== "1") notFound();
  if (searchParams.view === "hub") return <BriefingHome briefing={BRIEFING} />;
  if (searchParams.view === "hub-clear")
    return <BriefingHome briefing={{ ...BRIEFING, items: [] }} />;
  if (searchParams.view === "os") return <LifeOsView os={OS} />;
  if (searchParams.view === "os-empty")
    return (
      <LifeOsView
        os={{
          ...OS,
          discipline: disciplineScore({}),
          momentum: momentumScore([]),
          tier: null,
          index: null,
          outlook: [],
          brief: [],
          legacy: { ...OS.legacy, firstDay: null },
          portfolio: lifePortfolio([
            { area: "Discipline", now: null, then: null },
            { area: "Momentum", now: null, then: null },
            { area: "Climb", now: null, then: null },
            { area: "Earnings", now: null, then: null },
            { area: "Confidence", now: null, then: null },
            { area: "Recovery", now: null, then: null },
          ]),
        }}
      />
    );
  if (searchParams.view === "elevate-os") return <ElevateCommand os={ELEVATE_OS} />;
  if (searchParams.view === "elevate-empty")
    return <ElevateCommand os={{ ...ELEVATE_OS, events: [], focus: null }} />;
  if (searchParams.view === "event") return <EventPlanView event={EVENTS[0]} />;
  if (searchParams.view === "event-tight") return <EventPlanView event={EVENTS[1]} />;
  if (searchParams.view === "commit") return <CommitPreview />;
  if (searchParams.view === "elevate") return <ElevatePreview />;

  if (searchParams.view === "route") {
    return <ClimbRouteView route={ROUTES[0]} siteUrl="https://ascend.example" canAddPitch />;
  }

  if (searchParams.view === "pitch") {
    return (
      <ClimbPitchView
        pitch={SAVINGS}
        period={STATE.period}
        routeName="Payday Warriors"
        userId={ME}
        isOwner
        isPremium={false}
        momentum={momentum(SAVINGS.series)}
        notice={null}
      />
    );
  }

  if (searchParams.view === "empty") {
    return (
      <ClimbFace
        state={{ ...STATE, routes: [], best: null, momentum: null, weeks: 0, pending: [] }}
      />
    );
  }

  return <ClimbFace state={STATE} />;
}
