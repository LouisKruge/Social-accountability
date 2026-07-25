import { describe, expect, it } from "vitest";
import { computeRankings, computeScore, rankEntries } from "./ranking";

describe("computeScore — percentage_change", () => {
  it("computes positive % growth for an 'increase' category (steps/savings)", () => {
    // 5000 → 6000 steps = +20%
    expect(
      computeScore({
        metricType: "percentage_change",
        direction: "increase",
        baselineValue: 5000,
        currentValue: 6000,
      }),
    ).toEqual({ score: 20, isAbsolute: false });
  });

  it("rewards a DROP for a 'decrease' category (debt paydown)", () => {
    // debt 10000 → 8000 = 20% paid down (positive score)
    expect(
      computeScore({
        metricType: "percentage_change",
        direction: "decrease",
        baselineValue: 10000,
        currentValue: 8000,
      }),
    ).toEqual({ score: 20, isAbsolute: false });
  });

  it("produces a negative score when the user regresses", () => {
    // savings 2000 → 1500 = -25%
    expect(
      computeScore({
        metricType: "percentage_change",
        direction: "increase",
        baselineValue: 2000,
        currentValue: 1500,
      }).score,
    ).toBeCloseTo(-25);
  });

  it("falls back to ABSOLUTE change (flagged) when baseline is 0", () => {
    // saving from R0 → R500 : cannot divide by zero
    expect(
      computeScore({
        metricType: "percentage_change",
        direction: "increase",
        baselineValue: 0,
        currentValue: 500,
      }),
    ).toEqual({ score: 500, isAbsolute: true });
  });

  it("treats a null baseline as 0 (absolute, flagged)", () => {
    expect(
      computeScore({
        metricType: "percentage_change",
        direction: "increase",
        baselineValue: null,
        currentValue: 300,
      }),
    ).toEqual({ score: 300, isAbsolute: true });
  });
});

describe("computeScore — streak", () => {
  it("uses the raw streak length as the score (flagged absolute)", () => {
    expect(
      computeScore({
        metricType: "streak",
        direction: "increase",
        baselineValue: null,
        currentValue: 12,
      }),
    ).toEqual({ score: 12, isAbsolute: true });
  });
});

describe("rankEntries", () => {
  it("orders by score desc and assigns distinct ranks", () => {
    const ranked = rankEntries([
      { userId: "a", score: 10, isAbsolute: false, submittedAt: "2026-07-01T10:00:00Z" },
      { userId: "b", score: 30, isAbsolute: false, submittedAt: "2026-07-01T10:00:00Z" },
      { userId: "c", score: 20, isAbsolute: false, submittedAt: "2026-07-01T10:00:00Z" },
    ]);
    expect(ranked.map((r) => [r.userId, r.rank])).toEqual([
      ["b", 1],
      ["c", 2],
      ["a", 3],
    ]);
  });

  it("breaks ties by earliest submission time", () => {
    const ranked = rankEntries([
      { userId: "late", score: 15, isAbsolute: false, submittedAt: "2026-07-02T09:00:00Z" },
      { userId: "early", score: 15, isAbsolute: false, submittedAt: "2026-07-01T09:00:00Z" },
    ]);
    expect(ranked[0].userId).toBe("early");
    expect(ranked[0].rank).toBe(1);
    expect(ranked[1].userId).toBe("late");
  });
});

describe("computeRankings — worked example (matches the spec's math)", () => {
  it("ranks three savers by % growth from their own baselines", () => {
    // Alice R1000 → R1200 = +20%
    // Bob   R5000 → R5500 = +10%
    // Carol R200  → R300  = +50%  (started low, wins on RATE of improvement)
    const rows = computeRankings(
      { metricType: "percentage_change", direction: "increase" },
      [
        { userId: "alice", baselineValue: 1000, currentValue: 1200, submittedAt: "2026-07-13T08:00:00Z" },
        { userId: "bob", baselineValue: 5000, currentValue: 5500, submittedAt: "2026-07-13T09:00:00Z" },
        { userId: "carol", baselineValue: 200, currentValue: 300, submittedAt: "2026-07-13T10:00:00Z" },
      ],
    );

    expect(rows).toEqual([
      { userId: "carol", pctChange: 50, isAbsolute: false, rank: 1 },
      { userId: "alice", pctChange: 20, isAbsolute: false, rank: 2 },
      { userId: "bob", pctChange: 10, isAbsolute: false, rank: 3 },
    ]);
  });

  it("rounds to 2 decimals", () => {
    const [row] = computeRankings(
      { metricType: "percentage_change", direction: "increase" },
      [{ userId: "x", baselineValue: 3, currentValue: 4, submittedAt: "2026-07-13T08:00:00Z" }],
    );
    // 1/3 = 33.333...% → 33.33
    expect(row.pctChange).toBe(33.33);
  });
});
