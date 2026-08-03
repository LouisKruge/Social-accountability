"use client";

import { useFormState, useFormStatus } from "react-dom";
import { Button, ErrorNote, Field } from "@/components/ui";
import { DIRECTION_LABEL, GOAL_LABEL, type StyleProfile } from "@/lib/studios";
import { saveStyleProfile, type ProfileState } from "./actions";

function Submit() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" variant="secondary" disabled={pending}>
      {pending ? "Saving…" : "Save and continue"}
    </Button>
  );
}

function Choice({
  name, options, defaultValue,
}: {
  name: string;
  options: [string, string][];
  defaultValue: string;
}) {
  return (
    <div className="flex flex-wrap gap-1.5">
      {options.map(([value, label]) => (
        <label key={value} className="cursor-pointer">
          <input
            type="radio"
            name={name}
            value={value}
            defaultChecked={value === defaultValue}
            className="peer sr-only"
          />
          <span className="block rounded-full bg-valley/60 px-3 py-1.5 text-caption text-sage ring-1 ring-scree/60 transition peer-checked:bg-snow/12 peer-checked:text-snow peer-checked:ring-snow/30 peer-focus-visible:ring-2 peer-focus-visible:ring-snow">
            {label}
          </span>
        </label>
      ))}
    </div>
  );
}

export function ProfileForm({ existing }: { existing: StyleProfile | null }) {
  const [state, formAction] = useFormState<ProfileState, FormData>(saveStyleProfile, {});

  return (
    <form action={formAction} className="space-y-7">
      <fieldset>
        <legend className="mb-2.5 text-sm font-medium text-snow">
          What are you getting ready for?
        </legend>
        <p className="mb-3 text-meta text-sage">
          An interview needs different advice from a first date. This changes every studio.
        </p>
        <Choice
          name="goal_mode"
          options={Object.entries(GOAL_LABEL) as [string, string][]}
          defaultValue={existing?.goalMode ?? "general_confidence"}
        />
      </fieldset>

      <fieldset>
        <legend className="mb-2.5 text-sm font-medium text-snow">
          How would you like to dress?
        </legend>
        <p className="mb-3 text-meta text-sage">
          Your call, not ours — Elevate never infers this from a photo of you.
        </p>
        <Choice
          name="direction"
          options={Object.entries(DIRECTION_LABEL) as [string, string][]}
          defaultValue={existing?.direction ?? "smart_casual"}
        />
      </fieldset>

      <fieldset>
        <legend className="mb-2.5 text-sm font-medium text-snow">What can you spend?</legend>
        <Choice
          name="budget_tier"
          options={[
            ["low", "R150–R600 an item"],
            ["mid", "R600–R1 500"],
            ["high", "R1 500+"],
          ]}
          defaultValue={existing?.budgetTier ?? "mid"}
        />
      </fieldset>

      <Field
        label="Anything we should never suggest"
        name="avoid"
        defaultValue={existing?.avoid.join(", ") ?? ""}
        placeholder="skinny jeans, anything pink, logos"
        hint="Comma separated. Elevate will not bring these up again."
      />

      <Field
        label="Anything else worth knowing"
        name="notes"
        defaultValue={existing?.notes ?? ""}
        placeholder="I'm on my feet all day; I hate ironing"
        hint="Optional, in your own words."
      />

      <ErrorNote>{state.error}</ErrorNote>
      <Submit />
    </form>
  );
}
