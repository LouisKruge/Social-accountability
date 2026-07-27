import { describe, expect, it } from "vitest";
import {
  buildAchievements,
  currentStreak,
  daysBetween,
  difficultyFor,
  lastSevenDays,
  paceSeries,
  payoutPerWinner,
  projectWinners,
  relativeTime,
} from "./commitDashboard";

describe("currentStreak", () => {
  const target = 10_000;

  it("counts consecutive days that met the daily target", () => {
    const logs = [
      { date: "2026-07-24", value: 11_000 },
      { date: "2026-07-25", value: 12_000 },
      { date: "2026-07-26", value: 10_500 },
    ];
    expect(currentStreak(logs, target, "2026-07-26")).toBe(3);
  });

  it("treats today as a grace day rather than a miss", () => {
    // Today is not over yet, so 2 000 steps so far must not wipe the streak.
    const logs = [
      { date: "2026-07-24", value: 11_000 },
      { date: "2026-07-25", value: 12_000 },
      { date: "2026-07-26", value: 2_000 },
    ];
    expect(currentStreak(logs, target, "2026-07-26")).toBe(2);
  });

  it("breaks on a missed day that has already finished", () => {
    const logs = [
      { date: "2026-07-23", value: 11_000 },
      { date: "2026-07-24", value: 400 },
      { date: "2026-07-25", value: 12_000 },
      { date: "2026-07-26", value: 12_000 },
    ];
    expect(currentStreak(logs, target, "2026-07-26")).toBe(2);
  });

  it("breaks on a day with no log at all", () => {
    const logs = [
      { date: "2026-07-23", value: 11_000 },
      { date: "2026-07-25", value: 12_000 },
      { date: "2026-07-26", value: 12_000 },
    ];
    expect(currentStreak(logs, target, "2026-07-26")).toBe(2);
  });

  it("is zero with no logs", () => {
    expect(currentStreak([], target, "2026-07-26")).toBe(0);
  });

  it("is zero when there is no daily target to meet", () => {
    expect(currentStreak([{ date: "2026-07-26", value: 9_000 }], 0, "2026-07-26")).toBe(0);
  });
});

describe("projectWinners", () => {
  it("projects each participant's own pace to the end of the window", () => {
    // Day 10 of 30, target 300 000 → 10 000/day gets you there. Only the first
    // of these three is running fast enough to finish.
    const progress = [120_000, 90_000, 40_000];
    expect(projectWinners(progress, 300_000, 10, 30)).toBe(1);
    expect(projectWinners([120_000, 100_000, 40_000], 300_000, 10, 30)).toBe(2);
  });

  it("returns null before any day has elapsed", () => {
    expect(projectWinners([0, 0], 300_000, 0, 30)).toBeNull();
  });

  it("counts nobody when everyone is behind", () => {
    expect(projectWinners([10_000, 20_000], 300_000, 15, 30)).toBe(0);
  });

  it("never invents a winner out of a zero target", () => {
    expect(projectWinners([5], 0, 5, 30)).toBeNull();
  });
});

describe("payoutPerWinner", () => {
  it("matches the settlement formula", () => {
    // R2 000 pool, 10% fee → R1 800 split three ways.
    expect(payoutPerWinner(2_000, 0.1, 3)).toBe(600);
  });

  it("is null when nobody is projected to win", () => {
    expect(payoutPerWinner(2_000, 0.1, 0)).toBeNull();
  });

  it("is null on an empty pool", () => {
    expect(payoutPerWinner(0, 0.1, 4)).toBeNull();
  });

  it("rounds to cents", () => {
    expect(payoutPerWinner(1_000, 0.1, 3)).toBe(300);
    expect(payoutPerWinner(100, 0.1, 7)).toBe(12.86);
  });
});

describe("paceSeries", () => {
  it("accumulates actual effort against the straight line needed", () => {
    const logs = [
      { date: "2026-07-01", value: 8_000 },
      { date: "2026-07-02", value: 12_000 },
      { date: "2026-07-03", value: 10_000 },
    ];
    const { actual, required } = paceSeries(logs, "2026-07-01", 10, 100_000, "2026-07-03");
    expect(actual).toEqual([8_000, 20_000, 30_000]);
    expect(required).toEqual([10_000, 20_000, 30_000]);
  });

  it("fills unlogged days with zero rather than skipping them", () => {
    const logs = [{ date: "2026-07-01", value: 8_000 }];
    const { actual } = paceSeries(logs, "2026-07-01", 10, 100_000, "2026-07-03");
    expect(actual).toEqual([8_000, 8_000, 8_000]);
  });

  it("never runs past the end of the window", () => {
    const { actual } = paceSeries([], "2026-07-01", 3, 30_000, "2026-07-30");
    expect(actual).toHaveLength(3);
  });
});

describe("lastSevenDays", () => {
  it("returns seven days ending today, gaps as zero", () => {
    const days = lastSevenDays([{ date: "2026-07-26", value: 9_000 }], "2026-07-26");
    expect(days).toHaveLength(7);
    expect(days[6].value).toBe(9_000);
    expect(days[0].value).toBe(0);
  });
});

describe("difficultyFor", () => {
  it("reads difficulty off the challenge's own daily demand", () => {
    expect(difficultyFor(150_000, 30)).toBe("Starter"); // 5 000/day
    expect(difficultyFor(240_000, 30)).toBe("Steady"); // 8 000/day
    expect(difficultyFor(360_000, 30)).toBe("Serious"); // 12 000/day
    expect(difficultyFor(450_000, 30)).toBe("Elite"); // 15 000/day
  });
});

describe("buildAchievements", () => {
  const none = {
    stakeCount: 0,
    confirmedStakes: 0,
    bestStreak: 0,
    targetsHit: 0,
    totalLogged: 0,
    paidPayouts: 0,
    cohortsCompleted: 0,
  };

  it("unlocks nothing for a brand-new account", () => {
    expect(buildAchievements(none).every((a) => !a.unlocked)).toBe(true);
  });

  it("reports partial progress toward a locked badge", () => {
    const seven = buildAchievements({ ...none, bestStreak: 4 }).find((a) => a.key === "week-one")!;
    expect(seven.unlocked).toBe(false);
    expect(seven.progress).toBeCloseTo(4 / 7);
  });

  it("never reports progress above one", () => {
    const all = buildAchievements({ ...none, totalLogged: 900_000 });
    expect(all.every((a) => a.progress <= 1)).toBe(true);
  });

  it("unlocks on the exact threshold", () => {
    const club = buildAchievements({ ...none, totalLogged: 100_000 }).find(
      (a) => a.key === "six-figures",
    )!;
    expect(club.unlocked).toBe(true);
  });
});

describe("relativeTime", () => {
  const now = Date.parse("2026-07-26T12:00:00Z");

  it("counts minutes, hours and days", () => {
    expect(relativeTime("2026-07-26T11:58:00Z", now)).toBe("2m");
    expect(relativeTime("2026-07-26T09:00:00Z", now)).toBe("3h");
    expect(relativeTime("2026-07-24T12:00:00Z", now)).toBe("2d");
  });

  it("falls back to a date beyond a week", () => {
    expect(relativeTime("2026-07-01T12:00:00Z", now)).toMatch(/Jul/);
  });

  it("does not render a negative age", () => {
    expect(relativeTime("2026-07-27T12:00:00Z", now)).toBe("soon");
  });
});

describe("daysBetween", () => {
  it("counts whole days", () => {
    expect(daysBetween("2026-07-01", "2026-07-31")).toBe(30);
    expect(daysBetween("2026-07-31", "2026-07-01")).toBe(-30);
  });
});
