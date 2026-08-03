import { describe, expect, it } from "vitest";
import { MIN_DAYS_FOR_DNA, readDna, type DnaDay } from "./dna";

/** 2026-06-01 is a Monday, so offset 5 and 6 are Sat/Sun. */
const day = (offset: number, value: number, hour = 12): DnaDay => {
  const d = new Date(Date.UTC(2026, 5, 1 + offset));
  const iso = d.toISOString().slice(0, 10);
  return { date: iso, value, recordedAt: `${iso}T${String(hour).padStart(2, "0")}:30:00Z` };
};

const run = (n: number, value: (i: number) => number, hour: (i: number) => number = () => 12) =>
  Array.from({ length: n }, (_, i) => day(i, value(i), hour(i)));

const keys = (days: DnaDay[]) => readDna(days).traits.map((t) => t.key);

describe("readDna — the floor", () => {
  it("says nothing at all below ten days", () => {
    // An archetype assigned from four days is a horoscope, and it would be the
    // first thing a new user read about themselves.
    const short = run(MIN_DAYS_FOR_DNA - 1, () => 10_000);
    expect(readDna(short)).toMatchObject({ traits: [], primary: null });
  });

  it("starts describing at exactly ten", () => {
    expect(readDna(run(MIN_DAYS_FOR_DNA, () => 10_000)).traits.length).toBeGreaterThan(0);
  });

  it("returns at most three traits", () => {
    // Someone who is everything is described as nothing.
    const everything = run(30, (i) => (i % 7 >= 5 ? 20_000 : 3_000), () => 6);
    expect(readDna(everything).traits.length).toBeLessThanOrEqual(3);
  });
});

describe("readDna — steadiness", () => {
  it("reads a metronome as a grinder, never as boring", () => {
    const d = readDna(run(20, () => 10_000));
    expect(keys(run(20, () => 10_000))).toContain("grinder");
    expect(d.primary!.name).toBe("Consistent grinder");
  });

  it("reads big-day-then-quiet as a peak performer", () => {
    expect(keys(run(20, (i) => (i % 4 === 0 ? 30_000 : 2_000)))).toContain("peak");
  });

  it("is not both at once", () => {
    const k = keys(run(20, () => 10_000));
    expect(k).not.toContain("peak");
  });
});

describe("readDna — when in the week", () => {
  it("spots a weekend warrior", () => {
    // Offsets 5,6,12,13… are Sat/Sun from a Monday start.
    const k = keys(run(28, (i) => ((i % 7 === 5 || i % 7 === 6) ? 20_000 : 6_000)));
    expect(k).toContain("weekend");
  });

  it("spots the opposite", () => {
    const k = keys(run(28, (i) => ((i % 7 === 5 || i % 7 === 6) ? 3_000 : 12_000)));
    expect(k).toContain("weekday");
  });

  it("says nothing about the week without enough of both", () => {
    // Five days only — not enough weekend to compare against.
    const k = keys(run(10, () => 10_000));
    expect(k).not.toContain("weekend");
    expect(k).not.toContain("weekday");
  });
});

describe("readDna — when in the day", () => {
  it("spots an early bird", () => {
    expect(keys(run(20, () => 10_000, () => 6))).toContain("early_bird");
  });

  it("spots a night owl", () => {
    expect(keys(run(20, () => 10_000, () => 23))).toContain("night_owl");
  });

  it("says nothing about the clock for someone who logs at midday", () => {
    const k = keys(run(20, () => 10_000, () => 13));
    expect(k).not.toContain("early_bird");
    expect(k).not.toContain("night_owl");
  });

  it("ignores days with nothing logged when reading the clock", () => {
    // Zero-value days are not evidence about when somebody moves.
    const mixed = run(20, (i) => (i % 2 ? 10_000 : 0), (i) => (i % 2 ? 6 : 23));
    expect(keys(mixed)).toContain("early_bird");
    expect(keys(mixed)).not.toContain("night_owl");
  });
});

describe("readDna — comeback", () => {
  it("needs two separate recoveries before it says anything", () => {
    const one = [...run(6, () => 10_000), day(6, 0), day(7, 0), day(8, 12_000), ...run(4, () => 10_000)];
    expect(keys(one)).not.toContain("comeback");
  });

  it("recognises repeated recovery after quiet spells", () => {
    const days: DnaDay[] = [
      ...run(4, () => 10_000),
      day(4, 0), day(5, 0), day(6, 11_000),
      day(7, 10_000), day(8, 0), day(9, 0), day(10, 12_000),
      day(11, 10_000), day(12, 0), day(13, 0), day(14, 11_000),
    ];
    expect(keys(days)).toContain("comeback");
  });

  it("does not count a single quiet day as a comeback", () => {
    const days = run(20, (i) => (i % 5 === 0 ? 0 : 10_000));
    expect(keys(days)).not.toContain("comeback");
  });
});

describe("readDna — shape of the run", () => {
  it("spots someone who finishes stronger", () => {
    expect(keys(run(20, (i) => (i < 10 ? 5_000 : 12_000)))).toContain("finisher");
  });

  it("spots someone who starts hard", () => {
    expect(keys(run(20, (i) => (i < 10 ? 14_000 : 5_000)))).toContain("sprinter");
  });

  it("needs fourteen days before commenting on shape", () => {
    const k = keys(run(12, (i) => (i < 6 ? 4_000 : 14_000)));
    expect(k).not.toContain("finisher");
  });
});

describe("readDna — what it will never say", () => {
  it("has no judgemental archetype anywhere in its output", () => {
    // The label sits next to a person's name. There is no "inconsistent",
    // no "quitter", no "weak". A person is not their worst fortnight.
    const shapes: DnaDay[][] = [
      run(30, () => 10_000),
      run(30, (i) => (i % 4 === 0 ? 30_000 : 1_000)),
      run(30, (i) => (i < 15 ? 14_000 : 2_000)),
      run(30, () => 0),
      run(30, (i) => (i % 3 === 0 ? 0 : 8_000)),
    ];
    for (const s of shapes) {
      for (const t of readDna(s).traits) {
        expect(`${t.name} ${t.blurb}`).not.toMatch(
          /lazy|quitter|weak|poor|bad|failure|inconsistent|unreliable/i,
        );
      }
    }
  });

  it("states the evidence for every trait so it can be checked", () => {
    const d = readDna(run(30, () => 10_000, () => 6));
    expect(d.traits.length).toBeGreaterThan(0);
    for (const t of d.traits) {
      expect(t.evidence.length).toBeGreaterThan(0);
      expect(t.strength).toBeGreaterThanOrEqual(0);
      expect(t.strength).toBeLessThanOrEqual(1);
    }
  });

  it("survives a run of nothing without crashing or describing it", () => {
    const d = readDna(run(20, () => 0));
    expect(d.daysAnalysed).toBe(20);
    // No time-of-day or weekday claim can be made from days with no activity.
    expect(d.traits.map((t) => t.key)).not.toContain("early_bird");
    expect(d.traits.map((t) => t.key)).not.toContain("weekend");
  });
});
