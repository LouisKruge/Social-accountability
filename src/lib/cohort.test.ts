import { describe, expect, it } from "vitest";
import {
  addDays,
  dailyPace,
  toCohortDraft,
  validateCohort,
  type CohortInput,
} from "./cohort";

const TODAY = "2026-07-27";

const good: CohortInput = {
  name: "30-day steps",
  targetValue: 300_000,
  days: 30,
  stakeAmount: 150,
  startDate: "2026-08-01",
};

describe("validateCohort", () => {
  it("accepts a sensible challenge", () => {
    expect(validateCohort(good, TODAY)).toEqual({});
  });

  it("requires a name", () => {
    expect(validateCohort({ ...good, name: "   " }, TODAY).name).toBeDefined();
  });

  it("caps the name length", () => {
    expect(validateCohort({ ...good, name: "x".repeat(61) }, TODAY).name).toBeDefined();
    expect(validateCohort({ ...good, name: "x".repeat(60) }, TODAY).name).toBeUndefined();
  });

  it("enforces the schema's stake bounds", () => {
    expect(validateCohort({ ...good, stakeAmount: 49 }, TODAY).stakeAmount).toBeDefined();
    expect(validateCohort({ ...good, stakeAmount: 501 }, TODAY).stakeAmount).toBeDefined();
    expect(validateCohort({ ...good, stakeAmount: 50 }, TODAY).stakeAmount).toBeUndefined();
    expect(validateCohort({ ...good, stakeAmount: 500 }, TODAY).stakeAmount).toBeUndefined();
  });

  it("rejects a start date in the past", () => {
    expect(validateCohort({ ...good, startDate: "2026-07-26" }, TODAY).startDate).toBeDefined();
  });

  it("allows a challenge starting today", () => {
    expect(validateCohort({ ...good, startDate: TODAY }, TODAY).startDate).toBeUndefined();
  });

  it("rejects a start date absurdly far out", () => {
    expect(validateCohort({ ...good, startDate: "2027-01-01" }, TODAY).startDate).toBeDefined();
  });

  it("enforces the window length", () => {
    expect(validateCohort({ ...good, days: 2 }, TODAY).days).toBeDefined();
    expect(validateCohort({ ...good, days: 91 }, TODAY).days).toBeDefined();
    expect(validateCohort({ ...good, days: 3, targetValue: 30_000 }, TODAY).days).toBeUndefined();
  });

  it("rejects a fractional number of days", () => {
    expect(validateCohort({ ...good, days: 30.5 }, TODAY).days).toBeDefined();
  });

  it("rejects a target nobody could walk", () => {
    // 2 000 000 over 30 days is 66 667 steps a day.
    const errors = validateCohort({ ...good, targetValue: 2_000_000 }, TODAY);
    expect(errors.targetValue).toBeDefined();
    expect(errors.targetValue).toContain("a day");
  });

  it("rejects a target too small to be a challenge", () => {
    expect(validateCohort({ ...good, targetValue: 500 }, TODAY).targetValue).toBeDefined();
  });

  it("does not report a pace error when the window is already invalid", () => {
    const errors = validateCohort({ ...good, days: 0 }, TODAY);
    expect(errors.days).toBeDefined();
    expect(errors.targetValue).toBeUndefined();
  });

  it("collects every problem at once rather than one at a time", () => {
    const errors = validateCohort(
      { name: "", targetValue: 0, days: 1, stakeAmount: 9, startDate: "nope" },
      TODAY,
    );
    expect(Object.keys(errors).sort()).toEqual([
      "days",
      "name",
      "stakeAmount",
      "startDate",
      "targetValue",
    ]);
  });
});

describe("toCohortDraft", () => {
  it("makes the window inclusive of its first day", () => {
    // A 30-day challenge starting on the 1st ends on the 30th, not the 31st.
    expect(toCohortDraft(good).end_date).toBe("2026-08-30");
    expect(toCohortDraft(good).start_date).toBe("2026-08-01");
  });

  it("always satisfies the schema's end_date > start_date check", () => {
    const draft = toCohortDraft({ ...good, days: 3 });
    expect(Date.parse(draft.end_date)).toBeGreaterThan(Date.parse(draft.start_date));
  });

  it("trims the name and rounds the target", () => {
    const draft = toCohortDraft({ ...good, name: "  Walk it off  ", targetValue: 300_000.6 });
    expect(draft.name).toBe("Walk it off");
    expect(draft.target_value).toBe(300_001);
  });

  it("opens as 'open', never as active", () => {
    expect(toCohortDraft(good).status).toBe("open");
  });
});

describe("dailyPace", () => {
  it("states the daily demand the creator is setting", () => {
    expect(dailyPace(300_000, 30)).toBe(10_000);
    expect(dailyPace(310_000, 31)).toBe(10_000);
  });

  it("is zero rather than Infinity on a zero-length window", () => {
    expect(dailyPace(300_000, 0)).toBe(0);
  });
});

describe("addDays", () => {
  it("crosses month boundaries", () => {
    expect(addDays("2026-08-30", 3)).toBe("2026-09-02");
    expect(addDays("2026-03-01", -1)).toBe("2026-02-28");
  });
});
