import { AppShell, Header } from "@/components/ui";
import { DashSection } from "@/components/dash";
import {
  BucketGrid,
  DepositCard,
  DisputeCard,
  EligibilityPanel,
  WithdrawalCard,
  longDate,
} from "@/components/treasury-ui";
import {
  DEPOSIT_PRESENTATION,
  DISPUTE_PRESENTATION,
  WITHDRAWAL_PRESENTATION,
  ZERO_BALANCES,
  checkWithdrawal,
  depositReference,
  nextPayoutRun,
  withdrawalIsCancellable,
  withdrawalIsTerminal,
  depositIsTerminal,
  type Balances,
  type DepositState,
  type DisputeState,
  type WithdrawalState,
} from "@/lib/treasury";
import type { DepositRow, DisputeRow, WithdrawalRow } from "@/lib/treasuryAccount";
import { zar } from "@/lib/format";

/**
 * Treasury, rendered against fixtures.
 *
 * Every previous design pass found something in a screenshot that no amount of
 * reading the source revealed — a light-mode default, gold on the wrong button,
 * an event listed twice. Money screens are the ones where that matters most, so
 * they get the same treatment before anyone sees them.
 */

const deposit = (amount: number, state: DepositState, seq: number): DepositRow => {
  const p = DEPOSIT_PRESENTATION[state];
  return {
    id: `d-${seq}`,
    amount,
    state,
    reference: depositReference("preview-user", seq),
    label: p.label,
    blurb: p.blurb,
    progress: p.progress,
    needsUser: p.needsUser,
    terminal: depositIsTerminal(state),
    failureReason: state === "failed" ? "Your bank returned the transfer as unpaid." : null,
    createdAt: "2026-07-28T08:00:00Z",
  };
};

const withdrawal = (
  amount: number,
  state: WithdrawalState,
  extra: Partial<WithdrawalRow> = {},
): WithdrawalRow => {
  const p = WITHDRAWAL_PRESENTATION[state];
  return {
    id: `w-${state}`,
    amount,
    amountPaid: state === "paid" ? amount : null,
    state,
    label: p.label,
    blurb: p.blurb,
    progress: p.progress,
    cancellable: withdrawalIsCancellable(state),
    terminal: withdrawalIsTerminal(state),
    scheduledFor: "2026-08-06",
    decisionReason: null,
    requestedAt: "2026-08-01T09:30:00Z",
    ...extra,
  };
};

const dispute = (state: DisputeState, extra: Partial<DisputeRow> = {}): DisputeRow => {
  const p = DISPUTE_PRESENTATION[state];
  return {
    id: `x-${state}`,
    state,
    label: p.label,
    blurb: p.blurb,
    category: "verification_rejected",
    summary: "I logged 12,400 steps on the 14th from my watch and it wasn't counted.",
    resolution: state === "upheld" ? "Recounted. R250 is back on your ledger." : null,
    openedAt: "2026-07-20T11:00:00Z",
    messages: [{ author: "user", body: "Screenshot from Google Fit attached.", at: "2026-07-20T11:05:00Z" }],
    ...extra,
  };
};

const BALANCES: Balances = {
  available: 0,
  pending: 1_250,
  locked: 350,
  escrow: 350,
  processing: 300,
  verificationHold: 0,
  rewards: 940,
  referral: 0,
  withdrawable: 940,
};

export function TreasuryPreview({ variant }: { variant: "full" | "blocked" | "empty" }) {
  const balances =
    variant === "empty"
      ? ZERO_BALANCES
      : variant === "blocked"
        ? { ...BALANCES, verificationHold: 300, withdrawable: 640 }
        : BALANCES;

  const check = checkWithdrawal(
    Math.max(balances.withdrawable, 1),
    balances,
    variant === "full",
  );
  const nextRun = nextPayoutRun("2026-08-04");

  return (
    <AppShell>
      <Header
        title="Treasury"
        back="/commit"
        subtitle="Where is my money?"
      />

      <DashSection title="Where every rand sits">
        <BucketGrid balances={balances} />
        {balances.escrow > 0 && (
          <p className="mt-3 text-meta text-sage">
            {zar(balances.escrow)} is escrowed against 2 undecided challenges. Hit the target and
            all of it comes back to you — the fee only ever comes out of a forfeit, never out of
            your own returned stake.
          </p>
        )}
      </DashSection>

      {/* No DashSection wrapper: the panel carries its own heading, and the
          preview showed "Withdrawal checks" twice when it had one. */}
      <div className="mb-7">
        <EligibilityPanel check={check} amount={balances.withdrawable + 500} />
      </div>

      {variant !== "empty" && (
        <>
          <DashSection title="Payments in">
            <ul>
              <DepositCard d={deposit(400, "awaiting_transfer", 1)} />
              <DepositCard d={deposit(750, "reconciled", 2)} />
              <DepositCard d={deposit(100, "credited", 3)} />
              <DepositCard d={deposit(200, "failed", 4)} />
            </ul>
          </DashSection>

          <DashSection title="Payments out">
            <ul>
              <WithdrawalCard w={withdrawal(300, "scheduled")} />
              <WithdrawalCard w={withdrawal(500, "submitted")} />
              <WithdrawalCard w={withdrawal(640, "paid", { amountPaid: 630 })} />
              <WithdrawalCard
                w={withdrawal(900, "rejected", {
                  decisionReason:
                    "The account name did not match the name on your Ascend profile. Nothing left your wallet.",
                })}
              />
            </ul>
          </DashSection>

          <DashSection title="Disputes">
            <ul>
              <DisputeCard d={dispute("review")} />
              <DisputeCard d={dispute("upheld")} />
            </ul>
          </DashSection>
        </>
      )}

      <p className="text-meta text-sage/80">
        Payment runs leave every Tuesday and Thursday — the next one is {longDate(nextRun)}.
      </p>
    </AppShell>
  );
}
