"use client";

import { useState } from "react";
import { useFormState, useFormStatus } from "react-dom";
import { createCategory, type ActionState } from "./actions";
import { Button, Field, ErrorNote, SuccessNote } from "@/components/ui";

function Submit() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" disabled={pending}>
      {pending ? "Adding…" : "Add pitch"}
    </Button>
  );
}

const PRESETS = [
  { key: "steps", name: "Steps", metric_type: "percentage_change", direction: "increase", unit: "steps" },
  { key: "savings", name: "Savings", metric_type: "percentage_change", direction: "increase", unit: "ZAR" },
  { key: "debt", name: "Debt paydown", metric_type: "percentage_change", direction: "decrease", unit: "ZAR" },
  { key: "habit", name: "Daily habit", metric_type: "streak", direction: "increase", unit: "days" },
] as const;

export function CategoryForm({ groupId }: { groupId: string }) {
  const [state, formAction] = useFormState<ActionState, FormData>(createCategory, {});
  const [preset, setPreset] = useState<(typeof PRESETS)[number]>(PRESETS[0]);

  return (
    <div>
      <div className="mb-5 flex flex-wrap gap-2">
        {PRESETS.map((p) => (
          <button
            key={p.key}
            type="button"
            onClick={() => setPreset(p)}
            aria-pressed={preset.key === p.key}
            className={`rounded-pill px-4 py-2 text-caption transition ${
              preset.key === p.key
                ? "bg-snow font-medium text-valley"
                : "bg-ridge text-sage ring-1 ring-scree hover:text-snow"
            }`}
          >
            {p.name}
          </button>
        ))}
      </div>

      <form action={formAction} className="space-y-4">
        <input type="hidden" name="group_id" value={groupId} />
        <input type="hidden" name="metric_type" value={preset.metric_type} />
        <input type="hidden" name="direction" value={preset.direction} />
        <Field label="Name" name="name" defaultValue={preset.name} key={`${preset.key}-name`} required />
        <Field
          label="Unit"
          name="unit"
          defaultValue={preset.unit}
          key={`${preset.key}-unit`}
          hint={
            preset.metric_type === "streak"
              ? "Longest run wins."
              : preset.direction === "decrease"
                ? "Lower is better — ranked by how much you bring it down from your baseline."
                : "Higher is better — ranked by how far you climb from your baseline."
          }
        />
        <ErrorNote>{state.error}</ErrorNote>
        <SuccessNote>{state.success}</SuccessNote>
        <Submit />
      </form>
    </div>
  );
}
