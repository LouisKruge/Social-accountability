import { describe, expect, it } from "vitest";
import {
  SEASON_EPOCH,
  checkEligibility,
  countQualifyingSeasons,
  inSeason,
  prestigeFrom,
  seasonAt,
  seasonResult,
  type Snapshot,
} from "./season";

const snaps = (from: string, n: number, score: number): Snapshot[] =>
  Array.from({ length: n }, (_, i) => {
    const d = new Date(`${from}T00:00:00Z`);
    d.setUTCDate(d.getUTCDate() + i);
    return { takenOn: d.toISOString().slice(0, 10), score };
  });

describe("seasonAt", () => {
  it("opens season 1 on the epoch", () => {
    expect(seasonAt(SEASON_EPOCH)).toMatchObject({ number: 1, start: SEASON_EPOCH });
  });

  it("rolls to season 2 exactly 90 days in", () => {
    expect(seasonAt("2026-04-04").number).toBe(1);
    expect(seasonAt("2026-04-05").number).toBe(2);
  });

  it("clamps to season 1 before the epoch rather than inventing a season 0", () => {
    expect(seasonAt("2025-11-01").number).toBe(1);
  });

  it("reports days remaining and progress", () => {
    const s = seasonAt(SEASON_EPOCH);
    expect(s.daysRemaining).toBe(89);
    expect(s.progress).toBe(0);
    expect(seasonAt("2026-04-04").progress).toBe(1);
  });

  it("knows what falls inside its window", () => {
    const s = seasonAt(SEASON_EPOCH);
    expect(inSeason(s, "2026-02-01")).toBe(true);
    expect(inSeason(s, "2026-04-05")).toBe(false);
  });
});

describe("prestigeFrom", () => {
  it("starts everyone at Explorer", () => {
    expect(prestigeFrom(0)).toMatchObject({ level: 1, title: "Explorer" });
  });

  it("advances one title per qualifying season", () => {
    expect(prestigeFrom(1).title).toBe("Achiever");
    expect(prestigeFrom(3).title).toBe("Elite");
  });

  it("caps at Icon with no next", () => {
    expect(prestigeFrom(50)).toMatchObject({ title: "Icon", next: null });
  });

  it("is deliberately slow — seven titles is years, not a quarter", () => {
    expect(prestigeFrom(6).title).toBe("Icon");
  });
});

describe("seasonResult", () => {
  const s = seasonAt(SEASON_EPOCH);

  it("is empty when nothing was measured", () => {
    expect(seasonResult([], s)).toMatchObject({ peakScore: null, qualified: false });
  });

  it("qualifies on the CLOSING score, not the peak", () => {
    // Touching 900 in week two and then stopping is not a disciplined season.
    const spike = [
      ...snaps(SEASON_EPOCH, 30, 900),
      { takenOn: "2026-03-01", score: 420 },
    ];
    const r = seasonResult(spike, s);
    expect(r.peakScore).toBe(900);
    expect(r.closingScore).toBe(420);
    expect(r.qualified).toBe(false);
  });

  it("qualifies a season measured and finished strong", () => {
    expect(seasonResult(snaps(SEASON_EPOCH, 40, 780), s).qualified).toBe(true);
  });

  it("will not qualify a season nobody measured", () => {
    // One great day is not a season.
    expect(seasonResult(snaps(SEASON_EPOCH, 5, 950), s).qualified).toBe(false);
  });

  it("ignores snapshots outside the window", () => {
    const outside = snaps("2026-05-01", 40, 950);
    expect(seasonResult(outside, s).daysMeasured).toBe(0);
  });
});

describe("countQualifyingSeasons", () => {
  it("counts only CLOSED seasons, never the one in progress", () => {
    // A season you are still in cannot have been finished.
    const inProgress = snaps(SEASON_EPOCH, 40, 900);
    expect(countQualifyingSeasons(inProgress, "2026-03-01")).toBe(0);
  });

  it("counts a past season once it has closed", () => {
    const done = snaps(SEASON_EPOCH, 40, 900);
    expect(countQualifyingSeasons(done, "2026-05-01")).toBe(1);
  });
});

describe("checkEligibility", () => {
  const gate = { minScore: 780, minIntegrity: 90 };

  it("lets a qualified person through", () => {
    expect(checkEligibility(gate, 800, 95).eligible).toBe(true);
  });

  it("shows every requirement with its numbers, met or not", () => {
    // A gate that says only "not eligible" is one people assume is arbitrary,
    // and this one stands between them and real money.
    const e = checkEligibility(gate, 700, 95);
    expect(e.eligible).toBe(false);
    expect(e.checks).toHaveLength(2);
    expect(e.checks[0]).toMatchObject({ required: 780, actual: 700, met: false });
    expect(e.checks[1].met).toBe(true);
  });

  it("treats an unmeasured score as not met rather than as zero", () => {
    const e = checkEligibility(gate, null, null);
    expect(e.checks.every((c) => c.met === false)).toBe(true);
    expect(e.checks[0].actual).toBeNull();
  });
});
