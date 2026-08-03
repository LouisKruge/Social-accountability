import { describe, expect, it } from "vitest";
import { buildIntegrityTimeline, summarise, type TimelineSource } from "./integrityTimeline";

const src = (over: Partial<TimelineSource> = {}): TimelineSource => ({
  stakes: [],
  heldDays: [],
  verifiedDayCount: 0,
  settled: [],
  payoutEvents: [],
  ...over,
});

const STAKE = {
  id: "s1",
  cohortId: "c1",
  cohortName: "10k a day",
  amount: 500,
  paymentConfirmed: true,
  createdAt: "2026-07-01T10:00:00Z",
};

describe("buildIntegrityTimeline", () => {
  it("is empty for an account that has done nothing", () => {
    expect(buildIntegrityTimeline(src())).toEqual([]);
  });

  it("orders newest first across every kind of event", () => {
    const t = buildIntegrityTimeline(
      src({
        stakes: [STAKE],
        heldDays: [{ date: "2026-07-14", cohortName: "10k a day", reason: "4.1x your own median" }],
        settled: [{ id: "c1", name: "10k a day", endDate: "2026-07-30", hitTarget: true, payout: 900 }],
        payoutEvents: [
          {
            payoutId: "p1",
            at: "2026-08-02T09:00:00Z",
            to: "paid",
            reason: "EFT released",
            amount: 900,
            cohortName: "10k a day",
          },
        ],
      }),
    );
    const times = t.map((e) => Date.parse(e.at));
    expect(times).toEqual([...times].sort((a, b) => b - a));
    expect(t[0].kind).toBe("payout_paid");
  });

  it("shows a held day in the same list as a payout, marked adverse", () => {
    // A trust ledger that only shows good news is marketing.
    const t = buildIntegrityTimeline(
      src({ heldDays: [{ date: "2026-07-14", cohortName: "10k a day", reason: "recorded 9 days late" }] }),
    );
    expect(t[0]).toMatchObject({ kind: "day_held", adverse: true });
    expect(t[0].detail).toContain("recorded 9 days late");
  });

  it("does not emit one entry per verified day", () => {
    // Forty identical lines would bury the four that matter, and a record
    // nobody scrolls is not a record.
    const t = buildIntegrityTimeline(src({ verifiedDayCount: 40 }));
    expect(t).toEqual([]);
  });

  it("says plainly when an EFT has not landed", () => {
    const t = buildIntegrityTimeline(src({ stakes: [{ ...STAKE, paymentConfirmed: false }] }));
    expect(t.map((e) => e.kind)).toEqual(["stake_committed"]);
    expect(t[0].detail).toContain("has not landed");
  });

  it("signs a commitment negative and a payout positive", () => {
    const t = buildIntegrityTimeline(
      src({
        stakes: [STAKE],
        payoutEvents: [
          {
            payoutId: "p1",
            at: "2026-08-02T09:00:00Z",
            to: "paid",
            reason: "",
            amount: 900,
            cohortName: "10k a day",
          },
        ],
      }),
    );
    expect(t.find((e) => e.kind === "stake_committed")!.amount).toBe(-500);
    expect(t.find((e) => e.kind === "payout_paid")!.amount).toBe(900);
  });

  it("marks a missed target and a failed payout as adverse, and a met target as not", () => {
    const t = buildIntegrityTimeline(
      src({
        settled: [
          { id: "a", name: "Won", endDate: "2026-07-30", hitTarget: true, payout: 900 },
          { id: "b", name: "Lost", endDate: "2026-07-29", hitTarget: false, payout: null },
        ],
        payoutEvents: [
          {
            payoutId: "p1",
            at: "2026-08-01T09:00:00Z",
            to: "failed",
            reason: "bank rejected the account",
            amount: 900,
            cohortName: "Won",
          },
        ],
      }),
    );
    expect(t.find((e) => e.title.includes("Won"))!.adverse).toBe(false);
    expect(t.find((e) => e.title.includes("Lost"))!.adverse).toBe(true);
    expect(t.find((e) => e.kind === "payout_state")!.adverse).toBe(true);
  });

  it("ignores a challenge that has not settled", () => {
    const t = buildIntegrityTimeline(
      src({ settled: [{ id: "a", name: "Running", endDate: "2026-09-30", hitTarget: null, payout: null }] }),
    );
    // It still appears as an event, but never as a loss.
    expect(t[0].adverse).toBe(false);
  });
});

describe("summarise", () => {
  it("is null-safe with nothing judged", () => {
    expect(summarise(src()).holdRate).toBeNull();
  });

  it("computes a hold rate over judged days only", () => {
    const s = summarise(
      src({
        verifiedDayCount: 38,
        heldDays: [
          { date: "2026-07-14", cohortName: "x", reason: "r" },
          { date: "2026-07-15", cohortName: "x", reason: "r" },
        ],
      }),
    );
    expect(s.daysVerified).toBe(38);
    expect(s.holdRate).toBe(0.05);
  });

  it("totals committed and received separately", () => {
    const s = summarise(
      src({
        stakes: [STAKE, { ...STAKE, id: "s2", amount: 300 }],
        payoutEvents: [
          { payoutId: "p1", at: "2026-08-02T09:00:00Z", to: "paid", reason: "", amount: 900, cohortName: "x" },
          { payoutId: "p2", at: "2026-08-03T09:00:00Z", to: "processing", reason: "", amount: 400, cohortName: "x" },
        ],
      }),
    );
    expect(s.committed).toBe(800);
    // Only money that actually landed counts as received.
    expect(s.received).toBe(900);
  });

  it("counts only settled challenges as closed", () => {
    const s = summarise(
      src({
        settled: [
          { id: "a", name: "Won", endDate: "2026-07-30", hitTarget: true, payout: 900 },
          { id: "b", name: "Lost", endDate: "2026-07-29", hitTarget: false, payout: null },
          { id: "c", name: "Running", endDate: "2026-09-30", hitTarget: null, payout: null },
        ],
      }),
    );
    expect(s.challengesClosed).toBe(2);
    expect(s.challengesMet).toBe(1);
  });
});
