"use client";

import { useFormState, useFormStatus } from "react-dom";
import { confirmAge, type GateState } from "./actions";
import { Card, Button, ErrorNote } from "@/components/ui";

function Submit() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" disabled={pending}>
      {pending ? "Confirming…" : "I'm 18 or older — continue"}
    </Button>
  );
}

/**
 * 18+ gate. Sits in front of the whole feature because of the dating-profile use
 * case, rather than appearing as a checkbox deeper in the flow.
 */
export function AgeGate() {
  const [state, formAction] = useFormState<GateState, FormData>(confirmAge, {});

  return (
    <Card className="ring-1 ring-scree">
      <p className="font-display text-lg font-medium text-snow">This one is 18+</p>
      <p className="mt-2 text-body text-sage">
        Glow Up reviews photos of you, and is often used for dating profiles, so it&apos;s only
        available to adults. You&apos;ll also confirm at upload that the photos are of you and
        nobody else.
      </p>
      <form action={formAction} className="mt-5 space-y-3">
        <ErrorNote>{state.error}</ErrorNote>
        <Submit />
      </form>
    </Card>
  );
}
