import { describe, expect, it } from "vitest";
import { bestMove, gapToNext, logStreak, momentum, type ClimbPitch, type PitchRow } from "./climb";

const row = (over: Partial<PitchRow> & { userId: string; rank: number; pctChange: number }): PitchRow => ({
  displayName: "Climber",
  isAbsolute: false,
  series: [over.pctChange],
  ...over,
});

describe("gapToNext", () => {
  const rows = [
    row({ userId: "a", rank: 1, pctChange: 22 }),
    row({ userId: "b", rank: 2, pctChange: 14.5 }),
    row({ userId: "c", rank: 3, pctChange: 3 }),
  ];

  it("measures the distance to the rung above", () => {
    expect(gapToNext(rows, "b")).toBe(7.5);
    expect(gapToNext(rows, "c")).toBe(11.5);
  });

  it("returns null at the top rather than 0", () => {
    // 0 would render as "0% to catch nobody". Null is the only honest answer.
    expect(gapToNext(rows, "a")).toBeNull();
  });

  it("returns null for someone with no position", () => {
    expect(gapToNext(rows, "nobody")).toBeNull();
  });

  it("survives a hole in the ranks", () => {
    const sparse = [row({ userId: "a", rank: 1, pctChange: 10 }), row({ userId: "c", rank: 3, pctChange: 2 })];
    expect(gapToNext(sparse, "c")).toBeNull();
  });
});

describe("momentum", () => {
  it("needs a prior period to compare against", () => {
    expect(momentum([])).toBeNull();
    expect(momentum([12])).toBeNull();
  });

  it("reads a jump over the climber's own average as accelerating", () => {
    // average of 4,5,6 is 5; this week is 14.
    expect(momentum([4, 5, 6, 14])).toMatchObject({ direction: "accelerating", delta: 9, over: 3 });
  });

  it("reads a drop as slowing", () => {
    expect(momentum([20, 18, 22, 4])).toMatchObject({ direction: "slowing" });
  });

  it("calls a small move steady rather than manufacturing a trend", () => {
    // +0.5 against your own average is noise, and telling someone they are
    // "accelerating" on noise is the kind of fake insight this app avoids.
    expect(momentum([10, 10, 10.5])).toMatchObject({ direction: "steady", delta: 0.5 });
  });

  it("looks back at most four periods", () => {
    // The ancient 100 must not drag the average up forever.
    const m = momentum([100, 5, 5, 5, 5, 6]);
    expect(m).toMatchObject({ over: 4, delta: 1 });
  });

  it("takes a threshold in the pitch's own unit", () => {
    // One day either way on a streak is steady; three days is movement.
    expect(momentum([7, 8], 1)).toMatchObject({ direction: "steady" });
    expect(momentum([7, 11], 1)).toMatchObject({ direction: "accelerating" });
  });
});

describe("logStreak", () => {
  it("counts consecutive weeks back from the current one", () => {
    expect(logStreak(["2026-07-27", "2026-07-20", "2026-07-13"], "2026-07-27")).toBe(3);
  });

  it("does not collapse to zero on a Monday before you have logged", () => {
    // The new week is empty because it is Monday morning, not because the
    // streak broke. Measured to last week instead.
    expect(logStreak(["2026-07-20", "2026-07-13"], "2026-07-27")).toBe(2);
  });

  it("reads a genuinely broken streak as broken", () => {
    // Two empty weeks in a row is a break, not a grace period.
    expect(logStreak(["2026-07-13", "2026-07-06"], "2026-07-27")).toBe(0);
  });

  it("stops at the first gap", () => {
    expect(logStreak(["2026-07-27", "2026-07-20", "2026-07-06"], "2026-07-27")).toBe(2);
  });

  it("is zero with nothing logged", () => {
    expect(logStreak([], "2026-07-27")).toBe(0);
  });

  it("crosses a month and a year boundary", () => {
    expect(logStreak(["2026-01-05", "2025-12-29", "2025-12-22"], "2026-01-05")).toBe(3);
  });
});

const pitch = (over: Partial<ClimbPitch> & { id: string }): ClimbPitch => ({
  groupId: "g1",
  routeName: "The Firm",
  name: "Savings",
  metricType: "percentage_change",
  direction: "increase",
  unit: "ZAR",
  rows: [],
  viewer: null,
  gap: null,
  logged: true,
  series: [],
  ...over,
});

describe("bestMove", () => {
  it("is null when the viewer has no ranked position anywhere", () => {
    expect(bestMove([pitch({ id: "p1" })])).toBeNull();
  });

  it("picks the strongest percentage move", () => {
    const best = bestMove([
      pitch({ id: "p1", name: "Savings", viewer: row({ userId: "me", rank: 2, pctChange: 11 }) }),
      pitch({ id: "p2", name: "Steps", viewer: row({ userId: "me", rank: 1, pctChange: 27 }) }),
    ]);
    expect(best).toMatchObject({ pitchId: "p2", pitchName: "Steps", value: 27, rank: 1 });
  });

  it("never ranks a streak against a percentage", () => {
    // 14 days is not "worse than" 20%. They are different units, and any single
    // number combining them would be invented. A percentage pitch exists, so
    // the percentage is what gets reported.
    const best = bestMove([
      pitch({ id: "p1", metricType: "streak", unit: "days", viewer: row({ userId: "me", rank: 1, pctChange: 14 }) }),
      pitch({ id: "p2", viewer: row({ userId: "me", rank: 3, pctChange: 6 }) }),
    ]);
    expect(best).toMatchObject({ pitchId: "p2", value: 6 });
  });

  it("falls back to a streak when there is no percentage pitch at all", () => {
    const best = bestMove([
      pitch({ id: "p1", metricType: "streak", unit: "days", viewer: row({ userId: "me", rank: 1, pctChange: 14 }) }),
    ]);
    expect(best).toMatchObject({ pitchId: "p1", metricType: "streak", value: 14 });
  });

  it("reports the field size so a rank can be stated as 'of n'", () => {
    const rows = [
      row({ userId: "a", rank: 1, pctChange: 30 }),
      row({ userId: "me", rank: 2, pctChange: 12 }),
      row({ userId: "c", rank: 3, pctChange: 1 }),
    ];
    const best = bestMove([pitch({ id: "p1", rows, viewer: rows[1] })]);
    expect(best).toMatchObject({ rank: 2, fieldSize: 3 });
  });

  it("carries a negative move rather than hiding it", () => {
    // Going backwards is information. Suppressing it would make the hero a
    // highlight reel, which is the opposite of an accountability product.
    const best = bestMove([pitch({ id: "p1", viewer: row({ userId: "me", rank: 4, pctChange: -8 }) })]);
    expect(best).toMatchObject({ value: -8 });
  });
});
