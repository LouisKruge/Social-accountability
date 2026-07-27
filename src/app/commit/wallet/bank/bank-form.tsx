"use client";

import { useFormState, useFormStatus } from "react-dom";
import { Button, ErrorNote, Field, SuccessNote } from "@/components/ui";
import { savePayoutDestination, type BankState } from "./actions";

function Submit() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" variant="secondary" disabled={pending}>
      {pending ? "Saving…" : "Save bank details"}
    </Button>
  );
}

export function BankForm({
  existing,
}: {
  existing: { holder: string; bank: string; last4: string; verified: boolean } | null;
}) {
  const [state, formAction] = useFormState<BankState, FormData>(savePayoutDestination, {});

  return (
    <form action={formAction} className="space-y-5">
      {existing && (
        <div className="rounded-field bg-valley p-4 ring-1 ring-scree">
          <p className="text-micro uppercase text-sage">On file</p>
          <p className="mt-1 text-sm text-snow">
            {existing.bank} ····{existing.last4}
          </p>
          <p className="mt-0.5 text-xs text-sage">
            {existing.holder} ·{" "}
            <span className={existing.verified ? "text-ice" : "text-summit"}>
              {existing.verified ? "verified" : "awaiting verification"}
            </span>
          </p>
        </div>
      )}

      <Field label="Name on the account" name="account_holder" required autoComplete="name" />
      <Field label="Bank" name="bank_name" required placeholder="Capitec, FNB, Standard Bank…" />
      <Field
        label="Account number"
        name="account_number"
        inputMode="numeric"
        required
        hint="We show only the last four digits anywhere in the app."
      />
      <Field label="Branch code" name="branch_code" inputMode="numeric" hint="Optional — six digits." />

      <ErrorNote>{state.error}</ErrorNote>
      {state.ok && (
        <SuccessNote>
          Saved. We&apos;ll verify the account belongs to you before your first payout.
        </SuccessNote>
      )}
      <Submit />

      <p className="text-meta text-sage">
        These details are visible only to you and to the person who processes payouts. Changing them
        is recorded in your account activity, so you can see it if someone else ever does.
      </p>
    </form>
  );
}
