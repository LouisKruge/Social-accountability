"use client";

import { useState } from "react";
import { useFormState, useFormStatus } from "react-dom";
import { createReport, type NewReportState } from "./actions";
import { Button, Card, ErrorNote, Field } from "@/components/ui";

const GOALS = [
  { value: "dating_profile", label: "Dating profile", hint: "Photos that read well on apps" },
  { value: "job_interview", label: "Job interview", hint: "Looking credible and put together" },
  { value: "general_confidence", label: "General confidence", hint: "Day-to-day presentation" },
] as const;

const TIERS = [
  { value: "low", label: "Budget", hint: "R150–R600 an item" },
  { value: "mid", label: "Middle", hint: "R600–R1 500 an item" },
  { value: "high", label: "Premium", hint: "R1 500+ an item" },
] as const;

function Submit() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" disabled={pending}>
      {pending ? "Setting up…" : "Continue to photos"}
    </Button>
  );
}

export function NewReportForm() {
  const [state, formAction] = useFormState<NewReportState, FormData>(createReport, {});
  const [goal, setGoal] = useState<string>(GOALS[0].value);
  const [tier, setTier] = useState<string>(TIERS[1].value);

  return (
    <form action={formAction} className="space-y-7">
      <input type="hidden" name="goal" value={goal} />
      <input type="hidden" name="budget_tier" value={tier} />

      <fieldset>
        <legend className="mb-3 text-xs uppercase tracking-[0.16em] text-sage">
          What&apos;s this for?
        </legend>
        <div className="space-y-2">
          {GOALS.map((g) => (
            <button
              key={g.value}
              type="button"
              onClick={() => setGoal(g.value)}
              aria-pressed={goal === g.value}
              className={`flex w-full flex-col items-start rounded-card px-4 py-3.5 text-left ring-1 transition ${
                goal === g.value
                  ? "bg-slope ring-ice/40"
                  : "bg-slope/50 ring-scree hover:bg-ridge"
              }`}
            >
              <span className={`text-sm ${goal === g.value ? "text-ice" : "text-snow/90"}`}>
                {g.label}
              </span>
              <span className="mt-0.5 text-xs text-sage">{g.hint}</span>
            </button>
          ))}
        </div>
      </fieldset>

      <fieldset>
        <legend className="mb-3 text-xs uppercase tracking-[0.16em] text-sage">
          What can you spend?
        </legend>
        <div className="grid grid-cols-3 gap-2">
          {TIERS.map((t) => (
            <button
              key={t.value}
              type="button"
              onClick={() => setTier(t.value)}
              aria-pressed={tier === t.value}
              className={`rounded-card px-2 py-3 text-center ring-1 transition ${
                tier === t.value ? "bg-slope ring-ice/40" : "bg-slope/50 ring-scree hover:bg-ridge"
              }`}
            >
              <span className={`block text-sm ${tier === t.value ? "text-ice" : "text-snow/90"}`}>
                {t.label}
              </span>
              <span className="mt-0.5 block text-[0.65rem] leading-tight text-sage">{t.hint}</span>
            </button>
          ))}
        </div>
      </fieldset>

      <Field
        label="Anything about your style? (optional)"
        name="style_preference"
        placeholder="Smart casual, nothing too tight"
      />

      <Card className="ring-1 ring-scree">
        <label className="flex cursor-pointer items-start gap-3">
          <input
            type="checkbox"
            name="consent"
            className="mt-0.5 h-4 w-4 shrink-0 rounded border-scree bg-valley accent-ice"
          />
          <span className="text-sm leading-relaxed text-snow/90">
            The photos I upload are of me, and nobody else.
            <span className="mt-1.5 block text-xs leading-relaxed text-sage">
              Ascend only reviews your own photos. Uploading someone else&apos;s isn&apos;t
              supported and isn&apos;t allowed.
            </span>
          </span>
        </label>
      </Card>

      <ErrorNote>{state.error}</ErrorNote>
      <Submit />
    </form>
  );
}
