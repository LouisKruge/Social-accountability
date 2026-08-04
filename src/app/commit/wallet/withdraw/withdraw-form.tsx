"use client";

import { useFormState, useFormStatus } from "react-dom";
import { Button, ErrorNote, Field, SuccessNote } from "@/components/ui";
import { zar } from "@/lib/format";
import { requestWithdrawal, type TreasuryState } from "../actions";

function Submit({ allowed }: { allowed: boolean }) {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" variant="secondary" disabled={pending || !allowed}>
      {pending ? "Submitting…" : "Request this withdrawal"}
    </Button>
  );
}

/**
 * The withdrawal form.
 *
 * The button is disabled when the checks do not pass, but the server re-runs
 * every one of them against balances it reads itself. A disabled button is a
 * courtesy to the person, not a security control — the form is an attacker's
 * input and is treated as one.
 */
export function WithdrawForm({
  allowed,
  ceiling,
  nextRun,
}: {
  allowed: boolean;
  ceiling: number;
  nextRun: string;
}) {
  const [state, formAction] = useFormState<TreasuryState, FormData>(requestWithdrawal, {});

  return (
    <form action={formAction} className="space-y-5">
      <Field
        label="Amount"
        name="amount"
        inputMode="decimal"
        required
        defaultValue={ceiling > 0 ? String(Math.floor(ceiling)) : ""}
        hint={`${zar(ceiling)} is cleared. The minimum is R50.`}
      />

      <ErrorNote>{state.error}</ErrorNote>
      {state.ok && (
        <SuccessNote>
          Requested. It goes into the payment run on {nextRun}, and you can cancel it any time
          before it leaves.
        </SuccessNote>
      )}

      <Submit allowed={allowed} />
    </form>
  );
}
