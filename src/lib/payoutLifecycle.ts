// ─────────────────────────────────────────────────────────────────────────────
// PAYOUT LIFECYCLE
//
// "Where is my money" must have one true answer at every moment, and the answer
// must be reachable without asking a human. This module is the state machine
// that produces it.
//
// DESIGN NOTES
//
//  · TRANSITIONS ARE A WHITELIST. Anything not explicitly allowed is rejected.
//    A payout that could jump from `pending_verification` straight to `paid`
//    because a code path forgot a step is how money leaves without being
//    checked.
//
//  · PAID IS TERMINAL AND ONE-WAY. There is no transition out of `paid`. Money
//    that has landed cannot be un-landed by a state change; a reversal is a new
//    ledger entry, not an edit to history.
//
//  · NO TRANSITION MOVES MONEY. This module records where a payout IS. The act
//    of paying is a human doing an EFT, because Ascend holds no funds and is
//    not licensed to move them automatically. `processing` means "an operator
//    has submitted it", not "an API call fired".
//
//  · EVERY TRANSITION CARRIES A REASON. It is written to be shown to the person
//    waiting for the money.
// ─────────────────────────────────────────────────────────────────────────────

export type PayoutState =
  | "pending_verification"
  | "verified"
  | "manual_review"
  | "fraud_review"
  | "queued"
  | "scheduled"
  | "processing"
  | "paid"
  | "failed"
  | "returned"
  | "cancelled";

export type Actor = "system" | "operator" | "user";

/**
 * The whitelist. Read it as: from THIS state, these are the only places a
 * payout may go next.
 */
export const TRANSITIONS: Record<PayoutState, PayoutState[]> = {
  // The cohort has settled; the effort behind the win is still being checked.
  pending_verification: ["verified", "manual_review", "fraud_review", "cancelled"],
  // Effort confirmed, amount final. Still needs somewhere to send it.
  verified: ["queued", "manual_review", "fraud_review", "cancelled"],
  // A human is looking, for a reason that is not integrity (bank details, a
  // disputed cohort, an operator's own flag).
  manual_review: ["verified", "queued", "fraud_review", "cancelled"],
  // An integrity flag is blocking it. Only ever cleared by a human.
  fraud_review: ["verified", "cancelled"],
  // Cleared to pay, waiting for the next payment run.
  queued: ["scheduled", "manual_review", "fraud_review", "cancelled"],
  // In a specific run, with a date.
  scheduled: ["processing", "queued", "manual_review", "cancelled"],
  // An operator has submitted the transfer.
  processing: ["paid", "failed", "returned"],
  // Terminal. Money confirmed received.
  paid: [],
  // The transfer did not complete. Recoverable — it goes back in the queue.
  failed: ["queued", "manual_review", "cancelled"],
  // The bank sent it back, usually wrong details. Needs the user.
  returned: ["manual_review", "queued", "cancelled"],
  // Terminal.
  cancelled: [],
};

export const TERMINAL: PayoutState[] = ["paid", "cancelled"];

/** Does this state mean the user still has money coming? */
export function isOutstanding(state: PayoutState): boolean {
  return !TERMINAL.includes(state);
}

export function canTransition(from: PayoutState, to: PayoutState): boolean {
  return TRANSITIONS[from]?.includes(to) ?? false;
}

export interface TransitionResult {
  ok: boolean;
  from: PayoutState;
  to: PayoutState;
  reason: string;
  actor: Actor;
  error?: string;
}

/**
 * Attempt a transition.
 *
 * `reason` is mandatory and non-empty by design: a state change on somebody's
 * money without a stated cause is not an audit trail, it is a rumour.
 */
export function transition(
  from: PayoutState,
  to: PayoutState,
  reason: string,
  actor: Actor = "system",
): TransitionResult {
  const base = { from, to, reason, actor };

  if (!reason.trim()) {
    return { ...base, ok: false, error: "A transition must state its reason." };
  }
  if (from === to) {
    return { ...base, ok: false, error: `Already ${from}.` };
  }
  if (TERMINAL.includes(from)) {
    return { ...base, ok: false, error: `${from} is final and cannot be changed.` };
  }
  if (!canTransition(from, to)) {
    return { ...base, ok: false, error: `Cannot go from ${from} to ${to}.` };
  }
  // Clearing an integrity hold is a human judgement, always.
  if (from === "fraud_review" && actor === "system") {
    return { ...base, ok: false, error: "Only an operator can clear a fraud review." };
  }
  return { ...base, ok: true };
}

// ── What the person waiting sees ─────────────────────────────────────────────

export interface StatePresentation {
  label: string;
  /** One sentence, addressed to the user, explaining where their money is. */
  blurb: string;
  tone: "neutral" | "progress" | "good" | "warn" | "bad";
  /** Roughly how far along, for the tracker. 0–1. */
  progress: number;
  /** True when the user has to do something before it can move. */
  needsUser: boolean;
}

export const PRESENTATION: Record<PayoutState, StatePresentation> = {
  pending_verification: {
    label: "Checking your days",
    blurb: "The challenge has closed and we're confirming the days you logged.",
    tone: "progress",
    progress: 0.15,
    needsUser: false,
  },
  verified: {
    label: "Verified",
    blurb: "Your days are confirmed and the amount is final.",
    tone: "progress",
    progress: 0.35,
    needsUser: false,
  },
  manual_review: {
    label: "With our team",
    blurb: "Someone here is checking this one by hand before it's paid.",
    tone: "warn",
    progress: 0.3,
    needsUser: false,
  },
  fraud_review: {
    label: "Under review",
    blurb: "Some activity on this challenge was flagged for checking. We'll come back to you.",
    tone: "warn",
    progress: 0.3,
    needsUser: false,
  },
  queued: {
    label: "Queued for payment",
    blurb: "You're in the queue for the next payment run.",
    tone: "progress",
    progress: 0.55,
    needsUser: false,
  },
  scheduled: {
    label: "Scheduled",
    blurb: "Booked into a payment run.",
    tone: "progress",
    progress: 0.75,
    needsUser: false,
  },
  processing: {
    label: "On its way",
    blurb: "The transfer has been sent to your bank.",
    tone: "progress",
    progress: 0.9,
    needsUser: false,
  },
  paid: {
    label: "Paid",
    blurb: "This landed in your account.",
    tone: "good",
    progress: 1,
    needsUser: false,
  },
  failed: {
    label: "Transfer failed",
    blurb: "The payment didn't go through. We'll retry it — no action needed unless we ask.",
    tone: "bad",
    progress: 0.55,
    needsUser: false,
  },
  returned: {
    label: "Returned by your bank",
    blurb: "Your bank sent this back. Check your account details and we'll send it again.",
    tone: "bad",
    progress: 0.4,
    needsUser: true,
  },
  cancelled: {
    label: "Cancelled",
    blurb: "This payout was cancelled.",
    tone: "neutral",
    progress: 0,
    needsUser: false,
  },
};

/**
 * A truthful expected-arrival date, or null.
 *
 * Null is a real answer and the UI must be able to say "we can't say yet". A
 * fabricated date on a payout under review is worse than no date, because the
 * user plans around it and then loses trust when it slips.
 */
export function expectedArrival(
  state: PayoutState,
  /** When the cohort settled. */
  settledAt: string,
  /** Business days a run takes end to end. */
  runDays = 3,
): string | null {
  if (state === "paid" || state === "cancelled") return null;
  if (state === "fraud_review" || state === "manual_review" || state === "returned") return null;

  const offsets: Partial<Record<PayoutState, number>> = {
    pending_verification: runDays + 2,
    verified: runDays + 1,
    queued: runDays,
    scheduled: 2,
    processing: 1,
    failed: runDays + 2,
  };
  const days = offsets[state];
  if (days === undefined) return null;

  return addBusinessDays(settledAt, days);
}

/** Banks do not settle at weekends, so neither does an honest estimate. */
export function addBusinessDays(from: string, days: number): string {
  const d = new Date(from);
  let added = 0;
  while (added < days) {
    d.setUTCDate(d.getUTCDate() + 1);
    const dow = d.getUTCDay();
    if (dow !== 0 && dow !== 6) added += 1;
  }
  return d.toISOString().slice(0, 10);
}

/**
 * The full ordered tracker shown in the UI, with the current position marked.
 * Unhappy states are not on the happy path, so they replace the tail rather
 * than pretending progress continued.
 */
export const HAPPY_PATH: PayoutState[] = [
  "pending_verification",
  "verified",
  "queued",
  "scheduled",
  "processing",
  "paid",
];

export function trackerSteps(
  current: PayoutState,
): { state: PayoutState; label: string; done: boolean; active: boolean }[] {
  const offPath = !HAPPY_PATH.includes(current);
  const idx = HAPPY_PATH.indexOf(current);

  const steps = HAPPY_PATH.map((s, i) => ({
    state: s,
    label: PRESENTATION[s].label,
    done: !offPath && i < idx,
    active: !offPath && i === idx,
  }));

  if (offPath) {
    // Show how far it genuinely got, then the state it is actually in.
    const reached = Math.floor(PRESENTATION[current].progress * HAPPY_PATH.length);
    return [
      ...steps.slice(0, reached).map((s) => ({ ...s, done: true })),
      {
        state: current,
        label: PRESENTATION[current].label,
        done: false,
        active: true,
      },
    ];
  }
  return steps;
}
