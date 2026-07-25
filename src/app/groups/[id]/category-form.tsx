"use client";

import { useState } from "react";
import { useFormState, useFormStatus } from "react-dom";
import { createCategory, type ActionState } from "./actions";
import { Button, Field, ErrorNote, SuccessNote, Card } from "@/components/ui";

function Submit() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" disabled={pending}>
      {pending ? "Adding…" : "Add category"}
    </Button>
  );
}

/** Preset templates make the common cases one tap; advanced users can tweak. */
const PRESETS = [
  { key: "steps", name: "Steps", metric_type: "percentage_change", direction: "increase", unit: "steps" },
  { key: "savings", name: "Savings", metric_type: "percentage_change", direction: "increase", unit: "ZAR" },
  { key: "debt", name: "Debt paydown", metric_type: "percentage_change", direction: "decrease", unit: "ZAR" },
  { key: "habit", name: "Daily habit streak", metric_type: "streak", direction: "increase", unit: "days" },
] as const;

export function CategoryForm({ groupId }: { groupId: string }) {
  const [state, formAction] = useFormState<ActionState, FormData>(createCategory, {});
  const [preset, setPreset] = useState<(typeof PRESETS)[number]>(PRESETS[0]);

  return (
    <Card>
      <p className="mb-3 text-sm font-semibold text-slate-800">Add a category to compete on</p>

      <div className="mb-3 flex flex-wrap gap-2">
        {PRESETS.map((p) => (
          <button
            key={p.key}
            type="button"
            onClick={() => setPreset(p)}
            className={`rounded-full px-3 py-1.5 text-xs font-medium transition ${
              preset.key === p.key
                ? "bg-brand-600 text-white"
                : "bg-slate-100 text-slate-600 hover:bg-slate-200"
            }`}
          >
            {p.name}
          </button>
        ))}
      </div>

      <form action={formAction} className="space-y-3">
        <input type="hidden" name="group_id" value={groupId} />
        <input type="hidden" name="metric_type" value={preset.metric_type} />
        <input type="hidden" name="direction" value={preset.direction} />
        <Field label="Name" name="name" defaultValue={preset.name} key={preset.key + "-name"} required />
        <Field
          label="Unit"
          name="unit"
          defaultValue={preset.unit}
          key={preset.key + "-unit"}
          hint={
            preset.metric_type === "streak"
              ? "Streak: longest run wins."
              : preset.direction === "decrease"
                ? "Lower is better — ranked by % reduction from your baseline."
                : "Higher is better — ranked by % growth from your baseline."
          }
        />
        <ErrorNote>{state.error}</ErrorNote>
        <SuccessNote>{state.success}</SuccessNote>
        <Submit />
      </form>
    </Card>
  );
}
