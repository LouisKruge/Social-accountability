import { describe, expect, it } from "vitest";
import {
  ACCEPT_THRESHOLD,
  assessDay,
  assessWindow,
  integrityLabel,
  type DayLog,
} from "./integrity";

/** A clean day: device-sourced, logged the same evening. */
function day(over: Partial<DayLog> & { date: string; value: number }): DayLog {
  return {
    source: "apple_health",
    recordedAt: `${over.date}T20:00:00Z`,
    deviceId: "phone-1",
    ...over,
  };
}

function cleanWeek(from = 1, values = [10_200, 11_400, 9_800, 12_100, 10_050, 11_900, 10_700]) {
  return values.map((v, i) => day({ date: `2026-08-${String(from + i).padStart(2, "0")}`, value: v }));
}

describe("assessDay — the honest case", () => {
  it("fully trusts an ordinary device-logged day", () => {
    const v = assessDay(day({ date: "2026-08-08", value: 11_000 }), cleanWeek());
    expect(v.flags).toEqual([]);
    expect(v.confidence).toBe(100);
    expect(v.accepted).toBe(true);
  });

  it("accepts a manual day, but at lower confidence than a device one", () => {
    const manual = assessDay(
      day({ date: "2026-08-08", value: 11_000, source: "manual" }),
      [],
    );
    expect(manual.confidence).toBe(85);
    expect(manual.accepted).toBe(true);
    expect(manual.flags).toEqual([]);
  });

  it("does not flag a zero day", () => {
    const v = assessDay(day({ date: "2026-08-08", value: 0 }), cleanWeek());
    expect(v.flags).toEqual([]);
    expect(v.accepted).toBe(true);
  });
});

describe("assessDay — impossible and implausible", () => {
  it("rejects a physically impossible day", () => {
    const v = assessDay(day({ date: "2026-08-08", value: 150_000 }), cleanWeek());
    expect(v.flags.some((f) => f.code === "impossible_pace")).toBe(true);
    expect(v.accepted).toBe(false);
  });

  it("holds an exceptional but possible day rather than rejecting it", () => {
    // A very long hiking day. Suspicious, not impossible — a human should look.
    const v = assessDay(day({ date: "2026-08-08", value: 70_000 }), cleanWeek());
    expect(v.flags.some((f) => f.code === "outlier_spike")).toBe(true);
    expect(v.confidence).toBeGreaterThan(0);
  });

  it("explains a rejection in language fit to show the person", () => {
    const v = assessDay(day({ date: "2026-08-08", value: 150_000 }), []);
    expect(v.flags[0].detail).toMatch(/beyond what a person can walk/);
    expect(v.flags[0].detail).not.toMatch(/ERR|null|undefined/);
  });
});

describe("assessDay — the same number over and over", () => {
  it("flags a figure that repeats across days", () => {
    const history = [
      day({ date: "2026-08-01", value: 10_000 }),
      day({ date: "2026-08-02", value: 10_000 }),
    ];
    const v = assessDay(day({ date: "2026-08-03", value: 10_000 }), history);
    expect(v.flags.some((f) => f.code === "duplicate_value")).toBe(true);
  });

  it("does not flag a single coincidental repeat", () => {
    const history = [day({ date: "2026-08-01", value: 10_000 })];
    const v = assessDay(day({ date: "2026-08-02", value: 10_000 }), history);
    expect(v.flags.some((f) => f.code === "duplicate_value")).toBe(false);
  });

  it("never flags repeated zeroes as duplicates", () => {
    const history = [
      day({ date: "2026-08-01", value: 0 }),
      day({ date: "2026-08-02", value: 0 }),
    ];
    const v = assessDay(day({ date: "2026-08-03", value: 0 }), history);
    expect(v.flags).toEqual([]);
  });
});

describe("assessDay — backfill", () => {
  it("rejects a day filled in over a week later", () => {
    const v = assessDay(
      day({ date: "2026-08-01", value: 11_000, recordedAt: "2026-08-12T09:00:00Z" }),
      [],
    );
    expect(v.flags.some((f) => f.code === "late_backfill" && f.severity === 3)).toBe(true);
    expect(v.accepted).toBe(false);
  });

  it("dents but does not reject a couple of days late", () => {
    const v = assessDay(
      day({ date: "2026-08-01", value: 11_000, recordedAt: "2026-08-04T09:00:00Z" }),
      [],
    );
    expect(v.flags.some((f) => f.code === "late_backfill" && f.severity === 2)).toBe(true);
    expect(v.accepted).toBe(true);
  });

  it("treats logging the same evening as entirely normal", () => {
    const v = assessDay(
      day({ date: "2026-08-01", value: 11_000, recordedAt: "2026-08-01T21:30:00Z" }),
      [],
    );
    expect(v.flags).toEqual([]);
  });

  it("treats catching up the next morning as normal", () => {
    const v = assessDay(
      day({ date: "2026-08-01", value: 11_000, recordedAt: "2026-08-02T07:00:00Z" }),
      [],
    );
    expect(v.flags).toEqual([]);
  });
});

describe("assessDay — source and device", () => {
  it("flags a hand-typed day in a window otherwise logged by a tracker", () => {
    const v = assessDay(
      day({ date: "2026-08-08", value: 11_000, source: "manual" }),
      cleanWeek(),
    );
    expect(v.flags.some((f) => f.code === "source_downgrade")).toBe(true);
  });

  it("does not flag manual entry when the whole window is manual", () => {
    const history = cleanWeek().map((d) => ({ ...d, source: "manual" as const }));
    const v = assessDay(
      day({ date: "2026-08-08", value: 11_000, source: "manual" }),
      history,
    );
    expect(v.flags.some((f) => f.code === "source_downgrade")).toBe(false);
  });

  it("notes a new device without treating it as cheating", () => {
    const v = assessDay(
      day({ date: "2026-08-08", value: 11_000, deviceId: "phone-2" }),
      cleanWeek(),
    );
    const flag = v.flags.find((f) => f.code === "device_switch");
    expect(flag?.severity).toBe(1);
    expect(v.accepted).toBe(true); // people do buy new phones
  });

  it("does not flag a device switch without enough history to judge", () => {
    const v = assessDay(day({ date: "2026-08-08", value: 11_000, deviceId: "phone-2" }), [
      day({ date: "2026-08-07", value: 10_000 }),
    ]);
    expect(v.flags.some((f) => f.code === "device_switch")).toBe(false);
  });
});

describe("assessDay — judged against the person's own history", () => {
  it("flags a spike far outside this user's usual range", () => {
    const quiet = [3_000, 2_800, 3_200, 2_900, 3_100].map((v, i) =>
      day({ date: `2026-08-0${i + 1}`, value: v }),
    );
    const v = assessDay(day({ date: "2026-08-06", value: 25_000 }), quiet);
    expect(v.flags.some((f) => f.code === "outlier_spike")).toBe(true);
  });

  it("does not punish a strong day for someone who always walks a lot", () => {
    const busy = [22_000, 21_500, 23_000, 20_800, 22_400].map((v, i) =>
      day({ date: `2026-08-0${i + 1}`, value: v }),
    );
    const v = assessDay(day({ date: "2026-08-06", value: 25_000 }), busy);
    expect(v.flags).toEqual([]);
  });

  it("needs enough history before it judges anyone", () => {
    const v = assessDay(day({ date: "2026-08-03", value: 40_000 }), [
      day({ date: "2026-08-01", value: 3_000 }),
      day({ date: "2026-08-02", value: 3_000 }),
    ]);
    expect(v.flags.some((f) => f.code === "outlier_spike")).toBe(false);
  });

  it("does not stack two outlier reasons into a double penalty", () => {
    const quiet = [3_000, 2_800, 3_200, 2_900, 3_100].map((v, i) =>
      day({ date: `2026-08-0${i + 1}`, value: v }),
    );
    // Both over the implausible bar AND far outside this user's range.
    const v = assessDay(day({ date: "2026-08-06", value: 65_000 }), quiet);
    expect(v.flags.filter((f) => f.code === "outlier_spike")).toHaveLength(1);
  });
});

describe("assessDay — clock tampering", () => {
  it("flags a client clock well out of step with the server", () => {
    const v = assessDay(
      day({
        date: "2026-08-01",
        value: 11_000,
        recordedAt: "2026-08-01T20:00:00Z",
        clientClock: "2026-08-01T04:00:00Z",
      }),
      [],
    );
    expect(v.flags.some((f) => f.code === "clock_skew")).toBe(true);
  });

  it("tolerates an ordinary timezone offset", () => {
    const v = assessDay(
      day({
        date: "2026-08-01",
        value: 11_000,
        recordedAt: "2026-08-01T20:00:00Z",
        clientClock: "2026-08-01T18:00:00Z",
      }),
      [],
    );
    expect(v.flags.some((f) => f.code === "clock_skew")).toBe(false);
  });
});

describe("assessWindow", () => {
  it("trusts a clean window completely", () => {
    const w = assessWindow(cleanWeek());
    expect(w.integrityScore).toBe(100);
    expect(w.needsReview).toBe(false);
    expect(w.heldDays).toBe(0);
    expect(w.acceptedTotal).toBe(76_150);
  });

  it("holds bad days without discarding them", () => {
    const days = [...cleanWeek(), day({ date: "2026-08-08", value: 200_000 })];
    const w = assessWindow(days);
    expect(w.heldDays).toBe(1);
    expect(w.heldTotal).toBe(200_000);
    // The held steps are excluded from the total that counts toward money...
    expect(w.acceptedTotal).toBe(76_150);
    // ...but they are still reported, not erased.
    expect(w.heldTotal + w.acceptedTotal).toBe(276_150);
    expect(w.needsReview).toBe(true);
  });

  it("lets one bad day dent a long window without destroying it", () => {
    // Distinct values throughout: reusing the same seven figures for three
    // weeks running is itself the duplicate pattern the engine catches, which
    // is correct behaviour and not what this test is about.
    const days = Array.from({ length: 21 }, (_, i) =>
      day({
        date: `2026-08-${String(i + 1).padStart(2, "0")}`,
        value: 10_000 + i * 137,
      }),
    );
    days.push(day({ date: "2026-08-22", value: 200_000 }));
    const w = assessWindow(days);
    expect(w.integrityScore).toBeGreaterThan(90);
    expect(w.heldDays).toBe(1);
  });

  it("catches a whole window of identical figures", () => {
    // Someone typing the same round number every day is the pattern this
    // exists to notice.
    const days = Array.from({ length: 7 }, (_, i) =>
      day({ date: `2026-08-0${i + 1}`, value: 10_000, source: "manual" }),
    );
    const w = assessWindow(days);
    expect(w.perDay.every((v) => v.flags.some((f) => f.code === "duplicate_value"))).toBe(true);
    expect(w.integrityScore).toBeLessThan(70);
  });

  it("disqualifies a window that is mostly unverifiable", () => {
    const days = Array.from({ length: 10 }, (_, i) =>
      day({
        date: `2026-08-${String(i + 1).padStart(2, "0")}`,
        value: 200_000,
        source: "manual",
      }),
    );
    const w = assessWindow(days);
    expect(w.integrityScore).toBeLessThan(ACCEPT_THRESHOLD);
    expect(w.acceptedTotal).toBe(0);
  });

  it("handles an empty window without dividing by zero", () => {
    const w = assessWindow([]);
    expect(w.integrityScore).toBe(100);
    expect(w.acceptedTotal).toBe(0);
    expect(w.needsReview).toBe(false);
  });

  it("assesses each day against the others, not against itself", () => {
    // If a day were compared with itself it would always look like a duplicate.
    const w = assessWindow([day({ date: "2026-08-01", value: 10_000 })]);
    expect(w.perDay[0].flags).toEqual([]);
  });
});

describe("integrityLabel", () => {
  it("never accuses anybody of anything", () => {
    for (const score of [0, 40, 55, 75, 95, 100]) {
      expect(integrityLabel(score).label).not.toMatch(/cheat|fraud|fake|liar/i);
    }
  });

  it("maps the bands as documented", () => {
    expect(integrityLabel(95).tone).toBe("good");
    expect(integrityLabel(75).tone).toBe("good");
    expect(integrityLabel(60).tone).toBe("watch");
    expect(integrityLabel(20).tone).toBe("bad");
  });
});
