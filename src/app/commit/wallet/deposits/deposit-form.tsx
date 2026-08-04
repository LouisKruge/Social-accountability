"use client";

import { useFormState, useFormStatus } from "react-dom";
import { Button, ErrorNote, Field } from "@/components/ui";
import { createDeposit, type TreasuryState } from "../actions";

function Submit({ custodial }: { custodial: boolean }) {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" variant="secondary" disabled={pending}>
      {pending ? "Working…" : custodial ? "Continue to payment" : "Get my payment reference"}
    </Button>
  );
}

/**
 * The deposit form.
 *
 * ── WHY THE BUTTON IS NOT GOLD ───────────────────────────────────────────────
 * Gold means money confirmed as yours. Asking for a payment reference confirms
 * nothing — the money has not moved and may never move. The one gold button in
 * Commit is the one that commits rand to a challenge.
 */
export function DepositForm({
  custodial,
  beneficiary,
}: {
  custodial: boolean;
  beneficiary: { accountName: string; bank: string; accountNumber: string; branchCode: string };
}) {
  const [state, formAction] = useFormState<TreasuryState, FormData>(createDeposit, {});

  return (
    <form action={formAction} className="space-y-5">
      <Field
        label="Amount"
        name="amount"
        inputMode="decimal"
        required
        placeholder="250"
        hint="Between R50 and R50,000."
      />

      <ErrorNote>{state.error}</ErrorNote>

      {state.ok && state.reference && (
        <div className="rounded-field bg-ridge px-4 py-4 ring-1 ring-scree">
          <p className="text-micro uppercase text-sage">Your reference</p>
          <p className="tnum mt-1.5 font-display text-title font-semibold tracking-wide text-snow">
            {state.reference}
          </p>
          <p className="mt-2 text-caption text-sage">
            Use it exactly as shown. It is the only thing tying your transfer to your account — a
            payment without it has to be matched by hand, which takes days rather than hours.
          </p>

          {!custodial && (
            <dl className="mt-4 space-y-2 border-t border-scree/60 pt-4">
              <Line label="Account name" value={beneficiary.accountName} />
              <Line label="Bank" value={beneficiary.bank} />
              <Line label="Account number" value={beneficiary.accountNumber} mono />
              <Line label="Branch code" value={beneficiary.branchCode} mono />
            </dl>
          )}
        </div>
      )}

      <Submit custodial={custodial} />
    </form>
  );
}

function Line({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <div className="flex items-baseline justify-between gap-4">
      <dt className="shrink-0 text-caption text-sage">{label}</dt>
      <dd className={`min-w-0 truncate text-right text-body text-snow ${mono ? "tnum" : ""}`}>
        {value}
      </dd>
    </div>
  );
}
