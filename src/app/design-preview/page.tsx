import { notFound } from "next/navigation";
import { ClimbFace } from "@/components/climb-face";
import { ClimbRouteView } from "@/components/climb-route";
import { ClimbPitchView } from "@/components/climb-pitch";
import { HubPreview } from "./hub-preview";
import { CommitPreview, ElevatePreview } from "./modes-preview";
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

export default function DesignPreview({ searchParams }: { searchParams: { view?: string } }) {
  if (process.env.ALLOW_DESIGN_PREVIEW !== "1") notFound();
  if (searchParams.view === "hub") return <HubPreview />;
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
