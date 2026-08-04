import Link from "next/link";
import { cancelWithdrawalForm } from "@/app/commit/wallet/actions";
import { zar } from "@/lib/format";
import { BUCKET_BLURB, BUCKET_LABEL, type LedgerBucket } from "@/lib/treasury";
import type {
  DepositRow,
  DisputeRow,
  TreasuryAccount,
  WithdrawalRow,
} from "@/lib/treasuryAccount";

/**
 * THE TREASURY SURFACE.
 *
 * ── THE ONE RULE THIS FILE ENFORCES ──────────────────────────────────────────
 * Gold is money confirmed as yours. Nothing pending, escrowed, locked or under
 * review is ever gold, no matter how much better the screen would look — a
 * person scanning their own balance reads colour before they read words, and
 * making unsettled money look settled is the single most expensive lie a
 * finance screen can tell.
 *
 * So: `withdrawable` and `available` are gold. Every other bucket is snow or
 * sage, and each one says in plain words why it is not spendable yet.
 */

const GOLD_BUCKETS: LedgerBucket[] = ["available", "withdrawable"];

export function BucketGrid({ balances }: { balances: TreasuryAccount["balances"] }) {
  const rows = ([
    { key: "withdrawable", value: balances.withdrawable },
    { key: "available", value: balances.available },
    { key: "locked", value: balances.locked },
    { key: "escrow", value: balances.escrow },
    { key: "pending", value: balances.pending },
    { key: "processing", value: balances.processing },
    { key: "verification_hold", value: balances.verificationHold },
    { key: "rewards", value: balances.rewards },
    { key: "referral", value: balances.referral },
  ] satisfies { key: LedgerBucket; value: number }[]).filter(
    // The top two always show, even at zero: "R0 withdrawable" is an answer,
    // and a missing tile reads as a bug rather than as an empty bucket.
    (r, i) => r.value > 0 || i < 2,
  );

  return (
    <dl className="grid grid-cols-2 gap-2">
      {rows.map(({ key, value }) => {
        const gold = GOLD_BUCKETS.includes(key) && value > 0;
        return (
          <div
            key={key}
            className="rounded-field bg-ridge px-3.5 py-3 ring-1 ring-scree"
          >
            <dt className="text-micro uppercase text-sage">{BUCKET_LABEL[key]}</dt>
            <dd
              className={`tnum mt-1 font-display text-lg font-semibold ${
                gold ? "text-summit" : "text-snow"
              }`}
            >
              {zar(value)}
            </dd>
            <p className="mt-1 text-micro leading-snug text-sage/80">{BUCKET_BLURB[key]}</p>
          </div>
        );
      })}
    </dl>
  );
}

/**
 * The eligibility gate, shown in full whether or not it passes.
 *
 * Same principle as the elite challenge gate: every rule, with its own state
 * and its own numbers. Somebody refused access to their own money is owed the
 * specific line that stopped it — a generic "you cannot withdraw right now" is
 * how a product turns a solvable problem into a support ticket.
 */
export function EligibilityPanel({
  check,
  amount,
}: {
  check: TreasuryAccount["eligibility"];
  amount?: number;
}) {
  return (
    <div className="rounded-field bg-ridge px-4 py-4 ring-1 ring-scree">
      <div className="flex items-baseline justify-between gap-3">
        <p className="text-micro uppercase text-sage">Withdrawal checks</p>
        <span className={`text-caption ${check.allowed ? "text-snow" : "text-sage"}`}>
          {check.allowed ? "All clear" : `${check.reasons.filter((r) => !r.met).length} to go`}
        </span>
      </div>
      <ul className="mt-3 space-y-3">
        {check.reasons.map((r) => (
          <li key={r.label} className="flex gap-3">
            {/*
              Snow, not gold. A passed check is not money — it is a passed
              check. Gold on these dots was only visible in a screenshot, and
              it quietly turned the money colour into "this bit is fine",
              which is how an accent stops meaning anything at all.
            */}
            <span
              aria-hidden
              className={`mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full ${
                r.met ? "bg-snow" : "bg-scree"
              }`}
            />
            <div className="min-w-0">
              <p className={`text-body ${r.met ? "text-snow" : "text-sage"}`}>
                {r.label}
                <span className="sr-only">{r.met ? " — met" : " — not met"}</span>
              </p>
              <p className="mt-0.5 text-caption text-sage/80">{r.detail}</p>
            </div>
          </li>
        ))}
      </ul>
      {amount !== undefined && amount > check.ceiling && (
        <p className="mt-3 border-t border-scree/60 pt-3 text-caption text-sage">
          The most you can withdraw today is {zar(check.ceiling)}.
        </p>
      )}
    </div>
  );
}

/** A progress rail. Never gold: a deposit in flight is not money yet. */
function Rail({ progress, done }: { progress: number; done?: boolean }) {
  return (
    <div aria-hidden className="mt-2.5 h-px w-full bg-scree">
      <div
        className={`h-px transition-[width] duration-500 ease-ascend ${
          done ? "bg-summit" : "bg-snow/60"
        }`}
        style={{ width: `${Math.round(progress * 100)}%` }}
      />
    </div>
  );
}

export function DepositCard({ d }: { d: DepositRow }) {
  return (
    <li className="border-b border-scree/40 py-4 last:border-0">
      <div className="flex items-baseline justify-between gap-3">
        <span className="tnum font-display text-lg font-semibold text-snow">{zar(d.amount)}</span>
        <span className={`shrink-0 text-caption ${d.state === "credited" ? "text-summit" : "text-sage"}`}>
          {d.label}
        </span>
      </div>
      <p className="mt-1 text-caption text-sage">{d.blurb}</p>
      {!d.terminal && <Rail progress={d.progress} done={d.state === "credited"} />}
      {/*
        The reference shows on a FAILED deposit too. It used to be hidden there,
        while the copy on that exact card said "contact support with the
        reference" — so the one state where somebody most needs the number was
        the one state that withheld it.
      */}
      {d.needsUser && (
        <p className="mt-2.5 text-caption text-snow">
          Reference <span className="tnum font-semibold tracking-wide">{d.reference}</span>
        </p>
      )}
      {d.failureReason && <p className="mt-2 text-caption text-fall">{d.failureReason}</p>}
    </li>
  );
}

export function WithdrawalCard({ w }: { w: WithdrawalRow }) {
  return (
    <li className="border-b border-scree/40 py-4 last:border-0">
      <div className="flex items-baseline justify-between gap-3">
        <span
          className={`tnum font-display text-lg font-semibold ${
            w.state === "paid" ? "text-summit" : "text-snow"
          }`}
        >
          {zar(w.amountPaid ?? w.amount)}
        </span>
        <span className="shrink-0 text-caption text-sage">{w.label}</span>
      </div>
      <p className="mt-1 text-caption text-sage">{w.blurb}</p>
      {!w.terminal && <Rail progress={w.progress} />}
      {w.scheduledFor && !w.terminal && (
        <p className="mt-2 text-caption text-sage">
          In the payment run on{" "}
          <span className="text-snow">{longDate(w.scheduledFor)}</span>.
        </p>
      )}
      {w.amountPaid !== null && w.amountPaid !== w.amount && (
        <p className="mt-2 text-caption text-sage">
          You asked for {zar(w.amount)}; {zar(w.amountPaid)} landed. The difference is on the
          ledger.
        </p>
      )}
      {w.decisionReason && <p className="mt-2 text-caption text-snow/85">{w.decisionReason}</p>}
      {w.cancellable && (
        <form action={cancelWithdrawalForm} className="mt-3">
          <input type="hidden" name="id" value={w.id} />
          <button
            type="submit"
            className="text-caption text-sage underline decoration-scree underline-offset-4 transition hover:text-snow"
          >
            Cancel this withdrawal
          </button>
        </form>
      )}
    </li>
  );
}

export function DisputeCard({ d }: { d: DisputeRow }) {
  return (
    <li className="border-b border-scree/40 py-4 last:border-0">
      <div className="flex items-baseline justify-between gap-3">
        <span className="min-w-0 flex-1 text-body text-snow">{CATEGORY_LABEL[d.category] ?? d.category}</span>
        <span className="shrink-0 text-caption text-sage">{d.label}</span>
      </div>
      <p className="mt-1 text-caption text-sage">{d.summary}</p>
      {d.resolution && (
        <p className="mt-2 rounded-field bg-ridge px-3 py-2.5 text-caption text-snow/85">
          {d.resolution}
        </p>
      )}
      {d.messages.length > 0 && (
        <p className="mt-2 text-micro uppercase text-sage/70">
          {d.messages.length} {d.messages.length === 1 ? "message" : "messages"}
        </p>
      )}
      <Link
        href={`/commit/wallet/disputes/${d.id}`}
        className="mt-2 inline-block text-caption text-sage underline decoration-scree underline-offset-4 transition hover:text-snow"
      >
        Open
      </Link>
    </li>
  );
}

export const CATEGORY_LABEL: Record<string, string> = {
  verification_rejected: "A day was not counted",
  payout_amount: "The payout amount is wrong",
  payout_missing: "A payout never arrived",
  deposit_missing: "A deposit never arrived",
  settlement_outcome: "The challenge settled wrongly",
  other: "Something else",
};

export function longDate(iso: string): string {
  return new Date(`${iso.slice(0, 10)}T00:00:00Z`).toLocaleDateString("en-ZA", {
    day: "numeric",
    month: "long",
    timeZone: "UTC",
  });
}
