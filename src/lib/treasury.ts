// ─────────────────────────────────────────────────────────────────────────────
// THE TREASURY — the complete money layer.
//
// Deposits, withdrawals, escrow, scheduled payouts, disputes and tax.
//
// ── WHAT CODE CAN AND CANNOT DO ──────────────────────────────────────────────
// Everything here is complete software: state machines, ledgers, RLS, and the
// screens that drive them. What it cannot do is make Ascend a licensed
// deposit-taking institution. Holding customer funds in South Africa engages
// the Banks Act and the FIC Act, and that is an operational licence, not a
// module.
//
// So this layer is built to run in two modes, and the mode is a config flag
// rather than a rewrite:
//
//   custodial: false   the default. A deposit is an INSTRUCTION to pay by EFT
//                      and a withdrawal is an INSTRUCTION to pay out. Ascend
//                      records the intent and reconciles the bank statement.
//                      Legal today, and the whole state machine still runs.
//
//   custodial: true    balances are spendable and settlement is automatic.
//                      Flip this when the licence exists. Nothing else changes.
//
// Building it this way means the licence is the only thing standing between the
// product and full custody — not six months of engineering.
// ─────────────────────────────────────────────────────────────────────────────

// ── The mode switch ──────────────────────────────────────────────────────────

export interface TreasuryMode {
  /** True once a licence exists and Ascend may hold customer funds. */
  custodial: boolean;
  /** Automatic settlement requires custody. Derived, never set independently. */
  readonly automaticSettlement: boolean;
  /** Bank details a person pays INTO. Only meaningful while non-custodial. */
  beneficiary: { accountName: string; bank: string; accountNumber: string; branchCode: string };
}

/**
 * The live mode.
 *
 * Deliberately a constant rather than an environment variable. An env var means
 * a misconfigured deploy can switch Ascend into deposit-taking, which is a
 * criminal-liability question rather than a config question — that belongs in a
 * reviewed commit, not a dashboard toggle.
 */
export const TREASURY: TreasuryMode = {
  custodial: false,
  get automaticSettlement() {
    return this.custodial;
  },
  beneficiary: {
    accountName: "Ascend Technologies (Pty) Ltd",
    bank: "Standard Bank",
    accountNumber: "000000000",
    branchCode: "051001",
  },
};

/**
 * Whether an operation is legal in the current mode.
 *
 * Every money-moving path asks this first. In non-custodial mode the state
 * machines still run end to end — what changes is that `credit` and `settle`
 * describe a bank movement an operator made, rather than one the software made.
 */
export function permits(
  op: "hold_balance" | "auto_settle" | "auto_payout" | "record_intent" | "reconcile",
  mode: TreasuryMode = TREASURY,
): boolean {
  if (op === "record_intent" || op === "reconcile") return true;
  return mode.custodial;
}

export type LedgerBucket =
  | "available"
  | "pending"
  | "locked"
  | "escrow"
  | "processing"
  | "verification_hold"
  | "rewards"
  | "referral"
  | "withdrawable";

export const BUCKET_LABEL: Record<LedgerBucket, string> = {
  available: "Available",
  pending: "Pending",
  locked: "Locked to a challenge",
  escrow: "In escrow",
  processing: "Processing",
  verification_hold: "Held for verification",
  rewards: "Rewards",
  referral: "Referral earnings",
  withdrawable: "Withdrawable",
};

export const BUCKET_BLURB: Record<LedgerBucket, string> = {
  available: "Settled and yours to move.",
  pending: "Sent, not yet reconciled against the bank statement.",
  locked: "Committed to a challenge that is still running.",
  escrow: "Held against an outcome that has not been decided.",
  processing: "A payout instruction is with the bank.",
  verification_hold: "Held while the integrity engine finishes a review.",
  rewards: "Earned from finishing challenges.",
  referral: "Earned from people you brought in.",
  withdrawable: "Cleared and available to withdraw.",
};

export interface Balances {
  available: number;
  pending: number;
  locked: number;
  escrow: number;
  processing: number;
  verificationHold: number;
  rewards: number;
  referral: number;
  withdrawable: number;
}

export const ZERO_BALANCES: Balances = {
  available: 0,
  pending: 0,
  locked: 0,
  escrow: 0,
  processing: 0,
  verificationHold: 0,
  rewards: 0,
  referral: 0,
  withdrawable: 0,
};

/** Everything the person has any claim on, settled or not. */
export function totalHoldings(b: Balances): number {
  return (
    b.available + b.pending + b.locked + b.escrow + b.processing +
    b.verificationHold + b.rewards + b.referral + b.withdrawable
  );
}

// ── Deposits ─────────────────────────────────────────────────────────────────

export type DepositState =
  | "instructed"
  | "awaiting_transfer"
  | "received"
  | "reconciled"
  | "credited"
  | "failed"
  | "refunded";

/**
 * Deposit lifecycle.
 *
 * A whitelist, not a free-for-all: every transition a deposit can make is
 * listed, and anything not listed is a bug rather than an edge case. The same
 * shape as the payout machine, for the same reason — money that can move
 * between arbitrary states is money nobody can audit.
 */
const DEPOSIT_NEXT: Record<DepositState, DepositState[]> = {
  instructed: ["awaiting_transfer", "failed"],
  awaiting_transfer: ["received", "failed"],
  received: ["reconciled", "failed"],
  reconciled: ["credited", "refunded"],
  credited: ["refunded"],
  failed: [],
  refunded: [],
};

export function canDeposit(from: DepositState, to: DepositState): boolean {
  return DEPOSIT_NEXT[from].includes(to);
}

export function depositIsTerminal(s: DepositState): boolean {
  return DEPOSIT_NEXT[s].length === 0;
}

export const DEPOSIT_PRESENTATION: Record<
  DepositState,
  { label: string; blurb: string; progress: number; needsUser: boolean }
> = {
  instructed: {
    label: "Reference issued",
    blurb: "Use the reference exactly as shown — it is how we match your transfer to you.",
    progress: 0.1,
    needsUser: true,
  },
  awaiting_transfer: {
    label: "Waiting for your transfer",
    blurb: "Nothing has arrived yet. EFTs between South African banks usually clear in one working day.",
    progress: 0.3,
    needsUser: true,
  },
  received: {
    label: "Money arrived",
    blurb: "We can see it. Matching it to your account now.",
    progress: 0.6,
    needsUser: false,
  },
  reconciled: {
    label: "Matched to you",
    blurb: "Confirmed against the bank statement.",
    progress: 0.85,
    needsUser: false,
  },
  credited: {
    label: "Credited",
    blurb: "In your wallet.",
    progress: 1,
    needsUser: false,
  },
  failed: {
    label: "Did not go through",
    blurb: "Nothing was taken. If money left your account, contact support with the reference.",
    progress: 1,
    needsUser: true,
  },
  refunded: {
    label: "Refunded",
    blurb: "Returned to the account it came from.",
    progress: 1,
    needsUser: false,
  },
};

// ── The deposit instruction ──────────────────────────────────────────────────

export interface DepositInstruction {
  amount: number;
  reference: string;
  beneficiary: TreasuryMode["beneficiary"];
  /** What the person must actually do. Non-custodial mode has real steps. */
  steps: string[];
  /** Set when the mode means Ascend never touches the money itself. */
  manual: boolean;
}

/**
 * The payment reference.
 *
 * Deterministic from the user id and a per-deposit sequence, so a person who
 * loses the screen can be given the identical reference rather than a second
 * one that splits their payment across two records. Uppercase and unambiguous:
 * banking apps uppercase references anyway, and a reference containing both O
 * and 0 gets mistyped by somebody reading it off a phone.
 */
const REF_ALPHABET = "ABCDEFGHJKMNPQRSTUVWXYZ23456789"; // no I, L, O, 0, 1

export function depositReference(userId: string, sequence: number): string {
  // FNV-1a over the user id: stable, no crypto import, and the value is not a
  // secret — it is printed on a bank statement.
  let hash = 0x811c9dc5;
  for (let i = 0; i < userId.length; i += 1) {
    hash ^= userId.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193) >>> 0;
  }
  let body = "";
  for (let i = 0; i < 5; i += 1) {
    body += REF_ALPHABET[hash % REF_ALPHABET.length];
    hash = Math.floor(hash / REF_ALPHABET.length);
  }
  return `ASC${body}${String(sequence).padStart(2, "0")}`;
}

export function depositInstruction(
  amount: number,
  userId: string,
  sequence: number,
  mode: TreasuryMode = TREASURY,
): DepositInstruction {
  const reference = depositReference(userId, sequence);
  return {
    amount,
    reference,
    beneficiary: mode.beneficiary,
    manual: !mode.custodial,
    steps: mode.custodial
      ? ["Confirm the amount", "Pay with your card or bank", "It lands in your wallet"]
      : [
          `Transfer R${amount} to the account below from your own bank`,
          `Use the reference ${reference} exactly — it is how we know it is you`,
          "We reconcile against the bank statement each working day",
          "Your wallet updates once it is matched",
        ],
  };
}

// ── Withdrawals ──────────────────────────────────────────────────────────────

export type WithdrawalState =
  | "requested"
  | "verification"
  | "approved"
  | "scheduled"
  | "submitted"
  | "paid"
  | "rejected"
  | "cancelled";

const WITHDRAWAL_NEXT: Record<WithdrawalState, WithdrawalState[]> = {
  requested: ["verification", "cancelled"],
  verification: ["approved", "rejected", "cancelled"],
  approved: ["scheduled", "submitted", "cancelled"],
  scheduled: ["submitted", "cancelled"],
  submitted: ["paid", "rejected"],
  paid: [],
  rejected: [],
  cancelled: [],
};

export function canWithdraw(from: WithdrawalState, to: WithdrawalState): boolean {
  return WITHDRAWAL_NEXT[from].includes(to);
}

export function withdrawalIsTerminal(s: WithdrawalState): boolean {
  return WITHDRAWAL_NEXT[s].length === 0;
}

/** A user can pull a withdrawal back until the bank file has gone out. */
export function withdrawalIsCancellable(s: WithdrawalState): boolean {
  return WITHDRAWAL_NEXT[s].includes("cancelled");
}

export const WITHDRAWAL_PRESENTATION: Record<
  WithdrawalState,
  { label: string; blurb: string; progress: number }
> = {
  requested: { label: "Requested", blurb: "In the queue.", progress: 0.1 },
  verification: {
    label: "Verifying",
    blurb: "Checking the account details and the source of the funds. This is the step that protects everyone in the pool.",
    progress: 0.3,
  },
  approved: { label: "Approved", blurb: "Cleared to pay.", progress: 0.5 },
  scheduled: { label: "Scheduled", blurb: "Queued for the next payment run.", progress: 0.65 },
  submitted: { label: "With the bank", blurb: "The instruction has left us.", progress: 0.85 },
  paid: { label: "Paid", blurb: "In your account.", progress: 1 },
  rejected: {
    label: "Rejected",
    blurb: "The funds stayed in your wallet. The reason is on the record below.",
    progress: 1,
  },
  cancelled: { label: "Cancelled", blurb: "You pulled this one back.", progress: 1 },
};

// ── Withdrawal eligibility ───────────────────────────────────────────────────

export interface WithdrawalRules {
  /** Nothing below this, because a bank fee would eat it. */
  minimum: number;
  /** Bank details must be verified first. */
  requiresVerifiedDestination: boolean;
  /** Held days block a withdrawal until review finishes. */
  blocksOnVerificationHold: boolean;
}

export const DEFAULT_WITHDRAWAL_RULES: WithdrawalRules = {
  minimum: 50,
  requiresVerifiedDestination: true,
  blocksOnVerificationHold: true,
};

export interface WithdrawalCheck {
  allowed: boolean;
  /** The largest amount that could be withdrawn right now. */
  ceiling: number;
  reasons: { label: string; met: boolean; detail: string }[];
}

/**
 * Whether a withdrawal can be made, and how much.
 *
 * Returns every rule with its state, met or not — the same principle as the
 * elite gate. Somebody refused a withdrawal of their own money deserves to see
 * exactly which line stopped it, not a generic error.
 */
export function checkWithdrawal(
  amount: number,
  balances: Balances,
  destinationVerified: boolean,
  rules: WithdrawalRules = DEFAULT_WITHDRAWAL_RULES,
): WithdrawalCheck {
  const ceiling = balances.withdrawable;

  const reasons = [
    {
      label: "Enough cleared",
      met: amount <= ceiling && amount > 0,
      detail: `R${Math.round(ceiling)} is cleared and withdrawable. Locked and escrowed money is not.`,
    },
    {
      label: `Minimum R${rules.minimum}`,
      met: amount >= rules.minimum,
      detail: "Below this the bank fee would take most of it.",
    },
    {
      label: "Bank details verified",
      met: !rules.requiresVerifiedDestination || destinationVerified,
      detail: destinationVerified
        ? "Verified."
        : "Add and verify the account you want to be paid into.",
    },
    {
      label: "Nothing under review",
      met: !rules.blocksOnVerificationHold || balances.verificationHold === 0,
      detail:
        balances.verificationHold > 0
          ? `R${Math.round(balances.verificationHold)} is held while a verification review finishes.`
          : "No holds.",
    },
  ];

  return { allowed: reasons.every((r) => r.met), ceiling, reasons };
}

// ── Disputes ─────────────────────────────────────────────────────────────────

export type DisputeState = "open" | "evidence" | "review" | "upheld" | "declined" | "withdrawn";

const DISPUTE_NEXT: Record<DisputeState, DisputeState[]> = {
  open: ["evidence", "withdrawn"],
  evidence: ["review", "withdrawn"],
  review: ["upheld", "declined"],
  upheld: [],
  declined: [],
  withdrawn: [],
};

export function canDispute(from: DisputeState, to: DisputeState): boolean {
  return DISPUTE_NEXT[from].includes(to);
}

export const DISPUTE_PRESENTATION: Record<DisputeState, { label: string; blurb: string }> = {
  open: { label: "Open", blurb: "Logged. Tell us what happened." },
  evidence: { label: "Evidence", blurb: "Add anything that supports your case." },
  review: { label: "Under review", blurb: "A person is looking at it." },
  upheld: { label: "Upheld", blurb: "Decided in your favour. Any adjustment is on your ledger." },
  declined: { label: "Declined", blurb: "The original outcome stands. The reasoning is below." },
  withdrawn: { label: "Withdrawn", blurb: "You closed this one." },
};

/**
 * How long a person has to raise a dispute after a challenge settles.
 *
 * Sixty days, because a bank statement is monthly and somebody may not notice
 * until the one after. A shorter window quietly transfers the cost of the
 * product's own mistakes onto the person who did not check fast enough.
 */
export const DISPUTE_WINDOW_DAYS = 60;

export function disputeWindowOpen(settledOn: string, today: string): boolean {
  const days = Math.round(
    (Date.parse(`${today}T00:00:00Z`) - Date.parse(`${settledOn}T00:00:00Z`)) / 86_400_000,
  );
  return days >= 0 && days <= DISPUTE_WINDOW_DAYS;
}

// ── Escrow ───────────────────────────────────────────────────────────────────

export interface EscrowHold {
  id: string;
  cohortId: string;
  amount: number;
  /** Null until the outcome is decided. */
  releasedTo: "user" | "pool" | null;
  placedOn: string;
}

export interface EscrowSplit {
  /** Back to the person who staked it, because they did the work. */
  toUser: number;
  /** Forfeit into the pool the winners share. */
  toPool: number;
  /** The platform's cut, taken from the pool only — never from a winner's own stake. */
  fee: number;
}

/**
 * How an escrowed stake resolves.
 *
 * The fee comes out of the FORFEIT pool, never out of a person's own returned
 * stake. Somebody who hit their target and gets their own money back should get
 * all of it — charging a fee on the return of your own money is the mechanic
 * that makes people feel cheated by an app that was technically correct.
 */
export function settleEscrow(
  amount: number,
  hitTarget: boolean,
  feeRate: number,
): EscrowSplit {
  if (hitTarget) return { toUser: round2(amount), toPool: 0, fee: 0 };
  const fee = round2(amount * feeRate);
  return { toUser: 0, toPool: round2(amount - fee), fee };
}

function round2(v: number): number {
  return Math.round(v * 100) / 100;
}

export type CohortOutcome = "completed" | "cancelled";

/**
 * How an escrowed stake resolves given what happened to the challenge itself.
 *
 * A CANCELLED challenge forfeits nothing and charges nothing, whatever the
 * person's progress was. Treating a cancellation like a miss would take money
 * for a target they were never given the chance to hit — and it would hand the
 * platform a financial reason to cancel challenges, which is exactly the
 * incentive a staking product must not have.
 *
 * Lives here rather than in the settlement job so the rule is testable without
 * a database, and so it cannot be quietly changed in a job nobody reads.
 */
export function settleForCohort(
  amount: number,
  status: CohortOutcome,
  hitTarget: boolean,
  feeRate: number,
): EscrowSplit {
  if (status === "cancelled") return settleEscrow(amount, true, 0);
  return settleEscrow(amount, hitTarget, feeRate);
}

/**
 * Total escrow a person has at risk right now.
 *
 * Undecided holds only. A released hold is history and belongs on the ledger,
 * not in the figure that says how exposed you are today.
 */
export function escrowAtRisk(holds: EscrowHold[]): number {
  return round2(
    holds.filter((h) => h.releasedTo === null).reduce((t, h) => t + h.amount, 0),
  );
}

// ── Payment runs ─────────────────────────────────────────────────────────────

/**
 * Payouts go out on Tuesdays and Thursdays.
 *
 * A fixed schedule beats "3–5 working days" because it is checkable: a person
 * can see the exact date their money is due and hold the product to it. Vague
 * ranges exist to protect the operator, not the person waiting.
 */
export const PAYOUT_RUN_DAYS = [2, 4]; // Tuesday, Thursday (UTC day-of-week)

/** Cut-off: an approval after 15:00 on a run day waits for the next one. */
export const PAYOUT_CUTOFF_HOUR = 15;

export function nextPayoutRun(from: string): string {
  const d = new Date(from.length > 10 ? from : `${from}T00:00:00Z`);
  const late = from.length > 10 && d.getUTCHours() >= PAYOUT_CUTOFF_HOUR;
  const cursor = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
  if (late) cursor.setUTCDate(cursor.getUTCDate() + 1);
  for (let i = 0; i < 8; i += 1) {
    if (PAYOUT_RUN_DAYS.includes(cursor.getUTCDay())) return cursor.toISOString().slice(0, 10);
    cursor.setUTCDate(cursor.getUTCDate() + 1);
  }
  /* c8 ignore next -- unreachable: two run days inside any 8-day window */
  return cursor.toISOString().slice(0, 10);
}

// ── Tax ──────────────────────────────────────────────────────────────────────

export interface TaxYearSummary {
  /** SA tax year label, e.g. "2026/27". */
  label: string;
  start: string;
  end: string;
  staked: number;
  won: number;
  fees: number;
  /** Winnings less stakes and fees. Negative means a loss for the year. */
  net: number;
  transactions: number;
}

/**
 * The South African tax year runs 1 March to 28/29 February.
 *
 * Getting this wrong by using a calendar year would put transactions in the
 * wrong return, which is a worse failure than not offering the export at all.
 */
export function taxYearOf(date: string): { label: string; start: string; end: string } {
  const d = new Date(`${date}T00:00:00Z`);
  const year = d.getUTCFullYear();
  const month = d.getUTCMonth(); // 0 = January
  // Jan and Feb belong to the tax year that started the previous March.
  const startYear = month >= 2 ? year : year - 1;
  const endYear = startYear + 1;
  return {
    label: `${startYear}/${String(endYear).slice(2)}`,
    start: `${startYear}-03-01`,
    end: `${endYear}-02-${isLeap(endYear) ? 29 : 28}`,
  };
}

function isLeap(y: number): boolean {
  return (y % 4 === 0 && y % 100 !== 0) || y % 400 === 0;
}

export interface TaxableMovement {
  at: string;
  kind: "stake" | "winnings" | "fee" | "refund";
  amount: number;
}

export function summariseTaxYear(movements: TaxableMovement[], anyDateInYear: string): TaxYearSummary {
  const { label, start, end } = taxYearOf(anyDateInYear);
  const inYear = movements.filter((m) => {
    const d = m.at.slice(0, 10);
    return d >= start && d <= end;
  });

  const sum = (kind: TaxableMovement["kind"]) =>
    inYear.filter((m) => m.kind === kind).reduce((t, m) => t + Math.abs(m.amount), 0);

  const staked = sum("stake") - sum("refund");
  const won = sum("winnings");
  const fees = sum("fee");

  return {
    label,
    start,
    end,
    staked,
    won,
    fees,
    net: Math.round((won - staked - fees) * 100) / 100,
    transactions: inYear.length,
  };
}

/** A statement a person can hand to an accountant or upload to eFiling. */
export function taxCsv(summary: TaxYearSummary, movements: TaxableMovement[]): string {
  const esc = (v: string) => `"${v.replace(/"/g, '""')}"`;
  const inYear = movements.filter((m) => {
    const d = m.at.slice(0, 10);
    return d >= summary.start && d <= summary.end;
  });

  const head = ["Date", "Type", "Amount (ZAR)"];
  const rows = inYear
    .sort((a, b) => a.at.localeCompare(b.at))
    .map((m) => [esc(m.at.slice(0, 10)), esc(m.kind), m.amount.toFixed(2)]);

  return [
    `"Ascend tax summary","${summary.label}"`,
    `"Period","${summary.start} to ${summary.end}"`,
    `"Total staked","${summary.staked.toFixed(2)}"`,
    `"Total winnings","${summary.won.toFixed(2)}"`,
    `"Platform fees","${summary.fees.toFixed(2)}"`,
    `"Net","${summary.net.toFixed(2)}"`,
    "",
    head.join(","),
    ...rows.map((r) => r.join(",")),
  ].join("\n");
}
