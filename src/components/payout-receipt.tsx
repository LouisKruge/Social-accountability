import { Card } from "./ui";
import { Pool } from "./pool";

const zar = (n: number) =>
  `R${n.toLocaleString("en-ZA", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

/**
 * The payout receipt — Commit's most important screen.
 *
 * Shows the whole calculation, fee included, in the order it actually happens.
 * Hiding or burying the fee is what makes a mechanic like this feel rigged;
 * showing it is what makes someone come back for a second cohort. Reads as a
 * receipt on purpose — precise, numeric, unexcited.
 *
 * This is the ONLY place in Commit where gold appears, and only on money that
 * is actually confirmed as yours.
 */
export function PayoutReceipt({
  totalPool,
  feeRate,
  platformFee,
  distributablePool,
  winnerCount,
  participantCount,
  yourAmount,
  outcome,
  status,
}: {
  totalPool: number;
  feeRate: number;
  platformFee: number;
  distributablePool: number;
  winnerCount: number;
  participantCount: number;
  yourAmount: number | null;
  outcome: "mixed" | "no_winners" | "all_winners";
  status: "pending" | "paid" | "failed";
}) {
  const rows: [string, string][] =
    outcome === "no_winners"
      ? [
          ["Total pool", zar(totalPool)],
          [`Platform fee`, "R0.00 — no fee on a refunded round"],
          ["Winners", "0"],
          ["Refunded to each person", "their full stake"],
        ]
      : [
          ["Total pool", zar(totalPool)],
          [`Platform fee (${Math.round(feeRate * 100)}%)`, `− ${zar(platformFee)}`],
          ["Distributable pool", zar(distributablePool)],
          ["Winners", `${winnerCount} of ${participantCount}`],
          ["Split per winner", zar(distributablePool / Math.max(1, winnerCount))],
        ];

  return (
    <div>
      {outcome === "no_winners" && (
        <Card className="mb-4">
          <p className="text-body text-snow/90">
            Nobody reached the target this round, so there&apos;s nothing to share out. Every stake
            is being refunded in full and no fee was taken.
          </p>
        </Card>
      )}

      {outcome === "all_winners" && (
        <Card className="mb-4">
          <p className="text-body text-snow/90">
            Everyone hit their goal this round — so there were no forfeited stakes to share out.
            Your share is the pool minus the {Math.round(feeRate * 100)}% fee, which comes back a
            little under what you put in.
          </p>
        </Card>
      )}

      <Card>
        <p className="mb-4 text-micro uppercase text-sage">How this was worked out</p>
        <dl className="space-y-2.5">
          {rows.map(([k, v]) => (
            <div key={k} className="flex items-baseline justify-between gap-4">
              <dt className="text-sm text-sage">{k}</dt>
              <dd className="tnum text-right text-sm text-snow/90">{v}</dd>
            </div>
          ))}
        </dl>

        {yourAmount !== null && (
          <div className="mt-4 border-t border-scree/60 pt-4">
            <div className="flex items-baseline justify-between gap-4">
              <dt className="text-sm text-snow">
                {outcome === "no_winners" ? "Your refund" : "Your payout"}
              </dt>
              {/* the one gold figure in Commit: real money, confirmed */}
              <dd
                className={`tnum font-display text-2xl font-semibold tracking-tight ${
                  status === "paid" ? "text-summit" : "text-snow"
                }`}
              >
                {zar(yourAmount)}
              </dd>
            </div>
            <p className="mt-2 text-right text-xs text-sage">
              {status === "paid"
                ? "Paid to your account"
                : status === "failed"
                  ? "Payment failed — we'll be in touch"
                  : "Being paid by EFT within 3 working days"}
            </p>
          </div>
        )}
      </Card>

      <div className="mt-5">
        <Pool
          filled={distributablePool}
          capacity={Math.max(totalPool, 1)}
          participants={winnerCount}
          confirmed={status === "paid"}
          height={88}
        />
        <p className="mt-2 text-center text-xs text-sage">
          {outcome === "no_winners"
            ? `${zar(totalPool)} going back to ${participantCount} people`
            : `${zar(distributablePool)} shared between ${winnerCount} ${winnerCount === 1 ? "winner" : "winners"}`}
        </p>
      </div>
    </div>
  );
}
