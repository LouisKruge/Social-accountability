import { describe, expect, it } from "vitest";
import {
  DISPUTE_WINDOW_DAYS,
  PAYOUT_RUN_DAYS,
  TREASURY,
  ZERO_BALANCES,
  canDeposit,
  canDispute,
  canWithdraw,
  checkWithdrawal,
  depositInstruction,
  depositIsTerminal,
  depositReference,
  disputeWindowOpen,
  escrowAtRisk,
  nextPayoutRun,
  permits,
  settleEscrow,
  settleForCohort,
  summariseTaxYear,
  taxCsv,
  taxYearOf,
  totalHoldings,
  withdrawalIsCancellable,
  withdrawalIsTerminal,
  type Balances,
  type DepositState,
  type DisputeState,
  type EscrowHold,
  type TaxableMovement,
  type WithdrawalState,
} from "./treasury";

const balances = (over: Partial<Balances> = {}): Balances => ({ ...ZERO_BALANCES, ...over });

describe("treasury mode", () => {
  it("ships non-custodial, because the licence does not exist yet", () => {
    expect(TREASURY.custodial).toBe(false);
  });

  it("derives automatic settlement from custody rather than letting it be set alone", () => {
    expect(TREASURY.automaticSettlement).toBe(false);
    expect(TREASURY.automaticSettlement).toBe(TREASURY.custodial);
  });

  it("permits recording intent and reconciling in every mode", () => {
    expect(permits("record_intent")).toBe(true);
    expect(permits("reconcile")).toBe(true);
  });

  it("refuses to hold balances, auto-settle or auto-pay without custody", () => {
    expect(permits("hold_balance")).toBe(false);
    expect(permits("auto_settle")).toBe(false);
    expect(permits("auto_payout")).toBe(false);
  });

  it("unlocks all four the moment the flag flips, with no other change", () => {
    const licensed = { ...TREASURY, custodial: true, automaticSettlement: true };
    for (const op of ["hold_balance", "auto_settle", "auto_payout"] as const) {
      expect(permits(op, licensed)).toBe(true);
    }
  });
});

describe("balances", () => {
  it("counts every bucket in total holdings", () => {
    const b = balances({
      available: 100,
      pending: 50,
      locked: 200,
      escrow: 300,
      processing: 25,
      verificationHold: 10,
      rewards: 5,
      referral: 15,
      withdrawable: 95,
    });
    expect(totalHoldings(b)).toBe(800);
  });

  it("is zero for a new account", () => {
    expect(totalHoldings(ZERO_BALANCES)).toBe(0);
  });
});

// ── Deposits ─────────────────────────────────────────────────────────────────

describe("deposit state machine", () => {
  it("walks the happy path one step at a time", () => {
    const path: DepositState[] = [
      "instructed",
      "awaiting_transfer",
      "received",
      "reconciled",
      "credited",
    ];
    for (let i = 0; i < path.length - 1; i += 1) {
      expect(canDeposit(path[i]!, path[i + 1]!)).toBe(true);
    }
  });

  it("cannot skip reconciliation and credit straight from received", () => {
    // The whole point of the machine: money is credited only after it has been
    // matched against a real bank statement line.
    expect(canDeposit("received", "credited")).toBe(false);
    expect(canDeposit("awaiting_transfer", "credited")).toBe(false);
    expect(canDeposit("instructed", "credited")).toBe(false);
  });

  it("never runs backwards", () => {
    expect(canDeposit("credited", "reconciled")).toBe(false);
    expect(canDeposit("reconciled", "received")).toBe(false);
    expect(canDeposit("received", "awaiting_transfer")).toBe(false);
  });

  it("allows a refund from reconciled or credited but not from a failure", () => {
    expect(canDeposit("reconciled", "refunded")).toBe(true);
    expect(canDeposit("credited", "refunded")).toBe(true);
    expect(canDeposit("failed", "refunded")).toBe(false);
  });

  it("treats failed and refunded as terminal", () => {
    expect(depositIsTerminal("failed")).toBe(true);
    expect(depositIsTerminal("refunded")).toBe(true);
    expect(depositIsTerminal("credited")).toBe(false);
  });

  it("cannot fail once the money is reconciled", () => {
    // After reconciliation the money is demonstrably ours to hold or return;
    // "failed" would be a claim that it never arrived.
    expect(canDeposit("reconciled", "failed")).toBe(false);
    expect(canDeposit("credited", "failed")).toBe(false);
  });
});

describe("depositReference", () => {
  it("is stable for the same user and sequence", () => {
    const a = depositReference("11111111-1111-1111-1111-111111111111", 1);
    expect(depositReference("11111111-1111-1111-1111-111111111111", 1)).toBe(a);
  });

  it("differs between users", () => {
    expect(depositReference("user-a", 1)).not.toBe(depositReference("user-b", 1));
  });

  it("differs between deposits by the same user", () => {
    expect(depositReference("user-a", 1)).not.toBe(depositReference("user-a", 2));
  });

  it("avoids characters people mistype off a phone screen", () => {
    for (let i = 0; i < 40; i += 1) {
      const ref = depositReference(`user-${i}`, i);
      expect(ref.slice(3, 8)).not.toMatch(/[ILO01]/);
    }
  });

  it("is prefixed and fixed width so a bank statement is greppable", () => {
    expect(depositReference("user-a", 7)).toMatch(/^ASC[A-Z2-9]{5}07$/);
  });

  it("matches the SQL deposit_reference() byte for byte", () => {
    // The UI shows the reference before the row exists; the trigger writes the
    // one that gets stored. If these two ever disagree, a person pays using a
    // reference nothing will match — and the money is untraceable until an
    // operator finds it by hand. Pinned to values verified against Postgres.
    expect(depositReference("aaaa1111-0000-0000-0000-00000000aaaa", 1)).toBe("ASC43ECW01");
    expect(depositReference("aaaa1111-0000-0000-0000-00000000aaaa", 2)).toBe("ASC43ECW02");
  });
});

describe("depositInstruction", () => {
  it("gives real EFT steps and names the reference while non-custodial", () => {
    const inst = depositInstruction(250, "user-a", 1);
    expect(inst.manual).toBe(true);
    expect(inst.steps.some((s) => s.includes(inst.reference))).toBe(true);
    expect(inst.steps.some((s) => s.includes("R250"))).toBe(true);
  });

  it("collapses to a card flow once custody exists", () => {
    const inst = depositInstruction(250, "user-a", 1, { ...TREASURY, custodial: true });
    expect(inst.manual).toBe(false);
    expect(inst.steps).toHaveLength(3);
  });
});

// ── Withdrawals ──────────────────────────────────────────────────────────────

describe("withdrawal state machine", () => {
  it("walks the happy path", () => {
    const path: WithdrawalState[] = [
      "requested",
      "verification",
      "approved",
      "scheduled",
      "submitted",
      "paid",
    ];
    for (let i = 0; i < path.length - 1; i += 1) {
      expect(canWithdraw(path[i]!, path[i + 1]!)).toBe(true);
    }
  });

  it("cannot pay without passing verification", () => {
    expect(canWithdraw("requested", "paid")).toBe(false);
    expect(canWithdraw("requested", "approved")).toBe(false);
    expect(canWithdraw("verification", "paid")).toBe(false);
  });

  it("lets an approved payout skip the queue for an off-cycle run", () => {
    expect(canWithdraw("approved", "submitted")).toBe(true);
  });

  it("makes paid terminal in both directions", () => {
    expect(withdrawalIsTerminal("paid")).toBe(true);
    expect(canWithdraw("paid", "cancelled")).toBe(false);
    expect(canWithdraw("paid", "rejected")).toBe(false);
  });

  it("is cancellable until the bank file goes out", () => {
    expect(withdrawalIsCancellable("requested")).toBe(true);
    expect(withdrawalIsCancellable("verification")).toBe(true);
    expect(withdrawalIsCancellable("approved")).toBe(true);
    expect(withdrawalIsCancellable("scheduled")).toBe(true);
    // Submitted means an instruction has left us. Nothing to cancel any more.
    expect(withdrawalIsCancellable("submitted")).toBe(false);
  });
});

describe("checkWithdrawal", () => {
  const cleared = balances({ withdrawable: 500 });

  it("allows a clean withdrawal and says so on every line", () => {
    const check = checkWithdrawal(200, cleared, true);
    expect(check.allowed).toBe(true);
    expect(check.reasons.every((r) => r.met)).toBe(true);
    expect(check.ceiling).toBe(500);
  });

  it("takes the ceiling from withdrawable only, never from locked or escrowed money", () => {
    const b = balances({ withdrawable: 100, locked: 5_000, escrow: 5_000, available: 5_000 });
    expect(checkWithdrawal(200, b, true).ceiling).toBe(100);
    expect(checkWithdrawal(200, b, true).allowed).toBe(false);
  });

  it("names the exact line that failed rather than refusing generically", () => {
    const check = checkWithdrawal(20, cleared, true);
    expect(check.allowed).toBe(false);
    const failed = check.reasons.filter((r) => !r.met);
    expect(failed).toHaveLength(1);
    expect(failed[0]!.label).toContain("Minimum");
  });

  it("blocks on unverified bank details", () => {
    const check = checkWithdrawal(200, cleared, false);
    expect(check.allowed).toBe(false);
    expect(check.reasons.find((r) => r.label === "Bank details verified")!.met).toBe(false);
  });

  it("blocks while a verification hold is open, and says how much", () => {
    const check = checkWithdrawal(200, balances({ withdrawable: 500, verificationHold: 120 }), true);
    expect(check.allowed).toBe(false);
    const hold = check.reasons.find((r) => r.label === "Nothing under review")!;
    expect(hold.met).toBe(false);
    expect(hold.detail).toContain("120");
  });

  it("refuses a zero or negative amount", () => {
    expect(checkWithdrawal(0, cleared, true).allowed).toBe(false);
    expect(checkWithdrawal(-100, cleared, true).allowed).toBe(false);
  });

  it("allows withdrawing the whole cleared balance", () => {
    expect(checkWithdrawal(500, cleared, true).allowed).toBe(true);
  });

  it("still reports every rule when several fail at once", () => {
    const check = checkWithdrawal(9_000, balances({ withdrawable: 10, verificationHold: 5 }), false);
    expect(check.reasons).toHaveLength(4);
    expect(check.reasons.filter((r) => !r.met)).toHaveLength(3);
  });

  it("honours relaxed rules without changing the shape of the answer", () => {
    const check = checkWithdrawal(10, balances({ withdrawable: 10, verificationHold: 99 }), false, {
      minimum: 1,
      requiresVerifiedDestination: false,
      blocksOnVerificationHold: false,
    });
    expect(check.allowed).toBe(true);
    expect(check.reasons).toHaveLength(4);
  });
});

// ── Disputes ─────────────────────────────────────────────────────────────────

describe("dispute state machine", () => {
  it("walks open → evidence → review → decision", () => {
    const path: DisputeState[] = ["open", "evidence", "review"];
    for (let i = 0; i < path.length - 1; i += 1) {
      expect(canDispute(path[i]!, path[i + 1]!)).toBe(true);
    }
    expect(canDispute("review", "upheld")).toBe(true);
    expect(canDispute("review", "declined")).toBe(true);
  });

  it("cannot be decided before a person has reviewed it", () => {
    expect(canDispute("open", "declined")).toBe(false);
    expect(canDispute("open", "upheld")).toBe(false);
    expect(canDispute("evidence", "declined")).toBe(false);
  });

  it("cannot be withdrawn once it is under review", () => {
    // Otherwise a dispute could be pulled the moment it looked like going badly,
    // and the record would show nothing ever happened.
    expect(canDispute("review", "withdrawn")).toBe(false);
    expect(canDispute("open", "withdrawn")).toBe(true);
    expect(canDispute("evidence", "withdrawn")).toBe(true);
  });

  it("makes every decision final", () => {
    for (const s of ["upheld", "declined", "withdrawn"] as const) {
      expect(canDispute(s, "open")).toBe(false);
      expect(canDispute(s, "review")).toBe(false);
    }
  });
});

describe("disputeWindowOpen", () => {
  it("is open on the settlement day itself", () => {
    expect(disputeWindowOpen("2026-03-01", "2026-03-01")).toBe(true);
  });

  it("spans two monthly bank statements", () => {
    expect(DISPUTE_WINDOW_DAYS).toBe(60);
  });

  it("is open on the last day and shut on the next", () => {
    expect(disputeWindowOpen("2026-03-01", "2026-04-30")).toBe(true); // day 60
    expect(disputeWindowOpen("2026-03-01", "2026-05-01")).toBe(false); // day 61
  });

  it("is shut before the settlement it refers to", () => {
    expect(disputeWindowOpen("2026-03-01", "2026-02-28")).toBe(false);
  });
});

// ── Escrow ───────────────────────────────────────────────────────────────────

describe("settleEscrow", () => {
  it("returns the whole stake, fee-free, to somebody who hit their target", () => {
    expect(settleEscrow(500, true, 0.1)).toEqual({ toUser: 500, toPool: 0, fee: 0 });
  });

  it("takes the fee from the forfeit, never from a returned stake", () => {
    expect(settleEscrow(500, false, 0.1)).toEqual({ toUser: 0, toPool: 450, fee: 50 });
  });

  it("conserves the money exactly", () => {
    for (const amount of [100, 333, 1_234.56, 7]) {
      for (const hit of [true, false]) {
        const s = settleEscrow(amount, hit, 0.1);
        expect(s.toUser + s.toPool + s.fee).toBeCloseTo(amount, 2);
      }
    }
  });

  it("rounds every part to the cent rather than paying out float dust", () => {
    // 333.33 at 7.5% is 24.99975 — the kind of figure that renders as
    // "R24.99975" if nothing rounds it before it reaches a screen.
    const s = settleEscrow(333.33, false, 0.075);
    for (const v of [s.toUser, s.toPool, s.fee]) {
      expect(v).toBe(Math.round(v * 100) / 100);
    }
    expect(s.fee).toBe(25);
    expect(s.toPool).toBe(308.33);
  });
});

describe("settleForCohort", () => {
  it("refunds a cancelled challenge in full, fee-free, even to somebody who missed", () => {
    // The rule that matters most: a platform that could charge a fee on a
    // challenge it cancelled would have a financial reason to cancel them.
    expect(settleForCohort(500, "cancelled", false, 0.1)).toEqual({
      toUser: 500,
      toPool: 0,
      fee: 0,
    });
    expect(settleForCohort(500, "cancelled", true, 0.1)).toEqual({
      toUser: 500,
      toPool: 0,
      fee: 0,
    });
  });

  it("applies the normal split to a completed challenge", () => {
    expect(settleForCohort(500, "completed", true, 0.1)).toEqual({ toUser: 500, toPool: 0, fee: 0 });
    expect(settleForCohort(500, "completed", false, 0.1)).toEqual({
      toUser: 0,
      toPool: 450,
      fee: 50,
    });
  });

  it("conserves the money in both outcomes", () => {
    for (const status of ["completed", "cancelled"] as const) {
      for (const hit of [true, false]) {
        const s = settleForCohort(777.77, status, hit, 0.125);
        expect(s.toUser + s.toPool + s.fee).toBeCloseTo(777.77, 2);
      }
    }
  });
});

describe("escrowAtRisk", () => {
  const holds: EscrowHold[] = [
    { id: "a", cohortId: "c1", amount: 100, releasedTo: null, placedOn: "2026-03-01" },
    { id: "b", cohortId: "c2", amount: 250, releasedTo: null, placedOn: "2026-03-02" },
    { id: "c", cohortId: "c3", amount: 900, releasedTo: "user", placedOn: "2026-02-01" },
    { id: "d", cohortId: "c4", amount: 900, releasedTo: "pool", placedOn: "2026-02-01" },
  ];

  it("counts only what is still undecided", () => {
    expect(escrowAtRisk(holds)).toBe(350);
  });

  it("is zero with nothing outstanding", () => {
    expect(escrowAtRisk(holds.filter((h) => h.releasedTo !== null))).toBe(0);
    expect(escrowAtRisk([])).toBe(0);
  });
});

// ── Payment runs ─────────────────────────────────────────────────────────────

describe("nextPayoutRun", () => {
  // 2026-03-02 is a Monday.
  it("finds the next run day", () => {
    expect(nextPayoutRun("2026-03-02")).toBe("2026-03-03"); // Mon → Tue
    expect(nextPayoutRun("2026-03-04")).toBe("2026-03-05"); // Wed → Thu
    expect(nextPayoutRun("2026-03-06")).toBe("2026-03-10"); // Fri → next Tue
  });

  it("uses today when today is a run day and it is still early", () => {
    expect(nextPayoutRun("2026-03-03T09:00:00Z")).toBe("2026-03-03");
  });

  it("rolls past the cut-off to the next run", () => {
    expect(nextPayoutRun("2026-03-03T15:00:00Z")).toBe("2026-03-05");
    expect(nextPayoutRun("2026-03-05T16:30:00Z")).toBe("2026-03-10");
  });

  it("crosses a month and a year boundary", () => {
    expect(nextPayoutRun("2026-03-27")).toBe("2026-03-31"); // Fri → Tue
    expect(nextPayoutRun("2026-12-30")).toBe("2026-12-31"); // Wed → Thu
    expect(nextPayoutRun("2027-01-01")).toBe("2027-01-05"); // Fri → Tue
  });

  it("always lands on a declared run day", () => {
    const start = Date.UTC(2026, 0, 1);
    for (let i = 0; i < 400; i += 1) {
      const day = new Date(start + i * 86_400_000).toISOString().slice(0, 10);
      const run = new Date(`${nextPayoutRun(day)}T00:00:00Z`);
      expect(PAYOUT_RUN_DAYS).toContain(run.getUTCDay());
      expect(run.getTime()).toBeGreaterThanOrEqual(Date.parse(`${day}T00:00:00Z`));
    }
  });
});

// ── Tax ──────────────────────────────────────────────────────────────────────

describe("taxYearOf", () => {
  it("starts the year on 1 March", () => {
    expect(taxYearOf("2026-03-01")).toEqual({
      label: "2026/27",
      start: "2026-03-01",
      end: "2027-02-28",
    });
  });

  it("puts January and February in the year that began the previous March", () => {
    // The single most likely place to get this wrong, and it would file a
    // transaction in the wrong return.
    expect(taxYearOf("2027-01-15").label).toBe("2026/27");
    expect(taxYearOf("2027-02-28").label).toBe("2026/27");
    expect(taxYearOf("2027-03-01").label).toBe("2027/28");
  });

  it("ends on 29 February in a leap year", () => {
    expect(taxYearOf("2027-06-01").end).toBe("2028-02-29");
  });

  it("keeps 28 February for a century that is not a leap year", () => {
    expect(taxYearOf("2099-06-01").end).toBe("2100-02-28");
    expect(taxYearOf("1999-06-01").end).toBe("2000-02-29"); // divisible by 400
  });

  it("handles the last day of February as the year's close", () => {
    expect(taxYearOf("2026-02-28")).toEqual({
      label: "2025/26",
      start: "2025-03-01",
      end: "2026-02-28",
    });
  });
});

describe("summariseTaxYear", () => {
  const movements: TaxableMovement[] = [
    { at: "2026-02-25T10:00:00Z", kind: "stake", amount: -1_000 }, // previous year
    { at: "2026-03-01T10:00:00Z", kind: "stake", amount: -500 },
    { at: "2026-06-10T10:00:00Z", kind: "stake", amount: -300 },
    { at: "2026-06-20T10:00:00Z", kind: "winnings", amount: 900 },
    { at: "2026-06-20T10:00:00Z", kind: "fee", amount: -90 },
    { at: "2027-01-05T10:00:00Z", kind: "winnings", amount: 400 },
    { at: "2027-03-02T10:00:00Z", kind: "winnings", amount: 9_999 }, // next year
  ];

  it("includes only the movements inside the year", () => {
    const s = summariseTaxYear(movements, "2026-08-01");
    expect(s.label).toBe("2026/27");
    expect(s.transactions).toBe(5);
  });

  it("sums by kind regardless of the sign the ledger stored", () => {
    const s = summariseTaxYear(movements, "2026-08-01");
    expect(s.staked).toBe(800);
    expect(s.won).toBe(1_300);
    expect(s.fees).toBe(90);
  });

  it("nets winnings against stakes and fees", () => {
    expect(summariseTaxYear(movements, "2026-08-01").net).toBe(410);
  });

  it("reports a negative net for a losing year rather than clamping to zero", () => {
    const losing: TaxableMovement[] = [
      { at: "2026-04-01T00:00:00Z", kind: "stake", amount: -1_000 },
      { at: "2026-05-01T00:00:00Z", kind: "fee", amount: -50 },
    ];
    expect(summariseTaxYear(losing, "2026-06-01").net).toBe(-1_050);
  });

  it("nets a refund back out of what was staked", () => {
    const refunded: TaxableMovement[] = [
      { at: "2026-04-01T00:00:00Z", kind: "stake", amount: -500 },
      { at: "2026-04-20T00:00:00Z", kind: "refund", amount: 500 },
    ];
    const s = summariseTaxYear(refunded, "2026-06-01");
    expect(s.staked).toBe(0);
    expect(s.net).toBe(0);
  });

  it("returns an honest empty year rather than throwing", () => {
    const s = summariseTaxYear(movements, "2030-06-01");
    expect(s).toMatchObject({ label: "2030/31", staked: 0, won: 0, fees: 0, net: 0 });
    expect(s.transactions).toBe(0);
  });

  it("includes the movements sitting exactly on both boundaries", () => {
    const edges: TaxableMovement[] = [
      { at: "2026-03-01T00:00:00Z", kind: "winnings", amount: 1 },
      { at: "2027-02-28T23:59:59Z", kind: "winnings", amount: 1 },
      { at: "2026-02-28T23:59:59Z", kind: "winnings", amount: 100 },
      { at: "2027-03-01T00:00:00Z", kind: "winnings", amount: 100 },
    ];
    expect(summariseTaxYear(edges, "2026-09-01").won).toBe(2);
  });
});

describe("taxCsv", () => {
  const movements: TaxableMovement[] = [
    { at: "2026-06-20T10:00:00Z", kind: "winnings", amount: 900 },
    { at: "2026-03-01T10:00:00Z", kind: "stake", amount: -500 },
    { at: "2027-03-02T10:00:00Z", kind: "winnings", amount: 9_999 },
  ];

  it("carries the summary and only the year's rows", () => {
    const csv = taxCsv(summariseTaxYear(movements, "2026-08-01"), movements);
    expect(csv).toContain('"Ascend tax summary","2026/27"');
    expect(csv).toContain("2026-06-20");
    expect(csv).not.toContain("9999");
  });

  it("orders rows by date so it reads like a statement", () => {
    const csv = taxCsv(summariseTaxYear(movements, "2026-08-01"), movements);
    const body = csv.slice(csv.indexOf("Date,Type"));
    expect(body.indexOf("2026-03-01")).toBeLessThan(body.indexOf("2026-06-20"));
  });

  it("keeps the sign on each amount, because a stake is money out", () => {
    const csv = taxCsv(summariseTaxYear(movements, "2026-08-01"), movements);
    expect(csv).toContain("-500.00");
    expect(csv).toContain("900.00");
  });

  it("escapes a quote in a field rather than breaking the row", () => {
    const summary = summariseTaxYear([], "2026-08-01");
    const csv = taxCsv({ ...summary, label: 'the "big" year' }, []);
    expect(csv).toContain('the "big" year');
  });
});
