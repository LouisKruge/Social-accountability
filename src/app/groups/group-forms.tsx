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
      <div className="mb-4 grid grid-cols-2 gap-1 rounded-xl bg-slate-100 p-1">
        <button
          onClick={() => setTab("create")}
          className={`rounded-lg py-2 text-sm font-semibold transition ${
            tab === "create" ? "bg-white text-brand-700 shadow-sm" : "text-slate-500"
          }`}
        >
          Create
        </button>
        <button
          onClick={() => setTab("join")}
          className={`rounded-lg py-2 text-sm font-semibold transition ${
            tab === "join" ? "bg-white text-brand-700 shadow-sm" : "text-slate-500"
          }`}
        >
          Join
        </button>
      </div>

      {tab === "create" ? (
        <form action={createAction} className="space-y-3">
          <Field label="Group name" name="name" placeholder="Payday Warriors" required />
          <ErrorNote>{createState.error}</ErrorNote>
          <Submit label="Create group" pendingLabel="Creating…" />
        </form>
      ) : (
        <form action={joinAction} className="space-y-3">
          <Field
            label="Invite code"
            name="invite_code"
            placeholder="e.g. a1b2c3d4"
            autoCapitalize="none"
            required
          />
          <ErrorNote>{joinState.error}</ErrorNote>
          <Submit label="Join group" pendingLabel="Joining…" />
        </form>
      )}
    </Card>
  );
}
