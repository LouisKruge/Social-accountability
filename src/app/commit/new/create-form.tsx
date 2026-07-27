"use client";

import { useState } from "react";
import { useFormState, useFormStatus } from "react-dom";
import { Button, ErrorNote, Field } from "@/components/ui";
import { dailyPace, STAKE_MAX, STAKE_MIN } from "@/lib/cohort";
import { num } from "@/lib/format";
import { createCohort, type CreateCohortState } from "./actions";

function Submit() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" variant="secondary" disabled={pending}>
      {pending ? "Creating…" : "Publish challenge"}
    </Button>
  );
}

function FieldError({ children }: { children?: string }) {
  if (!children) return null;
  return (
    <p role="alert" className="mt-2 text-xs text-fall">
      {children}
    </p>
  );
}

export function CreateCohortForm({ today }: { today: string }) {
  const [state, formAction] = useFormState<CreateCohortState, FormData>(createCohort, {});
  const [target, setTarget] = useState(300_000);
  const [days, setDays] = useState(30);
  const [stake, setStake] = useState(150);

  const perDay = dailyPace(target, days);
  const errors = state.errors ?? {};

  return (
    <form action={formAction} className="space-y-5">
      <div>
        <Field
          label="Name"
          name="name"
          defaultValue="30-day steps"
          maxLength={60}
          required
          hint="What people will see in the list."
        />
        <FieldError>{errors.name}</FieldError>
      </div>

      <div>
        <Field
          label="Step target"
          name="target_value"
          type="number"
          inputMode="numeric"
          min="10000"
          step="1000"
          value={target}
          onChange={(e) => setTarget(Number(e.target.value))}
          required
          hint="Total steps over the whole window, not per day."
        />
        <FieldError>{errors.targetValue}</FieldError>
      </div>

      <div>
        <Field
          label="Runs for"
          name="days"
          type="number"
          inputMode="numeric"
          min="3"
          max="90"
          step="1"
          value={days}
          onChange={(e) => setDays(Number(e.target.value))}
          required
          hint="Days, counting the first one."
        />
        <FieldError>{errors.days}</FieldError>
      </div>

      {/* What the creator is actually asking of people. Shown while they type,
          because "300 000 steps" means nothing until it is per-day. */}
      <div className="rounded-field bg-valley p-4 ring-1 ring-scree">
        <p className="text-[0.62rem] uppercase tracking-[0.14em] text-sage">That works out to</p>
        <p className="tnum mt-1 font-display text-2xl font-semibold text-snow">
          {num(perDay)} <span className="text-sm font-normal text-sage">steps a day</span>
        </p>
        <p className="mt-1.5 text-xs leading-relaxed text-sage">
          {perDay === 0
            ? "Set a target and a window to see the daily pace."
            : perDay < 6_000
              ? "A gentle one — most people walk this without changing much."
              : perDay < 9_000
                ? "Steady. Roughly an hour of walking on top of a normal day."
                : perDay < 13_000
                  ? "Serious. This needs planning most days."
                  : "Elite. Very few people keep this up for a full window."}
        </p>
      </div>

      <div>
        <Field
          label="Stake per person"
          name="stake_amount"
          type="number"
          inputMode="numeric"
          min={STAKE_MIN}
          max={STAKE_MAX}
          step="10"
          value={stake}
          onChange={(e) => setStake(Number(e.target.value))}
          required
          hint={`R${STAKE_MIN}–R${STAKE_MAX}. Everyone who joins stakes the same amount.`}
        />
        <FieldError>{errors.stakeAmount}</FieldError>
      </div>

      <div>
        <Field
          label="Starts"
          name="start_date"
          type="date"
          defaultValue={today}
          min={today}
          required
          hint="People can join until it starts."
        />
        <FieldError>{errors.startDate}</FieldError>
      </div>

      <ErrorNote>{state.formError}</ErrorNote>

      <Submit />

      <p className="text-xs leading-relaxed text-sage">
        Publishing this costs you nothing and stakes you nothing. You join it the same way everyone
        else does, and creating it gives you no advantage in it.
      </p>
    </form>
  );
}
