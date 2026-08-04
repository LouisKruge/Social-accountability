"use client";

import { useState } from "react";
import { useFormState, useFormStatus } from "react-dom";
import { Button, ErrorNote } from "@/components/ui";
import { CATEGORY_LABEL } from "@/components/treasury-ui";
import { openDispute, type TreasuryState } from "../../actions";

function Submit() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" variant="secondary" disabled={pending}>
      {pending ? "Logging…" : "Open the dispute"}
    </Button>
  );
}

export interface Subject {
  kind: "cohort" | "deposit" | "withdrawal";
  id: string;
  label: string;
  detail: string;
}

/**
 * Opening a dispute.
 *
 * The subject is picked from things that actually exist on the account rather
 * than typed. A free-text "what is this about" produces disputes nobody can
 * act on, which wastes the time of the person who is already unhappy.
 */
export function DisputeForm({ subjects }: { subjects: Subject[] }) {
  const [state, formAction] = useFormState<TreasuryState, FormData>(openDispute, {});
  const [picked, setPicked] = useState<string>(subjects[0] ? key(subjects[0]) : "");

  const chosen = subjects.find((s) => key(s) === picked) ?? null;

  return (
    <form action={formAction} className="space-y-6">
      <fieldset>
        <legend className="mb-3 text-sm font-medium text-sage">What is this about?</legend>
        <ul className="space-y-2">
          {subjects.map((s) => (
            <li key={key(s)}>
              <label
                className={`flex cursor-pointer items-baseline justify-between gap-3 rounded-field px-4 py-3 ring-1 transition ${
                  picked === key(s) ? "bg-ridge text-snow ring-ice/30" : "bg-valley text-sage ring-scree"
                }`}
              >
                <span className="min-w-0">
                  <span className="block truncate text-body">{s.label}</span>
                  <span className="mt-0.5 block text-caption text-sage">{s.detail}</span>
                </span>
                <input
                  type="radio"
                  name="subject"
                  className="sr-only"
                  checked={picked === key(s)}
                  onChange={() => setPicked(key(s))}
                />
              </label>
            </li>
          ))}
        </ul>
      </fieldset>

      {/* Exactly one of these carries a value — the schema enforces the same. */}
      <input type="hidden" name="cohort_id" value={chosen?.kind === "cohort" ? chosen.id : ""} />
      <input type="hidden" name="deposit_id" value={chosen?.kind === "deposit" ? chosen.id : ""} />
      <input
        type="hidden"
        name="withdrawal_id"
        value={chosen?.kind === "withdrawal" ? chosen.id : ""}
      />

      <label className="block">
        <span className="mb-2 block text-sm font-medium text-sage">What went wrong?</span>
        <select
          name="category"
          defaultValue="settlement_outcome"
          className="w-full rounded-field bg-valley px-4 py-3.5 text-base text-snow ring-1 ring-scree focus:ring-2 focus:ring-ice"
        >
          {Object.entries(CATEGORY_LABEL).map(([value, label]) => (
            <option key={value} value={value}>
              {label}
            </option>
          ))}
        </select>
      </label>

      <label className="block">
        <span className="mb-2 block text-sm font-medium text-sage">In your own words</span>
        <textarea
          name="summary"
          rows={5}
          required
          minLength={10}
          maxLength={2000}
          placeholder="I logged 12,400 steps on the 14th and it wasn't counted."
          className="w-full rounded-field bg-valley px-4 py-3.5 text-base text-snow ring-1 ring-scree placeholder:text-sage/50 focus:ring-2 focus:ring-ice"
        />
        <span className="mt-2 block text-xs text-sage/80">
          Dates and figures help most. You can add evidence after it is open.
        </span>
      </label>

      <ErrorNote>{state.error}</ErrorNote>
      <Submit />
    </form>
  );
}

function key(s: Subject): string {
  return `${s.kind}:${s.id}`;
}
