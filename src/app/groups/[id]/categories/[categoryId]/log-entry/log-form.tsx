"use client";

import { useFormState, useFormStatus } from "react-dom";
import { logEntry, type ActionState } from "@/app/groups/[id]/actions";
import { Button, Field, ErrorNote } from "@/components/ui";

function Submit({ first }: { first: boolean }) {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" disabled={pending}>
      {pending ? "Saving…" : first ? "Set baseline & log" : "Log this week"}
    </Button>
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
      ? `Current streak${unit ? ` (${unit})` : ""}`
      : `This week's value${unit ? ` (${unit})` : ""}`;

  return (
    <form action={formAction} className="space-y-4">
      <input type="hidden" name="group_id" value={groupId} />
      <input type="hidden" name="category_id" value={categoryId} />

      {first && (
        <p className="rounded-xl border border-brand-100 bg-brand-50 px-3 py-2 text-sm text-brand-800">
          This is your first entry — it sets your <strong>baseline</strong>. You&apos;ll climb the
          leaderboard by improving on it from here.
        </p>
      )}

      <Field
        label={label}
        name="raw_value"
        type="number"
        inputMode="decimal"
        step="any"
        min="0"
        defaultValue={existingValue ?? ""}
        required
      />

      <label className="flex items-start gap-3 rounded-xl border border-slate-200 bg-white p-3">
        <input
          type="checkbox"
          name="share_raw_value"
          defaultChecked={existingShare}
          className="mt-1 h-4 w-4 rounded border-slate-300 text-brand-600"
        />
        <span className="text-sm text-slate-700">
          Show my actual number to the group
          <span className="block text-xs text-slate-400">
            Off by default — only your rank and % change are shared.
          </span>
        </span>
      </label>

      <ErrorNote>{state.error}</ErrorNote>
      <Submit first={first} />
    </form>
  );
}
