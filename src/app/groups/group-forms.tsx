"use client";

import { useState } from "react";
import { useFormState, useFormStatus } from "react-dom";
import { createGroup, joinGroup, type ActionState } from "./actions";
import { Button, Field, ErrorNote, Card } from "@/components/ui";

function Submit({ label, pendingLabel }: { label: string; pendingLabel: string }) {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" disabled={pending}>
      {pending ? pendingLabel : label}
    </Button>
  );
}

export function CreateOrJoin() {
  const [tab, setTab] = useState<"create" | "join">("create");
  const [createState, createAction] = useFormState<ActionState, FormData>(createGroup, {});
  const [joinState, joinAction] = useFormState<ActionState, FormData>(joinGroup, {});

  return (
    <Card>
      <div className="mb-5 grid grid-cols-2 gap-1 rounded-field bg-valley p-1">
        {(["create", "join"] as const).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            aria-pressed={tab === t}
            className={`rounded-[0.65rem] py-2.5 text-sm transition ${
              tab === t ? "bg-ridge font-medium text-snow" : "text-sage hover:text-snow"
            }`}
          >
            {t === "create" ? "Create" : "Join"}
          </button>
        ))}
      </div>

      {tab === "create" ? (
        <form action={createAction} className="space-y-4">
          <Field label="Group name" name="name" placeholder="Payday Warriors" required />
          <ErrorNote>{createState.error}</ErrorNote>
          <Submit label="Create group" pendingLabel="Creating…" />
        </form>
      ) : (
        <form action={joinAction} className="space-y-4">
          <Field
            label="Invite code"
            name="invite_code"
            placeholder="a1b2c3d4"
            autoCapitalize="none"
            autoComplete="off"
            required
          />
          <ErrorNote>{joinState.error}</ErrorNote>
          <Submit label="Join group" pendingLabel="Joining…" />
        </form>
      )}
    </Card>
  );
}
