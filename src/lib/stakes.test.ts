import { describe, expect, it } from "vitest";
import { settleCohort, remainingToTarget, type Participant } from "./stakes";

/** 20 people, R100 each; `winners` of them reach the target. */
function cohortOf(n: number, winners: number, amount = 100): Participant[] {
  return Array.from({ length: n }, (_, i) => ({
    userId: `u${i}`,
    amount,
    progress: i < winners ? 300_000 : 100_000,
  }));
}
const TARGET = 300_000;

describe("settleCohort — the worked example from the spec", () => {
  it("20 × R100, 12 winners → R150 each (50% return)", () => {
    const s = settleCohort(cohortOf(20, 12), TARGET, 0.1);
    expect(s.totalPool).toBe(2000);
    expect(s.platformFee).toBe(200);
    expect(s.distributablePool).toBe(1800);
    expect(s.winnerCount).toBe(12);
    expect(s.payoutPerWinner).toBe(150);
    expect(s.outcome).toBe("mixed");
    expect(s.lines).toHaveLength(12);
    expect(s.lines.every((l) => l.kind === "winnings")).toBe(true);
  });

  it("20 × R100, 8 winners → R225 each (125% return)", () => {
    const s = settleCohort(cohortOf(20, 8), TARGET, 0.1);
    expect(s.distributablePool).toBe(1800);
    expect(s.payoutPerWinner).toBe(225);
    expect(s.outcome).toBe("mixed");
  });
});

describe("EDGE CASE — zero winners", () => {
  const s = settleCohort(cohortOf(20, 0), TARGET, 0.1);

  it("refunds every participant their full stake", () => {
    expect(s.outcome).toBe("no_winners");
    expect(s.lines).toHaveLength(20);
    expect(s.lines.every((l) => l.kind === "refund" && l.amount === 100)).toBe(true);
  });

  it("charges NO platform fee — the platform must not retain the pool", () => {
    expect(s.platformFee).toBe(0);
    const returned = s.lines.reduce((t, l) => t + l.amount, 0);
    expect(returned).toBe(s.totalPool);
  });

  it("never divides by zero", () => {
    expect(Number.isFinite(s.payoutPerWinner)).toBe(true);
    expect(s.payoutPerWinner).toBe(0);
  });
});

describe("EDGE CASE — 100% winners", () => {
  const s = settleCohort(cohortOf(20, 20), TARGET, 0.1);

  it("flags the outcome so the UI can explain it", () => {
    expect(s.outcome).toBe("all_winners");
    expect(s.everyoneWon).toBe(true);
  });

  it("returns less than each person staked, purely because of the fee", () => {
    // R2000 pool − R200 fee = R1800 ÷ 20 = R90 against a R100 stake.
    expect(s.payoutPerWinner).toBe(90);
    expect(s.payoutPerWinner).toBeLessThan(100);
    expect(s.lines).toHaveLength(20);
  });

  it("distributes exactly the post-fee pool, losing nothing", () => {
    const paid = s.lines.reduce((t, l) => t + l.amount, 0);
    expect(paid).toBeCloseTo(s.distributablePool, 2);
  });
});

describe("settleCohort — robustness", () => {
  it("treats progress exactly on target as a win", () => {
    const s = settleCohort(
      [{ userId: "a", amount: 100, progress: TARGET }],
      TARGET,
      0.1,
    );
    expect(s.winnerCount).toBe(1);
  });

  it("handles an empty cohort without dividing by zero", () => {
    const s = settleCohort([], TARGET, 0.1);
    expect(s.outcome).toBe("no_winners");
    expect(s.totalPool).toBe(0);
    expect(s.lines).toHaveLength(0);
    expect(Number.isFinite(s.payoutPerWinner)).toBe(true);
  });

  it("supports mixed stake amounts", () => {
    const s = settleCohort(
      [
        { userId: "a", amount: 500, progress: TARGET },
        { userId: "b", amount: 50, progress: TARGET },
        { userId: "c", amount: 200, progress: 0 },
      ],
      TARGET,
      0.1,
    );
    expect(s.totalPool).toBe(750);
    expect(s.platformFee).toBe(75);
    expect(s.payoutPerWinner).toBe(337.5);
  });

  it("supports a zero fee rate", () => {
    const s = settleCohort(cohortOf(10, 5), TARGET, 0);
    expect(s.platformFee).toBe(0);
    expect(s.payoutPerWinner).toBe(200);
  });

  it("rejects a nonsensical fee rate rather than silently mis-paying", () => {
    expect(() => settleCohort(cohortOf(4, 2), TARGET, 1)).toThrow(/fee_rate/);
    expect(() => settleCohort(cohortOf(4, 2), TARGET, -0.5)).toThrow(/fee_rate/);
  });

  it("rounds to cents without float drift", () => {
    const s = settleCohort(cohortOf(3, 3, 100), TARGET, 0.1);
    expect(s.payoutPerWinner).toBe(90);
  });
});

describe("remainingToTarget", () => {
  it("reports the distance still to cover", () => {
    expect(remainingToTarget(7200, 10000)).toBe(2800);
  });
  it("never goes negative once the target is passed", () => {
    expect(remainingToTarget(12000, 10000)).toBe(0);
  });
});
