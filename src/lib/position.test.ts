import { describe, expect, it } from "vitest";
import {
  buildPosition,
  buildStrategies,
  compareStrategies,
  expectedReturn,
  portfolioHealth,
  probabilityPct,
  volatility,
  type PositionInput,
} from "./position";

const pos = (over: Partial<PositionInput> = {}): PositionInput => ({
  cohortId: "c1",
  name: "10k a day",
  stake: 500,
  progress: 150_000,
  target: 300_000,
  dayNumber: 15,
  totalDays: 30,
  daysRemaining: 15,
  history: Array.from({ length: 15 }, () => 10_000),
  poolTotal: 3_000,
  participants: 6,
  feeRate: 0.1,
  ...over,
});

describe("volatility — the metric that separates two people with the same average", () => {
  it("needs three days before it says anything", () => {
    expect(volatility([10_000, 10_000])).toBeNull();
    expect(volatility([10_000, 10_000, 10_000])).not.toBeNull();
  });

  it("calls a metronome metronomic", () => {
    const v = volatility(Array.from({ length: 14 }, () => 10_000))!;
    expect(v.cv).toBe(0);
    expect(v.steadiness).toBe(100);
    expect(v.label).toBe("metronomic");
  });

  it("separates the alternator from the metronome at the SAME average", () => {
    // Both average 10,000. Every mean-based metric in the product calls them
    // identical; this is the one that does not.
    const steady = Array.from({ length: 14 }, () => 10_000);
    const alternating = Array.from({ length: 14 }, (_, i) => (i % 2 ? 18_000 : 2_000));
    const a = volatility(steady)!;
    const b = volatility(alternating)!;
    expect(a.steadiness).toBeGreaterThan(b.steadiness + 50);
    expect(b.label).toBe("erratic");
  });

  it("is scale-free — the same shape in steps and in rand scores the same", () => {
    const steps = [8_000, 10_000, 12_000];
    const rand = [800, 1_000, 1_200];
    expect(volatility(steps)!.cv).toBe(volatility(rand)!.cv);
  });

  it("returns null rather than dividing by a zero mean", () => {
    expect(volatility([0, 0, 0])).toBeNull();
  });
});

describe("buildPosition", () => {
  it("reads dead-even progress as on pace", () => {
    const p = buildPosition(pos());
    expect(p.completion).toBe(0.5);
    expect(p.expected).toBe(0.5);
    expect(p.health).toBe("on_pace");
    expect(p.strain).toBe(1);
  });

  it("reads a lead as ahead", () => {
    const p = buildPosition(pos({ progress: 210_000 }));
    expect(p.health).toBe("ahead");
    expect(p.strain).toBeLessThan(1);
  });

  it("does not call a small early deficit critical", () => {
    // 15% behind on day two of thirty is noise. Colouring it red on day two is
    // how a product teaches people to ignore its warnings.
    const early = buildPosition(pos({ progress: 0, dayNumber: 2, daysRemaining: 28, history: [] }));
    expect(early.health).toBe("behind");
    expect(early.health).not.toBe("critical");
  });

  it("does call a real deficit critical when time has run out", () => {
    const late = buildPosition(
      pos({ progress: 120_000, dayNumber: 26, daysRemaining: 4, history: Array(26).fill(4_600) }),
    );
    expect(late.health).toBe("critical");
  });

  it("closes at the target", () => {
    expect(buildPosition(pos({ progress: 300_000 })).health).toBe("closed");
    expect(buildPosition(pos({ progress: 400_000 })).completion).toBe(1);
  });

  it("returns null strain rather than Infinity with nothing logged", () => {
    // "You need ∞× your current pace" is true and useless.
    expect(buildPosition(pos({ progress: 0, dayNumber: 0, history: [] })).strain).toBeNull();
  });

  it("computes the required velocity from what is actually left", () => {
    const p = buildPosition(pos({ progress: 150_000, daysRemaining: 15 }));
    expect(p.requiredVelocity).toBe(10_000);

    const behind = buildPosition(pos({ progress: 60_000, daysRemaining: 15 }));
    expect(behind.requiredVelocity).toBe(16_000);
  });

  it("carries a projection once there is enough history, and null before", () => {
    expect(buildPosition(pos({ history: [10_000, 10_000] })).projection).toBeNull();
    expect(buildPosition(pos()).projection).not.toBeNull();
  });
});

describe("expectedReturn", () => {
  it("splits the pool net of fee, assuming everyone finishes", () => {
    // The lowest defensible number. Erring smaller is the only direction that
    // cannot disappoint somebody who counted on it.
    expect(expectedReturn(pos({ poolTotal: 3_000, participants: 6, feeRate: 0.1 }))).toBe(450);
  });

  it("is zero rather than NaN with no participants", () => {
    expect(expectedReturn(pos({ participants: 0 }))).toBe(0);
  });
});

describe("portfolioHealth", () => {
  it("weights by exposure, not by count", () => {
    // One failing R2,000 position matters more than three healthy R100 ones.
    const positions = [
      buildPosition(pos({ cohortId: "big", stake: 2_000, progress: 30_000 })),
      buildPosition(pos({ cohortId: "a", stake: 100, progress: 300_000 })),
      buildPosition(pos({ cohortId: "b", stake: 100, progress: 300_000 })),
      buildPosition(pos({ cohortId: "c", stake: 100, progress: 300_000 })),
    ];
    const h = portfolioHealth(positions);
    expect(h.exposure).toBe(2_300);
    expect(h.atRisk).toBe(2_000);
    // Unweighted this would be 0.775; weighted by money it is far lower.
    expect(h.weightedCompletion!).toBeLessThan(0.3);
  });

  it("is null-safe on an empty portfolio", () => {
    expect(portfolioHealth([])).toMatchObject({ exposure: 0, weightedCompletion: null, atRisk: 0 });
  });
});

describe("strategy comparison", () => {
  const steady = Array.from({ length: 14 }, () => 10_000);

  it("offers nothing when the window is over", () => {
    expect(buildStrategies(100_000, 0, 1)).toEqual([]);
  });

  it("keeps every strategy's total on target", () => {
    const strategies = buildStrategies(100_000, 10, 1);
    for (const s of strategies) {
      const total = s.schedule.reduce((t, v) => t + v, 0);
      // Rounding to whole units per day moves the total by at most a day's worth.
      expect(Math.abs(total - 100_000)).toBeLessThan(10_000);
    }
  });

  it("front-loads by actually asking more of the early days", () => {
    const front = buildStrategies(100_000, 10, 1).find((s) => s.key === "front")!;
    expect(front.schedule[0]).toBeGreaterThan(front.schedule[front.schedule.length - 1]);
  });

  it("only offers the weekday split when the window contains both", () => {
    // Ten days always spans a weekend; three weekdays do not.
    expect(buildStrategies(100_000, 10, 1).some((s) => s.key === "weekday")).toBe(true);
    // Starting Monday, three days is Mon-Wed.
    expect(buildStrategies(30_000, 3, 1).some((s) => s.key === "weekday")).toBe(false);
  });

  it("gives every strategy a probability from the person's own history", () => {
    const results = compareStrategies(steady, 100_000, buildStrategies(100_000, 10, 1));
    expect(results.every((r) => r.probability !== null)).toBe(true);
    expect(results.every((r) => r.reachesTarget)).toBe(true);
  });

  it("returns null probabilities rather than guessing without history", () => {
    const results = compareStrategies([1, 2], 100_000, buildStrategies(100_000, 10, 1));
    expect(results.every((r) => r.probability === null)).toBe(true);
  });

  it("reports the heaviest day each strategy asks for", () => {
    const results = compareStrategies(steady, 100_000, buildStrategies(100_000, 10, 1));
    const front = results.find((r) => r.key === "front")!;
    const flat = results.find((r) => r.key === "flat")!;
    // The trade-off the comparison exists to show: front-loading buys slack
    // later at the cost of a harder first day.
    expect(front.peakDay).toBeGreaterThan(flat.peakDay);
  });
});

describe("probabilityPct", () => {
  it("never asserts certainty in either direction", () => {
    // A normal approximation over two weeks of step counts genuinely returns
    // 0.997 and 0.001. Rendering those as "100% likely" and "0% likely" claims
    // a certainty the method does not have.
    expect(probabilityPct(0.9999)).toBe(99);
    expect(probabilityPct(1)).toBe(99);
    expect(probabilityPct(0.0001)).toBe(1);
    expect(probabilityPct(0)).toBe(1);
  });

  it("passes ordinary values through unchanged", () => {
    expect(probabilityPct(0.5)).toBe(50);
    expect(probabilityPct(0.914)).toBe(91);
  });
});
