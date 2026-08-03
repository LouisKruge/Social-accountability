"use client";

import { useFormState, useFormStatus } from "react-dom";
import { logEntry, type ActionState } from "@/app/groups/[id]/actions";
import { Field, ErrorNote } from "@/components/ui";

/**
 * The commit button doubles as the confirmation moment: on submit it draws a
 * short ascent line rather than firing a generic toast. Copy stays consistent
 * with the action ("Log entry" → "Entry logged").
 */
function Submit({ first }: { first: boolean }) {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className="inline-flex w-full items-center justify-center gap-2.5 rounded-field bg-summit px-4 py-4 text-sm font-semibold text-valley transition hover:bg-summit-soft disabled:cursor-not-allowed disabled:bg-summit-deep"
    >
      {pending ? (
        <>
          <svg viewBox="0 0 40 16" className="h-4 w-10" aria-hidden="true">
            <path
              className="ascent-path motion-safe:animate-draw"
              d="M2 13 C 12 13, 14 5, 22 5 S 32 3, 38 3"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.5"
              strokeLinecap="round"
              pathLength={1}
              strokeDasharray="1"
              style={{ ["--dash" as string]: "1" }}
            />
          </svg>
          Logging…
        </>
      ) : first ? (
        "Set my baseline"
      ) : (
        "Log entry"
      )}
    </button>
  );
}

export function LogEntryForm({
  groupId,
  categoryId,
  unit,
  metricType,
  hasBaseline,
  existingValue,
  existingShare,
}: {
  groupId: string;
  categoryId: string;
  unit: string | null;
  metricType: "percentage_change" | "streak";
  hasBaseline: boolean;
  existingValue: number | null;
  existingShare: boolean;
}) {
  const [state, formAction] = useFormState<ActionState, FormData>(logEntry, {});
  const first = !hasBaseline;

  const label =
    metricType === "streak"
      ? `Days running${unit && unit !== "days" ? ` (${unit})` : ""}`
      : `This week's number${unit ? ` (${unit})` : ""}`;

  return (
    <form action={formAction} className="space-y-5">
      <input type="hidden" name="group_id" value={groupId} />
      <input type="hidden" name="category_id" value={categoryId} />

      {first && (
        <p className="rounded-field bg-ice/10 px-4 py-3.5 text-body text-ice ring-1 ring-ice/20">
          This first number is your baseline — the line you climb from. Nobody sees it.
        </p>
      )}

      <Field
        label={label}
        name="raw_value"
        type="number"
        inputMode="decimal"
        step="any"
        min="0"
        autoFocus
        defaultValue={existingValue ?? ""}
        required
      />

      <label className="flex cursor-pointer items-start gap-3 rounded-field bg-slope p-4 ring-1 ring-scree">
        <input
          type="checkbox"
          name="share_raw_value"
          defaultChecked={existingShare}
          className="mt-0.5 h-4 w-4 shrink-0 rounded border-scree bg-valley accent-ice"
        />
        <span className="text-sm text-snow/90">
          Show my actual number to the group
          <span className="mt-1 block text-meta text-sage">
            Off by default. Your rank and % still show either way.
          </span>
        </span>
      </label>

      <ErrorNote>{state.error}</ErrorNote>
      <Submit first={first} />
    </form>
  );
}
