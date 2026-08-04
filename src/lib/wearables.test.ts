import { describe, expect, it } from "vitest";
import {
  MAX_DAILY_STEPS,
  PROVIDERS,
  TOKEN_SKEW_MS,
  availableProviders,
  canRefresh,
  mergeDecision,
  needsRefresh,
  normalise,
  normaliseAppleHealth,
  normaliseFitbit,
  normaliseGoogleFit,
  planMerge,
  providerDef,
  sanitise,
  syncWindow,
  type Connection,
  type DailySteps,
  type ExistingLog,
} from "./wearables";

describe("providers", () => {
  it("models Apple Health as push-only, because HealthKit has no server API", () => {
    // The whole reason this field exists. A "connect Apple Health" OAuth button
    // would be a button that cannot work.
    expect(providerDef("apple_health").pull).toBe(false);
    expect(providerDef("fitbit").pull).toBe(true);
    expect(providerDef("google_fit").pull).toBe(true);
  });

  it("names the credentials each provider needs", () => {
    for (const p of PROVIDERS) {
      expect(p.requires.length).toBeGreaterThan(0);
    }
  });

  it("reports none available with an empty environment", () => {
    expect(availableProviders({})).toEqual([]);
  });

  it("reports only the providers whose credentials are all present", () => {
    expect(
      availableProviders({ FITBIT_CLIENT_ID: "a", FITBIT_CLIENT_SECRET: "b" }),
    ).toEqual(["fitbit"]);
    // A half-configured provider is not available — it would fail at the
    // redirect, after the user had already tapped connect.
    expect(availableProviders({ FITBIT_CLIENT_ID: "a" })).toEqual([]);
  });
});

// ── Normalisation ────────────────────────────────────────────────────────────

describe("normaliseFitbit", () => {
  it("reads the time series and casts the string value", () => {
    const out = normaliseFitbit({
      "activities-steps": [
        { dateTime: "2026-08-01", value: "8423" },
        { dateTime: "2026-08-02", value: "10120" },
      ],
    });
    expect(out).toEqual([
      { date: "2026-08-01", steps: 8423, source: "fitbit" },
      { date: "2026-08-02", steps: 10120, source: "fitbit" },
    ]);
  });

  it("sums to a number, not a string", () => {
    // Fitbit sends value as a string. Without the cast this is "84231012".
    const out = normaliseFitbit({
      "activities-steps": [
        { dateTime: "2026-08-01", value: "8423" },
        { dateTime: "2026-08-02", value: "1012" },
      ],
    });
    expect(out.reduce((t, d) => t + d.steps, 0)).toBe(9435);
  });

  it("drops rows with an unusable date or value", () => {
    expect(
      normaliseFitbit({
        "activities-steps": [
          { dateTime: "not-a-date", value: "100" },
          { dateTime: "2026-08-01", value: "abc" },
          { dateTime: "2026-13-45", value: "100" },
          { value: "100" },
        ],
      }),
    ).toEqual([]);
  });

  it("survives junk without throwing", () => {
    for (const junk of [null, undefined, {}, [], "", 7, { "activities-steps": "nope" }]) {
      expect(normaliseFitbit(junk)).toEqual([]);
    }
  });
});

describe("normaliseGoogleFit", () => {
  const bucket = (ms: string, ...vals: number[]) => ({
    startTimeMillis: ms,
    dataset: [{ point: vals.map((v) => ({ value: [{ intVal: v }] })) }],
  });

  it("sums every point in a bucket and dates it from startTimeMillis", () => {
    const out = normaliseGoogleFit({ bucket: [bucket("1754006400000", 4000, 4423)] });
    expect(out).toEqual([{ date: "2025-08-01", steps: 8423, source: "google_fit" }]);
  });

  it("drops an empty bucket rather than recording a zero", () => {
    // A day with no data is not a day with zero steps. A false zero reads as a
    // missed day and costs somebody their streak.
    const out = normaliseGoogleFit({
      bucket: [{ startTimeMillis: "1754006400000", dataset: [{ point: [] }] }],
    });
    expect(out).toEqual([]);
  });

  it("keeps a genuine zero that has a point", () => {
    const out = normaliseGoogleFit({ bucket: [bucket("1754006400000", 0)] });
    expect(out).toEqual([{ date: "2025-08-01", steps: 0, source: "google_fit" }]);
  });

  it("survives junk without throwing", () => {
    for (const junk of [null, undefined, {}, { bucket: "nope" }, { bucket: [{}] }]) {
      expect(normaliseGoogleFit(junk)).toEqual([]);
    }
  });
});

describe("normaliseAppleHealth", () => {
  it("reads the device payload", () => {
    expect(
      normaliseAppleHealth({ samples: [{ date: "2026-08-01", steps: 8423 }] }),
    ).toEqual([{ date: "2026-08-01", steps: 8423, source: "apple_health" }]);
  });

  it("validates its own client's payload as strictly as a third party's", () => {
    // "We wrote the client" is an assumption about a binary on somebody
    // else's phone, not an integrity guarantee.
    expect(
      normaliseAppleHealth({
        samples: [{ date: "2026-08-01", steps: "lots" }, { steps: 100 }, { date: "x", steps: 1 }],
      }),
    ).toEqual([]);
  });
});

describe("normalise", () => {
  it("dispatches to the right adapter", () => {
    expect(normalise("fitbit", { "activities-steps": [{ dateTime: "2026-08-01", value: "1" }] })[0]!
      .source).toBe("fitbit");
    expect(normalise("apple_health", { samples: [{ date: "2026-08-01", steps: 1 }] })[0]!
      .source).toBe("apple_health");
  });
});

// ── Sanity bounds ────────────────────────────────────────────────────────────

describe("sanitise", () => {
  const day = (date: string, steps: number): DailySteps => ({ date, steps, source: "fitbit" });

  it("accepts an ordinary day", () => {
    const { accepted, rejected } = sanitise([day("2026-08-01", 8423)], "2026-08-04");
    expect(accepted).toHaveLength(1);
    expect(rejected).toHaveLength(0);
  });

  it("rejects above the ceiling at the boundary, not downstream", () => {
    const { accepted, rejected } = sanitise(
      [day("2026-08-01", MAX_DAILY_STEPS), day("2026-08-02", MAX_DAILY_STEPS + 1)],
      "2026-08-04",
    );
    expect(accepted).toHaveLength(1);
    expect(rejected[0]!.why).toContain("ceiling");
  });

  it("rejects a negative count", () => {
    expect(sanitise([day("2026-08-01", -5)], "2026-08-04").rejected).toHaveLength(1);
  });

  it("rejects a future-dated day", () => {
    // A wrong device clock or a hand-made payload. Either way it cannot be
    // evidence of effort already made.
    const { accepted, rejected } = sanitise([day("2026-08-05", 9000)], "2026-08-04");
    expect(accepted).toHaveLength(0);
    expect(rejected[0]!.why).toContain("future");
  });

  it("accepts today itself", () => {
    expect(sanitise([day("2026-08-04", 9000)], "2026-08-04").accepted).toHaveLength(1);
  });

  it("rounds fractional counts", () => {
    expect(sanitise([day("2026-08-01", 8423.6)], "2026-08-04").accepted[0]!.steps).toBe(8424);
  });
});

// ── Merge ────────────────────────────────────────────────────────────────────

describe("mergeDecision", () => {
  const incoming: DailySteps = { date: "2026-08-01", steps: 9000, source: "fitbit" };
  const existing = (steps: number, source: ExistingLog["source"]): ExistingLog => ({
    date: "2026-08-01",
    steps,
    source,
  });

  it("inserts when the day is empty", () => {
    expect(mergeDecision(incoming, null)).toBe("insert");
  });

  it("never overwrites a manual entry", () => {
    // Somebody who typed a figure has made a claim; a sync silently replacing
    // it is the app arguing with them without telling them.
    expect(mergeDecision(incoming, existing(100, "manual"))).toBe("skip");
    expect(mergeDecision(incoming, existing(99_000, "manual"))).toBe("skip");
  });

  it("takes the larger figure from the same source", () => {
    // A partial sync at 9am must not freeze the day at that count.
    expect(mergeDecision(incoming, existing(4000, "fitbit"))).toBe("update");
  });

  it("does not lower a figure from the same source", () => {
    expect(mergeDecision(incoming, existing(12_000, "fitbit"))).toBe("skip");
  });

  it("leaves a different device's figure alone", () => {
    // A phone on a desk must not overwrite a watch's real count. The integrity
    // engine's device_switch signal wants to see both.
    expect(mergeDecision(incoming, existing(4000, "google_fit"))).toBe("skip");
  });

  it("is a no-op on an equal figure", () => {
    expect(mergeDecision(incoming, existing(9000, "fitbit"))).toBe("skip");
  });
});

describe("planMerge", () => {
  it("decides per day against what is already there", () => {
    const plan = planMerge(
      [
        { date: "2026-08-01", steps: 9000, source: "fitbit" },
        { date: "2026-08-02", steps: 5000, source: "fitbit" },
        { date: "2026-08-03", steps: 7000, source: "fitbit" },
      ],
      [
        { date: "2026-08-01", steps: 4000, source: "fitbit" },
        { date: "2026-08-02", steps: 6000, source: "manual" },
      ],
    );
    expect(plan.map((p) => p.decision)).toEqual(["update", "skip", "insert"]);
  });

  it("returns one entry per incoming day, never fewer", () => {
    const days: DailySteps[] = Array.from({ length: 7 }, (_, i) => ({
      date: `2026-08-0${i + 1}`,
      steps: 1000,
      source: "fitbit",
    }));
    expect(planMerge(days, [])).toHaveLength(7);
  });
});

// ── Tokens ───────────────────────────────────────────────────────────────────

describe("needsRefresh", () => {
  const conn = (expiresAt: string | null, refresh: string | null = "r"): Connection => ({
    provider: "fitbit",
    accessToken: "a",
    refreshToken: refresh,
    expiresAt,
    scope: null,
  });

  it("is false for a token with no expiry", () => {
    expect(needsRefresh(conn(null))).toBe(false);
  });

  it("is false well before expiry", () => {
    const now = new Date("2026-08-04T10:00:00Z");
    expect(needsRefresh(conn("2026-08-04T12:00:00Z"), now)).toBe(false);
  });

  it("refreshes a minute early rather than at the boundary", () => {
    // A token that expires DURING the request that used it gives a 401 the
    // sync reports as a failure, and the next run repeats it identically.
    const now = new Date("2026-08-04T10:00:00Z");
    const justInside = new Date(now.getTime() + TOKEN_SKEW_MS - 1).toISOString();
    const justOutside = new Date(now.getTime() + TOKEN_SKEW_MS + 1000).toISOString();
    expect(needsRefresh(conn(justInside), now)).toBe(true);
    expect(needsRefresh(conn(justOutside), now)).toBe(false);
  });

  it("is true for an already-expired token", () => {
    expect(needsRefresh(conn("2020-01-01T00:00:00Z"), new Date("2026-08-04T10:00:00Z"))).toBe(true);
  });

  it("knows when there is nothing to refresh with", () => {
    expect(canRefresh(conn("2020-01-01T00:00:00Z", null))).toBe(false);
    expect(canRefresh(conn("2020-01-01T00:00:00Z", "r"))).toBe(true);
  });
});

describe("syncWindow", () => {
  it("reaches back 30 days on a first connection", () => {
    // So an existing challenge is not empty the moment somebody connects.
    expect(syncWindow(null, "2026-08-04")).toEqual({ from: "2026-07-05", to: "2026-08-04" });
  });

  it("reaches back 7 days afterwards, because providers backfill late", () => {
    // A watch synced on Monday can change Saturday's total.
    expect(syncWindow("2026-08-03", "2026-08-04")).toEqual({
      from: "2026-07-28",
      to: "2026-08-04",
    });
  });

  it("crosses a year boundary", () => {
    expect(syncWindow("2026-12-31", "2027-01-02").from).toBe("2026-12-26");
  });
});
