import { describe, expect, it } from "vitest";
import {
  disciplineScore,
  lifePortfolio,
  MIN_DAYS_TO_SIMULATE,
  momentumScore,
  performanceIndex,
  project,
  simulate,
  statusTier,
  type EffortDay,
} from "./intelligence";

const day = (date: string, value: number, required = 10_000): EffortDay => ({ date, value, required });

/** n perfect days ending the day before `from`. */
function perfectRun(n: number, startDay = 1): EffortDay[] {
  return Array.from({ length: n }, (_, i) => day(iso(startDay + i), 10_000));
}
function iso(d: number): string {
  return `2026-06-${String(d).padStart(2, "0")}`;
}

describe("momentumScore — the property the streak could not deliver", () => {
  it("is high after a sustained good run", () => {
    expect(momentumScore(perfectRun(30)).score).toBeGreaterThanOrEqual(97);
  });

  it("barely drops after ONE missed day", () => {
    // The brief's requirement, stated as a test. A streak would have gone to 0.
    const withMiss = [...perfectRun(29), day(iso(30), 0)];
    const score = momentumScore(withMiss).score;
    expect(score).toBeGreaterThan(88);
    expect(score).toBeLessThan(97);
  });

  it("crashes after SEVEN consecutive missed days", () => {
    const collapsed = [...perfectRun(23), ...Array.from({ length: 7 }, (_, i) => day(iso(24 + i), 0))];
    const score = momentumScore(collapsed).score;
    expect(score).toBeLessThan(35);
    expect(momentumScore(collapsed).missStreak).toBe(7);
  });

  it("punishes seven scattered misses far less than seven consecutive ones", () => {
    // The whole point. Seven bad days spread over a month is a person having a
    // hard month; seven in a row is a person who has stopped.
    const scattered = perfectRun(30).map((d, i) => (i % 4 === 0 ? { ...d, value: 0 } : d));
    const consecutive = [...perfectRun(23), ...Array.from({ length: 7 }, (_, i) => day(iso(24 + i), 0))];
    expect(momentumScore(scattered).score).toBeGreaterThan(momentumScore(consecutive).score + 20);
  });

  it("does not engage the penalty until the third consecutive miss", () => {
    const two = [...perfectRun(28), day(iso(29), 0), day(iso(30), 0)];
    const three = [...perfectRun(27), day(iso(28), 0), day(iso(29), 0), day(iso(30), 0)];
    expect(momentumScore(two).missStreak).toBe(2);
    // Two misses cost roughly twice one miss; the third costs noticeably more.
    expect(momentumScore(two).score - momentumScore(three).score).toBeGreaterThan(8);
  });

  it("recovers as soon as the person comes back", () => {
    const collapsed = [...perfectRun(20), ...Array.from({ length: 7 }, (_, i) => day(iso(21 + i), 0))];
    const returned = [...collapsed, day(iso(28), 10_000), day(iso(29), 10_000)];
    expect(momentumScore(returned).score).toBeGreaterThan(momentumScore(collapsed).score * 1.8);
    expect(momentumScore(returned).missStreak).toBe(0);
  });

  it("caps a huge day at full credit rather than banking it against a miss", () => {
    // 40,000 steps on Sunday does not buy Monday off.
    const banked = [...perfectRun(28), day(iso(29), 40_000), day(iso(30), 0)];
    const plain = [...perfectRun(29), day(iso(30), 0)];
    expect(momentumScore(banked).score).toBe(momentumScore(plain).score);
  });

  it("treats a day with no requirement as met when anything was done", () => {
    expect(momentumScore([day(iso(1), 500, 0)]).score).toBe(100);
    expect(momentumScore([day(iso(1), 0, 0)]).score).toBe(0);
  });

  it("is zero, not NaN, with nothing logged", () => {
    expect(momentumScore([])).toMatchObject({ score: 0, delta: null });
  });

  it("does not seed from zero and make day one look like a failure", () => {
    expect(momentumScore(perfectRun(1)).score).toBe(100);
  });
});

describe("disciplineScore", () => {
  it("is null, not 300, when nothing has been measured", () => {
    const d = disciplineScore({});
    expect(d.score).toBeNull();
    expect(d.coverage).toBe(0);
    expect(d.band).toBe("Not measured yet");
  });

  it("floors at 300 rather than 0", () => {
    // A person one week in is not a 40/1000 person.
    expect(disciplineScore({ completion: 0 }).score).toBe(300);
  });

  it("tops out at 1000", () => {
    expect(disciplineScore({ completion: 1, consistency: 1, momentum: 1 }).score).toBe(1000);
  });

  it("rescales over available weight instead of zero-filling absent signals", () => {
    // Someone with no wearable is not less disciplined — Ascend just knows
    // less. Zero-filling recovery and sleep would silently cap them at ~940.
    const withoutWearable = disciplineScore({
      completion: 1,
      consistency: 1,
      momentum: 1,
      integrity: 1,
      challenge_history: 1,
      goal_completion: 1,
      financial: 1,
    });
    expect(withoutWearable.score).toBe(1000);
    expect(withoutWearable.coverage).toBeCloseTo(0.92, 2);
  });

  it("reports exactly which signals are missing, with their weight", () => {
    const d = disciplineScore({ completion: 0.8 });
    expect(d.missing.map((m) => m.key)).toContain("recovery");
    expect(d.missing.map((m) => m.key)).toContain("sleep");
    expect(d.missing.find((m) => m.key === "recovery")!.weight).toBeGreaterThan(0);
  });

  it("attributes points to the signals that earned them", () => {
    const d = disciplineScore({ completion: 1, consistency: 0 });
    const completion = d.contributions.find((c) => c.key === "completion")!;
    const consistency = d.contributions.find((c) => c.key === "consistency")!;
    expect(completion.share).toBeGreaterThan(0);
    expect(consistency.share).toBe(0);
    // The attributed points reconstruct the score above the 300 floor —
    // exactly, via largest-remainder apportionment. Rounding each share
    // independently drifts by a point or two, and a person checking the
    // arithmetic and finding it off by one has a reason to distrust the number.
    expect(d.contributions.reduce((t, c) => t + c.share, 0)).toBe(d.score! - 300);
  });

  it("apportions every point, across many signals and awkward weights", () => {
    const d = disciplineScore({
      completion: 0.37,
      consistency: 0.61,
      momentum: 0.83,
      integrity: 0.94,
      challenge_history: 0.5,
      goal_completion: 0.29,
      financial: 0.71,
    });
    expect(d.contributions.reduce((t, c) => t + c.share, 0)).toBe(d.score! - 300);
    expect(d.contributions.every((c) => Number.isInteger(c.share))).toBe(true);
  });

  it("clamps a signal that arrives out of range", () => {
    expect(disciplineScore({ completion: 4 }).score).toBe(1000);
    expect(disciplineScore({ completion: -2 }).score).toBe(300);
  });
});

describe("statusTier", () => {
  it("is null when there is no score", () => {
    expect(statusTier(null)).toBeNull();
  });

  it("names the tier and the distance to the next one", () => {
    expect(statusTier(300)).toMatchObject({ name: "Explorer" });
    expect(statusTier(660)).toMatchObject({ name: "Performer", next: { name: "Elite", pointsAway: 120 } });
  });

  it("has no next tier at the top", () => {
    expect(statusTier(1000)!.next).toBeNull();
  });

  it("lands exactly on a floor in the higher tier", () => {
    expect(statusTier(780)!.name).toBe("Elite");
  });
});

describe("simulate", () => {
  const steady = Array.from({ length: 14 }, () => 10_000);

  it("refuses to answer without enough history", () => {
    // A standard deviation over three points is not a description of anybody,
    // and somebody might stake money on the answer.
    expect(simulate([1, 2, 3], 100_000, 10, [10_000])).toBeNull();
    expect(simulate(Array(MIN_DAYS_TO_SIMULATE).fill(9_000), 90_000, 10, [9_000])).not.toBeNull();
  });

  it("ranks higher rates as more likely", () => {
    const rows = simulate(steady, 100_000, 10, [8_000, 10_000, 12_000])!;
    expect(rows[0].probability).toBeLessThan(rows[1].probability);
    expect(rows[1].probability).toBeLessThan(rows[2].probability);
    expect(rows[2].probability).toBeGreaterThan(0.9);
  });

  it("flags a rate that cannot reach the target at all", () => {
    const rows = simulate(steady, 200_000, 10, [5_000, 25_000])!;
    expect(rows[0].reachesTarget).toBe(false);
    expect(rows[1].reachesTarget).toBe(true);
  });

  it("lets the person's own variance decide, in both directions", () => {
    // Both average 10,000. One walks 10k every day; the other alternates 3k
    // and 17k. Variance cuts both ways and the model has to get both right:
    const erratic = Array.from({ length: 14 }, (_, i) => (i % 2 ? 17_000 : 3_000));

    // Comfortably clearing the target: being steady is what protects you.
    const easyS = simulate(steady, 80_000, 10, [10_000])![0].probability;
    const easyE = simulate(erratic, 80_000, 10, [10_000])![0].probability;
    expect(easyS).toBeGreaterThan(easyE);

    // Short of the target: erratic is the only person with a chance, because
    // the upside days are what carry them over.
    const hardS = simulate(steady, 120_000, 10, [10_000])![0].probability;
    const hardE = simulate(erratic, 120_000, 10, [10_000])![0].probability;
    expect(hardE).toBeGreaterThan(hardS);

    // And at exactly break-even it is 50/50 for both, by symmetry — variance
    // cannot change the odds of clearing precisely your own mean.
    expect(simulate(steady, 100_000, 10, [10_000])![0].probability).toBe(0.5);
    expect(simulate(erratic, 100_000, 10, [10_000])![0].probability).toBe(0.5);
  });
});

describe("project", () => {
  const steady = Array.from({ length: 14 }, () => 10_000);

  it("returns null without enough history", () => {
    expect(project([1, 2], 50_000, 5, 10)).toBeNull();
  });

  it("reads a comfortable pace as low risk", () => {
    const p = project(steady, 50_000, 10, 20)!;
    expect(p.risk).toBe("low");
    expect(p.requiredRate).toBe(5_000);
    expect(p.currentRate).toBe(10_000);
    expect(p.expectedCompletionDay).toBe(25);
  });

  it("reads an impossible pace as high risk and names no completion day", () => {
    const p = project(steady, 300_000, 5, 25)!;
    expect(p.risk).toBe("high");
    expect(p.expectedCompletionDay).toBeNull();
  });
});

describe("lifePortfolio", () => {
  it("computes percentage change where there is a comparison", () => {
    expect(lifePortfolio([{ area: "Discipline", now: 820, then: 740 }])[0]).toMatchObject({
      change: 10.8,
    });
  });

  it("says 'no comparison yet' rather than +0%", () => {
    // The difference matters most in the first month, when a new user would
    // otherwise see a wall of confident zeroes.
    expect(lifePortfolio([{ area: "Confidence", now: 5, then: null }])[0]).toMatchObject({
      change: null,
      note: "no comparison yet",
    });
  });

  it("distinguishes 'not measured' from 'no movement'", () => {
    const rows = lifePortfolio([
      { area: "Recovery", now: null, then: null },
      { area: "Savings", now: 0, then: 0 },
    ]);
    expect(rows[0].note).toBe("not measured");
    expect(rows[1].note).toBe("no movement");
  });

  it("refuses a percentage of zero", () => {
    expect(lifePortfolio([{ area: "Earnings", now: 400, then: 0 }])[0]).toMatchObject({
      change: null,
      note: "from zero",
    });
  });

  it("handles a negative baseline without inverting the sign", () => {
    // Net −500 improving to −200 is a 60% improvement, not −60%.
    expect(lifePortfolio([{ area: "Net", now: -200, then: -500 }])[0].change).toBe(60);
  });

  it("reports an already-percentage area in points, not a percentage of a percentage", () => {
    // Climb going from +4% to +23.4% is arithmetically a 485% change, and
    // nobody reading "+485%" learns that their rate of improvement rose by
    // nineteen points.
    const asPct = lifePortfolio([{ area: "Climb", now: 23.4, then: 4 }])[0];
    expect(asPct.change).toBe(485);

    const asPoints = lifePortfolio([{ area: "Climb", now: 23.4, then: 4, unit: "points" }])[0];
    expect(asPoints).toMatchObject({ change: 19.4, unit: "points" });
  });

  it("reads an unchanged points area as no movement rather than +0", () => {
    expect(lifePortfolio([{ area: "Momentum", now: 71, then: 71, unit: "points" }])[0]).toMatchObject({
      change: null,
      note: "no movement",
    });
  });

  it("lets a points area go negative", () => {
    expect(lifePortfolio([{ area: "Momentum", now: 54, then: 71, unit: "points" }])[0].change).toBe(-17);
  });
});

describe("performanceIndex", () => {
  it("is null with no history", () => {
    expect(performanceIndex([])).toBeNull();
  });

  it("rebases the first point to 1000", () => {
    const idx = performanceIndex([{ date: "2026-06-01", score: 700 }])!;
    expect(idx.value).toBe(1000);
    expect(idx.changePct).toBeNull();
  });

  it("expresses growth as a percentage of the starting point", () => {
    const idx = performanceIndex([
      { date: "2026-06-01", score: 700 },
      { date: "2026-06-30", score: 770 },
    ])!;
    expect(idx.value).toBe(1100);
    expect(idx.changePct).toBe(10);
  });

  it("reports volatility only once there are enough moves to have any", () => {
    expect(
      performanceIndex([
        { date: "2026-06-01", score: 700 },
        { date: "2026-06-02", score: 710 },
      ])!.volatility,
    ).toBeNull();

    const steady = performanceIndex([
      { date: "2026-06-01", score: 700 },
      { date: "2026-06-02", score: 710 },
      { date: "2026-06-03", score: 720 },
      { date: "2026-06-04", score: 730 },
    ])!;
    expect(steady.volatility).toBe(0);
  });

  it("sorts by date rather than trusting the caller", () => {
    const idx = performanceIndex([
      { date: "2026-06-30", score: 770 },
      { date: "2026-06-01", score: 700 },
    ])!;
    expect(idx.value).toBe(1100);
  });
});
