import { describe, expect, it } from "vitest";
import { transformationScore, type TransformationInputs } from "./transformation";

const base: TransformationInputs = {
  wardrobeItems: 0,
  wardrobeWorn: 0,
  looks: 0,
  actionsTotal: 0,
  actionsDone: 0,
  reports: 0,
  timelineEntries: 0,
  recordSpanWeeks: 0,
  eventsPrepared: 0,
  eventsTotal: 0,
};

describe("transformationScore", () => {
  it("is null for an account that has done nothing", () => {
    const t = transformationScore(base);
    expect(t.score).toBeNull();
    expect(t.coverage).toBe(0);
  });

  it("measures a completion rate, not a volume", () => {
    // Three actions, all done, beats thirty actions with four done. Someone
    // with a short list who finishes it has not transformed less.
    const small = transformationScore({ ...base, actionsTotal: 3, actionsDone: 3 });
    const large = transformationScore({ ...base, actionsTotal: 30, actionsDone: 4 });
    expect(small.score!).toBeGreaterThan(large.score!);
  });

  it("rewards wearing the wardrobe, not just cataloguing it", () => {
    const catalogued = transformationScore({ ...base, wardrobeItems: 25, wardrobeWorn: 0 });
    const worn = transformationScore({ ...base, wardrobeItems: 25, wardrobeWorn: 25 });
    expect(worn.score!).toBeGreaterThan(catalogued.score!);
  });

  it("does not let a burst of entries read as a journey", () => {
    // Twelve timeline entries in one afternoon is not twelve weeks of change.
    const burst = transformationScore({ ...base, timelineEntries: 12, recordSpanWeeks: 0 });
    const journey = transformationScore({ ...base, timelineEntries: 12, recordSpanWeeks: 12 });
    expect(journey.score!).toBeGreaterThan(burst.score!);
  });

  it("keeps grooming and communication listed as unmeasured", () => {
    const t = transformationScore({ ...base, actionsTotal: 2, actionsDone: 2 });
    expect(t.missing.map((m) => m.key)).toContain("grooming");
    expect(t.missing.map((m) => m.key)).toContain("communication");
    expect(t.coverage).toBeLessThan(1);
  });

  it("reaches the top only when every measurable signal is satisfied", () => {
    const t = transformationScore({
      wardrobeItems: 25,
      wardrobeWorn: 25,
      looks: 8,
      actionsTotal: 10,
      actionsDone: 10,
      reports: 3,
      timelineEntries: 12,
      recordSpanWeeks: 12,
      eventsPrepared: 4,
      eventsTotal: 4,
    });
    expect(t.score).toBe(1000);
    // Still not 100% coverage, because two signals genuinely have no source.
    expect(t.coverage).toBeCloseTo(0.92, 2);
  });

  it("shows what each signal contributed", () => {
    const t = transformationScore({ ...base, actionsTotal: 4, actionsDone: 2, wardrobeItems: 25, wardrobeWorn: 0 });
    const coaching = t.contributions.find((c) => c.key === "coaching")!;
    expect(coaching.share).toBeGreaterThan(0);
    // Exactly, not approximately: the panel's promise is that the parts
    // reconstruct the whole.
    expect(t.contributions.reduce((s, c) => s + c.share, 0)).toBe(t.score! - 300);
  });

  it("never scores an opinion — every input is a count of something done", () => {
    // A guard against the one way this feature could go wrong: no field in the
    // input type describes how the person looks.
    const fields = Object.keys(base);
    for (const f of fields) {
      expect(f).not.toMatch(/attract|beauty|rating|score_face|appearance|body|weight/i);
    }
  });
});
