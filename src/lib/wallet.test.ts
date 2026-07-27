import { describe, expect, it } from "vitest";
import { buildLedger, computeRoi, toCsv, type LedgerLine } from "./wallet";

describe("computeRoi", () => {
  it("is null before anything has been staked", () => {
    expect(computeRoi(0, 0)).toBeNull();
  });

  it("reports a loss as a negative return", () => {
    expect(computeRoi(1_000, 400)).toBeCloseTo(-0.6);
  });

  it("reports a gain", () => {
    expect(computeRoi(1_000, 1_500)).toBeCloseTo(0.5);
  });

  it("is zero when you get back exactly what you put in", () => {
    expect(computeRoi(500, 500)).toBe(0);
  });
});

describe("buildLedger", () => {
  const names = new Map([["c1", "30-day steps"]]);

  const stake = {
    id: "s1",
    amount: 150,
    payment_confirmed: true,
    payment_reference: "ASC-AAAA-BBBBBB",
    created_at: "2026-08-01T10:00:00Z",
    cohort_id: "c1",
  };

  it("shows a stake as money out, from the user's point of view", () => {
    const lines = buildLedger([], [stake], names);
    expect(lines).toHaveLength(1);
    expect(lines[0].amount).toBe(-150);
    expect(lines[0].label).toBe("Stake committed");
    expect(lines[0].memo).toBe("30-day steps");
  });

  it("marks an unconfirmed stake as pending", () => {
    const lines = buildLedger([], [{ ...stake, payment_confirmed: false }], names);
    expect(lines[0].status).toBe("pending");
  });

  it("does not double-count a stake the settlement job has already ledgered", () => {
    const tx = {
      id: "t1",
      kind: "stake_locked",
      amount: -150,
      status: "cleared",
      memo: "30-day steps",
      bank_reference: "EFT-1",
      effective_at: "2026-08-01T10:00:00Z",
      stake_id: "s1",
    };
    const lines = buildLedger([tx], [stake], names);
    expect(lines).toHaveLength(1);
    expect(lines[0].id).toBe("tx-t1");
  });

  it("orders newest first", () => {
    const older = { ...stake, id: "s0", created_at: "2026-07-01T10:00:00Z" };
    const lines = buildLedger([], [stake, older], names);
    expect(lines[0].id).toBe("stake-s1");
    expect(lines[1].id).toBe("stake-s0");
  });

  it("falls back to a readable name for a cohort it cannot resolve", () => {
    const lines = buildLedger([], [{ ...stake, cohort_id: "gone" }], new Map());
    expect(lines[0].memo).toBe("Challenge");
  });

  it("labels every transaction kind it can receive", () => {
    const kinds = ["stake_locked", "stake_refunded", "winnings_credited", "fee_charged", "adjustment"];
    const txs = kinds.map((kind, i) => ({
      id: `t${i}`,
      kind,
      amount: 10,
      status: "cleared",
      memo: "x",
      bank_reference: null,
      effective_at: "2026-08-01T10:00:00Z",
      stake_id: null,
    }));
    const lines = buildLedger(txs, [], names);
    expect(lines.every((l) => l.label && l.label !== "undefined")).toBe(true);
  });
});

describe("toCsv", () => {
  const lines: LedgerLine[] = [
    {
      id: "1",
      at: "2026-08-01T10:00:00Z",
      label: "Stake committed",
      memo: "30-day steps",
      amount: -150,
      status: "cleared",
      reference: "ASC-1",
    },
  ];

  it("writes a header and one row per line", () => {
    const csv = toCsv(lines).split("\n");
    expect(csv).toHaveLength(2);
    expect(csv[0]).toContain("Amount (ZAR)");
    expect(csv[1]).toContain("-150.00");
  });

  it("uses a plain date, not a timestamp", () => {
    expect(toCsv(lines)).toContain('"2026-08-01"');
  });

  it("escapes quotes rather than breaking the file", () => {
    const csv = toCsv([{ ...lines[0], memo: 'The "big" one' }]);
    expect(csv).toContain('"The ""big"" one"');
  });

  it("survives a comma in a challenge name", () => {
    const csv = toCsv([{ ...lines[0], memo: "Steps, August" }]);
    // The comma must be inside quotes, so the row still has six fields.
    expect(csv.split("\n")[1].match(/"/g)!.length).toBeGreaterThanOrEqual(8);
  });

  it("always writes two decimal places, so it reconciles against a bank statement", () => {
    const csv = toCsv([{ ...lines[0], amount: -150 }]);
    expect(csv).toContain("-150.00");
  });

  it("handles an empty ledger without producing a broken file", () => {
    expect(toCsv([]).split("\n")).toHaveLength(1);
  });
});
