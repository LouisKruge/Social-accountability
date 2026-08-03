"use client";

import { useState } from "react";
import { useFormState, useFormStatus } from "react-dom";
import { createGroup, joinGroup, type ActionState } from "./actions";
import { Button, Field, ErrorNote } from "@/components/ui";

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
    <div>
      {/* A segmented control, not two cards. The selected half is simply the
          brightest thing in the row — hierarchy by brightness, per §2. */}
      <div className="mb-5 grid grid-cols-2 gap-1 rounded-field bg-slope p-1">
        {(["create", "join"] as const).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            aria-pressed={tab === t}
            className={`min-h-[2.75rem] rounded-[0.65rem] text-body transition ${
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
    </div>
  );
}
