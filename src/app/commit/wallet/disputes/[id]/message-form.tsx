"use client";

import { useFormState, useFormStatus } from "react-dom";
import { Button, ErrorNote } from "@/components/ui";
import { addDisputeMessage, type TreasuryState } from "../../actions";

function Submit() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" variant="secondary" disabled={pending}>
      {pending ? "Adding…" : "Add this"}
    </Button>
  );
}

export function MessageForm({ disputeId }: { disputeId: string }) {
  const [state, formAction] = useFormState<TreasuryState, FormData>(addDisputeMessage, {});

  return (
    <form action={formAction} className="space-y-4">
      <input type="hidden" name="dispute_id" value={disputeId} />
      <label className="block">
        <span className="mb-2 block text-sm font-medium text-sage">Add to your case</span>
        <textarea
          name="body"
          rows={4}
          required
          maxLength={4000}
          className="w-full rounded-field bg-valley px-4 py-3.5 text-base text-snow ring-1 ring-scree placeholder:text-sage/50 focus:ring-2 focus:ring-ice"
        />
      </label>
      <ErrorNote>{state.error}</ErrorNote>
      <Submit />
    </form>
  );
}
