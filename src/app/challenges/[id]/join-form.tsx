"use client";

import { useFormState, useFormStatus } from "react-dom";
import { joinCohort, logSteps, type StakeState } from "./actions";
import { Button, ErrorNote, Field, Card } from "@/components/ui";

function Submit({ label, pendingLabel }: { label: string; pendingLabel: string }) {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" disabled={pending}>
      {pending ? pendingLabel : label}
    </Button>
  );
}

export function JoinForm({ cohortId, stakeAmount }: { cohortId: string; stakeAmount: number }) {
  const [state, formAction] = useFormState<StakeState, FormData>(joinCohort, {});

  return (
    <form action={formAction} className="space-y-4">
      <input type="hidden" name="cohort_id" value={cohortId} />

      <label className="flex cursor-pointer items-start gap-3 rounded-field bg-valley p-4 ring-1 ring-scree">
        <input
          type="checkbox"
          name="agree"
          className="mt-0.5 h-4 w-4 shrink-0 rounded border-scree bg-valley accent-summit"
        />
        <span className="text-sm leading-relaxed text-snow/90">
          I understand I&apos;m putting R{stakeAmount} on this, and that I lose it if I don&apos;t
          hit the target.
          <span className="mt-1.5 block text-xs leading-relaxed text-sage">
            Winners are decided only by your own verified steps. If nobody hits the target,
            everyone is refunded in full.
          </span>
        </span>
      </label>

      <ErrorNote>{state.error}</ErrorNote>
      <Submit label={`Stake R${stakeAmount}`} pendingLabel="Joining…" />
    </form>
  );
}

export function LogStepsForm({
  cohortId,
  stakeId,
  today,
  existing,
}: {
  cohortId: string;
  stakeId: string;
  today: string;
  existing: number | null;
}) {
  const [state, formAction] = useFormState<StakeState, FormData>(logSteps, {});

  return (
    <Card>
      <p className="mb-4 text-sm font-medium text-snow">Log today&apos;s steps</p>
      <form action={formAction} className="space-y-4">
        <input type="hidden" name="cohort_id" value={cohortId} />
        <input type="hidden" name="stake_id" value={stakeId} />
        <input type="hidden" name="log_date" value={today} />
        <Field
          label="Steps today"
          name="steps"
          type="number"
          inputMode="numeric"
          min="0"
          step="1"
          defaultValue={existing ?? ""}
          required
        />
        <ErrorNote>{state.error}</ErrorNote>
        <Submit label={existing !== null ? "Update today" : "Log steps"} pendingLabel="Saving…" />
      </form>
      <p className="mt-3 text-xs leading-relaxed text-sage">
        Self-reported while we finish the wearable sync. Only you can log against your stake.
      </p>
    </Card>
  );
}
