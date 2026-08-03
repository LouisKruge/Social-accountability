import { describe, expect, it } from "vitest";
import { buildItems, buildModes } from "./briefing";
import type { ClimbState } from "./climb";
import type { ExchangeState } from "./exchange";
import type { ElevateState } from "./elevate";

// The briefing's whole job is ORDER, so these fixtures build the smallest
// states that can put two competing items on the same screen.

const climb = (over: Partial<ClimbState> = {}): ClimbState => ({
  period: { start: "2026-07-20", end: "2026-07-26" },
  routes: [],
  dna: { traits: [], primary: null, daysAnalysed: 0 },
  best: null,
  momentum: null,
  weeks: 0,
  pending: [],
  ...over,
});

const commit = (over: Record<string, unknown> = {}): ExchangeState =>
  ({
    dashboard: { active: [], open: [], achievements: [], standings: null, analytics: null, ...(over.dashboard ?? {}) },
    wallet: {
      positions: { locked: 0, awaitingEft: 0, comingToYou: 0, paidOut: 0 },
      payouts: [],
      ...(over.wallet ?? {}),
    },
    modules: {},
    headline: null,
    integrity: null,
  }) as unknown as ExchangeState;

const elevate = (over: Partial<ElevateState> = {}): ElevateState =>
  ({
    actions: [],
    reportCount: 0,
    nextStep: null,
    wardrobeStats: { total: 0, neverWornCount: 0, bestValue: null },
    routes: [],
    ...over,
  }) as unknown as ElevateState;

const BEHIND = {
  cohortId: "c1",
  name: "10k a day",
  stake: 500,
  target: 300_000,
  progress: 50_000,
  dayNumber: 10,
  daysRemaining: 20,
};

describe("buildItems — ordering", () => {
  it("puts money blocked on the user above everything else", () => {
    const items = buildItems(
      climb({ pending: [{ routeId: "g", routeName: "Firm", pitchId: "p", pitchName: "Savings" }] }),
      commit({
        dashboard: { active: [BEHIND], open: [], achievements: [] },
        wallet: {
          positions: { locked: 500, awaitingEft: 0, comingToYou: 900, paidOut: 0 },
          payouts: [{ needsUser: true, amount: 900 }],
        },
      }),
      elevate(),
    );

    // Three real items compete. The one the user cannot proceed without is first.
    expect(items[0].id).toBe("payout-blocked");
    expect(items[0].kind).toBe("blocked");
    expect(items.map((i) => i.id)).toEqual(["payout-blocked", "at-risk-c1", "climb-pending"]);
  });

  it("puts money at risk above an unlogged week", () => {
    const items = buildItems(
      climb({ pending: [{ routeId: "g", routeName: "Firm", pitchId: "p", pitchName: "Savings" }] }),
      commit({ dashboard: { active: [BEHIND], open: [], achievements: [] } }),
      elevate(),
    );
    expect(items.map((i) => i.mode)).toEqual(["commit", "climb"]);
  });

  it("says nothing when a settled user has nothing outstanding", () => {
    // An empty briefing is a correct briefing. Manufacturing urgency to look
    // alive is the one thing this screen must not do. This is someone with a
    // route, everything logged, no stake and no open challenge to point at.
    const settled = buildItems(
      climb({ routes: [{ id: "g" }] as ClimbState["routes"] }),
      commit(),
      elevate(),
    );
    expect(settled).toEqual([]);
  });

  it("does point a brand-new account at its first step", () => {
    // The one case where a next step IS the whole briefing.
    const fresh = buildItems(climb(), commit(), elevate());
    expect(fresh).toHaveLength(1);
    expect(fresh[0]).toMatchObject({ id: "next-climb", kind: "next" });
  });
});

describe("buildItems — what it refuses to say", () => {
  it("does not flag a challenge that is on pace", () => {
    const onPace = { ...BEHIND, progress: 200_000 }; // pace 20k/day, needs 5k/day
    const items = buildItems(
      climb(),
      commit({ dashboard: { active: [onPace], open: [], achievements: [] } }),
      elevate(),
    );
    expect(items.some((i) => i.kind === "at_risk")).toBe(false);
  });

  it("does not flag a challenge already at target", () => {
    // Nothing is at risk when the target is met, however few days are left.
    const done = { ...BEHIND, progress: 300_000, daysRemaining: 1, dayNumber: 29 };
    const items = buildItems(
      climb({ routes: [{ id: "g" }] as ClimbState["routes"] }),
      commit({ dashboard: { active: [done], open: [], achievements: [] } }),
      elevate(),
    );
    expect(items).toEqual([]);
  });

  it("collapses many unlogged pitches into one sentence", () => {
    // Six identical rows is a chore list. Someone with six pitches understood
    // the situation from the first sentence.
    const pending = Array.from({ length: 6 }, (_, i) => ({
      routeId: "g",
      routeName: "Firm",
      pitchId: `p${i}`,
      pitchName: `Pitch ${i}`,
    }));
    const items = buildItems(climb({ pending }), commit(), elevate());
    expect(items).toHaveLength(1);
    expect(items[0].text).toBe("6 pitches have no number this week.");
  });

  it("only offers a next step when nothing else needs the user", () => {
    const withWork = buildItems(
      climb({ pending: [{ routeId: "g", routeName: "F", pitchId: "p", pitchName: "S" }] }),
      commit({ dashboard: { active: [], open: [{ stakeAmount: 200 }], achievements: [] } }),
      elevate(),
    );
    expect(withWork.some((i) => i.kind === "next")).toBe(false);

    const idle = buildItems(
      climb({ routes: [{ id: "g" }] as ClimbState["routes"] }),
      commit({ dashboard: { active: [], open: [{ stakeAmount: 200 }], achievements: [] } }),
      elevate(),
    );
    expect(idle).toHaveLength(1);
    expect(idle[0]).toMatchObject({ kind: "next", mode: "commit" });
  });

  it("names the cheapest way in rather than an abstraction", () => {
    const idle = buildItems(
      climb({ routes: [{ id: "g" }] as ClimbState["routes"] }),
      commit({
        dashboard: {
          active: [],
          open: [{ stakeAmount: 800 }, { stakeAmount: 150 }, { stakeAmount: 400 }],
          achievements: [],
        },
      }),
      elevate(),
    );
    expect(idle[0].text).toContain("R150");
  });

  it("reports an outstanding EFT, which is money the app is waiting on", () => {
    const items = buildItems(
      climb(),
      commit({
        wallet: {
          positions: { locked: 0, awaitingEft: 300, comingToYou: 0, paidOut: 0 },
          payouts: [],
        },
      }),
      elevate(),
    );
    expect(items[0]).toMatchObject({ id: "eft-outstanding", kind: "blocked" });
  });

  it("only mentions coaching actions once a review exists", () => {
    // Actions without a report would be actions about nothing.
    const noReport = buildItems(
      climb({ routes: [{ id: "g" }] as ClimbState["routes"] }),
      commit(),
      elevate({ actions: [{ status: "open" }] as ElevateState["actions"], reportCount: 0 }),
    );
    expect(noReport.some((i) => i.mode === "elevate" && i.kind === "ready")).toBe(false);

    const withReport = buildItems(
      climb(),
      commit(),
      elevate({ actions: [{ status: "open" }] as ElevateState["actions"], reportCount: 1 }),
    );
    expect(withReport[0]).toMatchObject({ mode: "elevate", kind: "ready" });
  });
});

describe("buildModes", () => {
  it("reports null rather than a zero for a mode with nothing in it", () => {
    // "R0" and "0%" read as facts about your money and your progress. They are
    // not; they mean "you have not started".
    const modes = buildModes(climb(), commit(), elevate());
    expect(modes.map((m) => m.value)).toEqual([null, null, null]);
    expect(modes.map((m) => m.caption)).toEqual([
      "No route yet",
      "Nothing on the line",
      "No review yet",
    ]);
  });

  it("formats a climb figure in its own unit", () => {
    const withStreak = buildModes(
      climb({
        best: {
          pitchId: "p",
          routeId: "g",
          routeName: "Firm",
          pitchName: "Up before six",
          metricType: "streak",
          unit: "days",
          value: 14,
          isAbsolute: true,
          rank: 1,
          fieldSize: 3,
        },
        routes: [{ id: "g" }] as ClimbState["routes"],
      }),
      commit(),
      elevate(),
    );
    expect(withStreak[0].value).toBe("14d");

    const withPct = buildModes(
      climb({
        best: {
          pitchId: "p",
          routeId: "g",
          routeName: "Firm",
          pitchName: "Savings",
          metricType: "percentage_change",
          unit: "ZAR",
          value: 23.4,
          isAbsolute: false,
          rank: 3,
          fieldSize: 6,
        },
        routes: [{ id: "g" }] as ClimbState["routes"],
      }),
      commit(),
      elevate(),
    );
    expect(withPct[0].value).toBe("+23.4%");
  });

  it("shows locked rand only when something is actually live", () => {
    const modes = buildModes(
      climb(),
      commit({
        dashboard: { active: [BEHIND], open: [], achievements: [] },
        wallet: {
          positions: { locked: 500, awaitingEft: 0, comingToYou: 0, paidOut: 0 },
          payouts: [],
        },
      }),
      elevate(),
    );
    expect(modes[1].value).toBe("R500");
    expect(modes[1].caption).toBe("on the line · 1 open");
  });
});
