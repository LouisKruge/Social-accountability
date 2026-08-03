"use client";

import { useState } from "react";
import { useFormState, useFormStatus } from "react-dom";
import { Button, Field, ErrorNote } from "@/components/ui";
import { EVENT_LABEL, type EventKind } from "@/lib/events";
import { createEvent, type EventState } from "../actions";

const KINDS = Object.entries(EVENT_LABEL) as [EventKind, string][];

function Submit() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" disabled={pending}>
      {pending ? "Building the plan…" : "Build the plan"}
    </Button>
  );
}

export function EventForm({ today }: { today: string }) {
  const [state, action] = useFormState<EventState, FormData>(createEvent, {});
  const [kind, setKind] = useState<EventKind>("interview");

  return (
    <form action={action} className="space-y-block">
      <div>
        <p className="mb-3 text-micro uppercase text-sage">What is it?</p>
        <div className="flex flex-wrap gap-2">
          {KINDS.map(([key, label]) => (
            <button
              key={key}
              type="button"
              onClick={() => setKind(key)}
              aria-pressed={kind === key}
              className={`rounded-pill px-4 py-2 text-caption transition ${
                kind === key
                  ? "bg-snow font-medium text-valley"
                  : "bg-ridge text-sage ring-1 ring-scree hover:text-snow"
              }`}
            >
              {label}
            </button>
          ))}
        </div>
        <input type="hidden" name="kind" value={kind} />
      </div>

      <Field
        label="Name it"
        name="title"
        placeholder="Standard Bank, second round"
        maxLength={120}
        required
      />

      <Field
        label="When"
        name="event_date"
        type="date"
        min={today}
        required
        hint="Ascend works backwards from this date, so it has to be right."
      />

      <Field
        label="Anything worth remembering"
        name="notes"
        placeholder="Optional — dress code, who you're meeting, what it's for"
      />

      <ErrorNote>{state.error}</ErrorNote>
      <Submit />
    </form>
  );
}
