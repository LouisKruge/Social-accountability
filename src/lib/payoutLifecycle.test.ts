import { describe, expect, it } from "vitest";
import {
  HAPPY_PATH,
  PRESENTATION,
  TERMINAL,
  TRANSITIONS,
  addBusinessDays,
  canTransition,
  expectedArrival,
  isOutstanding,
  trackerSteps,
  transition,
  type PayoutState,
} from "./payoutLifecycle";

const ALL = Object.keys(TRANSITIONS) as PayoutState[];

describe("the state machine's shape", () => {
  it("every state it can reach is a state it knows about", () => {
    for (const from of ALL) {
      for (const to of TRANSITIONS[from]) {
        expect(ALL).toContain(to);
      }
    }
  });

  it("no state can transition to itself", () => {
    for (const from of ALL) {
      expect(TRANSITIONS[from]).not.toContain(from);
    }
  });

  it("terminal states are dead ends", () => {
    for (const t of TERMINAL) {
      expect(TRANSITIONS[t]).toEqual([]);
    }
  });

  it("every non-terminal state can still reach paid or cancelled", () => {
    // A payout must never be able to get stuck somewhere with no way out.
    for (const start of ALL) {
      if (TERMINAL.includes(start)) continue;
      const seen = new Set<PayoutState>([start]);
      const queue = [start];
      let escapes = false;
      while (queue.length) {
        const s = queue.shift()!;
        if (TERMINAL.includes(s)) {
          escapes = true;
          break;
        }
        for (const next of TRANSITIONS[s]) {
          if (!seen.has(next)) {
            seen.add(next);
            queue.push(next);
          }
        }
      }
      expect(escapes, `${start} cannot reach a terminal state`).toBe(true);
    }
  });

  it("every state has something to show the user", () => {
    for (const s of ALL) {
      expect(PRESENTATION[s].label.length).toBeGreaterThan(0);
      expect(PRESENTATION[s].blurb.length).toBeGreaterThan(0);
      expect(PRESENTATION[s].progress).toBeGreaterThanOrEqual(0);
      expect(PRESENTATION[s].progress).toBeLessThanOrEqual(1);
    }
  });

  it("speaks to the user about their money, not about our internals", () => {
    for (const s of ALL) {
      expect(PRESENTATION[s].blurb).not.toMatch(/null|undefined|_id|SQL|row|record/i);
    }
  });
});

describe("money that has landed cannot be un-landed", () => {
  it("refuses every transition out of paid", () => {
    for (const to of ALL) {
      expect(canTransition("paid", to)).toBe(false);
    }
  });

  it("says so plainly rather than failing silently", () => {
    const r = transition("paid", "failed", "a bug tried this", "system");
    expect(r.ok).toBe(false);
    expect(r.error).toMatch(/final/);
  });

  it("refuses every transition out of cancelled", () => {
    for (const to of ALL) {
      expect(canTransition("cancelled", to)).toBe(false);
    }
  });
});

describe("the happy path", () => {
  it("runs end to end", () => {
    for (let i = 0; i < HAPPY_PATH.length - 1; i += 1) {
      const r = transition(HAPPY_PATH[i], HAPPY_PATH[i + 1], "next step");
      expect(r.ok, `${HAPPY_PATH[i]} → ${HAPPY_PATH[i + 1]}`).toBe(true);
    }
  });

  it("cannot skip verification and go straight to paid", () => {
    expect(canTransition("pending_verification", "paid")).toBe(false);
    expect(canTransition("verified", "paid")).toBe(false);
    expect(canTransition("queued", "paid")).toBe(false);
    // Only an actually-submitted transfer can be marked paid.
    expect(canTransition("processing", "paid")).toBe(true);
  });

  it("cannot skip from queued straight to processing without being scheduled", () => {
    expect(canTransition("queued", "processing")).toBe(false);
  });
});

describe("transition guards", () => {
  it("requires a reason", () => {
    expect(transition("verified", "queued", "").ok).toBe(false);
    expect(transition("verified", "queued", "   ").ok).toBe(false);
    expect(transition("verified", "queued", "bank details on file").ok).toBe(true);
  });

  it("rejects a no-op", () => {
    const r = transition("queued", "queued", "nothing changed");
    expect(r.ok).toBe(false);
    expect(r.error).toMatch(/Already/);
  });

  it("will not let the system clear its own fraud hold", () => {
    expect(transition("fraud_review", "verified", "looks fine now", "system").ok).toBe(false);
    expect(transition("fraud_review", "verified", "reviewed the logs", "operator").ok).toBe(true);
  });

  it("carries the actor through so the audit trail names who did it", () => {
    const r = transition("verified", "queued", "cleared", "operator");
    expect(r.actor).toBe("operator");
    expect(r.reason).toBe("cleared");
  });
});

describe("recovery paths", () => {
  it("a failed transfer goes back in the queue rather than dying", () => {
    expect(canTransition("failed", "queued")).toBe(true);
  });

  it("a returned payment routes to a human, because details are probably wrong", () => {
    expect(canTransition("returned", "manual_review")).toBe(true);
    expect(PRESENTATION.returned.needsUser).toBe(true);
  });

  it("anything still moving counts as money outstanding", () => {
    expect(isOutstanding("queued")).toBe(true);
    expect(isOutstanding("fraud_review")).toBe(true);
    expect(isOutstanding("paid")).toBe(false);
    expect(isOutstanding("cancelled")).toBe(false);
  });
});

describe("expectedArrival", () => {
  it("gives a date on the happy path", () => {
    expect(expectedArrival("queued", "2026-08-31T00:00:00Z")).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });

  it("gets nearer as the payout progresses", () => {
    const settled = "2026-08-31T00:00:00Z";
    const q = expectedArrival("queued", settled)!;
    const s = expectedArrival("scheduled", settled)!;
    const p = expectedArrival("processing", settled)!;
    expect(Date.parse(s)).toBeLessThan(Date.parse(q));
    expect(Date.parse(p)).toBeLessThan(Date.parse(s));
  });

  it("refuses to invent a date for something under review", () => {
    // A made-up date on a held payout is worse than none: the user plans
    // around it, it slips, and they stop believing anything on the page.
    expect(expectedArrival("fraud_review", "2026-08-31T00:00:00Z")).toBeNull();
    expect(expectedArrival("manual_review", "2026-08-31T00:00:00Z")).toBeNull();
    expect(expectedArrival("returned", "2026-08-31T00:00:00Z")).toBeNull();
  });

  it("gives no date for a payout that has already resolved", () => {
    expect(expectedArrival("paid", "2026-08-31T00:00:00Z")).toBeNull();
    expect(expectedArrival("cancelled", "2026-08-31T00:00:00Z")).toBeNull();
  });
});

describe("addBusinessDays", () => {
  it("skips the weekend", () => {
    // 2026-08-28 is a Friday.
    expect(addBusinessDays("2026-08-28T00:00:00Z", 1)).toBe("2026-08-31");
    expect(addBusinessDays("2026-08-28T00:00:00Z", 3)).toBe("2026-09-02");
  });

  it("never lands on a Saturday or Sunday", () => {
    for (let n = 1; n <= 20; n += 1) {
      const iso = addBusinessDays("2026-08-28T00:00:00Z", n);
      const dow = new Date(`${iso}T00:00:00Z`).getUTCDay();
      expect(dow).not.toBe(0);
      expect(dow).not.toBe(6);
    }
  });
});

describe("trackerSteps", () => {
  it("marks everything before the current step done", () => {
    const steps = trackerSteps("scheduled");
    expect(steps.find((s) => s.state === "verified")!.done).toBe(true);
    expect(steps.find((s) => s.state === "scheduled")!.active).toBe(true);
    expect(steps.find((s) => s.state === "paid")!.done).toBe(false);
  });

  it("shows everything done once paid", () => {
    const steps = trackerSteps("paid");
    expect(steps.filter((s) => s.done)).toHaveLength(HAPPY_PATH.length - 1);
    expect(steps[steps.length - 1].active).toBe(true);
  });

  it("does not pretend an off-path payout is still progressing", () => {
    const steps = trackerSteps("fraud_review");
    const last = steps[steps.length - 1];
    expect(last.state).toBe("fraud_review");
    expect(last.active).toBe(true);
    // It must not claim the later happy-path steps were reached.
    expect(steps.some((s) => s.state === "processing")).toBe(false);
    expect(steps.some((s) => s.state === "paid")).toBe(false);
  });

  it("shows a failed transfer as having got most of the way", () => {
    const steps = trackerSteps("failed");
    expect(steps.filter((s) => s.done).length).toBeGreaterThan(1);
    expect(steps[steps.length - 1].state).toBe("failed");
  });
});
